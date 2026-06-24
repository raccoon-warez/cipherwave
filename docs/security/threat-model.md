# CipherWave — Threat Model

CipherWave 3.0 is a **serverless, end-to-end-encrypted** group chat. There is no
CipherWave-operated backend. Peers relay through a **public MQTT broker**, and
**every byte sent through the broker is encrypted** — the broker sees only opaque
ciphertext on a topic that is a hash of the room code.

## What protects messages (two encryption layers)

- **Transport layer (relay-proof).** Every payload published to the broker —
  presence, nicknames, public-key exchange, and messages — is encrypted with an
  **AES-256-GCM key derived from the room code** (HKDF-SHA-256, `deriveRoomKey`).
  The broker never learns the room code (it only sees `SHA-256(room code)` as the
  MQTT topic), so it cannot decrypt anything or even read metadata like
  nicknames. (See the `room-key transport encryption` test in
  `tests/unit/e2e.test.ts`.)
- **Per-pair layer (between members).** Inside that, each pair of peers performs
  an **ECDH (P-256)** agreement and derives its own **AES-256-GCM** message key
  via HKDF salted with the room code. Every pair has its own key, so one member
  cannot read another pair's directed messages, and a party without the room code
  cannot derive a working key even if it sees the public keys.

## What an adversary can and cannot do

| Adversary | Can see | Can read anything? |
|---|---|---|
| MQTT broker / network observer (passive) | a topic = hash of the room code, message sizes, timing | **No** — every payload is room-key-encrypted ciphertext (incl. presence & nicknames) |
| Broker attempting tampering | can drop/replay ciphertext | **No** — cannot forge valid ciphertext without the room code; AES-GCM auth rejects tampering |
| Someone who guesses the topic hash | the hash, not the code | **No** — needs the room code itself (~80 bits) to derive any key |
| **Someone who knows the room code** | — | **Yes — by design** |

## Explicit limitations

- **The room code is the access secret.** Membership is "anyone who knows the
  code." There is no per-user authentication or identity verification. Treat the
  code like a password: share it over a trusted channel; generated codes are 16
  random unambiguous characters (~80 bits).
- **No forward secrecy / post-compromise security.** Keys are per-session, not
  ratcheted. If a session key is compromised, that session's messages are
  exposed (but not other pairs', and not other sessions').
- **Metadata is partly visible.** The broker cannot read payloads, but can
  observe that *some* clients are active on a topic (a hash), plus message sizes,
  timing, and the connecting IP addresses.
- **No message persistence.** History is in-memory per session only; nothing is
  retained on the broker (no MQTT `retain`).
- **Availability depends on public infrastructure.** Public MQTT brokers can
  rate-limit or go down; the client fails over across a list of brokers.
- **Group-size cap is best-effort.** With no central authority, the 2–64 cap is
  enforced cooperatively by clients and can briefly over-admit on simultaneous
  joins.

## Out of scope

Audio/video calls, accounts, moderation, and resistance to a malicious *peer*
who is a legitimate room member (any member can read the room's messages).
