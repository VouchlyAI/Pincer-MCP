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
- Comprehensive test suite with Vitest (12/12 passing)
  - Integration tests: MCP server tool listing, authentication flow, validation
  - Unit tests: Gatekeeper proxy token extraction, Validator schema checks
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

### Fixed
- Made `arguments` parameter optional in `ToolCallRequest` interface for better type safety
- Updated MCP server request handlers to use proper SDK schema imports (`ListToolsRequestSchema`, `CallToolRequestSchema`)
- Added fallback to empty object when arguments are undefined in validator calls

### Security
- Master encryption key stored in OS-native keychain (never in files)
- Proxy tokens prevent agents from accessing real API keys
- Memory scrubbing overwrites secrets with zeros after use
- Fine-grained agent-to-tool authorization mappings
- Append-only, tamper-evident audit logs
