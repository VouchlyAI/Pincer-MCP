import { BaseCaller } from "./base.js";
import { GeminiCaller } from "./gemini.js";

export class CallerRegistry {
    private callers = new Map<string, BaseCaller>();

    constructor() {
        // Register available callers
        this.callers.set("gemini_generate", new GeminiCaller());
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
