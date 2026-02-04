import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VaultStore } from "../src/vault/store.js";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

describe("VaultStore - Multi-Key Support", () => {
    let vault: VaultStore;
    const testVaultPath = join(homedir(), ".pincer", "vault-test.db");

    beforeEach(async () => {
        // Set test database path
        process.env["VAULT_DB_PATH"] = testVaultPath;

        // Clean up any existing test database
        if (existsSync(testVaultPath)) {
            unlinkSync(testVaultPath);
        }
        if (existsSync(testVaultPath + "-shm")) {
            unlinkSync(testVaultPath + "-shm");
        }
        if (existsSync(testVaultPath + "-wal")) {
            unlinkSync(testVaultPath + "-wal");
        }

        vault = new VaultStore();

        // Initialize master key for tests
        try {
            await vault.initializeMasterKey();
        } catch (error) {
            // Key might already exist, try to delete and recreate
            try {
                await vault.deleteMasterKey();
                await vault.initializeMasterKey();
            } catch (e) {
                // Ignore if still fails - key exists
            }
        }
    });

    afterEach(async () => {
        vault.close();

        // Clean up test database
        if (existsSync(testVaultPath)) {
            unlinkSync(testVaultPath);
        }
        if (existsSync(testVaultPath + "-shm")) {
            unlinkSync(testVaultPath + "-shm");
        }
        if (existsSync(testVaultPath + "-wal")) {
            unlinkSync(testVaultPath + "-wal");
        }

        delete process.env["VAULT_DB_PATH"];
    });

    describe("Multi-Key Storage", () => {
        it("should store multiple keys for the same tool with different labels", async () => {
            await vault.setSecret("gemini_api_key", "key1_value", "key1");
            await vault.setSecret("gemini_api_key", "key2_value", "key2");
            await vault.setSecret("gemini_api_key", "production_value", "production");

            const key1 = await vault.getSecret("gemini_api_key", "key1");
            const key2 = await vault.getSecret("gemini_api_key", "key2");
            const prod = await vault.getSecret("gemini_api_key", "production");

            expect(key1).toBe("key1_value");
            expect(key2).toBe("key2_value");
            expect(prod).toBe("production_value");
        });

        it("should use default label when not specified", async () => {
            await vault.setSecret("slack_token", "default_value");

            const value = await vault.getSecret("slack_token");
            expect(value).toBe("default_value");

            // Should also work with explicit default
            const valueExplicit = await vault.getSecret("slack_token", "default");
            expect(valueExplicit).toBe("default_value");
        });

        it("should list all secrets with their labels", async () => {
            await vault.setSecret("gemini_api_key", "value1", "key1");
            await vault.setSecret("gemini_api_key", "value2", "key2");
            await vault.setSecret("slack_token", "value3", "default");
            await vault.setSecret("slack_token", "value4", "production");

            const secrets = vault.listSecrets();

            expect(secrets).toHaveLength(2);

            const gemini = secrets.find((s) => s.toolName === "gemini_api_key");
            expect(gemini?.labels).toContain("key1");
            expect(gemini?.labels).toContain("key2");
            expect(gemini?.labels).toHaveLength(2);

            const slack = secrets.find((s) => s.toolName === "slack_token");
            expect(slack?.labels).toContain("default");
            expect(slack?.labels).toContain("production");
            expect(slack?.labels).toHaveLength(2);
        });

        it("should throw error when retrieving non-existent key label", async () => {
            await vault.setSecret("gemini_api_key", "value", "key1");

            await expect(
                vault.getSecret("gemini_api_key", "nonexistent")
            ).rejects.toThrow(/Secret not found.*nonexistent/);
        });
    });

    describe("Per-Agent Key Assignment", () => {
        it("should assign different keys to different agents for the same tool", async () => {
            // Setup: Store two keys
            await vault.setSecret("gemini_api_key", "clawdbot_key", "key1");
            await vault.setSecret("gemini_api_key", "mybot_key", "key2");

            // Register agents
            const token1 = vault.addAgent("clawdbot");
            const token2 = vault.addAgent("mybot");

            expect(token1).toMatch(/^pxr_/);
            expect(token2).toMatch(/^pxr_/);

            // Authorize with different keys
            vault.setAgentMapping("clawdbot", "gemini_generate", "key1");
            vault.setAgentMapping("mybot", "gemini_generate", "key2");

            // Verify key label assignments
            const clawdbotKey = vault.getAgentKeyLabel("clawdbot", "gemini_generate");
            const mybotKey = vault.getAgentKeyLabel("mybot", "gemini_generate");

            expect(clawdbotKey).toBe("key1");
            expect(mybotKey).toBe("key2");
        });

        it("should default to 'default' key label when not specified", async () => {
            vault.addAgent("testagent");
            vault.setAgentMapping("testagent", "slack_send_message");

            const keyLabel = vault.getAgentKeyLabel("testagent", "slack_send_message");
            expect(keyLabel).toBe("default");
        });

        it("should list all agents with their tool permissions and key assignments", async () => {
            // Setup keys
            await vault.setSecret("gemini_api_key", "value1", "key1");
            await vault.setSecret("slack_token", "value2", "production");

            // Setup agents
            vault.addAgent("agent1");
            vault.setAgentMapping("agent1", "gemini_generate", "key1");
            vault.setAgentMapping("agent1", "slack_send_message", "production");

            vault.addAgent("agent2");
            vault.setAgentMapping("agent2", "gemini_generate", "default");

            const agents = vault.listAgents();

            expect(agents).toHaveLength(2);

            const agent1 = agents.find((a) => a.agentId === "agent1");
            expect(agent1).toBeDefined();
            expect(agent1?.tools).toHaveLength(2);

            const geminiTool = agent1?.tools.find(
                (t) => t.toolName === "gemini_generate"
            );
            expect(geminiTool?.keyLabel).toBe("key1");

            const slackTool = agent1?.tools.find(
                (t) => t.toolName === "slack_send_message"
            );
            expect(slackTool?.keyLabel).toBe("production");

            const agent2 = agents.find((a) => a.agentId === "agent2");
            expect(agent2?.tools).toHaveLength(1);
            expect(agent2?.tools[0]?.keyLabel).toBe("default");
        });
    });

    describe("Encryption & Security", () => {
        it("should encrypt different key labels independently", async () => {
            await vault.setSecret("test_tool", "secret1", "label1");
            await vault.setSecret("test_tool", "secret2", "label2");

            // Retrieve and verify
            const value1 = await vault.getSecret("test_tool", "label1");
            const value2 = await vault.getSecret("test_tool", "label2");

            expect(value1).toBe("secret1");
            expect(value2).toBe("secret2");
            expect(value1).not.toBe(value2);
        });

        it("should update existing key when setting same tool and label", async () => {
            await vault.setSecret("test_tool", "old_value", "production");
            await vault.setSecret("test_tool", "new_value", "production");

            const value = await vault.getSecret("test_tool", "production");
            expect(value).toBe("new_value");
        });
    });
});
