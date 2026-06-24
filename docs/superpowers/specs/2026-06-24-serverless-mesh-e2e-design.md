# CipherWave 3.0 — Serverless Mesh + Configurable Rooms + Verified E2E

- **Date:** 2026-06-24
- **Status:** Draft for review
- **Author:** pairing session

## 1. Goals

1. **Configurable room size (2–64).** The person creating a room picks a capacity; the limit travels with the shareable room code so everyone agrees on it.
2. **Verified end-to-end encryption.** Messages are encrypted such that no server, tracker, or relay can read them — and we *prove* it with tests + a written threat model.
3. **Hostless — `file://` double-click.** No CipherWave-operated backend and no hosting required. The deliverable is a **single self-contained `www/index.html`** (all JS/CSS inlined) that, when **opened directly in a browser via `file://`** (or served statically), can generate keys, create/join a room, and chat with another such file — exactly like the localhost dev version. Peers find each other over public infrastructure (Nostr relays) and connect via WebRTC + a TURN relay.

   *Feasibility confirmed (2026-06-24 investigation):* `file://` is a secure context in Chrome/Firefox/Safari so WebCrypto (ECDH/AES-GCM) works; WebRTC data channels need no secure context; public Nostr relays accept a `null` Origin; and an inlined `<script type=module>` executes from `file://` (empirically verified in headless Chrome).

## 2. Non-goals

- Large-room performance tuning (>~16). Rooms are optimized for 2–8; the cap allows up to 64 but full-mesh cost grows ~O(n²).
- Forward secrecy / key ratcheting, message persistence/history, accounts, or moderation.
- Removing the existing Fastify server (it stays in the repo and keeps passing tests; it is simply no longer on the chat path).
- Audio/video calling from `file://` (text chat only; `getUserMedia` is out of scope here).
- Bundled/self-hosted relays or TURN (we rely on public infra; users may supply their own later).

## 3. Background (current state)

The working app is a Svelte 5 client (`src/client`, builds to `www/`) that today uses a **custom** WebRTC layer + a Fastify WebSocket signaling server, with an ECDH→AES-GCM E2E layer and a WS relay fallback. This design **replaces the custom WebRTC + signaling + relay** in the client with a serverless mesh, keeping (and hardening) the E2E crypto. The server, its REST API, and their tests are untouched.

## 4. Architecture

The monolithic `App.svelte` connection logic is split into three focused, independently testable modules plus a thin UI:

| Module | Responsibility | Depends on |
|---|---|---|
| `src/client/src/lib/mesh.ts` | The **only** Trystero-aware code. Join/leave a room, emit peer join/leave, send targeted/broadcast data, configure TURN. Exposes a transport-agnostic interface. | `trystero` |
| `src/client/src/lib/e2e.ts` | Pure crypto. Identity ECDH keypair; per-peer shared-key derivation (ECDH + room-secret); `encryptFor`/`decryptFrom`. No I/O. | WebCrypto |
| `src/client/src/lib/chat.ts` | Orchestration (Svelte store). Wires mesh ↔ e2e: on peer join exchange keys + derive; on send encrypt-per-recipient; on receive decrypt + render. Owns `peers`, `keys`, `messages`, room-cap enforcement. | `mesh`, `e2e` |
| `App.svelte` | UI only: register, connect (size selector), chat. Delegates to `chat`. | `chat` store |

**`mesh.ts` interface (transport-agnostic, so it can be mocked in tests):**
```ts
interface Mesh {
  join(opts: { appId: string; roomId: string; secret: string; turn: RTCIceServer[] }): void;
  leave(): void;
  selfId: string;
  onPeerJoin(cb: (peerId: string) => void): void;
  onPeerLeave(cb: (peerId: string) => void): void;
  send(type: string, payload: unknown, target?: string): void;   // target omitted = broadcast
  on(type: string, cb: (payload: unknown, peerId: string) => void): void;
}
```
The Trystero implementation maps `send`/`on` onto `room.makeAction()` and uses `room.onPeerJoin/onPeerLeave`. Tests provide a mock `Mesh` that bridges peers in-process.

## 5. Transport (serverless + TURN)

- **Library:** `trystero` (v0.25.x). Default **Nostr** strategy (public relays) for discovery + signaling; `torrent` strategy is a drop-in fallback if Nostr relays are flaky (single-line import swap).
- **One shared code, three roles.** The shareable room code (§8) is a *single* string used as: the Trystero `roomId` (discovery topic, hashed by Trystero so the code itself isn't exposed), the Trystero `password` (encrypts signaling), and the crypto `roomSecret` (§6 HKDF salt). Consequence: you need the code even to *discover* the room — discovery, signaling secrecy, and message keys are all gated by the same secret.
- **Join:** `joinRoom({ appId: 'cipherwave', password: code, turnConfig: TURN }, code)`.
  - `password` → Trystero AES-encrypts the session descriptions, so a malicious tracker cannot MITM the WebRTC handshake.
- **TURN:** Open Relay (`turn:openrelay.metered.ca:80` and `:443`, user/cred `openrelayproject`) plus Google STUN, configurable via a constant. Documented: free tier is ~20GB/mo; swap for your own TURN in production.
- **No CipherWave server** is contacted for chat.

## 6. End-to-end encryption (pairwise mesh)

Each **pair** of peers derives its own AES-256-GCM key — compromising one pair never exposes another.

**Key derivation (per pair), all WebCrypto:**
1. Each peer has an ephemeral **ECDH P-256** identity keypair (per session).
2. On peer join, peers exchange raw public keys via a `key` mesh action.
3. `rawSecret = ECDH.deriveBits(myPriv, peerPub)` (256 bits).
4. `aesKey = HKDF-SHA256(ikm = rawSecret, salt = SHA-256(roomSecret), info = "cipherwave-e2e-v1")` → AES-GCM 256.
   - Binding the key to `roomSecret` means a peer/MITM **without the room code cannot derive a usable key**, even if they observe the public keys.

**Message flow:**
- Send: for each connected peer, `encryptFor(peerId, plaintext)` → `{ nonce, content (base64) }`; `mesh.send('msg', payload, peerId)` (targeted). (2–8 peers ⇒ 1–7 encryptions/message.)
- Receive: `mesh.on('msg')` → `decryptFrom(peerId, payload)` → render. Decryption failures are dropped (logged), never shown.
- Local echo is added on send (sender sees its own message immediately).

Transports (Trystero data channel, and the TURN relay if used) only ever carry **ciphertext + public keys**.

## 7. Threat model (the "verify E2E actually works" deliverable)

| Adversary | Can see | Can read messages? | Mitigation |
|---|---|---|---|
| Nostr/torrent tracker (passive) | room presence, timing, IPs | **No** | App-layer AES-GCM; trackers carry only signaling |
| TURN relay | encrypted DTLS + ciphertext | **No** | Double-encrypted (DTLS + AES-GCM) |
| Malicious tracker (active MITM) | tries to swap SDP/DTLS fingerprints | **No** | Trystero `password` encrypts signaling **and** room-secret-salted HKDF binds app keys to the room |
| Someone who knows the room code | — | **Yes (by design)** | The room code **is** the access secret; documented. Generated codes are ~16 random chars (~80 bits) |
| Network observer | TLS to trackers, DTLS to peers | **No** | — |

**Explicit limitation:** membership = knowledge of the room code (no per-user identity/auth). Treated as a shared-secret room. A written copy of this table ships in `docs/security/threat-model.md`.

## 8. Room size (2–64)

- **Selector:** connect screen control (default **8**, min 2, max 64).
- **Encoding:** shareable code = `<base32 random ~16 chars>` + `~` + `<size>` (e.g. `K7QF…M2~8`). The whole string is the Trystero `roomId` *and* the `roomSecret`, so all peers automatically agree on the cap and the crypto secret from a single shared string. The size is parsed from the suffix; joining via a pasted code shows (and locks) that size.
- **Enforcement (best-effort, serverless):** every client knows the cap from the code. Trystero connects all present peers; when the count (incl. self) exceeds the cap, peers sort all peer-ids deterministically — the first `cap` are members, the rest **self-eject** (leave + show "Room is full"). Because Trystero converges to a consistent peer set, peers reach the same decision. Documented as best-effort (no central authority; simultaneous boundary joins may briefly over-admit).

## 9. Build & deployment (the single-file `www/index.html` deliverable)

The deliverable is **one self-contained `www/index.html`** that works opened via `file://` *and* served statically.

- **Single-file bundling:** add **`vite-plugin-singlefile`** (Vite 6 supported) — it inlines all JS + Tailwind CSS into `index.html`, leaving exactly one **inline** `<script type="module">` (no `src`, no external imports), which is confirmed to execute from `file://`. Set `base: './'`. Keep `build.outDir: '../../www'` and `emptyOutDir: true`.
- **`file://` constraints baked into the build:**
  - No external module scripts, **no dynamic `import()` or web workers** that would emit separate chunks (they'd 404 over `file://`). `inlineDynamicImports: true` folds normal chunks into the one bundle; the app avoids worker/separate-chunk patterns.
  - `src/client/index.html`: favicon → relative `./favicon.png` (or drop); the Google Fonts `<link>` stays (cosmetic — falls back to system fonts if offline). Network is required anyway for peer discovery, so CDN fonts are acceptable; self-hosting fonts is a possible later polish.
- `npm run build:client` → a single `www/index.html`. This **overwrites** the legacy `www/` static app (intended). Legacy files (`script.js`, `styles.css`, `*.backup`, `test-webrtc*.{js,html}`, `js/`) are removed.
- **Acceptance:**
  1. **`file://`:** double-click `www/index.html` in Chrome (and a spot-check in Firefox) on two machines/profiles → register → same room code → chat works, fully serverless, E2E-encrypted.
  2. **Static host:** the same file served by any static host / `npx serve www` works identically (and is the documented fallback for any hardened browser that excludes `file://` from secure contexts).

## 10. UI changes (`App.svelte`)

- **Connect screen:** add a **room-size** selector; "Generate Room ID" produces the `<random>~<size>` code; pasting a code reads/locks its size; copy-code button copies the full code.
- **Chat:** peer list driven by mesh peer join/leave; messages already keyed by `senderId/senderName` (multi-peer ready). Status reflects mesh connection.
- **Room full:** self-eject path shows a clear message and returns to the connect screen.
- Remove WebRTC/signaling internals from `App.svelte` (moved to `lib/`).

## 11. Testing & verification

- **Unit (`tests/unit/e2e.test.ts`):**
  - Per-pair ECDH keys differ across pairs.
  - AES-GCM round-trip succeeds within a pair.
  - **Room-secret binding:** same peers + different room code ⇒ non-matching keys ⇒ decrypt fails.
  - Wrong-peer key cannot decrypt.
- **E2E (`tests/e2e/mesh-chat.spec.ts`, Playwright, mocked `Mesh`):** 3 browser contexts bridged in-process (same Node-relay technique already used). Assert: all pairs exchange keys; a broadcast from one peer is decrypted by both others; intercepted payloads are `aes256-gcm` ciphertext containing no plaintext; a 4th "outsider" page with a *different* room code cannot decrypt.
- **Build smoke:** CI/script builds `www/`, serves it, loads the page headlessly, asserts the app mounts.
- **Manual:** real two-browser run against the statically-served `www/` (done by the user; we verify build + mocked e2e in-sandbox, since real Trystero needs network the sandbox blocks).
- Existing unit/integration/e2e suites continue to pass.

## 12. Dependencies & migration

- **Add:** `trystero` (client dependency), `vite-plugin-singlefile` (client dev dependency).
- **Remove from client path:** custom `setupWebRTC`, offer/answer/candidate handlers, the signaling `WebSocket`, ECDH-over-datachannel, WS relay fallback (superseded by `mesh.ts` + `chat.ts`).
- **Unchanged:** `src/server/**`, REST API, server tests, `npm run typecheck/test/build:server`.

## 13. Risks & open questions

- **Public infra availability (biggest risk):** the `null`-Origin acceptance is *proven*, but free public Nostr relays come and go. A `file://` artifact ships frozen (no server to update relay lists). Mitigation: keep Trystero's **multi-relay redundancy** (don't pin one relay); torrent strategy as fallback.
- **`file://` secure-context is SHOULD, not MUST:** current Chrome/Firefox/Safari treat `file://` as secure, but a hardened/enterprise config could exclude it. Fallback: `npx serve www` (http://localhost, also secure) with the same single file — no hosting/account needed.
- **TURN free-tier limits:** Open Relay's free quota (~20GB/mo); document self-hosting for production.
- **Best-effort room cap:** acceptable for 2–8; not a hard guarantee in a serverless model.
- **Real end-to-end can't run in this sandbox:** WebRTC + public-relay networking is blocked here, so verification relies on unit tests + a **mocked-transport** 3-peer e2e + the build smoke + the user's real two-browser `file://` run. The component facts (WebCrypto/WebRTC/Trystero/inline-module all work from `file://`) are evidence-backed; a live two-browser `file://`-over-public-relays run is the user's acceptance step.
- **Browsers to spot-check:** confirm the inline-module `file://` load in Firefox and Safari (empirically confirmed in Chrome only).

## 14. Acceptance criteria

1. `npm run build:client` produces a **single self-contained `www/index.html`** that, **double-clicked (`file://`)** in Chrome, runs the full app — generate keys, create/join a room, chat — with **no CipherWave backend** (and works identically served statically / `npx serve www`).
2. Two such files (two machines/profiles) entering the same room code chat in real time; a room-size selector (2–64) caps membership.
3. Messages are end-to-end encrypted: intercepted transport payloads are ciphertext; a party without the room code cannot decrypt (proven by tests).
4. `docs/security/threat-model.md` documents guarantees and limitations.
5. All existing test suites + typecheck still pass.
