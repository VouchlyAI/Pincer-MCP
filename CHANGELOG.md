# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-02-05

### Fixed
- **Schema Validation**: Shortened description in `server.json` to comply with the 100-character maximum length enforced by the MCP schema.

### Changed
- **Versioning**: Updated MCP server and CLI to dynamically read version from `package.json` at runtime, eliminating hardcoded version strings.
- **Packaging**: Bundled `server.json` in the NPM package to support direct integration with MCP registries.

### Added
- **Configuration**: Added `AUDIT_LOG_PATH` to the `server.json` environment variables schema to improve discoverability in MCP registries.

## [0.1.2] - 2026-02-05

### Changed
- **Dependency Update**: Bumped `@modelcontextprotocol/sdk` to v1.26.0 for improved protocol stability.
- **Security Hardening**: Updated `express-rate-limit` sub-dependency to include `ip-address` for better network validation.
- **Maintenance**: Synced `package-lock.json` with latest upstream changes.

## [0.1.1] - 2026-02-05

### Added
- **Dual Timestamping in Audit Logs**: Forensic audit logs now record both local and UTC timestamps for every event.
- **Enhanced Log Integrity**: Timestamps are now included in the SHA-256 chain hash, making the temporal record tamper-evident.

### Changed
- Centralized timestamp generation in `AuditLogger` to ensure consistency and protocol integrity.

### Fixed
- Fixed redundant timestamp generation in the Pincer orchestrator.

## [0.1.0] - 2026-02-04

### Added
- Project kickoff with Apache 2.0 license
- Initial architecture design and implementation plan
- Security specifications and threat model documentation
- Initial project setup with TypeScript and MCP SDK
- Two-tiered vault architecture (OS Keychain + SQLite)
- Body-based proxy token authentication system
- Gatekeeper for token extraction from `_meta.pincer_token` and `__pincer_auth__`
- VaultStore with AES-256-GCM encryption for secrets
- JIT credential injection with automatic memory scrubbing
- Vault CLI for initialization, secret storage, and agent management
- Forensic audit logging with SHA-256 chain hashing
- Abstract BaseCaller with retry logic and exponential backoff
- Gemini API caller implementation
- Zod schema validation for tool arguments
- Comprehensive test suite with Vitest (21/21 passing)
  - Integration tests: MCP server tool listing, authentication flow, validation
  - Unit tests: Gatekeeper proxy token extraction, Validator schema checks
  - Multi-key tests: Key storage, per-agent assignment, encryption
  - Coverage tracking for security-critical components
- **Executable CLI binary** - Install globally via npm and use `pincer` command
- **Multi-key support** - Store multiple API keys per tool with labels (e.g., key1, key2, production)
- **Per-agent key assignment** - Different agents can use different keys for the same tool
  - Example: `clawdbot` uses `gemini_key#1`, `mybot` uses `gemini_key#2`
- Enhanced vault commands:
  - `pincer init` - Initialize vault
  - `pincer set <tool> <key> --label <name>` - Add labeled keys
  - `pincer list` - View all stored keys
  - `pincer agent add <id>` - Register agents
  - `pincer agent authorize <id> <tool> --key <label>` - Assign specific keys
  - `pincer agent list` - View all agents and their permissions
  - `pincer agent revoke <id> <tool>` - Revoke specific tool access
  - `pincer agent remove <id>` - Remove agent entirely
- **Vault cleanup commands**:
  - `pincer clear [--yes]` - Delete all secrets/agents (keeps master key)
  - `pincer nuke [--yes]` - Complete vault destruction (master key + database)
  - `pincer reset` - Delete master key only
- **Environment variable proxy token fallback**: Gatekeeper now checks `PINCER_PROXY_TOKEN` environment variable if token is not in request, making MCP client integration simpler
- **Tool-to-Secret mapping documentation**: Added clear tables in README, SETUP.md, and IDE_INTEGRATION.md showing which secret name to use for each tool (e.g., `gemini_generate` → `gemini_api_key`)
- **OpenWebUI caller** - Self-hosted LLM support:
  - `openwebui_chat` - OpenAI-compatible chat completions with any OpenWebUI instance
  - `openwebui_list_models` - Fetch available models from OpenWebUI
  - Configurable URL via parameter or `OPENWEBUI_URL` env var
  - Default: `https://openwebui.com` (supports self-hosted instances)
  - Zod validation schemas for message format and parameters
  - Ideal for AI engineers testing local/self-hosted LLMs (Llama, Mistral, Granite, etc.)
- **OpenAI caller** - GPT model support:
  - `openai_chat` - Chat completions with GPT models (gpt-4o, gpt-4-turbo, gpt-3.5-turbo, etc.)
  - `openai_list_models` - List all available OpenAI models
  - Full message history support with system, user, and assistant roles
  - Temperature and max_tokens configuration
  - Response format options for structured outputs
  - Secure API key management through vault (`openai_api_key`)
- **OpenAI-compatible caller** - Generic OpenAI-spec API support:
  - `openai_compatible_chat` - Chat completions with any OpenAI-compatible endpoint
  - `openai_compatible_list_models` - List models from custom endpoints
  - Configurable URL via `OPENAI_COMPATIBLE_URL` env var or `url` parameter
  - Perfect for Azure OpenAI, local Ollama, vLLM servers, or other providers
  - Reuses standard OpenAI message format and parameters
  - Secure API key management through vault (`openai_compatible_api_key`)
- **Claude (Anthropic) caller** - Claude 3/3.5 model support:
  - `claude_chat` - Chat completions with Claude models (Sonnet, Opus, Haiku)
  - Messages API with separate system prompt parameter
  - Required max_tokens parameter (Anthropic requirement)
  - Support for Claude 3.5 Sonnet, Claude 3 Opus, and Haiku models
  - Temperature, top_p, and top_k controls
  - Secure API key management through vault (`claude_api_key`)
- **OpenRouter caller** - Unified multi-provider API support:
  - `openrouter_chat` - Access 100+ models from multiple providers
  - `openrouter_list_models` - List all available models across providers
  - Single API for OpenAI, Anthropic, Google, Meta, Mistral, and more
  - Provider-prefixed model names (e.g., `openai/gpt-4`, `anthropic/claude-3-5-sonnet`)
  - Standard OpenAI message format
  - Secure API key management through vault (`openrouter_api_key`)

### Changed
- **Proxy token authentication** now supports 3 sources (priority order):
  1. Request metadata (`_meta.pincer_token`)
  2. Tool arguments (`__pincer_auth__`)
  3. Environment variable (`PINCER_PROXY_TOKEN`) ← NEW
- Error messages now mention all available token authentication methods

### Fixed
- Made `arguments` parameter optional in `ToolCallRequest` interface for better type safety
- Fixed database column mapping in `VaultStore.getSecret()` for multi-key support (snake_case SQL → camelCase TypeScript)
- Updated MCP server request handlers to use proper SDK schema imports (`ListToolsRequestSchema`, `CallToolRequestSchema`)
- Added fallback to empty object when arguments are undefined in validator calls

### Security
- Master encryption key stored in OS-native keychain (never in files)
- Proxy tokens prevent agents from accessing real API keys
- Memory scrubbing overwrites secrets with zeros after use
- Fine-grained agent-to-tool authorization mappings
- Append-only, tamper-evident audit logs

[Unreleased]: https://github.com/VouchlyAI/Pincer-MCP/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/VouchlyAI/Pincer-MCP/releases/tag/v0.1.0
