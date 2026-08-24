import type { AudioEngine } from "./audio-engine";
import { THEMES, type ThemeId, type VizMode, type VizTheme } from "./themes";

export class VisualizerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: AudioEngine;
  private raf = 0;
  private last = 0;
  private rotation = 0;
  private waveHistory: Float32Array[] = [];
  private running = false;
  private reducedMotion = false;
  getMode: () => VizMode;
  getTheme: () => ThemeId;
  getSensitivity: () => number;

  constructor(
    canvas: HTMLCanvasElement,
    engine: AudioEngine,
    opts: {
      getMode: () => VizMode;
      getTheme: () => ThemeId;
      getSensitivity: () => number;
    },
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is unavailable.");
    this.ctx = ctx;
    this.engine = engine;
    this.getMode = opts.getMode;
    this.getTheme = opts.getTheme;
    this.getSensitivity = opts.getSensitivity;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.resize();
    this.loop(this.last);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private loop = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000) || 0.016;
    this.last = now;
    this.resize();
    this.engine.sample(dt, this.getSensitivity());
    const theme = THEMES[this.getTheme()];
    const mode = this.getMode();
    this.draw(dt, theme, mode);
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(dt: number, theme: VizTheme, mode: VizMode) {
    const { ctx, canvas, engine } = this;
    const w = canvas.width;
    const h = canvas.height;
    const [br, bg, bb] = theme.bg;
    ctx.fillStyle = `rgb(${br},${bg},${bb})`;
    ctx.fillRect(0, 0, w, h);

    const pulse = engine.bass * 0.55 + engine.beat * 0.45;
    const [wr, wg, wb] = theme.wash;
    const wash = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, Math.max(w, h) * 0.62);
    wash.addColorStop(0, `rgba(${wr},${wg},${wb},${0.18 + pulse * 0.28})`);
    wash.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    if (mode === "bars") this.drawBars(theme, w, h);
    else if (mode === "orbit") this.drawOrbit(dt, theme, w, h);
    else this.drawWave(theme, w, h);

    // Vignette
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, `rgba(${br},${bg},${bb},0.55)`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  private colorAt(theme: VizTheme, t: number, alpha = 1) {
    const stops = theme.bars;
    const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    const a = stops[i]!;
    const b = stops[Math.min(stops.length - 1, i + 1)]!;
    const r = a[0] + (b[0] - a[0]) * f;
    const g = a[1] + (b[1] - a[1]) * f;
    const bl = a[2] + (b[2] - a[2]) * f;
    return `rgba(${r | 0},${g | 0},${bl | 0},${alpha})`;
  }

  private drawBars(theme: VizTheme, w: number, h: number) {
    const { ctx, engine } = this;
    const n = engine.barCount;
    const marginX = w * 0.07;
    const baseY = h * 0.62;
    const maxH = h * 0.42;
    const gap = Math.max(1.5, (w - marginX * 2) / n * 0.22);
    const barW = Math.max(2, ((w - marginX * 2) - gap * (n - 1)) / n);
    const radius = Math.min(barW * 0.45, 6);

    for (let i = 0; i < n; i++) {
      const v = engine.smoothed[i] ?? 0;
      const peak = engine.peaks[i] ?? 0;
      const x = marginX + i * (barW + gap);
      const bh = Math.max(2, v * maxH);
      const t = i / (n - 1);
      ctx.fillStyle = this.colorAt(theme, t, 0.95);
      roundRect(ctx, x, baseY - bh, barW, bh, radius);
      ctx.fill();

      // Peak cap
      const py = baseY - peak * maxH;
      ctx.fillStyle = `rgba(${theme.peak[0]},${theme.peak[1]},${theme.peak[2]},0.85)`;
      ctx.fillRect(x, py - 2, barW, 2);

      // Reflection
      const rh = bh * 0.38;
      const grad = ctx.createLinearGradient(0, baseY, 0, baseY + rh + 8);
      grad.addColorStop(0, this.colorAt(theme, t, 0.28));
      grad.addColorStop(1, this.colorAt(theme, t, 0));
      ctx.fillStyle = grad;
      roundRect(ctx, x, baseY + 4, barW, rh, radius);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${theme.accent[0]},${theme.accent[1]},${theme.accent[2]},0.18)`;
    ctx.fillRect(marginX, baseY, w - marginX * 2, 1);
  }

  private drawOrbit(dt: number, theme: VizTheme, w: number, h: number) {
    const { ctx, engine } = this;
    const n = engine.barCount;
    const cx = w * 0.5;
    const cy = h * 0.48;
    const min = Math.min(w, h);
    const inner = min * (0.16 + engine.bass * 0.03);
    const maxLen = min * 0.28;
    if (!this.reducedMotion) this.rotation += dt * (0.12 + engine.treble * 0.35);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    // Inner disc
    const disc = ctx.createRadialGradient(0, 0, inner * 0.15, 0, 0, inner);
    disc.addColorStop(0, `rgba(${theme.glow[0]},${theme.glow[1]},${theme.glow[2]},${0.22 + engine.bass * 0.45})`);
    disc.addColorStop(1, `rgba(${theme.glow[0]},${theme.glow[1]},${theme.glow[2]},0)`);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, inner * 1.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${theme.accent[0]},${theme.accent[1]},${theme.accent[2]},0.28)`;
    ctx.lineWidth = Math.max(1, min * 0.002);
    ctx.beginPath();
    ctx.arc(0, 0, inner, 0, Math.PI * 2);
    ctx.stroke();

    const barW = (Math.PI * 2 * inner) / n * 0.55;
    for (let i = 0; i < n; i++) {
      const v = engine.smoothed[i] ?? 0;
      const peak = engine.peaks[i] ?? 0;
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const len = Math.max(min * 0.012, v * maxLen);
      const t = i / (n - 1);
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = this.colorAt(theme, t, 0.92);
      roundRect(ctx, inner, -barW / 2, len, barW, barW / 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${theme.peak[0]},${theme.peak[1]},${theme.peak[2]},0.8)`;
      ctx.fillRect(inner + peak * maxLen, -barW / 2, 2, barW);
      ctx.restore();
    }

    // Outer envelope
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const v = engine.smoothed[idx] ?? 0;
      const ang = (idx / n) * Math.PI * 2 - Math.PI / 2;
      const r = inner + Math.max(min * 0.012, v * maxLen) + min * 0.018;
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(${theme.glow[0]},${theme.glow[1]},${theme.glow[2]},0.28)`;
    ctx.lineWidth = Math.max(1.2, min * 0.003);
    ctx.stroke();

    ctx.restore();
  }

  private drawWave(theme: VizTheme, w: number, h: number) {
    const { ctx, engine } = this;
    const n = engine.barCount;
    const midY = h * 0.5;
    const amp = h * 0.28;
    const samples = 160;

    const points: number[] = [];
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const idx = t * (n - 1);
      const a = Math.floor(idx);
      const b = Math.min(n - 1, a + 1);
      const f = idx - a;
      const v = (engine.smoothed[a] ?? 0) * (1 - f) + (engine.smoothed[b] ?? 0) * f;
      const sign = i % 2 === 0 ? 1 : -1;
      // Fold spectrum into a centered waveform
      points.push((v * (0.55 + 0.45 * Math.sin(t * Math.PI))) * sign);
    }

    this.waveHistory.unshift(Float32Array.from(points));
    if (this.waveHistory.length > 3) this.waveHistory.pop();

    const time = engine.getWaveform();
    if (time && engine.source !== "idle" && engine.playing) {
      const step = Math.max(1, Math.floor(time.length / samples));
      for (let i = 0; i < samples; i++) {
        const s = time[i * step] ?? 128;
        points[i] = ((s - 128) / 128) * (0.35 + engine.energy * 0.9);
      }
    }

    const layers = [
      { data: this.waveHistory[2], alpha: 0.18, width: 1.2 },
      { data: this.waveHistory[1], alpha: 0.32, width: 1.6 },
      { data: points, alpha: 0.95, width: 2.2 },
    ];

    for (const layer of layers) {
      const data = layer.data;
      if (!data) continue;
      ctx.beginPath();
      for (let i = 0; i < samples; i++) {
        const x = (i / (samples - 1)) * w;
        const y = midY - (data[i] ?? 0) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = ((i - 1) / (samples - 1)) * w;
          const py = midY - (data[i - 1] ?? 0) * amp;
          const cpx = (px + x) / 2;
          ctx.quadraticCurveTo(px, py, cpx, (py + y) / 2);
        }
      }
      ctx.strokeStyle = this.colorAt(theme, 0.35, layer.alpha);
      ctx.lineWidth = layer.width * Math.min(2, window.devicePixelRatio || 1);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Filled core wave
    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < samples; i++) {
      const x = (i / (samples - 1)) * w;
      const y = midY - (points[i] ?? 0) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, midY);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, midY - amp, 0, midY + amp * 0.2);
    fill.addColorStop(0, this.colorAt(theme, 0.15, 0.22));
    fill.addColorStop(1, this.colorAt(theme, 0.8, 0));
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.fillStyle = `rgba(${theme.accent[0]},${theme.accent[1]},${theme.accent[2]},0.16)`;
    ctx.fillRect(w * 0.08, midY, w * 0.84, 1);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
