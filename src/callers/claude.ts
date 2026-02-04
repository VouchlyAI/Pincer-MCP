import { BaseCaller, EnrichedRequest, ToolResponse } from "./base.js";

interface ClaudeChatResponse {
    id?: string;
    type?: string;
    role?: string;
    content?: Array<{
        type?: string;
        text?: string;
    }>;
    model?: string;
    stop_reason?: string;
    stop_sequence?: string | null;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
}

/**
 * ClaudeCaller - Handles requests to Anthropic's Claude API
 * 
 * Supports Claude 3 and 3.5 models via the Messages API
 * 
 * Tool: claude_chat
 *    - Chat completions with Claude models
 *    - Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku, etc.
 *    - System prompts as separate parameter (not in messages array)
 *    - Required max_tokens parameter
 * 
 * API Differences from OpenAI:
 * - System prompt goes in separate 'system' parameter
 * - Messages only support 'user' and 'assistant' roles (no 'system')
 * - max_tokens is REQUIRED (not optional)
 * - Uses x-api-key header instead of Authorization: Bearer
 * - Requires anthropic-version header
 * 
 * Available Models:
 * - claude-3-5-sonnet-20241022 (latest, most capable)
 * - claude-3-opus-20240229 (powerful, for complex tasks)
 * - claude-3-sonnet-20240229 (balanced performance)
 * - claude-3-haiku-20240307 (fast, cost-effective)
 * 
 * Examples:
 * 
 * Simple chat:
 *   { 
 *     tool: "claude_chat",
 *     arguments: {
 *       model: "claude-3-5-sonnet-20241022",
 *       messages: [
 *         { role: "user", content: "Hello!" }
 *       ],
 *       max_tokens: 1024
 *     }
 *   }
 * 
 * With system prompt:
 *   { 
 *     tool: "claude_chat",
 *     arguments: {
 *       model: "claude-3-opus-20240229",
 *       system: "You are a helpful coding assistant",
 *       messages: [
 *         { role: "user", content: "Explain async/await" }
 *       ],
 *       max_tokens: 2048,
 *       temperature: 0.7
 *     }
 *   }
 * 
 * Multi-turn conversation:
 *   { 
 *     tool: "claude_chat",
 *     arguments: {
 *       model: "claude-3-haiku-20240307",
 *       messages: [
 *         { role: "user", content: "Hi there!" },
 *         { role: "assistant", content: "Hello! How can I help?" },
 *         { role: "user", content: "Tell me about TypeScript" }
 *       ],
 *       max_tokens: 1024
 *     }
 *   }
 */
export class ClaudeCaller extends BaseCaller {
    private readonly baseUrl = "https://api.anthropic.com/v1";
    private readonly apiVersion = "2023-06-01";

    protected async executeInternal(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const toolName = request.params.name;

        if (toolName === "claude_chat") {
            return this.chatCompletion(request);
        } else {
            throw new Error(`Unknown Claude tool: ${toolName}`);
        }
    }

    /**
     * Chat completion with Claude
     */
    private async chatCompletion(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const { model, messages, system, max_tokens, temperature, top_p, top_k } =
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

        // Validate max_tokens (REQUIRED by Anthropic)
        if (max_tokens === undefined || typeof max_tokens !== "number") {
            throw new Error(
                "max_tokens parameter is required and must be a number for Claude API"
            );
        }

        // Validate messages format (only user/assistant roles)
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
            if (msg.role !== "user" && msg.role !== "assistant") {
                throw new Error(
                    'Message role must be "user" or "assistant" for Claude. Use the "system" parameter for system prompts.'
                );
            }
        }

        // Build request body
        const requestBody: Record<string, unknown> = {
            model,
            messages,
            max_tokens,
        };

        // Add optional system prompt
        if (system !== undefined && typeof system === "string") {
            requestBody["system"] = system;
        }

        if (temperature !== undefined) {
            requestBody["temperature"] = temperature;
        }

        if (top_p !== undefined) {
            requestBody["top_p"] = top_p;
        }

        if (top_k !== undefined) {
            requestBody["top_k"] = top_k;
        }

        const response = await fetch(`${this.baseUrl}/messages`, {
            method: "POST",
            headers: {
                "x-api-key": realApiKey,
                "anthropic-version": this.apiVersion,
                "content-type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Claude API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as ClaudeChatResponse;

        // Extract response text from content array
        const messageContent = data.content?.[0]?.text;

        if (!messageContent) {
            throw new Error(
                "No response content from Claude. Check model availability and parameters."
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
