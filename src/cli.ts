#!/usr/bin/env node

import { VaultStore } from "./vault/store.js";
import { Command } from "commander";

const program = new Command();

program
    .name("pincer")
    .description("Pincer-MCP Vault Management CLI")
    .version("0.1.0");

// Initialize vault
program
    .command("init")
    .description("Initialize master key in OS keychain")
    .action(async () => {
        const vault = new VaultStore();
        try {
            await vault.initializeMasterKey();
            console.log("\n🔐 Vault initialized successfully!");
            console.log("\nNext steps:");
            console.log("  1. pincer set <tool-name> <api-key> [--label <label>]");
            console.log("  2. pincer agent add <agent-id>");
            console.log("  3. pincer agent authorize <agent-id> <tool-name> [--key <label>]");
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

// Set/add API key
program
    .command("set <tool-name> <api-key>")
    .description("Store an encrypted API key for a tool")
    .option("-l, --label <label>", "Label for this key (e.g., 'key1', 'production')")
    .action(async (toolName: string, apiKey: string, options: { label?: string }) => {
        const vault = new VaultStore();
        try {
            const label = options.label || "default";
            await vault.setSecret(toolName, apiKey, label);
            console.log(`✅ Secret stored for tool: ${toolName}`);
            if (label !== "default") {
                console.log(`   Label: ${label}`);
            }
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

// List keys
program
    .command("list")
    .description("List all stored tools and their key labels")
    .action(async () => {
        const vault = new VaultStore();
        try {
            const tools = vault.listSecrets();

            if (tools.length === 0) {
                console.log("📭 No secrets stored yet.");
                console.log("   Run: pincer set <tool-name> <api-key>");
            } else {
                console.log("\n🔑 Stored Secrets:");
                for (const tool of tools) {
                    console.log(`\n  ${tool.toolName}:`);
                    for (const label of tool.labels) {
                        const marker = label === "default" ? " (default)" : "";
                        console.log(`    - ${label}${marker}`);
                    }
                }
            }

            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

// Agent management
const agentCmd = program.command("agent").description("Manage agents and their access");

agentCmd
    .command("add <agent-id>")
    .description("Register a new agent and generate proxy token")
    .option("-t, --token <token>", "Use custom proxy token instead of generating one")
    .action(async (agentId: string, options: { token?: string }) => {
        const vault = new VaultStore();
        try {
            const proxyToken = vault.addAgent(agentId, options.token);
            console.log(`✅ Agent registered: ${agentId}`);
            console.log(`🎫 Proxy Token: ${proxyToken}`);
            console.log("\n⚠️  Save this token securely! Give it to the agent.");
            console.log(`   Set: export PINCER_PROXY_TOKEN="${proxyToken}"`);
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

agentCmd
    .command("authorize <agent-id> <tool-name>")
    .description("Authorize an agent to use a specific tool")
    .option("-k, --key <label>", "Specific key label to assign (defaults to 'default')")
    .action(async (agentId: string, toolName: string, options: { key?: string }) => {
        const vault = new VaultStore();
        try {
            const keyLabel = options.key || "default";
            vault.setAgentMapping(agentId, toolName, keyLabel);
            console.log(`✅ Agent '${agentId}' authorized for tool '${toolName}'`);
            if (keyLabel !== "default") {
                console.log(`   Using key: ${keyLabel}`);
            }
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

agentCmd
    .command("list")
    .description("List all registered agents and their permissions")
    .action(async () => {
        const vault = new VaultStore();
        try {
            const agents = vault.listAgents();

            if (agents.length === 0) {
                console.log("📭 No agents registered yet.");
                console.log("   Run: pincer agent add <agent-id>");
            } else {
                console.log("\n👥 Registered Agents:");
                for (const agent of agents) {
                    console.log(`\n  ${agent.agentId}:`);
                    console.log(`    Token: ${agent.proxyToken}`);
                    if (agent.tools.length > 0) {
                        console.log(`    Tools:`);
                        for (const tool of agent.tools) {
                            const keyInfo = tool.keyLabel !== "default" ? ` (key: ${tool.keyLabel})` : "";
                            console.log(`      - ${tool.toolName}${keyInfo}`);
                        }
                    } else {
                        console.log(`    Tools: None (use 'pincer agent authorize' to grant access)`);
                    }
                }
            }

            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

agentCmd
    .command("revoke <agent-id> <tool-name>")
    .description("Revoke an agent's access to a specific tool")
    .action(async (agentId: string, toolName: string) => {
        const vault = new VaultStore();
        try {
            vault.revokeAgentAccess(agentId, toolName);
            console.log(`✅ Revoked access for '${agentId}' to tool '${toolName}'`);
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

agentCmd
    .command("remove <agent-id>")
    .description("Remove an agent and all its permissions")
    .action(async (agentId: string) => {
        const vault = new VaultStore();
        try {
            vault.removeAgent(agentId);
            console.log(`✅ Agent '${agentId}' removed (all permissions revoked)`);
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

// Reset vault
program
    .command("reset")
    .description("Delete master key from OS keychain (destructive!)")
    .action(async () => {
        const vault = new VaultStore();
        try {
            await vault.deleteMasterKey();
            console.log("⚠️  Master key deleted. Run 'pincer init' to create a new one.");
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

program.parse();
