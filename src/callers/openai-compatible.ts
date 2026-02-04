import { BaseCaller, EnrichedRequest, ToolResponse } from "./base.js";

interface OpenAICompatibleChatResponse {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices?: Array<{
        index?: number;
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

interface OpenAICompatibleModel {
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
}

interface OpenAICompatibleModelsResponse {
    data?: OpenAICompatibleModel[];
    object?: string;
}

/**
 * OpenAICompatibleCaller - Handles requests to any OpenAI-compatible API
 * 
 * Supports two tools:
 * 
 * 1. openai_compatible_chat - Chat completions with OpenAI-compatible API
 *    - Messages with roles (system, user, assistant)
 *    - Configurable model selection
 *    - Temperature and token controls
 *    - Response format options
 * 
 * 2. openai_compatible_list_models - List available models
 *    - Returns all accessible models from the endpoint
 * 
 * URL Configuration (priority order):
 * - Parameter: url in arguments (highest priority)
 * - Environment: OPENAI_COMPATIBLE_URL env variable
 * - No default - will throw error if not provided
 * 
 * Use Cases:
 * - Azure OpenAI: https://your-resource.openai.azure.com/openai/deployments/your-deployment
 * - Local Ollama with OpenAI compatibility: http://localhost:11434/v1
 * - vLLM inference server: Your self-hosted endpoint
 * - Any OpenAI-spec compatible API
 * 
 * Examples:
 * 
 * List models (with env var):
 *   export OPENAI_COMPATIBLE_URL="http://localhost:11434/v1"
 *   { 
 *     tool: "openai_compatible_list_models",
 *     arguments: {}
 *   }
 * 
 * Chat completion (with URL parameter):
 *   { 
 *     tool: "openai_compatible_chat",
 *     arguments: {
 *       url: "https://your-azure-endpoint.com",
 *       model: "gpt-4",
 *       messages: [
 *         { role: "system", content: "You are helpful" },
 *         { role: "user", content: "Hello!" }
 *       ]
 *     }
 *   }
 * 
 * With Azure OpenAI:
 *   { 
 *     tool: "openai_compatible_chat",
 *     arguments: {
 *       url: "https://your-resource.openai.azure.com/openai/deployments/gpt-4",
 *       model: "gpt-4",
 *       messages: [...],
 *       temperature: 0.7
 *     }
 *   }
 */
export class OpenAICompatibleCaller extends BaseCaller {
    /**
     * Resolve the base URL for the OpenAI-compatible API
     * Priority: parameter > env var > error
     */
    private resolveBaseUrl(urlParam?: unknown): string {
        // 1. Check parameter
        if (urlParam && typeof urlParam === "string") {
            return urlParam.replace(/\/$/, ""); // Remove trailing slash
        }

        // 2. Check environment variable
        const envUrl = process.env["OPENAI_COMPATIBLE_URL"];
        if (envUrl && typeof envUrl === "string") {
            return envUrl.replace(/\/$/, "");
        }

        // 3. No default - throw error
        throw new Error(
            "OpenAI-compatible endpoint URL is required. Set OPENAI_COMPATIBLE_URL environment variable or provide 'url' parameter."
        );
    }

    protected async executeInternal(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const toolName = request.params.name;

        if (toolName === "openai_compatible_list_models") {
            return this.listModels(request);
        } else if (toolName === "openai_compatible_chat") {
            return this.chatCompletion(request);
        } else {
            throw new Error(`Unknown OpenAI-compatible tool: ${toolName}`);
        }
    }

    /**
     * List all available models from the OpenAI-compatible endpoint
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

        const response = await fetch(`${baseUrl}/models`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${realApiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `OpenAI-compatible API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenAICompatibleModelsResponse;

        if (!data.data || !Array.isArray(data.data)) {
            throw new Error(
                "Invalid response format from OpenAI-compatible models API"
            );
        }

        // Format models list
        const modelsList = data.data
            .map((model) => {
                const ownedBy = model.owned_by ? ` (${model.owned_by})` : "";
                return `- ${model.id}${ownedBy}`;
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
     * Chat completion with OpenAI-compatible API
     */
    private async chatCompletion(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const { url, model, messages, temperature, max_tokens, response_format } =
            args;
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
        };

        if (temperature !== undefined) {
            requestBody["temperature"] = temperature;
        }

        if (max_tokens !== undefined) {
            requestBody["max_tokens"] = max_tokens;
        }

        if (response_format !== undefined) {
            requestBody["response_format"] = response_format;
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
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
                `OpenAI-compatible API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenAICompatibleChatResponse;

        // Extract response text
        const messageContent = data.choices?.[0]?.message?.content;

        if (!messageContent) {
            throw new Error(
                "No response content from OpenAI-compatible API. Check model availability and endpoint configuration."
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
