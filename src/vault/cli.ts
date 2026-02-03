import { VaultStore } from "./store.js";

const command = process.argv[2];
const vault = new VaultStore();

(async () => {
    try {
        switch (command) {
            case "init":
                await vault.initializeMasterKey();
                console.log("\n🔐 Vault initialized successfully!");
                console.log("\nNext steps:");
                console.log("  1. npm run vault:set <tool-name> <api-key>");
                console.log("  2. npm run vault:add-agent <agent-id>");
                console.log("  3. npm run vault:authorize <agent-id> <tool-name>");
                break;

            case "set":
                const toolName = process.argv[3];
                const secret = process.argv[4];

                if (!toolName || !secret) {
                    console.error("Usage: npm run vault:set <tool-name> <secret>");
                    console.error(
                        "Example: npm run vault:set gemini_api_key AIzaSy..."
                    );
                    process.exit(1);
                }

                await vault.setSecret(toolName, secret);
                console.log(`✅ Secret stored for tool: ${toolName}`);
                break;

            case "add-agent":
                const agentId = process.argv[3];
                const customToken = process.argv[4]; // optional

                if (!agentId) {
                    console.error(
                        "Usage: npm run vault:add-agent <agent-id> [custom-token]"
                    );
                    console.error("Example: npm run vault:add-agent openclaw");
                    process.exit(1);
                }

                const proxyToken = vault.addAgent(agentId, customToken);
                console.log(`✅ Agent registered: ${agentId}`);
                console.log(`🎫 Proxy Token: ${proxyToken}`);
                console.log("\n⚠️  Save this token securely! Give it to the agent.");
                break;

            case "authorize":
                const agent = process.argv[3];
                const tool = process.argv[4];

                if (!agent || !tool) {
                    console.error(
                        "Usage: npm run vault:authorize <agent-id> <tool-name>"
                    );
                    console.error(
                        "Example: npm run vault:authorize openclaw gemini_generate"
                    );
                    process.exit(1);
                }

                vault.setAgentMapping(agent, tool);
                console.log(`✅ Agent '${agent}' authorized for tool '${tool}'`);
                break;

            case "reset":
                await vault.deleteMasterKey();
                console.log(
                    "⚠️  Master key deleted. Run 'vault:init' to create a new one."
                );
                break;

            default:
                console.error("Unknown command. Available:");
                console.error("  init         - Initialize master key in OS keychain");
                console.error("  set          - Store encrypted API secret");
                console.error(
                    "  add-agent    - Register agent and generate proxy token"
                );
                console.error("  authorize    - Authorize agent for tool access");
                console.error("  reset        - Delete master key (destructive)");
                process.exit(1);
        }

        vault.close();
    } catch (error) {
        console.error(`❌ Error: ${(error as Error).message}`);
        vault.close();
        process.exit(1);
    }
})();
