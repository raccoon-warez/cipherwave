<script lang="ts">
  // The signature element: a live phosphor oscilloscope trace. Represents the
  // carrier signal — calm when 'live', searching when 'scan'. Honors reduced motion.
  interface Props {
    height?: number;
    color?: string;
    amplitude?: number;
    speed?: number;
    noise?: number;
    lineWidth?: number;
  }
  let {
    height = 60,
    color = '#ffb454',
    amplitude = 0.55,
    speed = 1,
    noise = 0.12,
    lineWidth = 2,
  }: Props = $props();

  let canvas = $state<HTMLCanvasElement>();

  $effect(() => {
    const el = canvas;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grain = Array.from({ length: 256 }, () => Math.random() * 2 - 1);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el!.width = el!.clientWidth * dpr;
      el!.height = el!.clientHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    function draw(t: number) {
      const w = el!.clientWidth;
      const h = el!.clientHeight;
      const mid = h / 2;
      ctx!.clearRect(0, 0, w, h);
      ctx!.lineWidth = lineWidth;
      ctx!.lineJoin = 'round';
      ctx!.strokeStyle = color;
      ctx!.shadowColor = color;
      ctx!.shadowBlur = 12;
      ctx!.beginPath();
      const phase = t * 0.0016 * speed;
      for (let x = 0; x <= w; x += 2) {
        const u = x / w;
        // envelope so the trace tapers at both ends like a scope sweep
        const env = Math.sin(Math.PI * u);
        const y =
          mid +
          (Math.sin(u * 8 + phase * 3) * 0.5 +
            Math.sin(u * 19 - phase * 2.1) * 0.26 +
            Math.sin(u * 3.3 + phase) * 0.22 +
            grain[(Math.floor(x + phase * 46)) & 255]! * noise) *
            mid *
            amplitude *
            env;
        if (x === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.stroke();
    }

    if (reduce) {
      draw(800);
    } else {
      const loop = (ts: number) => {
        if (!running) return;
        draw(ts);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });
</script>

<canvas bind:this={canvas} style="width:100%; height:{height}px; display:block;" aria-hidden="true"></canvas>
