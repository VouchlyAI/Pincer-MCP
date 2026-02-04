import { BaseCaller, EnrichedRequest, ToolResponse } from "./base.js";

interface OpenAIChatResponse {
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

interface OpenAIModel {
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
}

interface OpenAIModelsResponse {
    data?: OpenAIModel[];
    object?: string;
}

/**
 * OpenAICaller - Handles requests to OpenAI API
 * 
 * Supports two tools:
 * 
 * 1. openai_chat - Chat completions with GPT models
 *    - Messages with roles (system, user, assistant)
 *    - Configurable model selection (gpt-4o, gpt-4-turbo, gpt-3.5-turbo, etc.)
 *    - Temperature and token controls
 *    - Response format options
 * 
 * 2. openai_list_models - List available OpenAI models
 *    - Returns all accessible models
 * 
 * API Key Configuration:
 * - Retrieved from vault using agent-specific credentials
 * - Managed via `pincer set openai_api_key` CLI command
 * 
 * Examples:
 * 
 * List models:
 *   { 
 *     tool: "openai_list_models",
 *     arguments: {}
 *   }
 * 
 * Chat completion:
 *   { 
 *     tool: "openai_chat",
 *     arguments: {
 *       model: "gpt-4o",
 *       messages: [
 *         { role: "system", content: "You are a helpful assistant" },
 *         { role: "user", content: "Hello!" }
 *       ]
 *     }
 *   }
 * 
 * With temperature control:
 *   { 
 *     tool: "openai_chat",
 *     arguments: {
 *       model: "gpt-3.5-turbo",
 *       messages: [...],
 *       temperature: 0.7,
 *       max_tokens: 150
 *     }
 *   }
 */
export class OpenAICaller extends BaseCaller {
    private readonly baseUrl = "https://api.openai.com/v1";

    protected async executeInternal(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const toolName = request.params.name;

        if (toolName === "openai_list_models") {
            return this.listModels(request);
        } else if (toolName === "openai_chat") {
            return this.chatCompletion(request);
        } else {
            throw new Error(`Unknown OpenAI tool: ${toolName}`);
        }
    }

    /**
     * List all available models from OpenAI
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
                `OpenAI API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenAIModelsResponse;

        if (!data.data || !Array.isArray(data.data)) {
            throw new Error("Invalid response format from OpenAI models API");
        }

        // Filter and format models list (show only GPT models for clarity)
        const gptModels = data.data.filter((model) =>
            model.id.includes("gpt")
        );

        const modelsList = gptModels
            .map((model) => {
                const ownedBy = model.owned_by ? ` (${model.owned_by})` : "";
                return `- ${model.id}${ownedBy}`;
            })
            .join("\n");

        const allModelsCount = data.data.length;
        const gptCount = gptModels.length;

        return {
            content: [
                {
                    type: "text",
                    text: `Available GPT models (${gptCount} of ${allModelsCount} total):\n\n${modelsList}`,
                },
            ],
        };
    }

    /**
     * Chat completion with OpenAI
     */
    private async chatCompletion(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const { model, messages, temperature, max_tokens, response_format } =
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
                `OpenAI API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenAIChatResponse;

        // Extract response text
        const messageContent = data.choices?.[0]?.message?.content;

        if (!messageContent) {
            throw new Error(
                "No response content from OpenAI. Check model availability."
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
