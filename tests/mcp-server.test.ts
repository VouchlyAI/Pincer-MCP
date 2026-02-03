import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, ChildProcess } from "child_process";

describe("MCP Server Integration", () => {
    let serverProcess: ChildProcess;
    let client: Client;
    let transport: StdioClientTransport;

    beforeAll(async () => {
        // Start the MCP server as a subprocess
        serverProcess = spawn("node", ["dist/index.js"], {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "inherit"], // stdin, stdout, stderr
        });

        // Give the server a moment to start
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Create MCP client
        client = new Client(
            {
                name: "pincer-test-client",
                version: "1.0.0",
            },
            {
                capabilities: {},
            }
        );

        // Connect to the server via stdio
        transport = new StdioClientTransport({
            command: "node",
            args: ["dist/index.js"],
        });

        await client.connect(transport);
    });

    afterAll(async () => {
        // Clean up
        await client.close();
        serverProcess.kill();
    });

    it("should list available tools", async () => {
        const response = await client.listTools();

        expect(response.tools).toBeDefined();
        expect(response.tools.length).toBeGreaterThan(0);

        // Check that gemini_generate tool exists
        const geminiTool = response.tools.find(
            (tool) => tool.name === "gemini_generate"
        );
        expect(geminiTool).toBeDefined();
        expect(geminiTool?.description).toContain("Gemini");
    });

    it("should reject tool call without authentication", async () => {
        await expect(
            client.callTool({
                name: "gemini_generate",
                arguments: {
                    prompt: "Hello",
                    model: "gemini-2.0-flash",
                },
            })
        ).rejects.toThrow(/proxy token/i);
    });

    it("should reject tool call with invalid proxy token format", async () => {
        await expect(
            client.callTool({
                name: "gemini_generate",
                arguments: {
                    prompt: "Hello",
                    model: "gemini-2.0-flash",
                    __pincer_auth__: "invalid_token_format",
                },
            })
        ).rejects.toThrow(/Invalid proxy token format/i);
    });

    it("should reject unknown tool (auth error first)", async () => {
        // Note: Authentication happens before tool validation,
        // so we get "Missing proxy token" error first
        await expect(
            client.callTool({
                name: "nonexistent_tool",
                arguments: {},
            })
        ).rejects.toThrow(/proxy token/i);
    });
});
