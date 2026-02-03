import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import Database from "better-sqlite3";
import * as keytar from "keytar";
import { homedir } from "os";
import { join, dirname } from "path";
import { nanoid } from "nanoid";
import { existsSync, mkdirSync } from "fs";

const KEYCHAIN_SERVICE = "pincer-mcp";
const KEYCHAIN_ACCOUNT = "master-key";

export class VaultStore {
    private db: Database.Database;
    private masterKey: Buffer | null = null;

    constructor() {
        const vaultPath =
            process.env["VAULT_DB_PATH"] || join(homedir(), ".pincer", "vault.db");

        // Ensure directory exists
        const dir = dirname(vaultPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(vaultPath);

        // Initialize schema
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT UNIQUE NOT NULL,
        encrypted_value TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS proxy_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        proxy_token TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS agent_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        UNIQUE(agent_id, tool_name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_proxy_tokens ON proxy_tokens(proxy_token);
      CREATE INDEX IF NOT EXISTS idx_agent_mappings ON agent_mappings(agent_id, tool_name);
    `);
    }

    /**
     * TIER 1: Master Key Management (OS Keychain)
     */
    private async getMasterKey(): Promise<Buffer> {
        if (this.masterKey) {
            return this.masterKey;
        }

        // Try to retrieve from OS keychain
        const storedKey = await keytar.getPassword(
            KEYCHAIN_SERVICE,
            KEYCHAIN_ACCOUNT
        );

        if (!storedKey) {
            throw new Error(
                "Master key not found in keychain. Run 'npm run vault:init' to initialize."
            );
        }

        this.masterKey = Buffer.from(storedKey, "hex");

        if (this.masterKey.length !== 32) {
            throw new Error(
                "Invalid master key length (expected 32 bytes for AES-256)"
            );
        }

        return this.masterKey;
    }

    async initializeMasterKey(): Promise<void> {
        const existingKey = await keytar.getPassword(
            KEYCHAIN_SERVICE,
            KEYCHAIN_ACCOUNT
        );

        if (existingKey) {
            throw new Error(
                "Master key already exists. Delete it first to reinitialize."
            );
        }

        // Generate cryptographically secure 256-bit key
        const newKey = randomBytes(32);
        const keyHex = newKey.toString("hex");

        // Store in OS keychain
        await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, keyHex);

        console.log("✅ Master key initialized in OS keychain");
        console.log(`   Service: ${KEYCHAIN_SERVICE}`);
        console.log(`   Account: ${KEYCHAIN_ACCOUNT}`);
    }

    async deleteMasterKey(): Promise<void> {
        const deleted = await keytar.deletePassword(
            KEYCHAIN_SERVICE,
            KEYCHAIN_ACCOUNT
        );

        if (!deleted) {
            throw new Error("No master key found to delete");
        }

        this.masterKey = null;
        console.log("🗑️  Master key deleted from OS keychain");
    }

    /**
     * TIER 2: Secret Encryption/Decryption (AES-256-GCM)
     */
    private async encrypt(plaintext: string): Promise<EncryptedData> {
        const masterKey = await this.getMasterKey();
        const iv = randomBytes(12); // GCM standard nonce size
        const cipher = createCipheriv("aes-256-gcm", masterKey, iv);

        let ciphertext = cipher.update(plaintext, "utf8", "hex");
        ciphertext += cipher.final("hex");

        const authTag = cipher.getAuthTag();

        return {
            encryptedValue: ciphertext,
            iv: iv.toString("hex"),
            authTag: authTag.toString("hex"),
        };
    }

    private async decrypt(encrypted: EncryptedData): Promise<string> {
        const masterKey = await this.getMasterKey();
        const iv = Buffer.from(encrypted.iv, "hex");
        const authTag = Buffer.from(encrypted.authTag, "hex");

        const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
        decipher.setAuthTag(authTag);

        let plaintext = decipher.update(encrypted.encryptedValue, "hex", "utf8");
        plaintext += decipher.final("utf8");

        return plaintext;
    }

    /**
     * Store a real API secret for a specific tool
     */
    async setSecret(toolName: string, secretValue: string): Promise<void> {
        const { encryptedValue, iv, authTag } = await this.encrypt(secretValue);

        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO secrets (tool_name, encrypted_value, iv, auth_tag)
      VALUES (?, ?, ?, ?)
    `);

        stmt.run(toolName, encryptedValue, iv, authTag);
    }

    /**
     * Retrieve and decrypt a real API secret (JIT)
     */
    async getSecret(toolName: string): Promise<string> {
        const stmt = this.db.prepare(`
      SELECT encrypted_value, iv, auth_tag FROM secrets WHERE tool_name = ?
    `);

        const row = stmt.get(toolName) as EncryptedData | undefined;

        if (!row) {
            throw new Error(`Secret not found for tool: ${toolName}`);
        }

        return await this.decrypt(row);
    }

    /**
     * Register a new agent with a proxy token
     */
    addAgent(agentId: string, customToken?: string): string {
        const proxyToken = customToken || `pxr_${nanoid(21)}`;

        const stmt = this.db.prepare(`
      INSERT INTO proxy_tokens (agent_id, proxy_token)
      VALUES (?, ?)
    `);

        try {
            stmt.run(agentId, proxyToken);
            return proxyToken;
        } catch (error) {
            if ((error as Error).message.includes("UNIQUE")) {
                throw new Error(`Agent '${agentId}' or token already exists`);
            }
            throw error;
        }
    }

    /**
     * Resolve proxy token to agent ID
     */
    async getAgentByProxyToken(proxyToken: string): Promise<string | null> {
        const stmt = this.db.prepare(`
      SELECT agent_id FROM proxy_tokens WHERE proxy_token = ?
    `);

        const row = stmt.get(proxyToken) as { agent_id: string } | undefined;
        return row?.agent_id || null;
    }

    /**
     * Authorize an agent to use a specific tool
     */
    setAgentMapping(agentId: string, toolName: string): void {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO agent_mappings (agent_id, tool_name)
      VALUES (?, ?)
    `);

        stmt.run(agentId, toolName);
    }

    /**
     * Check if an agent is authorized to use a specific tool
     */
    isAgentAuthorized(agentId: string, toolName: string): boolean {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM agent_mappings
      WHERE agent_id = ? AND tool_name = ?
    `);

        const result = stmt.get(agentId, toolName) as { count: number };
        return result.count > 0;
    }

    /**
     * Close database connection and scrub master key
     */
    close(): void {
        this.db.close();

        // Scrub master key from memory
        if (this.masterKey) {
            this.masterKey.fill(0);
            this.masterKey = null;
        }
    }
}

interface EncryptedData {
    encryptedValue: string;
    iv: string;
    authTag: string;
}
