# Integrating Pincer-MCP with IDEs and MCP Clients

This guide covers how to integrate Pincer-MCP with various IDEs and MCP-compatible tools, including VSCode, Cursor, Claude Desktop, and other MCP clients.

## Important: Vault Setup is CLI-Based

**Key Point:** Vault management is done via the `pincer` CLI from your terminal, regardless of which IDE or client uses the MCP server.

```bash
# Setup is the same for all clients
pincer init                              # One-time vault initialization
pincer set gemini_api_key "AIza..."     # Store API keys
pincer agent add my-ide                  # Create agent
pincer agent authorize my-ide gemini_generate  # Grant permissions
```

Once the vault is set up, any IDE or MCP client can connect to the Pincer server using the proxy token.

---

## VSCode / Cursor Integration

VSCode and Cursor support MCP through extensions or settings.

### Prerequisites

1. **Pincer-MCP installed:**
   ```bash
   npm install -g pincer-mcp
   # Or use local build: npm link
   ```

2. **Vault initialized:**
   ```bash
   pincer init
   pincer set gemini_api_key "YOUR_KEY"
   pincer agent add vscode
   # Save the proxy token!
   ```

### Configuration

#### Option 1: VSCode Settings (settings.json)

Add to your workspace or user `settings.json`:

```jsonc
{
  "mcp.servers": {
    "pincer": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/to/pincer-mcp/dist/index.js"
      ],
      "env": {
        "PINCER_PROXY_TOKEN": "pxr_V1StGXR8_Z5jdHi6B-myT"
      }
    }
  }
}
```

**Proxy Token Configuration:**

Pincer accepts the proxy token in **three ways** (priority order):

1. **Environment variable** (recommended for MCP clients):
   ```json
   "env": {
     "PINCER_PROXY_TOKEN": "pxr_YOUR_TOKEN"
   }
   ```
   
2. **Request metadata** (if your MCP client supports custom metadata):
   ```json
   "_meta": {
     "pincer_token": "pxr_YOUR_TOKEN"
   }
   ```

3. **Tool arguments** (fallback):
   ```json
   "arguments": {
     "__pincer_auth__": "pxr_YOUR_TOKEN",
     "prompt": "..."
   }
   ```

> **Recommended:** Use the environment variable approach in your MCP config. Pincer will automatically use it for all tool calls, avoiding the need to inject the token into each request.

**Note:** The `env` section is optional for vault paths. Pincer uses these defaults:
- Vault: `~/.pincer/vault.db` 
- Audit log: `~/.pincer/audit.jsonl`

Only set custom paths if you need to override them.

#### Option 2: MCP Extension Configuration

If using an MCP extension:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Search for "MCP: Configure Servers"
3. Add Pincer server:
   ```json
   {
     "name": "pincer",
     "command": "node",
     "args": ["/path/to/pincer-mcp/dist/index.js"],
     "env": {
       "PINCER_PROXY_TOKEN": "pxr_YOUR_TOKEN"
     }
   }
   ```

### Usage in VSCode

Once configured, Pincer tools appear in the MCP tool palette:

1. Open any file
2. Use AI assistant (Copilot, Cody, Continue, etc.)
3. Available tools:
   - `pincer/gemini_generate` - Text generation
   - `pincer/slack_send_message` - Slack integration
   - `pincer/gcloud_create_vm` - Cloud operations

**Example prompt:**
```
Use the pincer/gemini_generate tool to explain this function
```

---

## Claude Desktop Integration

Claude Desktop has native MCP support.

### Configuration File Location

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

### Setup Steps

1. **Initialize Pincer vault** (one-time):
   ```bash
   pincer init
   pincer set gemini_api_key "YOUR_KEY"
   pincer agent add claude-desktop
   # Output: pxr_abc123...
   ```

2. **Create/edit Claude config:**
   ```json
   {
     "mcpServers": {
       "pincer": {
         "command": "node",
         "args": ["/absolute/path/to/pincer-mcp/dist/index.js"],
         "env": {
           "PINCER_PROXY_TOKEN": "pxr_abc123..."
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

4. **Verify connection:**
   - Look for "3 tools available from pincer" in Claude interface
   - Type "What tools do you have access to?"

### Using Pincer Tools in Claude

Claude automatically discovers Pincer tools:

```
User: "Use Gemini to summarize this document"

Claude: [Uses pincer/gemini_generate automatically]
```

Claude handles the proxy token authentication transparently.

---

## Cursor IDE Integration

Cursor has built-in MCP support similar to VSCode.

### Configuration

Add to Cursor's settings (`.cursor/config.json` or workspace settings):

```json
{
  "mcp": {
    "servers": {
      "pincer": {
        "command": "node",
        "args": ["/path/to/pincer-mcp/dist/index.js"],
        "env": {
          "PINCER_PROXY_TOKEN": "pxr_YOUR_TOKEN"
        }
      }
    }
  }
}
```

### Usage

Cursor's AI can invoke Pincer tools directly:

```
Select code → Ask: "Use Gemini to refactor this"
```

---

## Cline (VSCode Extension) Integration

Cline supports MCP servers via configuration.

### Setup

1. **Install Cline extension** in VSCode

2. **Configure MCP server:**
   - Open Cline settings
   - Add custom MCP server:
     ```json
     {
       "name": "Pincer Security Gateway",
       "command": "node /path/to/pincer-mcp/dist/index.js",
       "env": {
         "PINCER_PROXY_TOKEN": "pxr_YOUR_TOKEN"
       }
     }
     ```

3. **Restart VSCode**

### Usage

Cline will list Pincer tools in its tool menu.

---

## Generic MCP Client Integration

For any MCP-compatible client:

### Standard Configuration Format

```json
{
  "servers": {
    "pincer": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/pincer-mcp/dist/index.js"],
      "env": {
        "PINCER_PROXY_TOKEN": "pxr_YOUR_TOKEN_HERE",
        "VAULT_DB_PATH": "/custom/path/.pincer/vault.db",
        "AUDIT_LOG_PATH": "/custom/path/.pincer/audit.jsonl"
      }
    }
  }
}
```

### Required Fields

- `command`: Path to Node.js or `node` if in PATH
- `args`: Path to `dist/index.js`

### Optional Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PINCER_PROXY_TOKEN` | Agent authentication | None (client must send in request) |
| `VAULT_DB_PATH` | Vault database location | `~/.pincer/vault.db` |
| `AUDIT_LOG_PATH` | Audit log file | `~/.pincer/audit.jsonl` |

---

## Vault Management from Terminal

**Important:** Vault setup and management is ALWAYS done via the `pincer` CLI, regardless of which IDE/client you use.

### Initial Setup (Once per machine)

```bash
# 1. Install Pincer
npm install -g pincer-mcp

# 2. Initialize vault
pincer init

# 3. Store API keys
pincer set gemini_api_key "AIzaSy..."
pincer set slack_token "xoxb-..."

# 4. List keys to verify
pincer list
```

**Tool-to-Secret Name Mappings:**

| Tool Name | Secret Name to Store |
|-----------|---------------------|
| `gemini_generate` | `gemini_api_key` |
| `slack_send_message` | `slack_token` |
| `gcloud_create_vm` | `gcloud_credentials` |

> **Important:** Use the secret name (right column) with `pincer set`, and the tool name (left column) with `pincer agent authorize`.

### Per-IDE Agent Setup

Create a separate agent for each IDE/client:

```bash
# VSCode agent
pincer agent add vscode
pincer agent authorize vscode gemini_generate
# Output: pxr_vscode_token_123

# Claude Desktop agent
pincer agent add claude-desktop
pincer agent authorize claude-desktop gemini_generate
# Output: pxr_claude_token_456

# Cursor agent
pincer agent add cursor
pincer agent authorize cursor gemini_generate
# Output: pxr_cursor_token_789
```

**Benefits of separate agents:**
- Track which IDE made which API calls (audit logs)
- Different permission levels per IDE
- Revoke access to one IDE without affecting others
- Separate rate limits/quotas

### Viewing Agent Permissions

```bash
pincer agent list
```

**Output:**
```
👥 Registered Agents:

  vscode:
    Token: pxr_vscode_token_123
    Tools:
      - gemini_generate (key: default)

  claude-desktop:
    Token: pxr_claude_token_456
    Tools:
      - gemini_generate (key: default)
      - slack_send_message (key: default)

  cursor:
    Token: pxr_cursor_token_789
    Tools:
      - gemini_generate (key: production)
```

---

## Security Considerations

### 1. Protect Proxy Tokens

**Don't commit to git:**
```bash
# Add to .gitignore
echo "claude_desktop_config.json" >> .gitignore
echo ".cursor/config.json" >> .gitignore
echo "settings.json" >> .gitignore
```

**Use environment variables when possible:**
```json
{
  "env": {
    "PINCER_PROXY_TOKEN": "${env:PINCER_TOKEN}"
  }
}
```

Then set in shell:
```bash
export PINCER_TOKEN="pxr_YOUR_TOKEN"
```

### 2. Separate Tokens per Environment

```bash
# Development IDE
pincer agent add vscode-dev
# Use dev API keys
pincer agent authorize vscode-dev gemini_generate --key dev

# Production IDE (different machine)
pincer agent add vscode-prod
# Use production API keys
pincer agent authorize vscode-prod gemini_generate --key production
```

### 3. Monitor Usage

```bash
# Watch audit logs in real-time
tail -f ~/.pincer/audit.jsonl

# Filter by agent
cat ~/.pincer/audit.jsonl | grep '"agentId":"vscode"'
```

### 4. Revoke Access

```bash
# Revoke access to a specific tool
pincer agent revoke old-vscode gemini_generate

# Remove agent entirely (all permissions)
pincer agent remove old-vscode
```

---

## Troubleshooting

### "Cannot find Pincer server"

**Cause:** Wrong path to `index.js`

**Fix:** Use absolute path:
```bash
# Find absolute path
cd /path/to/Pincer-MCP
pwd
# Copy full path

# Use in config
"args": ["/Users/yourname/Pincer-MCP/dist/index.js"]
```

### "Missing proxy token" error

**Cause:** Token not in environment or request

**Fix:**
```json
{
  "env": {
    "PINCER_PROXY_TOKEN": "pxr_YOUR_TOKEN"
  }
}
```

### "Master key not found"

**Cause:** Vault not initialized

**Fix:**
```bash
pincer init
```

### "Permission denied" on vault.db

**Cause:** File permissions issue

**Fix:**
```bash
chmod 600 ~/.pincer/vault.db
```

### IDE doesn't show Pincer tools

**Cause:** Server not started or config error

**Fix:**
1. Test server manually:
   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
   ```
2. Check IDE logs for errors
3. Restart IDE after config changes

---

## Advanced: Wrapper Script for Easy Configuration

Create a launcher script to simplify IDE configuration:

**`pincer-server.sh`:**
```bash
#!/bin/bash
# Pincer-MCP launcher for IDEs
export PINCER_PROXY_TOKEN="${PINCER_TOKEN:-$1}"
node /absolute/path/to/pincer-mcp/dist/index.js
```

Make executable:
```bash
chmod +x pincer-server.sh
```

**IDE config becomes:**
```json
{
  "command": "/path/to/pincer-server.sh",
  "args": ["pxr_YOUR_TOKEN"]
}
```

Or with environment variable:
```bash
export PINCER_TOKEN="pxr_YOUR_TOKEN"
```
```json
{
  "command": "/path/to/pincer-server.sh",
  "args": []
}
```

---

## Testing Your IDE Integration

### 1. Verify Server Starts

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
```

**Expected output:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "gemini_generate",
        "description": "Generate text using Google Gemini",
        "inputSchema": {...}
      },
      ...
    ]
  }
}
```

### 2. Test with Proxy Token

```bash
echo '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "gemini_generate",
    "arguments": {
      "prompt": "Say hello",
      "model": "gemini-2.0-flash"
    },
    "_meta": {
      "pincer_token": "pxr_YOUR_TOKEN"
    }
  },
  "id": 2
}' | node dist/index.js
```

### 3. Check IDE Connection

In your IDE:
1. Open AI assistant/copilot
2. Ask: "What tools are available?"
3. Should list `pincer/gemini_generate`, etc.

### 4. Verify Audit Logging

```bash
# Make a tool call from IDE
# Then check logs
tail -1 ~/.pincer/audit.jsonl | jq
```

---

## Example Configurations

### Multi-IDE Setup

```bash
# Developer's local machine setup
pincer init

# Store keys once
pincer set gemini_api_key "AIza..."

# Create agent per IDE
pincer agent add vscode && pincer agent authorize vscode gemini_generate
pincer agent add claude && pincer agent authorize claude gemini_generate  
pincer agent add cursor && pincer agent authorize cursor gemini_generate

# List all
pincer agent list
```

### Team Setup (Shared Machine)

```bash
# Admin initializes vault
pincer init
pincer set gemini_api_key "TEAM_KEY"

# Create agent per team member
pincer agent add alice-vscode
pincer agent add bob-cursor
pincer agent add charlie-claude

# Authorize individually
pincer agent authorize alice-vscode gemini_generate
pincer agent authorize bob-cursor gemini_generate
pincer agent authorize charlie-claude gemini_generate slack_send_message
```

Each team member gets their own proxy token to use in their IDE.

---

## Next Steps

- **[SETUP.md](SETUP.md)** - General Pincer setup guide
- **[CAPABILITIES.md](CAPABILITIES.md)** - Full API reference
- **[OPENCLAW_INTEGRATION.md](OPENCLAW_INTEGRATION.md)** - OpenClaw-specific integration
- **[TESTING.md](TESTING.md)** - Testing guide

## Support

For IDE-specific issues:
1. Check IDE's MCP documentation
2. Test Pincer standalone: `pincer --help`
3. Verify vault: `pincer agent list`
4. Check logs: `tail -f ~/.pincer/audit.jsonl`
5. File issue: [GitHub Issues](https://github.com/VouchlyAI/Pincer-MCP/issues)
