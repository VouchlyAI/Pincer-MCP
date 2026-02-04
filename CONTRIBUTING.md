# Contributing to Pincer-MCP

Thank you for your interest in contributing to Pincer-MCP! We're building the most secure credential isolation gateway for AI agents, and we welcome contributions that advance our mission of eliminating the "Lethal Trifecta" vulnerability in agentic systems.

## 🎯 Our Mission

Pincer-MCP ensures that AI agents **never see your real API keys**. Every contribution should align with our core security principles:
- **Zero-trust architecture**: Agents only interact with disposable proxy tokens
- **Credential isolation**: Real API keys stay encrypted in the OS keychain
- **JIT decryption**: Credentials are decrypted only when needed and immediately scrubbed
- **Fine-grained authorization**: Per-agent, per-tool access control

## 📋 Code of Conduct

We are committed to providing a welcoming and inclusive environment. All contributors are expected to:
- Be respectful and professional in all interactions
- Provide constructive feedback
- Focus on what is best for the community and the project
- Show empathy towards other community members

## 🐛 Reporting Bugs

If you find a bug, please create an issue with:
- **Clear title**: Summarize the issue in one line
- **Environment**: OS, Node.js version, Pincer version
- **Steps to reproduce**: Minimal steps to trigger the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Logs**: Relevant error messages or stack traces

**Security vulnerabilities**: Please report these privately via our [Security Policy](SECURITY.md), not as public issues.

## 💡 Suggesting Features

We welcome feature requests! Please create an issue with:
- **Use case**: Why is this feature needed?
- **Proposed solution**: How should it work?
- **Alternatives considered**: What other approaches did you think about?
- **Security implications**: How does this affect our security model?

## 🚀 Development Setup

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **OS**: macOS, Windows, or Linux with keychain support

### Installation

```bash
# Clone the repository
git clone https://github.com/VouchlyAI/Pincer-MCP.git
cd Pincer-MCP

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Project Structure

```
Pincer-MCP/
├── src/
│   ├── callers/          # API caller implementations
│   │   ├── base.ts       # Abstract base caller
│   │   ├── registry.ts   # Caller registry
│   │   └── *.ts          # Individual callers (gemini, openai, etc.)
│   ├── security/         # Security layer
│   │   ├── gatekeeper.ts # Proxy token authentication
│   │   └── validator.ts  # Zod schema validation
│   ├── vault/            # Credential vault
│   │   ├── store.ts      # Encrypted storage
│   │   └── injector.ts   # JIT credential injection
│   ├── audit/            # Audit logging
│   └── index.ts          # MCP server entry point
├── tests/                # Test suite
└── docs/                 # Documentation
```

## 🔧 Making Changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `security/description` - Security improvements

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): brief description

Longer explanation if needed.

Fixes #123
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `security`: Security improvements
- `test`: Test additions or fixes
- `refactor`: Code refactoring
- `chore`: Build/tooling changes

**Examples:**
```
feat(callers): add Anthropic Claude caller
fix(vault): prevent race condition in key decryption
docs(setup): clarify multi-key configuration
security(gatekeeper): add rate limiting for token validation
```

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following our coding standards
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run the test suite**: `npm test`
6. **Build the project**: `npm run build`
7. **Push your branch** and create a pull request
8. **Fill out the PR template** with:
   - Description of changes
   - Related issue numbers
   - Testing performed
   - Security considerations

### Code Review

All submissions require review. We use GitHub pull requests for this purpose. Reviewers will check:
- **Functionality**: Does it work as intended?
- **Security**: Does it maintain our zero-trust model?
- **Tests**: Are there adequate tests?
- **Documentation**: Is it well-documented?
- **Code quality**: Is it readable and maintainable?

## 📝 Coding Standards

### TypeScript

- Use **strict mode** (`strict: true` in tsconfig.json)
- Prefer **interfaces** over type aliases for object shapes
- Use **explicit return types** for public functions
- Avoid `any` - use `unknown` if type is truly unknown

### Security-First Coding

- **Never log credentials**: Ensure no API keys appear in logs
- **Scrub memory**: Clear sensitive data after use
- **Validate inputs**: Use Zod schemas for all external inputs
- **Fail securely**: Default to denying access on errors

### Documentation

- **JSDoc comments** for all public APIs
- **Inline comments** for complex logic
- **README updates** for new features
- **CHANGELOG entries** for all user-facing changes

### Testing

- **Unit tests** for individual functions
- **Integration tests** for MCP protocol interactions
- **Security tests** for authentication and authorization
- **Aim for 80%+ coverage** on security-critical components

## 🔌 Adding a New API Caller

Want to add support for a new LLM provider? Here's the step-by-step guide:

### 1. Create the Caller Class

Create `src/callers/yourapi.ts`:

```typescript
import { BaseCaller, EnrichedRequest } from "./base.js";

export class YourAPICaller extends BaseCaller {
    async call(request: EnrichedRequest): Promise<unknown> {
        const { apiKey } = request.credentials;
        const args = request.params.arguments;

        // Implement your API call logic here
        const response = await this.fetchWithRetry(
            "https://api.yourservice.com/v1/endpoint",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(args),
            }
        );

        return response;
    }
}
```

### 2. Register the Caller

Update `src/callers/registry.ts`:

```typescript
import { YourAPICaller } from "./yourapi.js";

constructor() {
    // ... existing callers
    this.callers.set("yourapi_chat", new YourAPICaller());
}
```

Add the tool schema in `getToolSchemas()`:

```typescript
{
    name: "yourapi_chat",
    description: "Chat completions using YourAPI",
    inputSchema: {
        type: "object",
        properties: {
            model: { type: "string" },
            messages: { type: "array", items: { /* ... */ } },
        },
        required: ["model", "messages"],
    },
}
```

### 3. Add Vault Mapping

Update `src/vault/injector.ts`:

```typescript
private getSecretKeyForTool(toolName: string): string {
    const mapping: Record<string, string> = {
        // ... existing mappings
        yourapi_chat: "yourapi_api_key",
    };
    return mapping[toolName] || toolName;
}
```

### 4. Add Zod Validation

Update `src/security/validator.ts`:

```typescript
this.schemas.set(
    "yourapi_chat",
    z.object({
        model: z.string().min(1),
        messages: z.array(z.object({
            role: z.enum(["system", "user", "assistant"]),
            content: z.string()
        })).min(1),
        __pincer_auth__: z.string().optional(),
    })
);
```

### 5. Update Documentation

- Add to `docs/TOOL_MAPPINGS.md`
- Update `CHANGELOG.md`
- Add usage examples to `README.md`

### 6. Add Tests

Create `tests/yourapi.test.ts` with:
- Schema validation tests
- Mock API response tests
- Error handling tests

### 7. Submit PR

Follow the pull request process above!

## 📚 Documentation Contributions

Documentation improvements are always welcome! You can help by:
- Fixing typos or unclear explanations
- Adding examples and use cases
- Improving setup instructions
- Translating documentation (future)

## 🙏 Recognition

Contributors will be recognized in:
- The project README
- Release notes
- Our community showcase (coming soon)

## 📞 Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Create an issue
- **Security**: See [SECURITY.md](SECURITY.md)
- **Chat**: Join our community (coming soon)

## 📄 License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

---

**Thank you for helping make AI agents more secure!** 🦀
