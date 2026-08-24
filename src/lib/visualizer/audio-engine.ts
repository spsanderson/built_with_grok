export type AudioSource = "idle" | "mic" | "file" | "demo";

const FFT_SIZE = 2048;
const BAR_COUNT = 96;

type EngineListener = () => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private master: GainNode | null = null;
  private freqBytes: Uint8Array<ArrayBuffer> | null = null;
  private timeBytes: Uint8Array<ArrayBuffer> | null = null;
  readonly smoothed = new Float32Array(BAR_COUNT);
  readonly peaks = new Float32Array(BAR_COUNT);
  bass = 0;
  mid = 0;
  treble = 0;
  energy = 0;
  beat = 0;

  source: AudioSource = "idle";
  playing = false;
  trackName: string | null = null;
  duration = 0;
  currentTime = 0;
  error: string | null = null;
  objectUrl: string | null = null;

  private mediaStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaNode: MediaElementAudioSourceNode | null = null;
  private demoNodes: AudioNode[] = [];
  private demoTimer: number | null = null;
  private demoNextNote = 0;
  private demoStep = 0;
  private listeners = new Set<EngineListener>();
  private timeRaf = 0;
  private lastEnergy = 0;

  get barCount() {
    return BAR_COUNT;
  }

  subscribe(fn: EngineListener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private async ensureContext() {
    if (this.ctx && this.analyser) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: "interactive" });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0.72;
    this.analyser.minDecibels = -92;
    this.analyser.maxDecibels = -18;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.analyser);
    this.master.connect(this.ctx.destination);
    this.freqBytes = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.timeBytes = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private async tearDownSource() {
    this.stopDemoClock();
    if (this.micNode) {
      this.micNode.disconnect();
      this.micNode = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) track.stop();
      this.mediaStream = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute("src");
      this.audioEl.load();
    }
    for (const node of this.demoNodes) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.demoNodes = [];
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.stopTimeLoop();
  }

  async startMic() {
    this.error = null;
    try {
      await this.ensureContext();
      await this.tearDownSource();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone is not available in this browser.");
      }
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (!this.ctx || !this.analyser) return;
      this.micNode = this.ctx.createMediaStreamSource(this.mediaStream);
      // Mic must not route to speakers (feedback).
      this.micNode.connect(this.analyser);
      this.source = "mic";
      this.playing = true;
      this.trackName = "Microphone";
      this.duration = 0;
      this.currentTime = 0;
      this.emit();
    } catch (err) {
      this.source = "idle";
      this.playing = false;
      this.trackName = null;
      this.error = permissionMessage(err);
      this.emit();
    }
  }

  async loadFile(file: File) {
    this.error = null;
    try {
      await this.ensureContext();
      await this.tearDownSource();
      if (!this.ctx || !this.master) return;
      if (!this.audioEl) {
        this.audioEl = new Audio();
        this.audioEl.crossOrigin = "anonymous";
        this.audioEl.preload = "auto";
      }
      this.objectUrl = URL.createObjectURL(file);
      this.audioEl.src = this.objectUrl;
      if (!this.mediaNode) {
        this.mediaNode = this.ctx.createMediaElementSource(this.audioEl);
        this.mediaNode.connect(this.master);
      }
      this.audioEl.onended = () => {
        this.playing = false;
        this.emit();
      };
      this.audioEl.ontimeupdate = () => {
        this.currentTime = this.audioEl?.currentTime ?? 0;
        this.duration = this.audioEl?.duration || 0;
      };
      await this.audioEl.play();
      this.source = "file";
      this.playing = true;
      this.trackName = file.name.replace(/\.[^/.]+$/, "");
      this.duration = this.audioEl.duration || 0;
      this.currentTime = 0;
      this.startTimeLoop();
      this.emit();
    } catch (err) {
      this.source = "idle";
      this.playing = false;
      this.trackName = null;
      this.error = "That file could not be played. Try MP3, WAV, or M4A.";
      console.warn(err);
      this.emit();
    }
  }

  async toggleFilePlayback() {
    if (this.source !== "file" || !this.audioEl) return;
    if (this.playing) {
      this.audioEl.pause();
      this.playing = false;
    } else {
      await this.ensureContext();
      await this.audioEl.play();
      this.playing = true;
    }
    this.emit();
  }

  seek(ratio: number) {
    if (!this.audioEl || this.source !== "file" || !Number.isFinite(this.audioEl.duration)) return;
    this.audioEl.currentTime = Math.max(0, Math.min(1, ratio)) * this.audioEl.duration;
    this.currentTime = this.audioEl.currentTime;
    this.emit();
  }

  async startDemo() {
    this.error = null;
    await this.ensureContext();
    await this.tearDownSource();
    if (!this.ctx || !this.master) return;
    this.source = "demo";
    this.playing = true;
    this.trackName = "Pulse study";
    this.duration = 0;
    this.currentTime = 0;
    this.demoStep = 0;
    this.demoNextNote = this.ctx.currentTime + 0.05;
    this.startDemoClock();
    this.emit();
  }

  async stopAll() {
    await this.tearDownSource();
    this.source = "idle";
    this.playing = false;
    this.trackName = null;
    this.duration = 0;
    this.currentTime = 0;
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.energy = 0;
    this.beat = 0;
    this.smoothed.fill(0);
    this.peaks.fill(0);
    this.emit();
  }

  sample(dt: number, sensitivity: number) {
    const analyser = this.analyser;
    const freq = this.freqBytes;
    const time = this.timeBytes;
    const idle = this.source === "idle" || !this.playing;
    if (!analyser || !freq || !time || idle) {
      this.sampleIdle(dt);
      return;
    }
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(time);

    const binCount = freq.length;
    const sampleRate = this.ctx?.sampleRate ?? 44100;
    const nyquist = sampleRate / 2;
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let energy = 0;

    for (let i = 0; i < BAR_COUNT; i++) {
      const f0 = 22 * Math.pow(16000 / 22, i / (BAR_COUNT - 1));
      const f1 = 22 * Math.pow(16000 / 22, (i + 1) / (BAR_COUNT - 1));
      const b0 = Math.max(0, Math.floor((f0 / nyquist) * binCount));
      const b1 = Math.min(binCount - 1, Math.max(b0 + 1, Math.floor((f1 / nyquist) * binCount)));
      let sum = 0;
      for (let b = b0; b <= b1; b++) sum += freq[b] ?? 0;
      const raw = (sum / (b1 - b0 + 1) / 255) * sensitivity;
      const target = Math.min(1, raw * raw * (3 - 2 * raw)); // smoothstep punch
      const k = 1 - Math.exp(-dt * 14);
      this.smoothed[i] += (target - this.smoothed[i]) * k;
      if (this.smoothed[i] > this.peaks[i]) this.peaks[i] = this.smoothed[i];
      else this.peaks[i] *= Math.exp(-dt * 1.6);
      energy += this.smoothed[i];
      if (i < BAR_COUNT * 0.18) bass += this.smoothed[i];
      else if (i < BAR_COUNT * 0.62) mid += this.smoothed[i];
      else treble += this.smoothed[i];
    }

    this.bass = bass / (BAR_COUNT * 0.18);
    this.mid = mid / (BAR_COUNT * 0.44);
    this.treble = treble / (BAR_COUNT * 0.38);
    this.energy = energy / BAR_COUNT;
    const rising = this.energy - this.lastEnergy;
    this.lastEnergy = this.energy;
    const beatHit = this.bass > 0.42 && rising > 0.035 ? 1 : 0;
    this.beat = Math.max(this.beat * Math.exp(-dt * 6), beatHit);
  }

  getWaveform(): Uint8Array<ArrayBuffer> | null {
    return this.timeBytes;
  }

  private sampleIdle(dt: number) {
    const t = performance.now() / 1000;
    let energy = 0;
    let bass = 0;
    for (let i = 0; i < BAR_COUNT; i++) {
      const n = i / BAR_COUNT;
      const wave =
        0.18 +
        0.12 * Math.sin(t * 0.55 + n * 6.2) +
        0.08 * Math.sin(t * 1.15 + n * 14.0) +
        0.05 * Math.sin(t * 0.28 + n * 2.4);
      const target = Math.max(0.04, wave * (0.55 + 0.45 * Math.sin(n * Math.PI)));
      const k = 1 - Math.exp(-dt * 6);
      this.smoothed[i] += (target - this.smoothed[i]) * k;
      if (this.smoothed[i] > this.peaks[i]) this.peaks[i] = this.smoothed[i];
      else this.peaks[i] *= Math.exp(-dt * 0.9);
      energy += this.smoothed[i];
      if (i < BAR_COUNT * 0.18) bass += this.smoothed[i];
    }
    this.bass = bass / (BAR_COUNT * 0.18);
    this.mid = 0.16;
    this.treble = 0.1;
    this.energy = energy / BAR_COUNT;
    this.beat *= Math.exp(-dt * 4);
  }

  private startTimeLoop() {
    this.stopTimeLoop();
    const tick = () => {
      if (this.audioEl && this.source === "file") {
        this.currentTime = this.audioEl.currentTime;
        this.duration = this.audioEl.duration || 0;
        this.emit();
      }
      this.timeRaf = window.setTimeout(tick, 250);
    };
    tick();
  }

  private stopTimeLoop() {
    if (this.timeRaf) {
      window.clearTimeout(this.timeRaf);
      this.timeRaf = 0;
    }
  }

  private startDemoClock() {
    const tick = () => {
      this.scheduleDemo();
      this.demoTimer = window.setTimeout(tick, 25);
    };
    tick();
  }

  private stopDemoClock() {
    if (this.demoTimer != null) {
      window.clearTimeout(this.demoTimer);
      this.demoTimer = null;
    }
  }

  private scheduleDemo() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.source !== "demo") return;
    const secondsPerStep = 60 / 96 / 4; // 96 BPM, 16th notes
    const horizon = ctx.currentTime + 0.12;
    while (this.demoNextNote < horizon) {
      const step = this.demoStep % 16;
      const t = this.demoNextNote;
      if (step === 0 || step === 6 || step === 10) this.kick(t);
      if (step === 4 || step === 12) this.snare(t);
      if (step % 2 === 1) this.hat(t, step % 4 === 3 ? 0.08 : 0.045);
      if (step === 0 || step === 8) this.pad(t, secondsPerStep * 8);
      if ([0, 3, 6, 8, 11, 14].includes(step)) this.lead(t, step);
      if (step % 2 === 0) this.bassNote(t, step);
      this.demoNextNote += secondsPerStep;
      this.demoStep += 1;
    }
  }

  private kick(time: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(148, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.95, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(time);
    osc.stop(time + 0.3);
    this.track(osc, gain);
  }

  private snare(time: number) {
    const ctx = this.ctx!;
    const noise = this.noise(0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.35, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 180;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    osc.connect(og);
    og.connect(this.master!);
    noise.start(time);
    noise.stop(time + 0.2);
    osc.start(time);
    osc.stop(time + 0.14);
    this.track(noise, filter, gain, osc, og);
  }

  private hat(time: number, dur: number) {
    const ctx = this.ctx!;
    const noise = this.noise(dur + 0.04);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.12, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    noise.start(time);
    noise.stop(time + dur + 0.02);
    this.track(noise, filter, gain);
  }

  private bassNote(time: number, step: number) {
    const ctx = this.ctx!;
    const scale = [41.2, 49, 55, 61.74]; // E1 A1 A1 B1-ish
    const freq = scale[Math.floor(step / 2) % scale.length]!;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + 0.22);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.22, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    osc.start(time);
    osc.stop(time + 0.3);
    this.track(osc, filter, gain);
  }

  private lead(time: number, step: number) {
    const ctx = this.ctx!;
    const notes = [329.63, 392, 440, 493.88, 587.33, 659.26];
    const freq = notes[step % notes.length]!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.12, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(time);
    osc.stop(time + 0.24);
    this.track(osc, gain);
  }

  private pad(time: number, dur: number) {
    const ctx = this.ctx!;
    const freqs = [164.81, 196, 246.94];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.05, time + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(time);
      osc.stop(time + dur + 0.05);
      this.track(osc, gain);
    }
  }

  private noise(duration: number) {
    const ctx = this.ctx!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  private track(...nodes: AudioNode[]) {
    this.demoNodes.push(...nodes);
    if (this.demoNodes.length > 240) {
      const drop = this.demoNodes.splice(0, 80);
      for (const n of drop) {
        try {
          n.disconnect();
        } catch {
          /* noop */
        }
      }
    }
  }
}

function permissionMessage(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone access was blocked. Open a track or play the demo instead.";
  }
  if (name === "NotFoundError") {
    return "No microphone was found. Open a track or play the demo instead.";
  }
  return "Microphone is unavailable here. Open a track or play the demo instead.";
}

export const audioEngine = new AudioEngine();
