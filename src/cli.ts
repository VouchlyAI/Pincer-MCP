#!/usr/bin/env node

import { VaultStore } from "./vault/store.js";
import { Command } from "commander";
import * as openpgp from "openpgp";
import { readFileSync } from "fs";

// Version is auto-synced during build via scripts/sync-version.js
const VERSION = "0.1.5";

const program = new Command();

program
    .name("pincer")
    .description("Pincer-MCP Vault Management CLI")
    .version(VERSION);

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

// Reset vault (delete master key)
program
    .command("reset")
    .description("Delete master key from OS keychain (keeps vault data)")
    .action(async () => {
        const vault = new VaultStore();
        try {
            await vault.deleteMasterKey();
            console.log("⚠️  Master key deleted from OS keychain.");
            console.log("   Vault data (secrets, agents) still exists but is unusable.");
            console.log("   Run 'pincer init' to create a new master key.");
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

// Clear all vault data (keep master key)
program
    .command("clear")
    .description("Delete all secrets and agents (keeps master key)")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (options: { yes?: boolean }) => {
        const vault = new VaultStore();
        try {
            if (!options.yes) {
                console.log("⚠️  WARNING: This will delete ALL secrets and agents from the vault!");
                console.log("   Master key will be preserved.");
                console.log("\n   Run with --yes to confirm: pincer clear --yes");
                vault.close();
                process.exit(0);
            }

            vault.deleteAllSecrets();
            console.log("✅ All secrets and agents deleted.");
            console.log("   Master key preserved. Vault is now empty.");
            console.log("   Run 'pincer set' to add new secrets.");
            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

// Nuclear option: Delete everything
program
    .command("nuke")
    .description("🔥 Delete EVERYTHING: master key, vault database, all data")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (options: { yes?: boolean }) => {
        const vault = new VaultStore();
        try {
            if (!options.yes) {
                console.log("🔥 DANGER: This will PERMANENTLY delete:");
                console.log("   • Master key from OS keychain");
                console.log("   • All encrypted secrets");
                console.log("   • All agents and proxy tokens");
                console.log("   • Vault database file");
                console.log("\n   This action CANNOT be undone!");
                console.log("\n   Run with --yes to confirm: pincer nuke --yes");
                vault.close();
                process.exit(0);
            }

            await vault.nukeVault();
            console.log("💥 Vault completely destroyed.");
            console.log("   All data deleted from OS keychain and filesystem.");
            console.log("   Run 'pincer init' to start fresh.");
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            process.exit(1);
        }
    });

// GPG Key Management
const keyCmd = program.command("key").description("Manage GPG/PGP signing keys for keyless agent execution");

keyCmd
    .command("generate")
    .description("Generate a new GPG/PGP keypair and store the private key in the vault")
    .requiredOption("-n, --name <name>", "Identity name (e.g., 'Release Signing Key')")
    .option("-e, --email <email>", "Email address for the key identity")
    .option("--type <type>", "Key type: 'ecc' (default, Curve25519) or 'rsa'", "ecc")
    .action(async (options: { name: string; email?: string; type?: string }) => {
        const vault = new VaultStore();
        try {
            const userIDs = [{ name: options.name, email: options.email || "" }];
            const passphrase = generatePassphrase();

            const keyType = options.type === "rsa" ? "rsa" : "curve25519";

            console.log("🔑 Generating GPG keypair...");
            const { privateKey, publicKey } = await openpgp.generateKey({
                type: keyType as "curve25519" | "rsa",
                userIDs,
                passphrase,
            });

            // Extract fingerprint from the generated key
            const parsedKey = await openpgp.readPrivateKey({ armoredKey: privateKey as string });
            const fingerprint = parsedKey.getFingerprint().toUpperCase();
            const keyId = fingerprint.slice(-16); // Last 16 chars as key ID

            // Store the key bundle in vault
            const keyBundle = JSON.stringify({
                armoredPrivateKey: privateKey,
                passphrase,
                fingerprint,
                userID: `${options.name}${options.email ? ` <${options.email}>` : ""}`,
            });

            await vault.setSecret("gpg_signing_key", keyBundle, keyId);

            console.log(`\n✅ GPG keypair generated and stored in vault`);
            console.log(`   Key ID:      ${keyId}`);
            console.log(`   Fingerprint: ${fingerprint}`);
            console.log(`   Type:        ${keyType.toUpperCase()}`);
            console.log(`   Identity:    ${options.name}${options.email ? ` <${options.email}>` : ""}`);
            console.log(`\n📋 Public Key (distribute this freely):\n`);
            console.log(publicKey);
            console.log(`\n🔗 Next: Authorize an agent to use this key:`);
            console.log(`   pincer agent authorize <agent-id> gpg_sign_data --key ${keyId}`);

            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

keyCmd
    .command("import <file>")
    .description("Import an existing armored PGP private key file into the vault")
    .option("-p, --passphrase <passphrase>", "Passphrase for the private key (if encrypted)")
    .action(async (file: string, options: { passphrase?: string }) => {
        const vault = new VaultStore();
        try {
            const armoredKey = readFileSync(file, "utf8");

            // Parse and validate the key
            const parsedKey = await openpgp.readPrivateKey({ armoredKey });
            const fingerprint = parsedKey.getFingerprint().toUpperCase();
            const keyId = fingerprint.slice(-16);

            // If key is encrypted and passphrase provided, verify it works
            let passphrase = options.passphrase || "";
            if (!parsedKey.isDecrypted()) {
                if (!passphrase) {
                    throw new Error("Private key is encrypted. Provide passphrase with --passphrase");
                }
                // Verify passphrase works
                await openpgp.decryptKey({ privateKey: parsedKey, passphrase });
            } else {
                // Key is unencrypted — encrypt it with a generated passphrase for vault storage
                passphrase = generatePassphrase();
                // Re-read and encrypt with passphrase
                const reEncrypted = await openpgp.encryptKey({
                    privateKey: parsedKey,
                    passphrase,
                });
                // Update armoredKey to the encrypted version
                const keyBundle = JSON.stringify({
                    armoredPrivateKey: reEncrypted.armor(),
                    passphrase,
                    fingerprint,
                    userID: parsedKey.getUserIDs().join(", "),
                });

                await vault.setSecret("gpg_signing_key", keyBundle, keyId);

                console.log(`✅ GPG key imported and stored in vault`);
                console.log(`   Key ID:      ${keyId}`);
                console.log(`   Fingerprint: ${fingerprint}`);
                console.log(`   Identity:    ${parsedKey.getUserIDs().join(", ")}`);
                console.log(`\n🔗 Next: Authorize an agent to use this key:`);
                console.log(`   pincer agent authorize <agent-id> gpg_sign_data --key ${keyId}`);

                vault.close();
                return;
            }

            // Store with original passphrase
            const keyBundle = JSON.stringify({
                armoredPrivateKey: armoredKey,
                passphrase,
                fingerprint,
                userID: parsedKey.getUserIDs().join(", "),
            });

            await vault.setSecret("gpg_signing_key", keyBundle, keyId);

            console.log(`✅ GPG key imported and stored in vault`);
            console.log(`   Key ID:      ${keyId}`);
            console.log(`   Fingerprint: ${fingerprint}`);
            console.log(`   Identity:    ${parsedKey.getUserIDs().join(", ")}`);
            console.log(`\n🔗 Next: Authorize an agent to use this key:`);
            console.log(`   pincer agent authorize <agent-id> gpg_sign_data --key ${keyId}`);

            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

keyCmd
    .command("list")
    .description("List all GPG keys stored in the vault")
    .action(async () => {
        const vault = new VaultStore();
        try {
            const secrets = vault.listSecrets();
            const gpgKeys = secrets.filter(s => s.toolName === "gpg_signing_key");

            if (gpgKeys.length === 0 || !gpgKeys[0] || gpgKeys[0].labels.length === 0) {
                console.log("📭 No GPG keys stored.");
                console.log("   Run: pincer key generate --name 'My Key'");
            } else {
                console.log("\n🔑 GPG Signing Keys:\n");
                for (const label of gpgKeys[0].labels) {
                    try {
                        const raw = await vault.getSecret("gpg_signing_key", label);
                        const bundle = JSON.parse(raw);
                        console.log(`  ${label}:`);
                        console.log(`    Fingerprint: ${bundle.fingerprint}`);
                        console.log(`    Identity:    ${bundle.userID}`);
                    } catch {
                        console.log(`  ${label}: (unable to decrypt)`);
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

keyCmd
    .command("export <key-id>")
    .description("Export the public key for a stored GPG key (safe to share)")
    .action(async (keyId: string) => {
        const vault = new VaultStore();
        try {
            const raw = await vault.getSecret("gpg_signing_key", keyId);
            const bundle = JSON.parse(raw);

            // Read private key and extract public key
            const privateKey = await openpgp.readPrivateKey({ armoredKey: bundle.armoredPrivateKey });
            const publicKey = privateKey.toPublic().armor();

            console.log(publicKey);

            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

keyCmd
    .command("delete <key-id>")
    .description("Delete a GPG key from the vault")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (keyId: string, options: { yes?: boolean }) => {
        const vault = new VaultStore();
        try {
            if (!options.yes) {
                console.log(`⚠️  WARNING: This will permanently delete GPG key '${keyId}' from the vault.`);
                console.log(`   Any agents authorized with this key will lose signing capability.`);
                console.log(`\n   Run with --yes to confirm: pincer key delete ${keyId} --yes`);
                vault.close();
                process.exit(0);
            }

            // Overwrite with empty to effectively delete (vault doesn't have per-label delete)
            // We set an empty value which will fail on use
            await vault.setSecret("gpg_signing_key", "{}", keyId);
            console.log(`✅ GPG key '${keyId}' deleted from vault.`);

            vault.close();
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            vault.close();
            process.exit(1);
        }
    });

/**
 * Generate a cryptographically secure passphrase for PGP key protection.
 */
function generatePassphrase(): string {
    const { randomBytes } = require("crypto");
    return randomBytes(32).toString("base64url");
}

program.parse();
