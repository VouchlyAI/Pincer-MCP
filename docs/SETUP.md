# Pincer-MCP Setup Guide

This guide walks you through setting up Pincer-MCP from scratch, including installation, vault initialization, and configuring your first agent.

## Prerequisites

- **Node.js:** 18.0.0 or higher
- **Operating System:** macOS, Windows, or Linux with keychain support
  - macOS: Keychain Access (built-in)
  - Windows: Credential Manager (built-in)
  - Linux: GNOME Keyring or similar

## Installation

### Option 1: Global Installation (Recommended)

Install Pincer-MCP globally to use the `pincer` CLI from anywhere:

```bash
npm install -g pincer-mcp
```

Verify installation:
```bash
pincer --version
```

### Option 2: Local Development

Clone and build from source:

```bash
git clone https://github.com/VouchlyAI/Pincer-MCP.git
cd Pincer-MCP
npm install
npm run build
npm link  # Makes 'pincer' command available locally
```

## Vault Initialization

### Step 1: Initialize the Master Key

The master key is stored in your OS keychain and used to encrypt all secrets:

```bash
pincer init
```

**Output:**
```
✅ Master key initialized in OS keychain
   Service: pincer-mcp
   Account: master-key
```

**What this does:**
- Generates a cryptographically secure 256-bit AES key
- Stores it in your OS keychain (macOS Keychain, Windows Credential Manager, etc.)
- Creates `~/.pincer/vault.db` SQLite database

> **Important:** The master key never touches the filesystem. It's protected by your OS-level security (biometrics, passwords, etc.)

### Step 2: Store API Keys

Add your real API keys to the encrypted vault:

```bash
# Store Gemini API key
pincer set gemini_api_key "AIzaSyDpxPq_YOUR_ACTUAL_KEY_HERE"

# Store Slack token
pincer set slack_token "xoxb-12345-YOUR_SLACK_TOKEN"

# Store Google Cloud credentials (if needed)
pincer set gcloud_credentials '{"type":"service_account","project_id":"..."}'
```

**Tool-to-Secret Name Mappings:**

When storing secrets, use the correct secret name for each tool:

| Tool Name | Secret Name | Example |
|-----------|-------------|---------|
| `gemini_generate` | `gemini_api_key` | `pincer set gemini_api_key AIza...` |
| `slack_send_message` | `slack_token` | `pincer set slack_token xoxb-...` |
| `gcloud_create_vm` | `gcloud_credentials` | `pincer set gcloud_credentials {...}` |

> **Why different names?** Tool names (e.g., `gemini_generate`) are what you authorize agents to use. Secret names (e.g., `gemini_api_key`) are what you store in the vault. This allows one secret to power multiple tools or future tool additions.

**With labels (multi-key support):**
```bash
# Store multiple keys for the same tool
pincer set gemini_api_key "AIzaSy_DEV_KEY..." --label dev
pincer set gemini_api_key "AIzaSy_PROD_KEY..." --label production
```

### Step 3: Register an Agent

Create an agent identity and generate its proxy token:

```bash
pincer agent add myagent
```

**Output:**
```
✅ Agent registered: myagent
🎫 Proxy Token: pxr_V1StGXR8_Z5jdHi6B-myT
⚠️  Save this token securely! Give it to the agent.
   Set: export PINCER_PROXY_TOKEN="pxr_V1StGXR8_Z5jdHi6B-myT"
```

> **Critical:** Save this proxy token! This is the ONLY credential your agent will ever see. The agent never gets access to your real API keys.

### Step 4: Authorize the Agent

Grant the agent permission to use specific tools:

```bash
# Allow agent to use Gemini
pincer agent authorize myagent gemini_generate

# Allow agent to use Slack
pincer agent authorize myagent slack_send_message
```

**With specific key labels:**
```bash
# Use production key for this agent
pincer agent authorize myagent gemini_generate --key production
```

### Step 5: Verify Setup

List all registered agents and their permissions:

```bash
pincer agent list
```

**Output:**
```
👥 Registered Agents:

  myagent:
    Token: pxr_V1StGXR8_Z5jdHi6B-myT
    Tools:
      - gemini_generate (key: default)
      - slack_send_message (key: default)
```

## Running the MCP Server

### Development Mode

Start the server with automatic restart on file changes:

```bash
cd Pincer-MCP
npm run dev
```

### Production Mode

Build and run the compiled server:

```bash
npm run build
node dist/index.js
```

### As a Child Process

Run Pincer as a spawned MCP server from your application:

```javascript
import { spawn } from 'child_process';

const server = spawn('node', ['/path/to/pincer-mcp/dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send JSON-RPC requests to server.stdin
// Read responses from server.stdout
```

## Configuring Your Agent

### Option 1: Environment Variable

Set the proxy token as an environment variable:

```bash
export PINCER_PROXY_TOKEN="pxr_V1StGXR8_Z5jdHi6B-myT"
```

### Option 2: MCP Client Configuration

If using an MCP client library, configure it to connect to Pincer:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["/path/to/pincer-mcp/dist/index.js"],
});

const client = new Client({
  name: "myagent",
  version: "1.0.0",
}, {
  capabilities: {},
});

await client.connect(transport);
```

### Option 3: Include in Request Body

Include the proxy token in your JSON-RPC requests:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "gemini_generate",
    "arguments": {
      "prompt": "Hello world",
      "model": "gemini-2.0-flash"
    },
    "_meta": {
      "pincer_token": "pxr_V1StGXR8_Z5jdHi6B-myT"
    }
  },
  "id": 1
}
```

**Fallback location:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "gemini_generate",
    "arguments": {...},
    "__pincer_auth__": "pxr_V1StGXR8_Z5jdHi6B-myT"
  },
  "id": 1
}
```

## Making Your First API Call

### Using MCP SDK

```typescript
// List available tools
const tools = await client.listTools();
console.log(tools);

// Call Gemini with proxy token in metadata
const response = await client.callTool({
  name: "gemini_generate",
  arguments: {
    prompt: "Explain quantum computing in simple terms",
    model: "gemini-2.0-flash",
    temperature: 0.7
  },
  _meta: {
    pincer_token: process.env.PINCER_PROXY_TOKEN
  }
});

console.log(response.content[0].text);
```

### Raw JSON-RPC

```bash
# List tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js

# Call tool (requires proxy token)
echo '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "gemini_generate",
    "arguments": {
      "prompt": "Hello from Pincer!",
      "model": "gemini-2.0-flash"
    },
    "_meta": {
      "pincer_token": "pxr_V1StGXR8_Z5jdHi6B-myT"
    }
  },
  "id": 2
}' | node dist/index.js
```

## Multi-Agent Setup Example

### Scenario: Dev and Production Agents

Set up two agents with different API keys for development and production:

```bash
# Store two Gemini keys
pincer set gemini_api_key "AIzaSy_DEV_KEY_123" --label dev
pincer set gemini_api_key "AIzaSy_PROD_KEY_789" --label production

# Register development agent
pincer agent add dev-bot
pincer agent authorize dev-bot gemini_generate --key dev

# Register production agent
pincer agent add prod-bot
pincer agent authorize prod-bot gemini_generate --key production

# View setup
pincer agent list
```

**Result:**
- `dev-bot` calls use the dev API key (rate limits, quota separate)
- `prod-bot` calls use the production API key
- Both agents are isolated from each other's credentials

## Troubleshooting

### "Master key not found"

```bash
# Reinitialize the vault
pincer init
```

### "Invalid or expired proxy token"

```bash
# Verify token is registered
pincer agent list

# Re-register if needed
pincer agent add myagent --token pxr_CUSTOM_TOKEN
```

### "Agent not authorized for tool"

```bash
# Grant permission
pincer agent authorize myagent gemini_generate
```

### "Secret not found for tool"

```bash
# Verify secret is stored
pincer list

# Add if missing
pincer set gemini_api_key "YOUR_KEY"
```

### Clear and Reset

```bash
# Delete master key (WARNING: destructive!)
pincer reset

# Remove vault database
rm -rf ~/.pincer

# Start fresh
pincer init
```

## Security Best Practices

1. **Never share proxy tokens in code repositories**
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Rotate proxy tokens regularly**
   ```bash
   pincer agent add myagent --token pxr_NEW_TOKEN
   ```

3. **Use separate keys for dev/staging/prod**
   ```bash
   pincer set tool_name "key" --label environment
   ```

4. **Monitor audit logs**
   ```bash
   tail -f ~/.pincer/audit.jsonl
   ```

5. **Revoke agent access when no longer needed**
   ```bash
   # Delete agent mapping from database
   sqlite3 ~/.pincer/vault.db "DELETE FROM agent_mappings WHERE agent_id='old-agent'"
   ```

## Next Steps

- Read the [Capabilities Reference](CAPABILITIES.md) for full API documentation
- Check the [Testing Guide](TESTING.md) for running tests
- Review [CHANGELOG.md](../CHANGELOG.md) for version history
- Explore example integrations in `examples/` (coming soon)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VAULT_DB_PATH` | Path to vault database | `~/.pincer/vault.db` |
| `AUDIT_LOG_PATH` | Path to audit log | `~/.pincer/audit.jsonl` |
| `PINCER_PROXY_TOKEN` | Agent's proxy token | None (required) |

## Files Created by Pincer

```
~/.pincer/
├── vault.db          # Encrypted secrets (SQLite)
├── vault.db-shm      # SQLite shared memory
├── vault.db-wal      # SQLite write-ahead log
└── audit.jsonl       # Tamper-evident audit log
```

**Important:** These files contain encrypted data. The master key is in your OS keychain, NOT in these files.