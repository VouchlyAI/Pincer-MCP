# Pincer-MCP Testing Guide

This document provides a comprehensive overview of the Pincer-MCP test suite, including test organization, coverage, and how to run tests.

## Test Suite Overview

**Total Tests:** 21/21 passing
**Test Files:** 3
**Framework:** Vitest
**Coverage Tracking:** Enabled for security-critical components

## Test Files

### 1. Integration Tests (`tests/mcp-server.test.ts`)

**Purpose:** End-to-end testing of the MCP server with real stdio transport

**Tests (4 total):**

1. **Tool Listing**
   - Verifies server exposes correct tool schemas
   - Validates tool names and argument schemas
   - Tests: `gemini_generate`, `openai_chat`, `claude_chat`

2. **Authentication Rejection**
   - Ensures unauthenticated requests are blocked
   - Validates "Missing proxy token" error message
   - Tests body-based auth requirement

3. **Invalid Token Format**
   - Validates proxy token format (`pxr_` prefix)
   - Tests format validation before vault lookup
   - Ensures client-side errors are caught early

4. **Unknown Tool Handling**
   - Tests behavior when calling non-existent tools
   - Verifies auth errors occur before tool validation
   - Validates error message priority

**Key Features Tested:**
- MCP protocol compliance
- Stdio transport communication
- JSON-RPC request/response handling
- Tool discovery mechanism

---

### 2. Security Layer Tests (`tests/security.test.ts`)

**Purpose:** Unit tests for authentication and validation components

**Tests (8 total):**

#### Gatekeeper - Proxy Token Extraction (4 tests)

1. **Primary Location (`_meta.pincer_token`)**
   - Tests token extraction from preferred location
   - Validates format checking
   - Ensures vault lookup is attempted

2. **Fallback Location (`__pincer_auth__`)**
   - Tests fallback to root-level parameter
   - Validates backward compatibility
   - Ensures both locations are checked

3. **Missing Token Rejection**
   - Tests error when no token provided
   - Validates helpful error message
   - Ensures request is blocked immediately

4. **Invalid Token Format**
   - Tests `pxr_` prefix validation
   - Validates format-level security
   - Ensures malformed tokens are rejected

#### Validator - Schema Validation (4 tests)

1. **Gemini Tool Validation**
   - Tests Zod schema for `gemini_generate`
   - Validates required fields: `prompt`, `model`
   - Tests optional field: `temperature`


3. **Unknown Tool Rejection**
   - Tests error for unregistered tools
   - Validates tool registry lookup
   - Ensures only known tools are callable

4. **Invalid Arguments Rejection**
   - Tests schema validation failures
   - Validates error messages include field names
   - Ensures type coercion is disabled

**Key Features Tested:**
- Body-first authentication extraction
- Dual-location token fallback
- Zod schema validation
- Type safety enforcement
- Error message clarity

---

### 3. Multi-Key Tests (`tests/vault-multikey.test.ts`)

**Purpose:** Tests for multi-key support and per-agent key assignment

**Tests (9 total):**

#### Multi-Key Storage (4 tests)

1. **Multiple Keys per Tool**
   ```typescript
   // Example: Store 3 keys for same tool
   vault.setSecret("gemini_api_key", "value1", "key1");
   vault.setSecret("gemini_api_key", "value2", "key2");
   vault.setSecret("gemini_api_key", "value3", "production");
   ```
   - Tests labeled key storage
   - Validates independent encryption
   - Ensures correct retrieval by label

2. **Default Label Handling**
   - Tests implicit "default" label
   - Validates backward compatibility
   - Ensures label-less calls work

3. **Secret Listing**
   - Tests `vault.listSecrets()` output
   - Validates grouping by tool name
   - Ensures all labels are shown

4. **Non-Existent Key Error**
   - Tests error for missing key label
   - Validates error message includes label
   - Ensures helpful debugging info

#### Per-Agent Key Assignment (3 tests)

1. **Different Keys for Different Agents**
   ```typescript
   // Example: Two agents, same tool, different keys
   vault.setAgentMapping("clawdbot", "gemini_generate", "key1");
   vault.setAgentMapping("mybot", "gemini_generate", "key2");
   ```
   - Tests per-agent key selection
   - Validates correct key label retrieval
   - Ensures agent isolation

2. **Default Key Label Assignment**
   - Tests implicit "default" for agents
   - Validates backward compatibility
   - Ensures omit-able key parameter

3. **Agent Permission Listing**
   - Tests `vault.listAgents()` output
   - Validates tool + key label display
   - Ensures complete permission view

#### Encryption & Security (2 tests)

1. **Independent Encryption**
   - Tests each key label encrypts separately
   - Validates different IVs and auth tags
   - Ensures no cross-contamination

2. **Key Update (Replace)**
   - Tests `INSERT OR REPLACE` behavior
   - Validates old value is overwritten
   - Ensures atomic updates

**Key Features Tested:**
- Multi-key storage architecture
- Labeled key management
- Per-agent key assignment
- Agent authorization mapping
- Database schema with `key_label` column
- Encryption integrity per label

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- mcp-server
npm test -- security
npm test -- vault-multikey
```

### Run in Watch Mode
```bash
npm test -- --watch
```

### Run with Coverage
```bash
npm test -- --coverage
```

## Test Database Management

Tests use a separate test database to avoid conflicts:

```typescript
// Example from vault-multikey.test.ts
const testVaultPath = join(homedir(), ".pincer", "vault-test.db");
process.env["VAULT_DB_PATH"] = testVaultPath;
```

**Cleanup:**
- Tests automatically clean up before/after
- Master key is deleted and recreated per test
- Database files are removed in `afterEach()`

## Coverage Requirements

**Critical Components (100% coverage required):**
- `src/security/gatekeeper.ts` - Authentication
- `src/security/validator.ts` - Schema validation
- `src/vault/store.ts` - Encryption/decryption
- `src/vault/injector.ts` - JIT injection

**Standard Components (>80% coverage):**
- `src/pincer.ts` - Main orchestrator
- `src/callers/*.ts` - External API callers

## Test Data

### Sample Proxy Tokens
```
pxr_V1StGXR8_Z5jdHi6B-myT  (valid format)
invalid_token               (invalid format)
```

### Sample Tool Arguments

**Gemini:**
```json
{
  "prompt": "Hello world",
  "model": "gemini-2.0-flash",
  "temperature": 0.7
}
```


## Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Pull requests
- Main branch pushes

**Required:**
- All 21 tests must pass
- No TypeScript compilation errors
- No lint warnings in test files

## Adding New Tests

### Template for New Test File

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { YourComponent } from "../src/your-component.js";

describe("Your Component", () => {
  let component: YourComponent;

  beforeEach(() => {
    component = new YourComponent();
  });

  afterEach(() => {
    component.close();
  });

  it("should do something", () => {
    expect(component.doSomething()).toBe(expected);
  });
});
```

### Best Practices

1. **Isolation:** Each test should be independent
2. **Cleanup:** Always clean up resources in `afterEach()`
3. **Descriptive:** Use clear test names that describe behavior
4. **Coverage:** Aim for edge cases, not just happy paths
5. **Fast:** Keep tests under 100ms each when possible

## Debugging Failed Tests

### Common Issues

1. **Master Key Already Exists**
   ```bash
   # Clean up manually
   rm -rf ~/.pincer
   ```

2. **Database Locked**
   ```bash
   # Kill any hanging processes
   pkill -f "pincer"
   ```

3. **Port Conflicts**
   - Tests use stdio transport (no ports)
   - Check for hung child processes

### Verbose Output

```bash
npm test -- --reporter=verbose
```

### Debug Single Test

```typescript
it.only("should debug this test", () => {
  // Only this test will run
});
```

## Test Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Total Tests | 21 | 25+ |
| Pass Rate | 100% | 100% |
| Avg Duration | 68ms/test | <100ms |
| Total Suite Time | 1.56s | <3s |
| Coverage (Security) | ~85% | 95% |

## Future Test Additions

- [ ] Stress tests for concurrent requests
- [ ] Fuzzing for schema validation
- [ ] Performance benchmarks
- [ ] Memory leak detection
- [ ] Audit log integrity tests
- [ ] Key rotation tests
- [ ] Rate limiting tests
