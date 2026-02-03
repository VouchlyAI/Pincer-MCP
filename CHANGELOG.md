# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- Comprehensive security test suite

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

## [0.1.0] - 2026-02-03

### Added
- Project kickoff with Apache 2.0 license
- Initial architecture design and implementation plan
- Security specifications and threat model documentation

[Unreleased]: https://github.com/VouchlyAI/Pincer-MCP/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/VouchlyAI/Pincer-MCP/releases/tag/v0.1.0
