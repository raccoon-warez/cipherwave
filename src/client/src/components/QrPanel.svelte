<script lang="ts">
  import { untrack } from 'svelte';
  import { QrCode, ChevronDown } from '@lucide/svelte';

  interface Props {
    dataUrl: string;
    label?: string;
    open?: boolean;
    size?: number;
  }
  let { dataUrl, label = 'QR code', open = true, size = 140 }: Props = $props();

  // Initialize from the `open` prop once; visibility is then user-controlled.
  let show = $state(untrack(() => open));
  let zoom = $state(false);
</script>

<div class="qrp">
  <button class="qrp-toggle" type="button" onclick={() => (show = !show)} aria-expanded={show}>
    <QrCode class="qrp-ic" />
    <span class="qrp-label">{label}</span>
    <ChevronDown class="qrp-ic chev {show ? 'open' : ''}" />
  </button>

  {#if show && dataUrl}
    <button class="qrp-img" type="button" onclick={() => (zoom = true)} title="Tap to enlarge" aria-label="Enlarge QR code">
      <img src={dataUrl} alt="Channel QR code" width={size} height={size} />
    </button>
  {/if}
</div>

{#if zoom}
  <div
    class="qrp-overlay"
    role="button"
    tabindex="0"
    aria-label="Close enlarged QR code"
    onclick={() => (zoom = false)}
    onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') zoom = false; }}
  >
    <img src={dataUrl} alt="Channel QR code, enlarged" />
    <span class="qrp-hint">Tap anywhere to close</span>
  </div>
{/if}

<style>
  .qrp { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }

  .qrp-toggle {
    display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center;
    padding: 9px 12px; background: transparent; border: 1px solid var(--line); border-radius: var(--r-md);
    color: var(--text-2); cursor: pointer;
    font-family: var(--font-display); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
    transition: border-color .15s, color .15s;
  }
  .qrp-toggle:hover { color: var(--signal); border-color: var(--signal-dim); }
  .qrp-label { flex: 1; text-align: left; }
  :global(.qrp-ic) { width: 14px; height: 14px; flex-shrink: 0; }
  :global(.qrp-ic.chev) { transition: transform .2s; }
  :global(.qrp-ic.chev.open) { transform: rotate(180deg); }

  .qrp-img { padding: 0; border: none; background: transparent; cursor: zoom-in; line-height: 0; }
  .qrp-img img {
    background: #fff; padding: 9px; border-radius: var(--r-md); image-rendering: pixelated; display: block;
    box-shadow: 0 0 0 1px var(--line), 0 8px 24px rgba(0,0,0,0.4);
  }

  .qrp-overlay {
    position: fixed; inset: 0; z-index: 60;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    background: rgba(3, 5, 7, 0.88); backdrop-filter: blur(5px); cursor: zoom-out;
    animation: qfade .15s ease;
  }
  .qrp-overlay img {
    width: min(76vw, 76vh, 440px); height: auto; background: #fff; padding: 16px;
    border-radius: var(--r-lg); image-rendering: pixelated; box-shadow: 0 24px 70px rgba(0,0,0,0.6);
  }
  .qrp-hint { font-family: var(--font-mono); font-size: 12px; color: var(--text-2); letter-spacing: 0.05em; }
  @keyframes qfade { from { opacity: 0; } to { opacity: 1; } }
</style>
