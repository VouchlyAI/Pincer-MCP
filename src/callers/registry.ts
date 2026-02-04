import { BaseCaller } from "./base.js";
import { GeminiCaller } from "./gemini.js";
import { OpenWebUICaller } from "./openwebui.js";
import { OpenAICaller } from "./openai.js";
import { OpenAICompatibleCaller } from "./openai-compatible.js";
import { ClaudeCaller } from "./claude.js";
import { OpenRouterCaller } from "./openrouter.js";

export class CallerRegistry {
    private callers = new Map<string, BaseCaller>();

    constructor() {
        // Register available callers
        this.callers.set("gemini_generate", new GeminiCaller());
        this.callers.set("openwebui_chat", new OpenWebUICaller());
        this.callers.set("openwebui_list_models", new OpenWebUICaller());
        this.callers.set("openai_chat", new OpenAICaller());
        this.callers.set("openai_list_models", new OpenAICaller());
        this.callers.set("openai_compatible_chat", new OpenAICompatibleCaller());
        this.callers.set("openai_compatible_list_models", new OpenAICompatibleCaller());
        this.callers.set("claude_chat", new ClaudeCaller());
        this.callers.set("openrouter_chat", new OpenRouterCaller());
        this.callers.set("openrouter_list_models", new OpenRouterCaller());
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
            // OpenAI tools
            {
                name: "openai_chat",
                description:
                    "Chat completions using OpenAI API. Supports GPT models including gpt-4o, gpt-4-turbo, gpt-3.5-turbo, and more.",
                inputSchema: {
                    type: "object",
                    properties: {
                        model: {
                            type: "string",
                            description: "Model identifier (e.g., 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo')",
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
                                        description: "Message role",
                                    },
                                    content: {
                                        type: "string",
                                        description: "Message content",
                                    },
                                },
                                required: ["role", "content"],
                            },
                        },
                        temperature: {
                            type: "number",
                            description:
                                "Controls randomness (0.0 = deterministic, 2.0 = very random)",
                            minimum: 0,
                            maximum: 2,
                            default: 1.0,
                        },
                        max_tokens: {
                            type: "number",
                            description: "Maximum tokens in response",
                        },
                        response_format: {
                            type: "object",
                            description: "Response format specification (e.g., {type: 'json_object'})",
                        },
                    },
                    required: ["model", "messages"],
                },
            },
            {
                name: "openai_list_models",
                description:
                    "List all available models from OpenAI. Use this to discover which models are available before making chat requests.",
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
            // OpenAI-compatible tools (for Azure OpenAI, local servers, etc.)
            {
                name: "openai_compatible_chat",
                description:
                    "Chat completions using any OpenAI-compatible API endpoint. Perfect for Azure OpenAI, local Ollama, vLLM servers, or other OpenAI-spec providers. Requires OPENAI_COMPATIBLE_URL env var or 'url' parameter.",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "Optional: Base URL for the OpenAI-compatible endpoint (overrides OPENAI_COMPATIBLE_URL env var). Examples: 'https://your-resource.openai.azure.com' or 'http://localhost:11434/v1'",
                        },
                        model: {
                            type: "string",
                            description: "Model identifier (deployment name for Azure, model name for others)",
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
                                        description: "Message role",
                                    },
                                    content: {
                                        type: "string",
                                        description: "Message content",
                                    },
                                },
                                required: ["role", "content"],
                            },
                        },
                        temperature: {
                            type: "number",
                            description:
                                "Controls randomness (0.0 = deterministic, 2.0 = very random)",
                            minimum: 0,
                            maximum: 2,
                            default: 1.0,
                        },
                        max_tokens: {
                            type: "number",
                            description: "Maximum tokens in response",
                        },
                        response_format: {
                            type: "object",
                            description: "Response format specification (e.g., {type: 'json_object'})",
                        },
                    },
                    required: ["model", "messages"],
                },
            },
            {
                name: "openai_compatible_list_models",
                description:
                    "List all available models from an OpenAI-compatible endpoint. Use this to discover which models are available. Requires OPENAI_COMPATIBLE_URL env var or 'url' parameter.",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "Optional: Base URL for the OpenAI-compatible endpoint (overrides OPENAI_COMPATIBLE_URL env var)",
                        },
                    },
                    required: [],
                },
            },
            // Claude (Anthropic) tools
            {
                name: "claude_chat",
                description:
                    "Chat completions using Anthropic's Claude models. Supports Claude 3.5 Sonnet, Claude 3 Opus, Haiku, and more. Uses Messages API with separate system parameter.",
                inputSchema: {
                    type: "object",
                    properties: {
                        model: {
                            type: "string",
                            description: "Model identifier (e.g., 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307')",
                        },
                        messages: {
                            type: "array",
                            description: "Array of message objects with 'role' (user/assistant only) and 'content'. System prompts go in separate 'system' parameter.",
                            items: {
                                type: "object",
                                properties: {
                                    role: {
                                        type: "string",
                                        enum: ["user", "assistant"],
                                        description: "Message role (only user/assistant, no system)",
                                    },
                                    content: {
                                        type: "string",
                                        description: "Message content",
                                    },
                                },
                                required: ["role", "content"],
                            },
                        },
                        system: {
                            type: "string",
                            description: "Optional system prompt (separate from messages)",
                        },
                        max_tokens: {
                            type: "number",
                            description: "Maximum tokens in response (REQUIRED by Anthropic)",
                        },
                        temperature: {
                            type: "number",
                            description:
                                "Controls randomness (0.0 = deterministic, 1.0 = very random)",
                            minimum: 0,
                            maximum: 1,
                            default: 1.0,
                        },
                        top_p: {
                            type: "number",
                            description: "Nucleus sampling threshold",
                            minimum: 0,
                            maximum: 1,
                        },
                        top_k: {
                            type: "number",
                            description: "Top-k sampling parameter",
                            minimum: 1,
                        },
                    },
                    required: ["model", "messages", "max_tokens"],
                },
            },
            // OpenRouter tools (unified multi-provider API)
            {
                name: "openrouter_chat",
                description:
                    "Chat completions using OpenRouter's unified API. Access 100+ models from multiple providers (OpenAI, Anthropic, Google, Meta, Mistral, etc.) through a single endpoint. Model names are provider-prefixed (e.g., 'openai/gpt-4', 'anthropic/claude-3-5-sonnet').",
                inputSchema: {
                    type: "object",
                    properties: {
                        model: {
                            type: "string",
                            description: "Provider-prefixed model identifier (e.g., 'openai/gpt-4o', 'anthropic/claude-3-5-sonnet', 'google/gemini-2.0-flash-exp')",
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
                                        description: "Message role",
                                    },
                                    content: {
                                        type: "string",
                                        description: "Message content",
                                    },
                                },
                                required: ["role", "content"],
                            },
                        },
                        temperature: {
                            type: "number",
                            description:
                                "Controls randomness (0.0 = deterministic, 2.0 = very random)",
                            minimum: 0,
                            maximum: 2,
                            default: 1.0,
                        },
                        max_tokens: {
                            type: "number",
                            description: "Maximum tokens in response",
                        },
                        top_p: {
                            type: "number",
                            description: "Nucleus sampling threshold",
                            minimum: 0,
                            maximum: 1,
                        },
                    },
                    required: ["model", "messages"],
                },
            },
            {
                name: "openrouter_list_models",
                description:
                    "List all available models from OpenRouter. Returns 100+ models from multiple providers including OpenAI, Anthropic, Google, Meta, and more.",
                inputSchema: {
                    type: "object",
                    properties: {},
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
