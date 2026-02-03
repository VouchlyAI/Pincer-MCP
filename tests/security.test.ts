import { describe, it, expect, beforeEach } from "vitest";
import { Gatekeeper } from "../src/security/gatekeeper.js";
import { Validator } from "../src/security/validator.js";

describe("Security Layer", () => {
    describe("Gatekeeper - Proxy Token Extraction", () => {
        let gatekeeper: Gatekeeper;

        beforeEach(() => {
            gatekeeper = new Gatekeeper();
        });

        it("should extract proxy token from _meta.pincer_token", async () => {
            const request = {
                params: {
                    name: "test_tool",
                    arguments: {},
                    _meta: {
                        pincer_token: "pxr_V1StGXR8_Z5jdHi6B-myT",
                    },
                },
            };

            // This will fail because token not in vault, but validates extraction works
            await expect(gatekeeper.authenticate(request)).rejects.toThrow(
                /Invalid or expired/
            );
        });

        it("should extract proxy token from __pincer_auth__ fallback", async () => {
            const request = {
                params: {
                    name: "test_tool",
                    arguments: {
                        __pincer_auth__: "pxr_A3fgH9kL_P2jdQr8X-yzW",
                    },
                },
            };

            await expect(gatekeeper.authenticate(request)).rejects.toThrow(
                /Invalid or expired/
            );
        });

        it("should reject missing proxy token", async () => {
            const request = {
                params: {
                    name: "test_tool",
                    arguments: {},
                },
            };

            await expect(gatekeeper.authenticate(request)).rejects.toThrow(
                /Missing proxy token/
            );
        });

        it("should reject invalid proxy token format", async () => {
            const request = {
                params: {
                    name: "test_tool",
                    arguments: {},
                    _meta: {
                        pincer_token: "invalid_format",
                    },
                },
            };

            await expect(gatekeeper.authenticate(request)).rejects.toThrow(
                /Invalid proxy token format/
            );
        });
    });

    describe("Validator - Schema Validation", () => {
        let validator: Validator;

        beforeEach(() => {
            validator = new Validator();
        });

        it("should validate correct gemini_generate arguments", () => {
            expect(() => {
                validator.validate("gemini_generate", {
                    prompt: "Hello world",
                    model: "gemini-2.0-flash",
                    temperature: 1.0,
                });
            }).not.toThrow();
        });

        it("should reject invalid model", () => {
            expect(() => {
                validator.validate("gemini_generate", {
                    prompt: "Hello",
                    model: "invalid-model",
                });
            }).toThrow(/Validation failed/);
        });

        it("should reject temperature out of range", () => {
            expect(() => {
                validator.validate("gemini_generate", {
                    prompt: "Hello",
                    model: "gemini-2.0-flash",
                    temperature: 3.0, // Max is 2.0
                });
            }).toThrow(/Validation failed/);
        });

        it("should reject unknown tool", () => {
            expect(() => {
                validator.validate("unknown_tool", {});
            }).toThrow(/Unknown tool/);
        });
    });
});
