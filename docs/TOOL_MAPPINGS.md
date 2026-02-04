# Tool-to-Secret Name Mappings

When storing credentials in the Pincer vault using `pincer set`, you must use the correct **Secret Name**. The **Tool Name** is what you use when authorizing agents with `pincer agent authorize`.

| Tool Name | Secret Name | Example Command |
|-----------|-------------|-----------------|
| `gemini_generate` | `gemini_api_key` | `pincer set gemini_api_key AIza...` |
| `openai_chat` | `openai_api_key` | `pincer set openai_api_key sk-proj...` |
| `openai_list_models` | `openai_api_key` | (same as above) |
| `openai_compatible_chat` | `openai_compatible_api_key` | `pincer set openai_compatible_api_key YOUR_KEY` |
| `openai_compatible_list_models` | `openai_compatible_api_key` | (same as above) |
| `claude_chat` | `claude_api_key` | `pincer set claude_api_key sk-ant-api03...` |
| `openrouter_chat` | `openrouter_api_key` | `pincer set openrouter_api_key sk-or-v1...` |
| `openrouter_list_models` | `openrouter_api_key` | (same as above) |
| `openwebui_chat` | `openwebui_api_key` | `pincer set openwebui_api_key sk-...` |
| `openwebui_list_models` | `openwebui_api_key` | (same as above) |

## Why different names?

- **Tool Names** (e.g., `gemini_generate`) are used for authorizing access.
- **Secret Names** (e.g., `gemini_api_key`) are used for storing the actual credentials.

This separation allows:
1. One secret to power multiple tools.
2. Future tool additions without requiring you to re-store existing keys.
3. Clarity in audit logs about which specific tool was invoked.
