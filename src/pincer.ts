import { Gatekeeper } from "./security/gatekeeper.js";
import { Validator } from "./security/validator.js";
import { VaultInjector } from "./vault/injector.js";
import { AuditLogger } from "./audit/logger.js";
import { CallerRegistry } from "./callers/registry.js";

export class Pincer {
    private gatekeeper = new Gatekeeper();
    private validator = new Validator();
    private injector = new VaultInjector();
    private audit = new AuditLogger();
    private registry = new CallerRegistry();

    async listTools() {
        // Return available tools without requiring auth
        return {
            tools: this.registry.getToolSchemas(),
        };
    }

    async callTool(request: ToolCallRequest) {
        const startTime = Date.now();
        let agentId = "unknown";

        try {
            // Step 1: Extract proxy token from request body & authenticate
            const authResult = await this.gatekeeper.authenticate(request);
            agentId = authResult.agentId;

            console.error(`[${agentId}] Calling tool: ${request.params.name}`);

            // Step 2: Validate tool arguments against schema
            this.validator.validate(request.params.name, request.params.arguments || {});

            // Step 3: Get the appropriate caller
            const caller = this.registry.getCaller(request.params.name);

            // Step 4: JIT inject real credentials (proxy token → real API key)
            const enrichedRequest = await this.injector.injectCredentials(
                request,
                agentId,
                request.params.name
            );

            // Step 5: Execute the tool call
            const result = await caller.execute(enrichedRequest);

            // Step 6: Scrub secrets from volatile memory
            this.injector.scrubMemory(enrichedRequest);

            // Step 7: Log to audit trail
            await this.audit.log({
                agentId,
                tool: request.params.name,
                duration: Date.now() - startTime,
                status: "success",
            });

            console.error(`[${agentId}] ✅ Success (${Date.now() - startTime}ms)`);

            return { ...result, isError: false };
        } catch (error) {
            const err = error as Error;

            // Log failures with error details
            await this.audit.log({
                agentId,
                tool: request.params?.name || "unknown",
                duration: Date.now() - startTime,
                status: "error",
                error: err.message,
            });

            console.error(`[${agentId}] ❌ Error: ${err.message}`);

            throw error;
        }
    }

    close(): void {
        console.error("🔒 Cleaning up vault and closing connections...");
        this.gatekeeper.close();
        this.injector.close();
    }
}

interface ToolCallRequest {
    params: {
        name: string;
        arguments?: Record<string, unknown> | undefined;
        _meta?: Record<string, unknown> | undefined;
    };
}
