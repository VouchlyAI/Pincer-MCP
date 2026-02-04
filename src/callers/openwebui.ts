import { BaseCaller, EnrichedRequest, ToolResponse } from "./base.js";

interface OpenWebUIChatResponse {
    id?: string;
    model?: string;
    choices?: Array<{
        message?: {
            role?: string;
            content?: string;
        };
        finish_reason?: string;
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}

interface OpenWebUIModel {
    id: string;
    name?: string;
    object?: string;
    created?: number;
    owned_by?: string;
}

interface OpenWebUIModelsResponse {
    data?: OpenWebUIModel[];
}

/**
 * OpenWebUICaller - Handles requests to OpenWebUI API
 * 
 * Supports two tools:
 * 
 * 1. openwebui_chat - Chat completions with OpenAI-compatible API
 *    - Messages with roles (system, user, assistant)
 *    - Configurable model selection
 *    - Temperature and token controls
 * 
 * 2. openwebui_list_models - Fetch available models
 *    - Returns list of all accessible models
 * 
 * URL Configuration:
 * - Parameter: url in arguments (highest priority)
 * - Environment: OPENWEBUI_URL env variable
 * - Default: https://openwebui.com
 * 
 * Examples:
 * 
 * List models:
 *   { 
 *     tool: "openwebui_list_models",
 *     arguments: {}
 *   }
 * 
 * Chat completion:
 *   { 
 *     tool: "openwebui_chat",
 *     arguments: {
 *       model: "llama3",
 *       messages: [
 *         { role: "system", content: "You are helpful" },
 *         { role: "user", content: "Hello!" }
 *       ]
 *     }
 *   }
 * 
 * With custom URL:
 *   { 
 *     tool: "openwebui_chat",
 *     arguments: {
 *       url: "https://my-instance.com",
 *       model: "llama3",
 *       messages: [...]
 *     }
 *   }
 */
export class OpenWebUICaller extends BaseCaller {
    /**
     * Resolve the base URL for OpenWebUI instance
     * Priority: parameter > env var > default
     */
    private resolveBaseUrl(urlParam?: unknown): string {
        // 1. Check parameter
        if (urlParam && typeof urlParam === "string") {
            return urlParam.replace(/\/$/, ""); // Remove trailing slash
        }

        // 2. Check environment variable
        const envUrl = process.env["OPENWEBUI_URL"];
        if (envUrl && typeof envUrl === "string") {
            console.error("Using OpenWebUI URL from environment variable: " + envUrl);
            return envUrl.replace(/\/$/, "");
        }

        // 3. Default
        return "https://openwebui.com";
    }

    protected async executeInternal(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const toolName = request.params.name;

        if (toolName === "openwebui_list_models") {
            return this.listModels(request);
        } else if (toolName === "openwebui_chat") {
            return this.chatCompletion(request);
        } else {
            throw new Error(`Unknown OpenWebUI tool: ${toolName}`);
        }
    }

    /**
     * List all available models from OpenWebUI
     */
    private async listModels(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const { url } = args;
        const realApiKey = request.credentials.apiKey;

        if (!realApiKey) {
            throw new Error("API key is required but was not provided");
        }

        const baseUrl = this.resolveBaseUrl(url);

        const response = await fetch(`${baseUrl}/api/models`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${realApiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `OpenWebUI API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenWebUIModelsResponse;

        if (!data.data || !Array.isArray(data.data)) {
            throw new Error("Invalid response format from OpenWebUI models API");
        }

        // Format models list as text
        const modelsList = data.data
            .map((model) => {
                const name = model.name || model.id;
                const ownedBy = model.owned_by ? ` (${model.owned_by})` : "";
                return `- ${name}${ownedBy}`;
            })
            .join("\n");

        return {
            content: [
                {
                    type: "text",
                    text: `Available models (${data.data.length}):\n\n${modelsList}`,
                },
            ],
        };
    }

    /**
     * Chat completion with OpenWebUI
     */
    private async chatCompletion(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const { url, model, messages, temperature, max_tokens, stream } = args;
        const realApiKey = request.credentials.apiKey;

        if (!realApiKey) {
            throw new Error("API key is required but was not provided");
        }

        if (!model || typeof model !== "string") {
            throw new Error("Model parameter is required and must be a string");
        }

        if (!messages || !Array.isArray(messages)) {
            throw new Error(
                "Messages parameter is required and must be an array"
            );
        }

        // Validate messages format
        for (const msg of messages) {
            if (
                !msg ||
                typeof msg !== "object" ||
                !msg.role ||
                !msg.content
            ) {
                throw new Error(
                    'Each message must have "role" and "content" fields'
                );
            }
            if (
                msg.role !== "system" &&
                msg.role !== "user" &&
                msg.role !== "assistant"
            ) {
                throw new Error(
                    'Message role must be "system", "user", or "assistant"'
                );
            }
        }

        const baseUrl = this.resolveBaseUrl(url);

        // Build request body
        const requestBody: Record<string, unknown> = {
            model,
            messages,
            stream: stream ?? false,
        };

        if (temperature !== undefined) {
            requestBody["temperature"] = temperature;
        }

        if (max_tokens !== undefined) {
            requestBody["max_tokens"] = max_tokens;
        }

        const response = await fetch(`${baseUrl}/api/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${realApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `OpenWebUI API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenWebUIChatResponse;

        // Extract response text
        const messageContent = data.choices?.[0]?.message?.content;

        if (!messageContent) {
            throw new Error(
                "No response content from OpenWebUI. Check model availability."
            );
        }

        return {
            content: [
                {
                    type: "text",
                    text: messageContent,
                },
            ],
        };
    }
}
