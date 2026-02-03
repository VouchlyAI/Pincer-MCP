import { z } from "zod";

export class Validator {
    private schemas = new Map<string, z.ZodSchema>();

    constructor() {
        // Register tool schemas
        this.schemas.set(
            "gemini_generate",
            z.object({
                prompt: z.string().min(1).max(10000),
                model: z.enum(["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"]),
                temperature: z.number().min(0).max(2).optional(),
                // __pincer_auth__ is optional (will be removed by Gatekeeper)
                __pincer_auth__: z.string().optional(),
            })
        );

        this.schemas.set(
            "slack_send_message",
            z.object({
                channel: z.string().regex(/^[C|D][A-Z0-9]{8,}$/),
                text: z.string().min(1).max(4000),
                __pincer_auth__: z.string().optional(),
            })
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
