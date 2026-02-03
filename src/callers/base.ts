export abstract class BaseCaller {
    protected maxRetries = 3;
    protected retryDelay = 1000; // ms

    async execute(request: EnrichedRequest): Promise<ToolResponse> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await this.executeInternal(request);
            } catch (error) {
                lastError = error as Error;

                // Don't retry on auth failures
                if (this.isAuthError(error)) {
                    throw error;
                }

                // Exponential backoff (only if we're going to retry)
                if (attempt < this.maxRetries - 1) {
                    await this.sleep(this.retryDelay * Math.pow(2, attempt));
                }
            }
        }

        throw new Error(
            `Failed after ${this.maxRetries} retries: ${lastError?.message}`
        );
    }

    protected abstract executeInternal(
        request: EnrichedRequest
    ): Promise<ToolResponse>;

    protected isAuthError(error: unknown): boolean {
        const message = (error as Error).message.toLowerCase();
        return (
            message.includes("unauthorized") ||
            message.includes("forbidden") ||
            message.includes("401") ||
            message.includes("403")
        );
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export interface EnrichedRequest {
    params: {
        name: string;
        arguments?: Record<string, unknown> | undefined;
    };
    credentials: {
        apiKey?: string | undefined;
        agentId: string;
    };
}

export interface ToolResponse {
    content: Array<{
        type: string;
        text: string;
    }>;
}
