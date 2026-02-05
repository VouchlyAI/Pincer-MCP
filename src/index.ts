import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Pincer } from "./pincer.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf8")
);

const server = new Server(
    {
        name: "pincer-mcp",
        version: pkg.version,
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const pincer = new Pincer();

// Register MCP handlers
server.setRequestHandler(ListToolsRequestSchema, () => pincer.listTools());
server.setRequestHandler(CallToolRequestSchema, (request) => pincer.callTool(request));

// Graceful shutdown
process.on("SIGINT", () => {
    console.error("🦞 Pincer-MCP shutting down...");
    pincer.close();
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.error("🦞 Pincer-MCP shutting down...");
    pincer.close();
    process.exit(0);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("🦞 Pincer-MCP started on stdio");
console.error("   Waiting for tool calls...");
