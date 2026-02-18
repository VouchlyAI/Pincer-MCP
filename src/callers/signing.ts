import * as openpgp from "openpgp";
import { readFileSync } from "fs";
import { BaseCaller, EnrichedRequest, ToolResponse } from "./base.js";

export class SigningCaller extends BaseCaller {
    protected override maxRetries = 1; // Signing is local, no point retrying

    protected override async executeInternal(request: EnrichedRequest): Promise<ToolResponse> {
        const toolName = request.params.name;

        switch (toolName) {
            case "gpg_sign_data":
                return await this.signData(request);
            case "gpg_decrypt":
                return await this.decryptData(request);
            default:
                throw new Error(`Unknown signing tool: ${toolName}`);
        }
    }

    /**
     * Sign data or file contents using a PGP private key from the vault.
     * The agent never sees the private key — only the detached signature is returned.
     */
    private async signData(request: EnrichedRequest): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const dataArg = args['data'] as string | undefined;
        const filePath = args['file_path'] as string | undefined;
        const detached = (args['detached'] as boolean) ?? true;

        // Resolve the data to sign
        let contentToSign: string;
        if (filePath) {
            try {
                contentToSign = readFileSync(filePath, "utf8");
            } catch (error) {
                throw new Error(`Failed to read file: ${filePath} — ${(error as Error).message}`);
            }
        } else if (dataArg) {
            contentToSign = dataArg;
        } else {
            throw new Error("Either 'data' or 'file_path' must be provided");
        }

        // Parse the vault secret — contains {armoredPrivateKey, passphrase, fingerprint, userID}
        const keyBundle = this.parseKeyBundle(request.credentials.apiKey!);

        // Read and decrypt the private key
        const privateKey = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: keyBundle.armoredPrivateKey }),
            passphrase: keyBundle.passphrase,
        });

        // Create the message
        const message = await openpgp.createMessage({ text: contentToSign });

        if (detached) {
            // Detached signature — most common for git commits, file signing
            const signature = await openpgp.sign({
                message,
                signingKeys: privateKey,
                detached: true,
            });

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            signature: signature as string,
                            fingerprint: keyBundle.fingerprint,
                            userID: keyBundle.userID,
                            detached: true,
                            source: filePath ? `file:${filePath}` : "inline_data",
                        }, null, 2),
                    },
                ],
            };
        } else {
            // Inline (clearsigned) signature
            const signedMessage = await openpgp.sign({
                message,
                signingKeys: privateKey,
            });

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            signed_message: signedMessage as string,
                            fingerprint: keyBundle.fingerprint,
                            userID: keyBundle.userID,
                            detached: false,
                            source: filePath ? `file:${filePath}` : "inline_data",
                        }, null, 2),
                    },
                ],
            };
        }
    }

    /**
     * Decrypt PGP-encrypted data using the private key from the vault.
     * The agent sends ciphertext, Pincer decrypts with the private key, returns plaintext.
     */
    private async decryptData(request: EnrichedRequest): Promise<ToolResponse> {
        const args = request.params.arguments || {};
        const encryptedData = args['data'] as string | undefined;
        const filePath = args['file_path'] as string | undefined;

        // Resolve the encrypted content
        let ciphertext: string;
        if (filePath) {
            try {
                ciphertext = readFileSync(filePath, "utf8");
            } catch (error) {
                throw new Error(`Failed to read file: ${filePath} — ${(error as Error).message}`);
            }
        } else if (encryptedData) {
            ciphertext = encryptedData;
        } else {
            throw new Error("Either 'data' (armored PGP message) or 'file_path' must be provided");
        }

        // Parse the vault secret
        const keyBundle = this.parseKeyBundle(request.credentials.apiKey!);

        // Read and decrypt the private key
        const privateKey = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: keyBundle.armoredPrivateKey }),
            passphrase: keyBundle.passphrase,
        });

        // Read the encrypted message
        const message = await openpgp.readMessage({ armoredMessage: ciphertext });

        // Decrypt
        const { data: decrypted } = await openpgp.decrypt({
            message,
            decryptionKeys: privateKey,
        });

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        decrypted_data: decrypted as string,
                        fingerprint: keyBundle.fingerprint,
                        source: filePath ? `file:${filePath}` : "inline_data",
                    }, null, 2),
                },
            ],
        };
    }

    /**
     * Parse the JSON key bundle stored in the vault.
     * Format: {armoredPrivateKey, passphrase, fingerprint, userID}
     */
    private parseKeyBundle(raw: string): KeyBundle {
        try {
            const parsed = JSON.parse(raw);
            if (!parsed.armoredPrivateKey || !parsed.passphrase) {
                throw new Error("Key bundle missing required fields");
            }
            return parsed as KeyBundle;
        } catch (error) {
            if ((error as Error).message.includes("Key bundle")) {
                throw error;
            }
            throw new Error(
                "Invalid GPG key bundle in vault. Expected JSON with {armoredPrivateKey, passphrase, fingerprint, userID}. " +
                "Use 'pincer key generate' or 'pincer key import' to store keys properly."
            );
        }
    }
}

interface KeyBundle {
    armoredPrivateKey: string;
    passphrase: string;
    fingerprint: string;
    userID: string;
}
