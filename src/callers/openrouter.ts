import { BaseCaller, EnrichedRequest, ToolResponse } from "./base.js";

interface OpenRouterChatResponse {
    id?: string;
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

interface OpenRouterModel {
    id: string;
    name?: string;
    created?: number;
    context_length?: number;
    pricing?: {
        prompt?: string;
        completion?: string;
    };
}

interface OpenRouterModelsResponse {
    data?: OpenRouterModel[];
}

/**
 * OpenRouterCaller - Handles requests to OpenRouter's unified AI API
 * 
 * OpenRouter provides access to 100+ models from multiple providers through
 * a single OpenAI-compatible API endpoint.
 * 
 * Supported Providers:
 * - OpenAI (GPT-4, GPT-3.5, etc.)
 * - Anthropic (Claude 3/3.5)
 * - Google (Gemini)
 * - Meta (Llama)
 * - Mistral, Cohere, and many more
 * 
 * Tools:
 * 
 * 1. openrouter_chat - Chat completions with any OpenRouter model
 *    - Provider-prefixed model names (e.g., "openai/gpt-4", "anthropic/claude-3-5-sonnet")
 *    - Standard OpenAI message format
 *    - Automatic failover support
 * 
 * 2. openrouter_list_models - List all available models
 *    - Returns models from all providers
 *    - Includes pricing information
 * 
 * Examples:
 * 
 * List all models:
 *   { 
 *     tool: "openrouter_list_models",
 *     arguments: {}
 *   }
 * 
 * Chat with GPT-4 via OpenRouter:
 *   { 
 *     tool: "openrouter_chat",
 *     arguments: {
 *       model: "openai/gpt-4o",
 *       messages: [
 *         { role: "user", content: "Hello!" }
 *       ]
 *     }
 *   }
 * 
 * Chat with Claude via OpenRouter:
 *   { 
 *     tool: "openrouter_chat",
 *     arguments: {
 *       model: "anthropic/claude-3-5-sonnet",
 *       messages: [
 *         { role: "system", content: "You are helpful" },
 *         { role: "user", content: "Explain AI" }
 *       ],
 *       max_tokens: 1024
 *     }
 *   }
 * 
 * Chat with Gemini via OpenRouter:
 *   { 
 *     tool: "openrouter_chat",
 *     arguments: {
 *       model: "google/gemini-2.0-flash-exp",
 *       messages: [
 *         { role: "user", content: "Hello Gemini!" }
 *       ]
 *     }
 *   }
 */
export class OpenRouterCaller extends BaseCaller {
    private readonly baseUrl = "https://openrouter.ai/api/v1";

    protected async executeInternal(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const toolName = request.params.name;

        if (toolName === "openrouter_list_models") {
            return this.listModels(request);
        } else if (toolName === "openrouter_chat") {
            return this.chatCompletion(request);
        } else {
            throw new Error(`Unknown OpenRouter tool: ${toolName}`);
        }
    }

    /**
     * List all available models from OpenRouter
     */
    private async listModels(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const realApiKey = request.credentials.apiKey;

        if (!realApiKey) {
            throw new Error("API key is required but was not provided");
        }

        const response = await fetch(`${this.baseUrl}/models`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${realApiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `OpenRouter API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenRouterModelsResponse;

        if (!data.data || !Array.isArray(data.data)) {
            throw new Error(
                "Invalid response format from OpenRouter models API"
            );
        }

        // Format models list with pricing info
        const modelsList = data.data
            .slice(0, 50) // Limit to first 50 for readability
            .map((model) => {
                const contextLength = model.context_length
                    ? ` (${model.context_length} tokens)`
                    : "";
                return `- ${model.id}${contextLength}`;
            })
            .join("\n");

        return {
            content: [
                {
                    type: "text",
                    text: `Available models (showing 50 of ${data.data.length}):\n\n${modelsList}\n\nNote: OpenRouter provides 100+ models from multiple providers. Visit https://openrouter.ai/models for the complete list.`,
                },
            ],
        };
    }

    /**
     * Chat completion with OpenRouter
     */
    private async chatCompletion(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const { model, messages, temperature, max_tokens, top_p } = args;
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

        if (top_p !== undefined) {
            requestBody["top_p"] = top_p;
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
                `OpenRouter API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenRouterChatResponse;

        // Extract response text
        const messageContent = data.choices?.[0]?.message?.content;

        if (!messageContent) {
            throw new Error(
                "No response content from OpenRouter. Check model availability."
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
