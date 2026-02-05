# Security Policy

## 🛡️ Security Philosophy

Pincer-MCP is built on a **zero-trust architecture** designed to eliminate the "Lethal Trifecta" vulnerability in agentic AI systems. Our core security principle is simple: **agents never see your real API keys**.

### Security Model

```
┌─────────────────────────────────────────────────────────┐
│  Agent Layer (Untrusted)                                │
│  • Only knows proxy token (pxr_xxx)                     │
│  • Cannot access real credentials                       │
│  • Isolated from vault                                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Pincer Gateway (Stateless Intermediary)                │
│  • Validates proxy tokens                               │
│  • Enforces per-agent authorization                     │
│  • JIT credential injection                             │
│  • Immediate memory scrubbing                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Vault Layer (Encrypted Storage)                        │
│  • Master key in OS keychain                            │
│  • AES-256-GCM encrypted secrets                        │
│  • Per-agent key assignment                             │
│  • Tamper-evident audit logs                            │
└─────────────────────────────────────────────────────────┘
```

## 📋 Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | ✅ Yes             |
| < 0.1.0 | ❌ No (pre-release)|

## 🚨 Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

### Private Disclosure Process

1. **Email**: Send details to **security@vouchly.ai**
2. **Subject**: `[SECURITY] Pincer-MCP: Brief Description`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
   - Your contact information

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Status updates**: Every 7 days until resolved
- **Disclosure timeline**: Coordinated with you

### Responsible Disclosure

We follow a **90-day disclosure timeline**:
1. **Day 0**: Vulnerability reported
2. **Day 1-30**: Investigation and fix development
3. **Day 31-60**: Testing and verification
4. **Day 61-90**: Coordinated public disclosure

We will credit you in the security advisory unless you prefer to remain anonymous.

## 🔒 Security Features

### 1. OS-Level Key Protection

**Master Encryption Key Storage:**
- **macOS**: Keychain Access (protected by FileVault + biometrics)
- **Windows**: Credential Manager (protected by DPAPI)
- **Linux**: GNOME Keyring or KWallet (protected by login keyring)

**Security Properties:**
- Never stored in files or environment variables
- Requires OS-level authentication to access
- Automatically locked when user logs out
- Protected by OS security updates

### 2. JIT Credential Injection

**Just-In-Time Decryption:**
```typescript
1. Agent sends request with proxy token
2. Gatekeeper validates token
3. Vault decrypts real API key (in memory only)
4. Injector adds key to request
5. External API call is made
6. Memory is scrubbed (overwritten with zeros)
7. Response returned to agent (no credentials)
```

**Memory Scrubbing:**
- Credentials overwritten with zeros after use
- Garbage collection hint triggered
- WeakSet tracking for automatic cleanup
- No credentials persist in memory

### 3. Fine-Grained Authorization

**Per-Agent, Per-Tool Access Control:**
- Agents must be explicitly authorized for each tool
- Different agents can use different API keys for the same tool
- Revocation is immediate and granular
- Authorization mappings stored encrypted

**Example:**
```bash
# Agent "dev-bot" uses development key
pincer agent authorize dev-bot gemini_generate --key dev

# Agent "prod-bot" uses production key
pincer agent authorize prod-bot gemini_generate --key production
```

### 4. Tamper-Evident Audit Logs

**Chain-Hashed Logging:**
- Every tool call is logged with SHA-256 chain hash
- Each entry includes hash of previous entry
- Tampering breaks the chain (detectable)
- Append-only (no deletions or modifications)

**Logged Information:**
- Timestamps (UTC and Local)
- Agent ID
- Tool name
- Duration
- Status (success/failure)
- Chain hash (includes timestamps in hash)

**Location:** `~/.pincer/audit.jsonl`

### 5. Proxy Token Authentication

**Token Format:** `pxr_<nanoid>`
- Cryptographically random (nanoid library)
- 21-character identifier
- URL-safe characters only
- No embedded metadata

**Authentication Sources (priority order):**
1. Request metadata (`_meta.pincer_token`)
2. Tool arguments (`__pincer_auth__`)
3. Environment variable (`PINCER_PROXY_TOKEN`)

## 🔐 Security Best Practices

### Vault Management

**DO:**
- ✅ Initialize vault on first use: `pincer init`
- ✅ Use labeled keys for different environments
- ✅ Regularly audit stored secrets: `pincer list`
- ✅ Back up your OS keychain (master key is there)

**DON'T:**
- ❌ Share proxy tokens between agents
- ❌ Commit proxy tokens to version control
- ❌ Store proxy tokens in plain text
- ❌ Disable OS keychain encryption

### Token Rotation

**Regular Rotation:**
```bash
# Remove old agent
pincer agent remove old-agent

# Register new agent with fresh token
pincer agent add new-agent
pincer agent authorize new-agent gemini_generate
```

**Frequency Recommendations:**
- **Development**: Every 30 days
- **Production**: Every 90 days
- **After compromise**: Immediately

### Agent Authorization

**Principle of Least Privilege:**
```bash
# Only authorize tools the agent needs
pincer agent authorize myagent gemini_generate
# Don't authorize all tools by default
```

**Review Permissions:**
```bash
# Regularly audit agent permissions
pincer agent list
```

### Audit Log Monitoring

**Watch for Suspicious Activity:**
```bash
# Monitor audit logs in real-time
tail -f ~/.pincer/audit.jsonl
```

**Red Flags:**
- Unusual tool call patterns
- Failed authentication attempts
- Calls from unexpected agents
- High-frequency API usage

**Verify Chain Integrity:**
```bash
# Check for tampering (future feature)
pincer audit verify
```

## ⚠️ Known Limitations

We believe in honest security disclosure. Here are current limitations:

### 1. Host Compromise
**Limitation:** If the host machine is compromised with root/admin access, an attacker could:
- Extract the master key from the OS keychain
- Intercept decrypted credentials in memory
- Modify the Pincer binary

**Mitigation:**
- Use full-disk encryption (FileVault, BitLocker)
- Enable OS-level security features (SIP, ASLR)
- Keep OS and security patches up to date
- Use hardware security modules (future)

### 2. Memory Inspection
**Limitation:** Credentials exist in memory briefly during API calls.

**Mitigation:**
- Immediate memory scrubbing after use
- Minimal credential lifetime (milliseconds)
- No credential logging or persistence

### 3. Proxy Token Theft
**Limitation:** If a proxy token is stolen, an attacker can make authorized API calls.

**Mitigation:**
- Regular token rotation
- Audit log monitoring
- Immediate revocation on suspicion
- Rate limiting (future)

### 4. Side-Channel Attacks
**Limitation:** Timing attacks or power analysis could theoretically leak information.

**Mitigation:**
- Constant-time operations where possible
- OS-level protections (ASLR, DEP)
- Future: Hardware security module support

## 🗺️ Security Roadmap

### Planned Enhancements

**v0.2.0:**
- [ ] Rate limiting per agent/tool
- [ ] Audit log integrity verification command
- [ ] Automatic token expiration
- [ ] Webhook notifications for security events

**v0.3.0:**
- [ ] Hardware security module (HSM) support
- [ ] Multi-factor authentication for vault access
- [ ] Encrypted backup/restore functionality
- [ ] Security policy enforcement (e.g., require token rotation)

**v1.0.0:**
- [ ] FIPS 140-2 compliance
- [ ] SOC 2 Type II audit
- [ ] Formal security verification
- [ ] Bug bounty program

## 🏆 Security Hall of Fame

We recognize security researchers who responsibly disclose vulnerabilities:

*No vulnerabilities reported yet. Be the first!*

## 📚 Additional Resources

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [NIST Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)
- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)

## 📞 Security Contact

- **Email**: security@vouchly.ai
- **PGP Key**: Coming soon
- **Response Time**: 48 hours

---

**Security is a journey, not a destination. Thank you for helping us protect the AI ecosystem.** 🦀
