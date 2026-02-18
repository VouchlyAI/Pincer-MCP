import { z } from "zod";

export class Validator {
    private schemas = new Map<string, z.ZodSchema>();

    constructor() {
        // Register tool schemas
        this.schemas.set(
            "gemini_generate",
            z.object({
                prompt: z.string().min(1).max(10000),
                model: z.string().min(1),
                temperature: z.number().min(0).max(2).optional(),
                // __pincer_auth__ is optional (will be removed by Gatekeeper)
                __pincer_auth__: z.string().optional(),
            })
        );

        // OpenWebUI Schemas
        this.schemas.set(
            "openwebui_chat",
            z.object({
                model: z.string().min(1),
                messages: z.array(z.object({
                    role: z.enum(["system", "user", "assistant"]),
                    content: z.string()
                })).min(1),
                url: z.string().url().optional(),
                temperature: z.number().min(0).max(2).optional(),
                max_tokens: z.number().positive().optional(),
                stream: z.boolean().optional(),
                __pincer_auth__: z.string().optional(),
            })
        );

        this.schemas.set(
            "openwebui_list_models",
            z.object({
                url: z.string().url().optional(),
                __pincer_auth__: z.string().optional(),
            })
        );

        // OpenAI Schemas
        this.schemas.set(
            "openai_chat",
            z.object({
                model: z.string().min(1),
                messages: z.array(z.object({
                    role: z.enum(["system", "user", "assistant"]),
                    content: z.string()
                })).min(1),
                temperature: z.number().min(0).max(2).optional(),
                max_tokens: z.number().positive().optional(),
                response_format: z.object({
                    type: z.enum(["text", "json_object"])
                }).optional(),
                __pincer_auth__: z.string().optional(),
            })
        );

        this.schemas.set(
            "openai_list_models",
            z.object({
                __pincer_auth__: z.string().optional(),
            })
        );

        // OpenAI-compatible Schemas
        this.schemas.set(
            "openai_compatible_chat",
            z.object({
                url: z.string().url().optional(),
                model: z.string().min(1),
                messages: z.array(z.object({
                    role: z.enum(["system", "user", "assistant"]),
                    content: z.string()
                })).min(1),
                temperature: z.number().min(0).max(2).optional(),
                max_tokens: z.number().positive().optional(),
                response_format: z.object({
                    type: z.enum(["text", "json_object"])
                }).optional(),
                __pincer_auth__: z.string().optional(),
            })
        );

        this.schemas.set(
            "openai_compatible_list_models",
            z.object({
                url: z.string().url().optional(),
                __pincer_auth__: z.string().optional(),
            })
        );

        // Claude Schemas
        this.schemas.set(
            "claude_chat",
            z.object({
                model: z.string().min(1),
                messages: z.array(z.object({
                    role: z.enum(["user", "assistant"]),
                    content: z.string()
                })).min(1),
                system: z.string().optional(),
                max_tokens: z.number().positive(),
                temperature: z.number().min(0).max(1).optional(),
                top_p: z.number().min(0).max(1).optional(),
                top_k: z.number().min(1).optional(),
                __pincer_auth__: z.string().optional(),
            })
        );

        // OpenRouter Schemas
        this.schemas.set(
            "openrouter_chat",
            z.object({
                model: z.string().min(1),
                messages: z.array(z.object({
                    role: z.enum(["system", "user", "assistant"]),
                    content: z.string()
                })).min(1),
                temperature: z.number().min(0).max(2).optional(),
                max_tokens: z.number().positive().optional(),
                top_p: z.number().min(0).max(1).optional(),
                __pincer_auth__: z.string().optional(),
            })
        );

        this.schemas.set(
            "openrouter_list_models",
            z.object({
                __pincer_auth__: z.string().optional(),
            })
        );

        // GPG Signing Proxy Schemas
        this.schemas.set(
            "gpg_sign_data",
            z.object({
                data: z.string().optional(),
                file_path: z.string().optional(),
                detached: z.boolean().optional(),
                __pincer_auth__: z.string().optional(),
            }).refine(
                (args) => args.data !== undefined || args.file_path !== undefined,
                { message: "Either 'data' or 'file_path' must be provided" }
            )
        );

        this.schemas.set(
            "gpg_decrypt",
            z.object({
                data: z.string().optional(),
                file_path: z.string().optional(),
                __pincer_auth__: z.string().optional(),
            }).refine(
                (args) => args.data !== undefined || args.file_path !== undefined,
                { message: "Either 'data' or 'file_path' must be provided" }
            )
        );
    }

    validate(toolName: string, args: unknown): void {
        const schema = this.schemas.get(toolName);
        if (!schema) {
            throw new Error(`Unknown tool: ${toolName}`);
        }

        try {
            // Zod will throw if validation fails
            schema.parse(args);
        } catch (error) {
            if (error instanceof z.ZodError) {
                const issues = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
                throw new Error(`Validation failed: ${issues}`);
            }
            throw error;
        }
    }
}
