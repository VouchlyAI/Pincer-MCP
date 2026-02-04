import { BaseCaller } from "./base.js";
import { GeminiCaller } from "./gemini.js";
import { OpenWebUICaller } from "./openwebui.js";

export class CallerRegistry {
    private callers = new Map<string, BaseCaller>();

    constructor() {
        // Register available callers
        this.callers.set("gemini_generate", new GeminiCaller());
        this.callers.set("openwebui_chat", new OpenWebUICaller());
        this.callers.set("openwebui_list_models", new OpenWebUICaller());
        // Add more callers here as they're implemented
    }

    getCaller(toolName: string): BaseCaller {
        const caller = this.callers.get(toolName);

        if (!caller) {
            throw new Error(`No caller registered for tool: ${toolName}`);
        }

        return caller;
    }

    getToolSchemas() {
        return [
            {
                name: "gemini_generate",
                description:
                    "Generate content using Google's Game Gemini AI models. Supports Flash and Pro variants.",
                inputSchema: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "The text prompt to send to Gemini (used when contents is not provided)",
                        },
                        model: {
                            type: "string",
                            enum: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
                            description: "The Gemini model to use",
                            default: "gemini-2.0-flash",
                        },
                        temperature: {
                            type: "number",
                            description:
                                "Controls randomness (0.0 = deterministic, 2.0 = very random)",
                            minimum: 0,
                            maximum: 2,
                            default: 1.0,
                        },
                        systemInstruction: {
                            type: "string",
                            description: "Optional system instruction to guide the model's behavior",
                        },
                        contents: {
                            type: "array",
                            description: "Optional array of content objects for multi-turn conversations. Each object should have a 'role' (user/model) and 'parts' array",
                            items: {
                                type: "object",
                                properties: {
                                    role: {
                                        type: "string",
                                        enum: ["user", "model"],
                                    },
                                    parts: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                text: {
                                                    type: "string",
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    required: ["model"],
                },
            },
            // OpenWebUI tools
            {
                name: "openwebui_chat",
                description:
                    "Chat completions using OpenWebUI API. Supports any OpenWebUI instance (hosted or self-hosted) with OpenAI-compatible chat API.",
                inputSchema: {
                    type: "object",
                    properties: {
                        model: {
                            type: "string",
                            description: "Model identifier (e.g., 'llama3', 'gpt-4o', 'granite3.1-dense:8b')",
                        },
                        messages: {
                            type: "array",
                            description: "Array of message objects with 'role' and 'content'",
                            items: {
                                type: "object",
                                properties: {
                                    role: {
                                        type: "string",
                                        enum: ["system", "user", "assistant"],
                                        description: "Message role"
                                    },
                                    content: {
                                        type: "string",
                                        description: "Message content"
                                    },
                                },
                                required: ["role", "content"],
                            },
                        },
                        url: {
                            type: "string",
                            description: "Optional: Base URL for OpenWebUI instance (overrides OPENWEBUI_URL env var, default: https://openwebui.com)",
                        },
                        temperature: {
                            type: "number",
                            description: "Controls randomness (0.0 = deterministic, 2.0 = very random)",
                            minimum: 0,
                            maximum: 2,
                            default: 0.7,
                        },
                        max_tokens: {
                            type: "number",
                            description: "Maximum tokens in response",
                        },
                        stream: {
                            type: "boolean",
                            description: "Whether to stream the response",
                            default: false,
                        },
                    },
                    required: ["model", "messages"],
                },
            },
            {
                name: "openwebui_list_models",
                description:
                    "List all available models from OpenWebUI instance. Use this to discover which models are available before making chat requests.",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "Optional: Base URL for OpenWebUI instance (overrides OPENWEBUI_URL env var, default: https://openwebui.com)",
                        },
                    },
                    required: [],
                },
            },
            // Placeholder for future tools
            {
                name: "slack_send_message",
                description: "Send a message to a Slack channel (coming soon)",
                inputSchema: {
                    type: "object",
                    properties: {
                        channel: {
                            type: "string",
                            description: "Slack channel ID (e.g., C1234567890)",
                        },
                        text: {
                            type: "string",
                            description: "Message text to send",
                        },
                    },
                    required: ["channel", "text"],
                },
            },
        ];
    }
}
