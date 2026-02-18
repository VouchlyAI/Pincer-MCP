import { appendFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { homedir } from "os";
import { join, dirname } from "path";

export class AuditLogger {
    private logPath: string;
    private lastHash: string = "0000000000000000"; // Genesis hash

    constructor() {
        this.logPath =
            process.env['AUDIT_LOG_PATH'] || join(homedir(), ".pincer", "audit.jsonl");

        // Ensure directory exists
        const dir = dirname(this.logPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        // Load last hash from existing log
        this.loadLastHash();
    }

    async log(event: AuditEvent): Promise<void> {
        // Generate timestamps
        const now = new Date();
        const timestamp_utc = now.toISOString();
        const timestamp_local = now.toLocaleString();

        // Prepare full log entry
        const logEntryBase = {
            ...event,
            timestamp_utc,
            timestamp_local,
        };

        // Create chain hash (links to previous event, including timestamps)
        const chainHash = this.computeChainHash(JSON.stringify(logEntryBase));

        // Append to log with chain hash
        const logEntry = {
            ...logEntryBase,
            chainHash,
            prevHash: this.lastHash,
        };

        appendFileSync(this.logPath, JSON.stringify(logEntry) + "\n");

        // Update chain
        this.lastHash = chainHash;
    }

    private computeChainHash(data: string): string {
        const hash = createHash("sha256");
        hash.update(this.lastHash + data);
        return hash.digest("hex").slice(0, 16);
    }

    private loadLastHash(): void {
        if (!existsSync(this.logPath)) {
            return;
        }

        const content = readFileSync(this.logPath, "utf8");
        const lines = content.trim().split("\n");

        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            if (lastLine) {
                try {
                    const lastEntry = JSON.parse(lastLine);
                    this.lastHash = lastEntry.chainHash || "0000000000000000";
                } catch (error) {
                    // If parse fails, keep genesis hash
                    console.error("⚠️  Warning: Could not parse last audit log entry");
                }
            }
        }
    }
}

interface AuditEvent {
    timestamp_utc?: string;
    timestamp_local?: string;
    agentId: string;
    tool: string;
    duration: number;
    status: "success" | "error";
    error?: string;
    input_chars?: number;
    output_chars?: number;
    estimated_input_tokens?: number;
    estimated_output_tokens?: number;
    // GPG Signing Proxy fields
    signing_key_id?: string;
    signing_operation?: "sign" | "decrypt";
}
