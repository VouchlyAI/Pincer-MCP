import { BaseCaller, EnrichedRequest, ToolResponse } from "./base.js";

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
        finishReason?: string;
    }>;
}

/**
 * GeminiCaller - Handles requests to Google's Gemini API
 * 
 * Supports:
 * - Simple prompts: Use the 'prompt' parameter for single-turn requests
 * - System instructions: Use 'systemInstruction' to guide model behavior
 * - Multi-turn conversations: Use 'contents' array for conversation history
 * 
 * Examples:
 * 
 * 1. Simple prompt:
 *    { prompt: "What is 2+2?", model: "gemini-2.0-flash" }
 * 
 * 2. With system instruction:
 *    { 
 *      prompt: "Write a poem", 
 *      systemInstruction: "You are a professional poet",
 *      model: "gemini-2.0-flash" 
 *    }
 * 
 * 3. Multi-turn conversation:
 *    { 
 *      contents: [
 *        { role: "user", parts: [{ text: "Hello!" }] },
 *        { role: "model", parts: [{ text: "Hi there!" }] },
 *        { role: "user", parts: [{ text: "Tell me about AI" }] }
 *      ],
 *      systemInstruction: "You are a helpful AI assistant",
 *      model: "gemini-2.0-flash"
 *    }
 */
export class GeminiCaller extends BaseCaller {
    protected async executeInternal(
        request: EnrichedRequest
    ): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const { prompt, model, temperature, systemInstruction, contents } = args;
        const realApiKey = request.credentials.apiKey;

        if (!realApiKey) {
            throw new Error("API key is required but was not provided");
        }

        // Build request body with optional parameters
        const requestBody: Record<string, unknown> = {
            generationConfig: {
                temperature: temperature ?? 1.0,
            },
        };

        // Add system instruction if provided
        if (systemInstruction && typeof systemInstruction === 'string') {
            requestBody['systemInstruction'] = {
                parts: [{ text: systemInstruction }]
            };
        }

        // Add contents - either from the contents array or from the prompt parameter
        if (contents && Array.isArray(contents)) {
            requestBody['contents'] = contents;
        } else if (prompt && typeof prompt === 'string') {
            requestBody['contents'] = [{ parts: [{ text: prompt }] }];
        } else {
            throw new Error('Either "prompt" or "contents" parameter must be provided');
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": realApiKey, // Real key (not proxy token)
                },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as GeminiResponse;

        // Handle case where Gemini blocks content
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const blockReason = data.candidates?.[0]?.finishReason || "unknown";
            throw new Error(`Gemini blocked content. Reason: ${blockReason}`);
        }

        return {
            content: [
                {
                    type: "text",
                    text: data.candidates[0].content.parts[0].text,
                },
            ],
        };
    }
}
