# PromptAudit — Client-Side Zero-Knowledge Capture Agent

This repository contains the cryptographic core architecture of the PromptAudit Capture Agent (Browser Extension).

## Security & Compliance Architecture

PromptAudit is designed for strict compliance with the revised Swiss Data Protection Act (DSG), the EU AI Act (Art. 12), and GDPR (Art. 32). It enforces a strict zero-knowledge architecture:

* **Local Encryption:** All AI prompts and responses are encrypted directly within the employee's browser context using **AES-256-GCM**.
* **Key Derivation:** Encryption keys are derived locally via **PBKDF2-SHA256** with 210,000 iterations. Plaintext keys are never transmitted to our servers and are never stored.
* **Immutable Audit Trail:** Encrypted payloads are chained into an append-only cryptographic ledger (WORM SHA-256 hash chain). There is no technical path for deletion or alteration.

## Cryptographic Reference (Web Crypto API)

```typescript
// Enforced local encryption inside the browser extension sandbox
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, hash: "SHA-256", iterations: 210000 },
  baseKey,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"]
);

const ciphertext = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  key,
  plaintext
);
```

## Compliance Audit
This open-source component allows internal corporate IT security teams and external auditors to mathematically verify that zero cleartext prompts ever leave the corporate infrastructure.
