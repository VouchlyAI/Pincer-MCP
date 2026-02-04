import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import Database from "better-sqlite3";
import keytar from "keytar";
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
            process.env['VAULT_DB_PATH'] || join(homedir(), ".pincer", "vault.db");

        // Ensure directory exists
        const dir = dirname(vaultPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(vaultPath);

        // Initialize schema with multi-key support
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        key_label TEXT NOT NULL DEFAULT 'default',
        encrypted_value TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tool_name, key_label)
      );
      
      CREATE TABLE IF NOT EXISTS proxy_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT UNIQUE NOT NULL,
        proxy_token TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS agent_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        key_label TEXT NOT NULL DEFAULT 'default',
        UNIQUE(agent_id, tool_name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_proxy_tokens ON proxy_tokens(proxy_token);
      CREATE INDEX IF NOT EXISTS idx_agent_mappings ON agent_mappings(agent_id, tool_name);
      CREATE INDEX IF NOT EXISTS idx_secrets_tool ON secrets(tool_name, key_label);
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
                "Master key not found in keychain. Run 'pincer init' to initialize."
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
        // keytar doesn't have a deletePassword method
        // Set to empty string to effectively delete
        await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);

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
     * Store a real API secret for a specific tool with optional label
     */
    async setSecret(
        toolName: string,
        secretValue: string,
        keyLabel: string = "default"
    ): Promise<void> {
        const { encryptedValue, iv, authTag } = await this.encrypt(secretValue);

        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO secrets (tool_name, key_label, encrypted_value, iv, auth_tag)
      VALUES (?, ?, ?, ?, ?)
    `);

        stmt.run(toolName, keyLabel, encryptedValue, iv, authTag);
    }

    /**
     * Retrieve and decrypt a real API secret (JIT) with optional key label
     */
    async getSecret(
        toolName: string,
        keyLabel: string = "default"
    ): Promise<string> {
        const stmt = this.db.prepare(`
      SELECT encrypted_value, iv, auth_tag FROM secrets 
      WHERE tool_name = ? AND key_label = ?
    `);

        const row = stmt.get(toolName, keyLabel) as {
            encrypted_value: string;
            iv: string;
            auth_tag: string;
        } | undefined;

        if (!row) {
            throw new Error(
                `Secret not found for tool: ${toolName} (key: ${keyLabel})`
            );
        }

        return await this.decrypt({
            encryptedValue: row.encrypted_value,
            iv: row.iv,
            authTag: row.auth_tag,
        });
    }

    /**
     * List all secrets grouped by tool
     */
    listSecrets(): Array<{ toolName: string; labels: string[] }> {
        const stmt = this.db.prepare(`
      SELECT tool_name, key_label FROM secrets ORDER BY tool_name, key_label
    `);

        const rows = stmt.all() as Array<{ tool_name: string; key_label: string }>;
        const grouped = new Map<string, string[]>();

        for (const row of rows) {
            if (!grouped.has(row.tool_name)) {
                grouped.set(row.tool_name, []);
            }
            grouped.get(row.tool_name)!.push(row.key_label);
        }

        return Array.from(grouped.entries()).map(([toolName, labels]) => ({
            toolName,
            labels,
        }));
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
     * Authorize an agent to use a specific tool with a specific key
     */
    setAgentMapping(
        agentId: string,
        toolName: string,
        keyLabel: string = "default"
    ): void {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_mappings (agent_id, tool_name, key_label)
      VALUES (?, ?, ?)
    `);

        stmt.run(agentId, toolName, keyLabel);
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
     * Get the specific key label assigned to an agent for a tool
     */
    getAgentKeyLabel(agentId: string, toolName: string): string {
        const stmt = this.db.prepare(`
      SELECT key_label FROM agent_mappings
      WHERE agent_id = ? AND tool_name = ?
    `);

        const result = stmt.get(agentId, toolName) as
            | { key_label: string }
            | undefined;
        return result?.key_label || "default";
    }

    /**
     * List all agents with their tools and assigned keys
     */
    listAgents(): Array<{
        agentId: string;
        proxyToken: string;
        tools: Array<{ toolName: string; keyLabel: string }>;
    }> {
        const agentsStmt = this.db.prepare(`
      SELECT agent_id, proxy_token FROM proxy_tokens ORDER BY agent_id
    `);

        const agents = agentsStmt.all() as Array<{
            agent_id: string;
            proxy_token: string;
        }>;

        return agents.map((agent) => {
            const toolsStmt = this.db.prepare(`
        SELECT tool_name, key_label FROM agent_mappings
        WHERE agent_id = ? ORDER BY tool_name
      `);

            const tools = toolsStmt.all(agent.agent_id) as Array<{
                tool_name: string;
                key_label: string;
            }>;

            return {
                agentId: agent.agent_id,
                proxyToken: agent.proxy_token,
                tools: tools.map((t) => ({
                    toolName: t.tool_name,
                    keyLabel: t.key_label,
                })),
            };
        });
    }

    /**
     * Revoke an agent's access to a specific tool
     */
    revokeAgentAccess(agentId: string, toolName: string): void {
        const stmt = this.db.prepare(`
      DELETE FROM agent_mappings
      WHERE agent_id = ? AND tool_name = ?
    `);

        const result = stmt.run(agentId, toolName);

        if (result.changes === 0) {
            throw new Error(
                `Agent '${agentId}' does not have access to tool '${toolName}'`
            );
        }
    }

    /**
     * Remove an agent completely (delete token and all permissions)
     */
    removeAgent(agentId: string): void {
        // Delete all permissions first
        const mappingsStmt = this.db.prepare(`
      DELETE FROM agent_mappings WHERE agent_id = ?
    `);
        mappingsStmt.run(agentId);

        // Delete proxy token
        const tokenStmt = this.db.prepare(`
      DELETE FROM proxy_tokens WHERE agent_id = ?
    `);
        const result = tokenStmt.run(agentId);

        if (result.changes === 0) {
            throw new Error(`Agent '${agentId}' not found`);
        }
    }

    /**
     * Delete all secrets from vault (keeps master key and structure)
     */
    deleteAllSecrets(): void {
        const secretsStmt = this.db.prepare(`DELETE FROM secrets`);
        const tokensStmt = this.db.prepare(`DELETE FROM proxy_tokens`);
        const mappingsStmt = this.db.prepare(`DELETE FROM agent_mappings`);

        secretsStmt.run();
        tokensStmt.run();
        mappingsStmt.run();
    }

    /**
     * Nuclear option: Delete everything including master key and database file
     */
    async nukeVault(): Promise<void> {
        // Delete master key from OS keychain
        await this.deleteMasterKey();

        // Close database connection
        this.close();

        // Get vault path
        const { homedir } = await import("os");
        const { join } = await import("path");
        const vaultPath =
            process.env["VAULT_DB_PATH"] ||
            join(homedir(), ".pincer", "vault.db");

        // Delete database file
        const { unlinkSync, existsSync } = await import("fs");
        if (existsSync(vaultPath)) {
            unlinkSync(vaultPath);
        }
        // Also delete WAL and SHM files if they exist
        if (existsSync(`${vaultPath}-wal`)) {
            unlinkSync(`${vaultPath}-wal`);
        }
        if (existsSync(`${vaultPath}-shm`)) {
            unlinkSync(`${vaultPath}-shm`);
        }
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
