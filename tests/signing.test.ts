import { describe, it, expect, beforeAll } from "vitest";
import * as openpgp from "openpgp";
import { SigningCaller } from "../src/callers/signing.js";
import { Validator } from "../src/security/validator.js";
import type { EnrichedRequest } from "../src/callers/base.js";

// ---------------------------------------------------------------------------
// Test fixture: generate a real ECC keypair once for the entire suite.
// This avoids the overhead of key generation per test.
// ---------------------------------------------------------------------------

interface KeyBundle {
    armoredPrivateKey: string;
    passphrase: string;
    fingerprint: string;
    userID: string;
}

let testKeyBundle: KeyBundle;
let testPublicKeyArmored: string;

beforeAll(async () => {
    const passphrase = "test-passphrase-pincer-2026";
    const { privateKey, publicKey } = await openpgp.generateKey({
        type: "curve25519",
        userIDs: [{ name: "Pincer Test", email: "test@pincer.dev" }],
        passphrase,
    });

    const parsedKey = await openpgp.readPrivateKey({ armoredKey: privateKey as string });
    const fingerprint = parsedKey.getFingerprint().toUpperCase();

    testKeyBundle = {
        armoredPrivateKey: privateKey as string,
        passphrase,
        fingerprint,
        userID: "Pincer Test <test@pincer.dev>",
    };
    testPublicKeyArmored = publicKey as string;
});

// ---------------------------------------------------------------------------
// Helper: build a minimal EnrichedRequest for the SigningCaller
// ---------------------------------------------------------------------------
function makeRequest(
    toolName: "gpg_sign_data" | "gpg_decrypt",
    args: Record<string, unknown>,
    keyBundle: KeyBundle
): EnrichedRequest {
    return {
        params: {
            name: toolName,
            arguments: args,
        },
        credentials: {
            apiKey: JSON.stringify(keyBundle),
        },
    } as unknown as EnrichedRequest;
}

// ---------------------------------------------------------------------------
// gpg_sign_data tests
// ---------------------------------------------------------------------------

describe("SigningCaller — gpg_sign_data", () => {
    let caller: SigningCaller;

    beforeAll(() => {
        caller = new SigningCaller();
    });

    it("should return a detached PGP signature for inline data", async () => {
        const req = makeRequest("gpg_sign_data", { data: "Hello, Pincer!" }, testKeyBundle);
        const result = await caller.execute(req);

        expect(result.content).toHaveLength(1);
        const parsed = JSON.parse(result.content[0].text);

        expect(parsed.detached).toBe(true);
        expect(parsed.signature).toMatch(/-----BEGIN PGP SIGNATURE-----/);
        expect(parsed.fingerprint).toBe(testKeyBundle.fingerprint);
        expect(parsed.userID).toBe(testKeyBundle.userID);
        expect(parsed.source).toBe("inline_data");
    });

    it("should return a clearsigned message when detached=false", async () => {
        const req = makeRequest(
            "gpg_sign_data",
            { data: "Clearsign this", detached: false },
            testKeyBundle
        );
        const result = await caller.execute(req);

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.detached).toBe(false);
        expect(parsed.signed_message).toMatch(/-----BEGIN PGP MESSAGE-----/);
    });

    it("should produce a signature that verifies against the public key", async () => {
        const plaintext = "Verifiable content";
        const req = makeRequest("gpg_sign_data", { data: plaintext }, testKeyBundle);
        const result = await caller.execute(req);

        const parsed = JSON.parse(result.content[0].text);

        // Verify the signature using openpgp directly
        const publicKey = await openpgp.readKey({ armoredKey: testPublicKeyArmored });
        const message = await openpgp.createMessage({ text: plaintext });
        const signature = await openpgp.readSignature({ armoredSignature: parsed.signature });

        const verificationResult = await openpgp.verify({
            message,
            signature,
            verificationKeys: publicKey,
        });

        const { verified } = verificationResult.signatures[0];
        await expect(verified).resolves.toBe(true); // resolves to true = valid signature
    });

    it("should include the key fingerprint in the response", async () => {
        const req = makeRequest("gpg_sign_data", { data: "fingerprint check" }, testKeyBundle);
        const result = await caller.execute(req);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.fingerprint).toBe(testKeyBundle.fingerprint);
        expect(parsed.fingerprint).toHaveLength(40); // Full fingerprint is 40 hex chars
    });

    it("should throw when neither data nor file_path is provided", async () => {
        const req = makeRequest("gpg_sign_data", {}, testKeyBundle);
        await expect(caller.execute(req)).rejects.toThrow(/data.*file_path/i);
    });

    it("should throw when file_path does not exist", async () => {
        const req = makeRequest(
            "gpg_sign_data",
            { file_path: "/nonexistent/path/to/file.txt" },
            testKeyBundle
        );
        await expect(caller.execute(req)).rejects.toThrow(/Failed to read file/);
    });

    it("should throw when key bundle JSON is malformed", async () => {
        const req = {
            params: { name: "gpg_sign_data", arguments: { data: "test" } },
            credentials: { apiKey: "not-valid-json{{{" },
        } as unknown as EnrichedRequest;

        await expect(caller.execute(req)).rejects.toThrow(/Invalid GPG key bundle/);
    });

    it("should throw when key bundle is missing required fields", async () => {
        const badBundle = JSON.stringify({ fingerprint: "ABCD" }); // missing armoredPrivateKey + passphrase
        const req = {
            params: { name: "gpg_sign_data", arguments: { data: "test" } },
            credentials: { apiKey: badBundle },
        } as unknown as EnrichedRequest;

        await expect(caller.execute(req)).rejects.toThrow(/Key bundle missing required fields/);
    });

    it("should throw when passphrase is wrong", async () => {
        const badBundle: KeyBundle = { ...testKeyBundle, passphrase: "wrong-passphrase" };
        const req = makeRequest("gpg_sign_data", { data: "test" }, badBundle);
        await expect(caller.execute(req)).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// gpg_decrypt tests
// ---------------------------------------------------------------------------

describe("SigningCaller — gpg_decrypt", () => {
    let caller: SigningCaller;
    let encryptedMessage: string;
    const plaintext = "Secret message for Pincer";

    beforeAll(async () => {
        caller = new SigningCaller();

        // Encrypt a message with the test public key so we can decrypt it in tests
        const publicKey = await openpgp.readKey({ armoredKey: testPublicKeyArmored });
        const message = await openpgp.createMessage({ text: plaintext });
        encryptedMessage = await openpgp.encrypt({
            message,
            encryptionKeys: publicKey,
        }) as string;
    });

    it("should decrypt a PGP-encrypted message and return plaintext", async () => {
        const req = makeRequest("gpg_decrypt", { data: encryptedMessage }, testKeyBundle);
        const result = await caller.execute(req);

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.decrypted_data).toBe(plaintext);
        expect(parsed.fingerprint).toBe(testKeyBundle.fingerprint);
        expect(parsed.source).toBe("inline_data");
    });

    it("should include the key fingerprint in the response", async () => {
        const req = makeRequest("gpg_decrypt", { data: encryptedMessage }, testKeyBundle);
        const result = await caller.execute(req);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.fingerprint).toBe(testKeyBundle.fingerprint);
    });

    it("should throw when neither data nor file_path is provided", async () => {
        const req = makeRequest("gpg_decrypt", {}, testKeyBundle);
        await expect(caller.execute(req)).rejects.toThrow(/data.*file_path/i);
    });

    it("should throw when file_path does not exist", async () => {
        const req = makeRequest(
            "gpg_decrypt",
            { file_path: "/nonexistent/encrypted.asc" },
            testKeyBundle
        );
        await expect(caller.execute(req)).rejects.toThrow(/Failed to read file/);
    });

    it("should throw when ciphertext is not valid PGP", async () => {
        const req = makeRequest("gpg_decrypt", { data: "this is not pgp data" }, testKeyBundle);
        await expect(caller.execute(req)).rejects.toThrow();
    });

    it("should throw when key bundle JSON is malformed", async () => {
        const req = {
            params: { name: "gpg_decrypt", arguments: { data: encryptedMessage } },
            credentials: { apiKey: "{{broken json" },
        } as unknown as EnrichedRequest;

        await expect(caller.execute(req)).rejects.toThrow(/Invalid GPG key bundle/);
    });

    it("should throw when wrong private key is used for decryption", async () => {
        // Generate a different keypair — decryption should fail
        const { privateKey: otherPrivate } = await openpgp.generateKey({
            type: "curve25519",
            userIDs: [{ name: "Other Key", email: "other@pincer.dev" }],
            passphrase: "other-pass",
        });
        const parsedOther = await openpgp.readPrivateKey({ armoredKey: otherPrivate as string });

        const wrongBundle: KeyBundle = {
            armoredPrivateKey: otherPrivate as string,
            passphrase: "other-pass",
            fingerprint: parsedOther.getFingerprint().toUpperCase(),
            userID: "Other Key <other@pincer.dev>",
        };

        const req = makeRequest("gpg_decrypt", { data: encryptedMessage }, wrongBundle);
        await expect(caller.execute(req)).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Validator schema tests for signing tools
// ---------------------------------------------------------------------------

describe("Validator — GPG tool schemas", () => {
    let validator: Validator;

    beforeAll(() => {
        validator = new Validator();
    });

    it("should accept gpg_sign_data with data field", () => {
        expect(() => {
            validator.validate("gpg_sign_data", { data: "some content" });
        }).not.toThrow();
    });

    it("should accept gpg_sign_data with file_path field", () => {
        expect(() => {
            validator.validate("gpg_sign_data", { file_path: "/path/to/file.txt" });
        }).not.toThrow();
    });

    it("should accept gpg_sign_data with detached=false", () => {
        expect(() => {
            validator.validate("gpg_sign_data", { data: "content", detached: false });
        }).not.toThrow();
    });

    it("should reject gpg_sign_data with neither data nor file_path", () => {
        expect(() => {
            validator.validate("gpg_sign_data", {});
        }).toThrow(/Validation failed/);
    });

    it("should accept gpg_decrypt with data field", () => {
        expect(() => {
            validator.validate("gpg_decrypt", { data: "-----BEGIN PGP MESSAGE-----..." });
        }).not.toThrow();
    });

    it("should accept gpg_decrypt with file_path field", () => {
        expect(() => {
            validator.validate("gpg_decrypt", { file_path: "/path/to/encrypted.asc" });
        }).not.toThrow();
    });

    it("should reject gpg_decrypt with neither data nor file_path", () => {
        expect(() => {
            validator.validate("gpg_decrypt", {});
        }).toThrow(/Validation failed/);
    });
});
