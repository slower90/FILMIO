---
name: E2EE envelope sender key
description: The device-to-device chat envelope format must carry the sender public key for recipient-side ECDH decryption.
---

The encrypted chat envelope includes the sender device public key alongside per-device ciphertexts. Version 2 also carries a fresh ephemeral sender public key per recipient; message keys come from P-256 ECDH plus HKDF, and ephemeral private keys are discarded.

**Why:** ECDH decryption is symmetric only when each side uses the other side's public key, and the recipient cannot derive the sender key from a device ID alone.

**How to apply:** Preserve the sender public key when adding envelope versions or delivery formats, validate the algorithm and ephemeral key fields before persisting, and keep attachments inside the encrypted plaintext payload.