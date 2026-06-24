<script lang="ts">
  import { RadioTower, Lock, Hash, RefreshCw, Copy, ArrowLeft, LogOut, Send, Users, Search, X } from '@lucide/svelte';
  import { createChat, generateRoomCode, parseRoomCode, type Peer } from './lib/chat';
  import qrcode from 'qrcode-generator';
  import Waveform from './components/Waveform.svelte';
  import QrPanel from './components/QrPanel.svelte';

  // A room code shared via the URL hash (#CODE) when the app is hosted — lets a
  // scanned QR open the app already pointed at the channel.
  const roomFromUrl = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();

  // What the QR encodes: a join URL when hosted, or the bare code under file://.
  function joinTarget(code: string): string {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return `${location.origin}${location.pathname}#${encodeURIComponent(code)}`;
    }
    return code;
  }

  function makeQR(text: string): string {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(5, 12);
  }

  // ========================
  // App State
  // ========================
  let view = $state<'register' | 'connect' | 'chat'>('register');

  let username = $state('');
  let usernameError = $state('');
  let myUser = $state<{ nickname: string; id: string; avatar: string } | null>(null);

  let roomCode = $state('');
  let roomSize = $state(8);
  let roomError = $state('');
  let connecting = $state(false);

  let messageInput = $state('');
  let searchQuery = $state('');
  let drawerOpen = $state(false); // mobile channel/stations drawer

  let qrDataUrl = $derived(roomCode ? makeQR(joinTarget(roomCode)) : '');

  const chat = createChat();
  const { peers, messages, status, connected, roomFull } = chat;

  $effect(() => {
    if ($roomFull) {
      roomError = 'This channel is full';
      view = 'connect';
    }
  });

  // ========================
  // Identity
  // ========================
  function handleRegister() {
    const trimmed = username.trim();
    if (!trimmed) { usernameError = 'Enter a handle'; return; }
    if (trimmed.length < 2) { usernameError = 'At least 2 characters'; return; }
    if (trimmed.length > 20) { usernameError = 'Max 20 characters'; return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { usernameError = 'Letters, numbers and underscores only'; return; }

    const initials = trimmed.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    myUser = { nickname: trimmed, id: generateUserId(), avatar: initials };
    view = 'connect';
    usernameError = '';
    if (roomFromUrl) {
      roomCode = roomFromUrl;
      roomSize = parseRoomCode(roomFromUrl).size;
    } else {
      roomCode = generateRoomCode(roomSize);
    }
  }

  function generateUserId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    let id = '';
    for (let i = 0; i < 8; i++) id += chars[bytes[i]! % chars.length];
    return 'CW-' + id;
  }

  // ========================
  // Channel
  // ========================
  function setRoomSize(n: number) {
    roomSize = n;
    roomCode = generateRoomCode(roomSize);
  }
  function regenerateRoom() { roomCode = generateRoomCode(roomSize); }
  function onRoomCodeInput(value: string) {
    roomCode = value;
    if (value.includes('~')) roomSize = parseRoomCode(value).size;
  }
  function copyRoomCode() { navigator.clipboard?.writeText(roomCode); }

  async function handleConnect() {
    const code = roomCode.trim();
    if (!code) { roomError = 'Enter or generate a channel code'; return; }
    connecting = true;
    roomError = '';
    try {
      await chat.connect(code, myUser!);
      view = 'chat';
    } catch (err) {
      console.error(err);
      roomError = 'Could not open the channel. Check your network and retry.';
    } finally {
      connecting = false;
    }
  }

  // ========================
  // Transmissions
  // ========================
  async function sendMessage() {
    const text = messageInput.trim();
    if (!text || !$connected) return;
    messageInput = '';
    await chat.sendMessage(text);
  }

  function disconnect() {
    chat.disconnect();
    drawerOpen = false;
    view = 'connect';
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function handleChatKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }
  function handleRegisterKey(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleRegister(); }
  }
  function filteredPeers(): Peer[] {
    const q = searchQuery.trim().toLowerCase();
    const list = $peers;
    return q ? list.filter(p => p.nickname.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) : list;
  }
</script>

{#if view === 'register'}
  <!-- ===== STATION IDENTITY ===== -->
  <div class="stage">
    <section class="console hero-card">
      <span class="cn tl"></span><span class="cn tr"></span><span class="cn bl"></span><span class="cn br"></span>

      <div class="brand">
        <div class="brand-mark"><RadioTower class="ic-lg" /></div>
        <h1 class="title">CipherWave</h1>
        <p class="eyebrow">Encrypted shortwave · No server · No trace</p>
      </div>

      <div class="wave-window"><Waveform height={72} amplitude={0.62} noise={0.16} speed={1.1} /></div>

      <div class="field">
        <label class="lbl" for="username-input">Choose a handle</label>
        <input
          id="username-input"
          class="input mono {usernameError ? 'err' : ''}"
          type="text"
          bind:value={username}
          onkeydown={handleRegisterKey}
          placeholder="e.g. nightjar"
          maxlength="20"
          autocomplete="off"
          spellcheck="false"
        />
        {#if usernameError}<p class="msg-err">{usernameError}</p>{/if}
        <p class="hint">You'll be assigned an anonymous call sign. No email, phone or account.</p>
      </div>

      <button class="btn btn-primary" onclick={handleRegister}>Create Identity</button>

      <div class="device-label">
        <Lock class="ic-xs secure" />
        <span>SECURE TRANSCEIVER · END-TO-END ENCRYPTED</span>
      </div>
    </section>
  </div>

{:else if view === 'connect'}
  <!-- ===== OPEN A CHANNEL ===== -->
  <div class="stage">
    <section class="console connect-card">
      <button class="icon-btn back" onclick={() => { view = 'register'; username = ''; usernameError = ''; }} aria-label="Back">
        <ArrowLeft class="ic-sm" />
      </button>

      <div class="callsign">
        <div class="avatar lg">{myUser?.avatar}</div>
        <div class="callsign-info">
          <span class="callsign-name">{myUser?.nickname}</span>
          <span class="callsign-id mono">{myUser?.id}</span>
        </div>
      </div>

      <h2 class="screen-title">Open a channel</h2>

      <div class="field">
        <label class="lbl" for="room-id-input"><Hash class="ic-xs" /> Channel code</label>
        <div class="code-row">
          <input
            id="room-id-input"
            class="input mono code"
            type="text"
            value={roomCode}
            oninput={(e) => onRoomCodeInput((e.target as HTMLInputElement).value)}
            placeholder="Enter or generate a code"
            autocomplete="off"
            spellcheck="false"
          />
          <button class="icon-btn" onclick={regenerateRoom} title="New code"><RefreshCw class="ic-sm" /></button>
          <button class="icon-btn" onclick={copyRoomCode} title="Copy code"><Copy class="ic-sm" /></button>
        </div>
      </div>

      <div class="field">
        <label class="lbl" for="room-size-input"><Users class="ic-xs" /> Channel capacity · <strong class="cap">{roomSize}</strong></label>
        <input
          id="room-size-input"
          class="slider"
          type="range" min="2" max="64"
          value={roomSize}
          oninput={(e) => setRoomSize(parseInt((e.target as HTMLInputElement).value, 10))}
        />
      </div>

      {#if qrDataUrl}
        <div class="qr-block">
          <QrPanel dataUrl={qrDataUrl} label="Channel QR · scan to join" open={true} size={150} />
        </div>
      {/if}

      <ol class="steps">
        <li><span class="step-i">›</span> Share the channel code or QR</li>
        <li><span class="step-i">›</span> They open CipherWave on any device</li>
        <li><span class="step-i">›</span> Same code — you're transmitting</li>
      </ol>

      <button class="btn btn-primary" onclick={handleConnect} disabled={connecting}>
        {#if connecting}<span class="spinner"></span> Acquiring signal…{:else}<RadioTower class="ic-sm" /> Open Channel{/if}
      </button>

      {#if roomError}<p class="msg-err center">{roomError}</p>{/if}
    </section>
  </div>

{:else}
  <!-- ===== OPEN CHANNEL · TRANSMISSION LOG ===== -->
  <div class="console-page">
    {#if drawerOpen}
      <div class="scrim" role="button" tabindex="0" aria-label="Close panel"
        onclick={() => (drawerOpen = false)}
        onkeydown={(e) => { if (e.key === 'Escape') drawerOpen = false; }}></div>
    {/if}
    <aside class="rail {drawerOpen ? 'open' : ''}">
      <div class="rail-head">
        <div class="callsign sm">
          <div class="avatar">{myUser?.avatar}</div>
          <div class="callsign-info">
            <span class="callsign-name">{myUser?.nickname}</span>
            <span class="callsign-id mono">{myUser?.id}</span>
          </div>
        </div>
        <div class="rail-actions">
          <button class="icon-btn" onclick={disconnect} title="Leave channel"><LogOut class="ic-sm" /></button>
          <button class="icon-btn mobile-only" onclick={() => (drawerOpen = false)} aria-label="Close panel"><X class="ic-sm" /></button>
        </div>
      </div>

      <div class="secure-strip">
        <Lock class="ic-xs secure" />
        <span>Secure channel · the relay only sees noise</span>
      </div>

      <div class="channel-card">
        <div class="channel-row">
          <div class="channel-info">
            <span class="lbl">Channel code</span>
            <span class="channel-code mono">{roomCode}</span>
          </div>
          <button class="icon-btn" onclick={copyRoomCode} title="Copy code"><Copy class="ic-sm" /></button>
        </div>
        {#if qrDataUrl}<QrPanel dataUrl={qrDataUrl} label="Show QR" open={false} size={150} />{/if}
      </div>

      <div class="rail-section">
        <div class="search">
          <Search class="ic-sm muted" />
          <input class="input bare" type="text" value={searchQuery} oninput={(e) => (searchQuery = (e.target as HTMLInputElement).value)} placeholder="Find a station" />
        </div>
        <span class="section-label">Stations on channel · {$peers.length}</span>
        <div class="stations">
          {#each filteredPeers() as peer (peer.id)}
            <div class="station">
              <div class="avatar sq">{peer.avatar}</div>
              <div class="station-info">
                <span class="station-name">{peer.nickname}</span>
                <span class="station-id mono">on channel</span>
              </div>
              <span class="live-dot"></span>
            </div>
          {/each}
          {#if filteredPeers().length === 0}
            <div class="empty">
              {#if $peers.length === 0}<p>No one else here yet</p><p class="dim">Share the code to bring someone in</p>
              {:else}<p>No matching station</p>{/if}
            </div>
          {/if}
        </div>
      </div>
    </aside>

    <main class="channel">
      <header class="channel-head">
        <button class="icon-btn mobile-only" onclick={() => (drawerOpen = true)} aria-label="Channel & stations"><Users class="ic-sm" /></button>
        <div class="channel-title">
          <span class="ch-name">CipherWave</span>
          <span class="ch-status mono">{$connected ? `Connected · ${$peers.length} on channel` : ($status || 'Acquiring signal…')}</span>
        </div>
        <div class="carrier"><Waveform height={26} amplitude={$connected ? 0.4 : 0.7} noise={$connected ? 0.08 : 0.2} speed={$connected ? 0.7 : 1.4} lineWidth={1.5} /></div>
        <Lock class="ic-md secure" />
        <button class="icon-btn mobile-only" onclick={disconnect} aria-label="Leave channel"><LogOut class="ic-sm" /></button>
      </header>

      <div class="log">
        <div class="log-inner">
          <div class="enc-banner">
            <Lock class="ic-xs secure" />
            <span>End-to-end encrypted. The relay can't read these transmissions.</span>
          </div>

          {#each $messages as msg (msg.id)}
            <div class="tx {msg.mine ? 'mine' : 'theirs'}">
              <div class="tx-meta mono">
                <span class="tx-from">{msg.mine ? 'YOU' : msg.senderName}</span>
                <span class="tx-time">{formatTime(msg.timestamp)}</span>
              </div>
              <p class="tx-body">{msg.content}</p>
            </div>
          {/each}

          {#if $messages.length === 0}
            <div class="empty-log">
              <RadioTower class="ic-xl" />
              <p>Channel open</p>
              <p class="dim">Send the first transmission</p>
            </div>
          {/if}
        </div>
      </div>

      <footer class="composer">
        <input
          class="input transmit"
          type="text"
          value={messageInput}
          oninput={(e) => (messageInput = (e.target as HTMLInputElement).value)}
          onkeydown={handleChatKey}
          placeholder={$connected ? 'Transmit…' : 'Waiting for a station to join…'}
          disabled={!$connected}
        />
        <button class="btn-send" onclick={sendMessage} disabled={!messageInput.trim() || !$connected} aria-label="Transmit">
          <Send class="ic-sm" />
        </button>
      </footer>
    </main>
  </div>
{/if}

<style>
  /* ===== Layout shells ===== */
  .stage {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  /* ===== Console panel (the instrument) ===== */
  .console {
    position: relative;
    width: 100%;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 80px rgba(0,0,0,0.5);
  }
  .console::before {
    content: '';
    position: absolute; inset: 0 0 auto 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--signal), transparent);
    opacity: 0.7;
    border-radius: var(--r-lg) var(--r-lg) 0 0;
  }
  .hero-card { max-width: 420px; padding: 40px 34px 22px; text-align: center; }
  .connect-card { max-width: 460px; padding: 30px 30px 26px; }

  /* registration-mark corners — the instrument signature */
  .cn { position: absolute; width: 12px; height: 12px; pointer-events: none; opacity: 0.55; }
  .cn::before, .cn::after { content: ''; position: absolute; background: var(--signal); }
  .cn::before { width: 12px; height: 1.5px; }
  .cn::after { width: 1.5px; height: 12px; }
  .cn.tl { top: 10px; left: 10px; } .cn.tl::before, .cn.tl::after { top: 0; left: 0; }
  .cn.tr { top: 10px; right: 10px; } .cn.tr::before { top: 0; right: 0; } .cn.tr::after { top: 0; right: 0; }
  .cn.bl { bottom: 10px; left: 10px; } .cn.bl::before { bottom: 0; left: 0; } .cn.bl::after { bottom: 0; left: 0; }
  .cn.br { bottom: 10px; right: 10px; } .cn.br::before { bottom: 0; right: 0; } .cn.br::after { bottom: 0; right: 0; }

  /* ===== Brand ===== */
  .brand { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .brand-mark {
    width: 52px; height: 52px; display: grid; place-items: center;
    color: var(--signal); border: 1px solid var(--signal-dim); border-radius: var(--r-md);
    background: radial-gradient(circle at 50% 30%, var(--signal-glow), transparent 70%);
  }
  .title {
    font-family: var(--font-display); font-weight: 700; font-size: 26px;
    letter-spacing: 0.22em; color: var(--text); padding-left: 0.22em; text-transform: uppercase;
  }
  .eyebrow {
    font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--muted);
  }

  .wave-window {
    margin: 22px 0 26px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--ink-2);
    padding: 6px 10px;
    overflow: hidden;
  }

  /* ===== Fields ===== */
  .field { margin-bottom: 18px; text-align: left; }
  .lbl {
    display: flex; align-items: center; gap: 6px;
    font-family: var(--font-display); font-weight: 500; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-2); margin-bottom: 8px;
  }
  .lbl :global(svg) { width: 13px; height: 13px; color: var(--muted); }
  .cap { color: var(--signal); font-family: var(--font-mono); }

  .input {
    width: 100%; padding: 12px 14px;
    background: var(--ink-2); border: 1px solid var(--line);
    border-radius: var(--r-md); color: var(--text); font-size: 14px;
    outline: none; transition: border-color .15s, box-shadow .15s;
  }
  .input::placeholder { color: var(--faint); }
  .input:focus { border-color: var(--signal); box-shadow: 0 0 0 3px var(--signal-glow); }
  .input.err { border-color: var(--danger); }
  .input.mono { font-family: var(--font-mono); letter-spacing: 0.04em; }
  .input.code { letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: var(--signal); }
  .input.bare { background: transparent; border: none; padding: 0; box-shadow: none; }
  .input.bare:focus { box-shadow: none; }

  .hint { color: var(--muted); font-size: 12px; margin-top: 8px; line-height: 1.5; }
  .msg-err { color: var(--danger); font-size: 12.5px; margin-top: 8px; }
  .msg-err.center { text-align: center; }

  .code-row { display: flex; gap: 8px; }
  .code-row .input { flex: 1; }

  /* ===== Slider ===== */
  .slider { width: 100%; accent-color: var(--signal); cursor: pointer; height: 4px; }

  /* ===== Buttons ===== */
  .btn {
    width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    padding: 13px 18px; border: none; border-radius: var(--r-md); cursor: pointer;
    font-family: var(--font-display); font-weight: 700; font-size: 13.5px;
    letter-spacing: 0.08em; text-transform: uppercase; transition: transform .12s, box-shadow .15s, filter .15s;
  }
  .btn-primary { background: var(--signal); color: var(--ink); box-shadow: 0 6px 22px var(--signal-glow); }
  .btn-primary:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 8px 28px var(--signal-glow); }
  .btn-primary:active:not(:disabled) { transform: scale(0.985); }
  .btn-primary:disabled { background: var(--line-bright); color: var(--muted); box-shadow: none; cursor: not-allowed; }

  .icon-btn {
    display: grid; place-items: center; flex-shrink: 0;
    width: 40px; height: 40px; border-radius: var(--r-md);
    background: var(--ink-2); border: 1px solid var(--line); color: var(--text-2);
    cursor: pointer; transition: color .15s, border-color .15s, background .15s;
  }
  .icon-btn:hover { color: var(--signal); border-color: var(--signal-dim); }
  .icon-btn.back { position: absolute; top: 18px; left: 18px; width: 36px; height: 36px; }

  .spinner {
    width: 15px; height: 15px; border: 2px solid rgba(6,9,12,0.35); border-top-color: var(--ink);
    border-radius: 50%; animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ===== Device label ===== */
  .device-label {
    display: flex; align-items: center; justify-content: center; gap: 7px;
    margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--line);
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; color: var(--muted);
  }

  /* ===== Call sign ===== */
  .callsign { display: flex; align-items: center; gap: 12px; }
  .connect-card .callsign { flex-direction: column; text-align: center; gap: 10px; margin: 6px 0 22px; }
  .callsign.sm { gap: 10px; }
  .callsign-info { display: flex; flex-direction: column; min-width: 0; }
  .connect-card .callsign-info { align-items: center; }
  .callsign-name { font-family: var(--font-display); font-weight: 500; font-size: 15px; }
  .callsign-id { font-size: 11px; color: var(--muted); letter-spacing: 0.08em; }

  .avatar {
    width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center;
    border-radius: var(--r-sm); background: var(--ink-2); border: 1px solid var(--signal-dim);
    color: var(--signal); font-family: var(--font-mono); font-weight: 700; font-size: 14px;
  }
  .avatar.lg { width: 58px; height: 58px; font-size: 20px; border-radius: var(--r-md); }
  .avatar.sq { width: 38px; height: 38px; }

  .screen-title {
    font-family: var(--font-display); font-weight: 500; font-size: 18px;
    letter-spacing: 0.02em; margin-bottom: 18px; color: var(--text);
  }

  /* ===== QR ===== */
  .qr-block { margin: 4px 0 18px; }

  /* ===== Steps ===== */
  .steps { list-style: none; margin: 0 0 22px; display: flex; flex-direction: column; gap: 7px; }
  .steps li { display: flex; gap: 9px; font-size: 13px; color: var(--text-2); }
  .step-i { color: var(--signal); font-family: var(--font-mono); }

  /* ============================================================
     CHAT — console page
     ============================================================ */
  .console-page { display: flex; height: 100dvh; }

  .rail {
    width: 320px; min-width: 320px; display: flex; flex-direction: column;
    background: var(--panel); border-right: 1px solid var(--line);
  }
  .rail-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px; border-bottom: 1px solid var(--line);
  }
  .secure-strip {
    display: flex; align-items: center; gap: 8px; padding: 10px 18px;
    font-size: 11.5px; color: var(--secure); background: rgba(88,211,201,0.05);
    border-bottom: 1px solid var(--line);
  }

  .channel-card { margin: 14px 16px; padding: 14px; border: 1px solid var(--line);
    border-radius: var(--r-md); background: var(--ink-2); display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .channel-row { display: flex; align-items: center; gap: 8px; width: 100%; }
  .channel-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .channel-card .lbl { margin: 0; }
  .channel-code { font-size: 12px; font-weight: 700; color: var(--signal); word-break: break-all; letter-spacing: 0.08em; }
  .rail-actions { display: flex; gap: 6px; }

  .rail-section { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 4px 0 0; }
  .search { display: flex; align-items: center; gap: 9px; padding: 10px 18px; }
  .section-label {
    font-family: var(--font-display); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--muted); padding: 6px 18px;
  }
  .stations { flex: 1; overflow-y: auto; }
  .station { display: flex; align-items: center; gap: 11px; padding: 10px 18px; transition: background .12s; }
  .station:hover { background: var(--panel-2); }
  .station-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .station-name { font-size: 13.5px; font-weight: 500; }
  .station-id { font-size: 10.5px; color: var(--secure); letter-spacing: 0.05em; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--signal);
    box-shadow: 0 0 8px var(--signal); animation: blink 2s ease-in-out infinite; }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

  .empty { text-align: center; padding: 28px 18px; color: var(--muted); }
  .empty p { font-size: 13px; margin-bottom: 3px; }
  .dim { color: var(--faint); font-size: 12px; }

  /* ===== Main channel ===== */
  .channel { flex: 1; display: flex; flex-direction: column; background: var(--ink); min-width: 0; }
  .channel-head {
    display: flex; align-items: center; gap: 14px; padding: 13px 22px;
    border-bottom: 1px solid var(--line); background: var(--panel);
  }
  .channel-title { display: flex; flex-direction: column; min-width: 0; }
  .ch-name { font-family: var(--font-display); font-weight: 700; font-size: 14px; letter-spacing: 0.16em; text-transform: uppercase; }
  .ch-status { font-size: 11px; color: var(--muted); letter-spacing: 0.03em; }
  .carrier { flex: 1; max-width: 220px; opacity: 0.85; }

  .log { flex: 1; overflow-y: auto; padding: 22px 26px; }
  .log-inner { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; min-height: 100%; }

  .enc-banner {
    align-self: center; display: flex; align-items: center; gap: 8px;
    padding: 7px 14px; border-radius: 999px; font-size: 11.5px; color: var(--secure);
    background: rgba(88,211,201,0.06); border: 1px solid rgba(88,211,201,0.14); margin-bottom: 6px;
  }

  /* transmissions */
  .tx { max-width: 70%; padding: 9px 13px 10px; border-radius: var(--r-md); animation: rise .25s ease both; }
  .tx.theirs { align-self: flex-start; background: var(--panel); border: 1px solid var(--line); border-left: 2px solid var(--secure-dim); }
  .tx.mine { align-self: flex-end; background: rgba(255,180,84,0.08); border: 1px solid rgba(255,180,84,0.18); border-right: 2px solid var(--signal); }
  .tx-meta { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; font-size: 10.5px; }
  .tx-from { font-weight: 700; letter-spacing: 0.06em; }
  .tx.mine .tx-from { color: var(--signal); }
  .tx.theirs .tx-from { color: var(--secure); }
  .tx-time { color: var(--faint); }
  .tx-body { font-size: 14px; line-height: 1.5; color: var(--text); word-break: break-word; }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  .empty-log { flex: 1; display: grid; place-content: center; justify-items: center; gap: 6px; color: var(--faint); }
  .empty-log p { font-size: 14px; }

  .composer { display: flex; gap: 12px; padding: 14px 22px; background: var(--panel); border-top: 1px solid var(--line); }
  .transmit { flex: 1; font-size: 14px; }
  .btn-send {
    width: 46px; height: 46px; flex-shrink: 0; display: grid; place-items: center;
    border: none; border-radius: var(--r-md); background: var(--signal); color: var(--ink);
    cursor: pointer; transition: transform .12s, filter .15s, box-shadow .15s; box-shadow: 0 4px 16px var(--signal-glow);
  }
  .btn-send:hover:not(:disabled) { filter: brightness(1.08); }
  .btn-send:active:not(:disabled) { transform: scale(0.94); }
  .btn-send:disabled { background: var(--line-bright); color: var(--muted); box-shadow: none; cursor: not-allowed; }

  /* ===== Icons ===== */
  :global(.ic-xs) { width: 13px; height: 13px; }
  :global(.ic-sm) { width: 17px; height: 17px; }
  :global(.ic-md) { width: 20px; height: 20px; }
  :global(.ic-lg) { width: 26px; height: 26px; }
  :global(.ic-xl) { width: 44px; height: 44px; }
  :global(.secure) { color: var(--secure); }
  :global(.muted) { color: var(--muted); }

  .mobile-only { display: none; }
  .scrim { position: fixed; inset: 0; z-index: 35; background: rgba(3, 5, 7, 0.6); backdrop-filter: blur(2px); }

  /* ===== Responsive ===== */
  @media (max-width: 760px) {
    .stage { align-items: flex-start; padding: 16px 14px; }
    .hero-card { padding: 30px 20px 16px; }
    .connect-card { padding: 24px 18px 20px; }
    .icon-btn.back { top: 13px; left: 13px; }
    .wave-window { margin: 18px 0 22px; }

    .mobile-only { display: grid; }
    .carrier { display: none; }
    .channel-title { flex: 1; }

    /* sidebar → slide-in drawer */
    .rail {
      position: fixed; top: 0; bottom: 0; left: 0; z-index: 40;
      width: min(88vw, 358px); transform: translateX(-100%);
      transition: transform .25s ease; box-shadow: 0 0 60px rgba(0, 0, 0, 0.6);
    }
    .rail.open { transform: translateX(0); }

    .channel { width: 100%; }
    .channel-head { padding: 11px 12px; gap: 10px; }
    .tx { max-width: 88%; }
    .log { padding: 18px 14px; }
    .composer { padding: 12px 14px; }
  }
</style>
