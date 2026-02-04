import { VaultStore } from "./store.js";
import { EnrichedRequest } from "../callers/base.js";

export class VaultInjector {
    private vault = new VaultStore();
    private activeSecrets = new WeakSet<object>();

    async injectCredentials(
        request: ToolCallRequest,
        agentId: string,
        toolName: string
    ): Promise<EnrichedRequest> {
        // Map tool name to vault secret key
        const secretKey = this.getSecretKeyForTool(toolName);

        // Get the specific key label for this agent
        const keyLabel = this.vault.getAgentKeyLabel(agentId, toolName);

        // JIT decrypt real API key from vault (agent-specific key)
        const realApiKey = await this.vault.getSecret(secretKey, keyLabel);

        // Clone request and inject real credentials
        const enriched = {
            ...request,
            credentials: {
                apiKey: realApiKey,
                agentId, // for audit trail
            },
        };

        // Track for later scrubbing
        this.activeSecrets.add(enriched);

        return enriched;
    }

    scrubMemory(request: EnrichedRequest): void {
        // Overwrite credential values with zeros
        if (request.credentials?.apiKey) {
            const length = request.credentials.apiKey.length;
            request.credentials.apiKey = "0".repeat(length);
            delete request.credentials.apiKey;
        }

        // Remove from tracking
        this.activeSecrets.delete(request);

        // Force garbage collection hint (requires --expose-gc flag)
        if (global.gc) {
            global.gc();
        }
    }

    private getSecretKeyForTool(toolName: string): string {
        // Map external tool names to internal vault keys
        const mapping: Record<string, string> = {
            gemini_generate: "gemini_api_key",
            openwebui_chat: "openwebui_api_key",
            openwebui_list_models: "openwebui_api_key",
            openai_chat: "openai_api_key",
            openai_list_models: "openai_api_key",
            openai_compatible_chat: "openai_compatible_api_key",
            openai_compatible_list_models: "openai_compatible_api_key",
            claude_chat: "claude_api_key",
            openrouter_chat: "openrouter_api_key",
            openrouter_list_models: "openrouter_api_key",
            slack_send_message: "slack_token",
            gcloud_create_vm: "gcloud_credentials",
        };

        return mapping[toolName] || toolName;
    }

    close(): void {
        this.vault.close();
    }
}

interface ToolCallRequest {
    params: {
        name: string;
        arguments?: Record<string, unknown> | undefined;
    };
}
