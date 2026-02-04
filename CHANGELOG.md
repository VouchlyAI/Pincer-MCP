# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
