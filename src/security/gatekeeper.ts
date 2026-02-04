import { VaultStore } from "../vault/store.js";

export class Gatekeeper {
    private vault = new VaultStore();

    async authenticate(request: ToolCallRequest): Promise<AuthResult> {
        // Step 1: Extract proxy token from request body
        const proxyToken = this.extractProxyToken(request);

        if (!proxyToken) {
            throw new Error(
                "Missing proxy token. Include it in '_meta.pincer_token', '__pincer_auth__', or set PINCER_PROXY_TOKEN env variable"
            );
        }

        // Step 2: Validate proxy token format
        if (!this.isValidProxyToken(proxyToken)) {
            throw new Error("Invalid proxy token format. Expected 'pxr_' prefix.");
        }

        // Step 3: Resolve proxy token to agent ID
        const agentId = await this.vault.getAgentByProxyToken(proxyToken);

        if (!agentId) {
            throw new Error("Invalid or expired proxy token");
        }

        // Step 4: Verify agent is authorized for this tool
        const toolName = request.params.name;
        const isAuthorized = this.vault.isAgentAuthorized(agentId, toolName);

        if (!isAuthorized) {
            throw new Error(
                `Agent '${agentId}' is not authorized to use tool '${toolName}'`
            );
        }

        return { agentId, proxyToken };
    }

    /**
     * Extract proxy token from request body or environment variable
     * Priority: 1) _meta.pincer_token, 2) __pincer_auth__, 3) PINCER_PROXY_TOKEN env
     */
    private extractProxyToken(request: ToolCallRequest): string | null {
        // Preferred: _meta.pincer_token (JSON-RPC 2.0 metadata convention)
        if (request.params._meta && "pincer_token" in request.params._meta) {
            const token = request.params._meta["pincer_token"];
            if (typeof token === "string") {
                return token;
            }
        }

        // Fallback 1: __pincer_auth__ in tool arguments
        const args = request.params.arguments || {};
        if (typeof args === "object" && "__pincer_auth__" in args) {
            const token = args["__pincer_auth__"] as string;

            // Remove from arguments to avoid leaking to external APIs
            delete args["__pincer_auth__"];

            return token;
        }

        // Fallback 2: Environment variable (useful for MCP clients)
        const envToken = process.env["PINCER_PROXY_TOKEN"];
        if (envToken && typeof envToken === "string") {
            return envToken;
        }

        return null;
    }

    /**
     * Validate proxy token format (pxr_<nanoid>)
     */
    private isValidProxyToken(token: string): boolean {
        return /^pxr_[A-Za-z0-9_-]{21,}$/.test(token);
    }

    close(): void {
        this.vault.close();
    }
}

interface ToolCallRequest {
    params: {
        name: string;
        arguments?: Record<string, unknown> | undefined;
        _meta?: Record<string, unknown> | undefined;
    };
}

interface AuthResult {
    agentId: string;
    proxyToken: string;
}
