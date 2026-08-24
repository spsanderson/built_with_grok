import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Pause, c as Maximize2, d as AudioLines, f as Activity, i as Play, l as Circle, o as Minimize2, r as Square, s as Mic, t as Upload, u as ChartColumn } from "../_libs/lucide-react.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DK-1ToP9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,transform,background-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:shrink-0", {
	variants: {
		variant: {
			primary: "bg-accent text-accent-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:opacity-90",
			ghost: "bg-transparent text-fg hover:bg-fg/8",
			outline: "bg-surface/70 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-surface-2/80",
			subtle: "bg-fg/6 text-fg hover:bg-fg/10"
		},
		size: {
			md: "h-11 rounded-md px-4 text-sm",
			sm: "h-10 rounded-sm px-3 text-sm",
			icon: "size-11 rounded-md",
			"icon-sm": "size-10 rounded-sm"
		}
	},
	defaultVariants: {
		variant: "primary",
		size: "md"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		ref,
		...props
	});
});
Button.displayName = "Button";
var Slider = import_react.forwardRef(({ className, value, min = 0, max = 1, step = .01, onValueChange, ...props }, ref) => {
	const current = value[0] ?? min;
	const pct = (current - min) / (max - min) * 100;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		ref,
		type: "range",
		min,
		max,
		step,
		value: current,
		suppressHydrationWarning: true,
		onChange: (e) => onValueChange([Number(e.target.value)]),
		className: cn("range-input", className),
		style: { background: `linear-gradient(to right, var(--color-accent) ${pct}%, color-mix(in oklab, var(--color-fg) 12%, transparent) ${pct}%)` },
		...props
	});
});
Slider.displayName = "Slider";
var FFT_SIZE = 2048;
var BAR_COUNT = 96;
var AudioEngine = class {
	ctx = null;
	analyser = null;
	master = null;
	freqBytes = null;
	timeBytes = null;
	smoothed = new Float32Array(BAR_COUNT);
	peaks = new Float32Array(BAR_COUNT);
	bass = 0;
	mid = 0;
	treble = 0;
	energy = 0;
	beat = 0;
	source = "idle";
	playing = false;
	trackName = null;
	duration = 0;
	currentTime = 0;
	error = null;
	objectUrl = null;
	mediaStream = null;
	micNode = null;
	audioEl = null;
	mediaNode = null;
	demoNodes = [];
	demoTimer = null;
	demoNextNote = 0;
	demoStep = 0;
	listeners = /* @__PURE__ */ new Set();
	timeRaf = 0;
	lastEnergy = 0;
	get barCount() {
		return BAR_COUNT;
	}
	subscribe(fn) {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}
	resume() {
		if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
	}
	emit() {
		for (const fn of this.listeners) fn();
	}
	async ensureContext() {
		if (this.ctx && this.analyser) {
			if (this.ctx.state === "suspended") await this.ctx.resume();
			return;
		}
		const Ctx = window.AudioContext || window.webkitAudioContext;
		this.ctx = new Ctx({ latencyHint: "interactive" });
		this.analyser = this.ctx.createAnalyser();
		this.analyser.fftSize = FFT_SIZE;
		this.analyser.smoothingTimeConstant = .72;
		this.analyser.minDecibels = -92;
		this.analyser.maxDecibels = -18;
		this.master = this.ctx.createGain();
		this.master.gain.value = .85;
		this.master.connect(this.analyser);
		this.master.connect(this.ctx.destination);
		this.freqBytes = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
		this.timeBytes = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
		if (this.ctx.state === "suspended") await this.ctx.resume();
	}
	async tearDownSource() {
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
		for (const node of this.demoNodes) try {
			node.disconnect();
		} catch {}
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
			if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone is not available in this browser.");
			this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false
			} });
			if (!this.ctx || !this.analyser) return;
			this.micNode = this.ctx.createMediaStreamSource(this.mediaStream);
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
	async loadFile(file) {
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
	seek(ratio) {
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
		this.demoNextNote = this.ctx.currentTime + .05;
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
	sample(dt, sensitivity) {
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
		const nyquist = (this.ctx?.sampleRate ?? 44100) / 2;
		let bass = 0;
		let mid = 0;
		let treble = 0;
		let energy = 0;
		for (let i = 0; i < BAR_COUNT; i++) {
			const f0 = 22 * Math.pow(16e3 / 22, i / 95);
			const f1 = 22 * Math.pow(16e3 / 22, (i + 1) / 95);
			const b0 = Math.max(0, Math.floor(f0 / nyquist * binCount));
			const b1 = Math.min(binCount - 1, Math.max(b0 + 1, Math.floor(f1 / nyquist * binCount)));
			let sum = 0;
			for (let b = b0; b <= b1; b++) sum += freq[b] ?? 0;
			const raw = sum / (b1 - b0 + 1) / 255 * sensitivity;
			const target = Math.min(1, raw * raw * (3 - 2 * raw));
			const k = 1 - Math.exp(-dt * 14);
			this.smoothed[i] += (target - this.smoothed[i]) * k;
			if (this.smoothed[i] > this.peaks[i]) this.peaks[i] = this.smoothed[i];
			else this.peaks[i] *= Math.exp(-dt * 1.6);
			energy += this.smoothed[i];
			if (i < BAR_COUNT * .18) bass += this.smoothed[i];
			else if (i < BAR_COUNT * .62) mid += this.smoothed[i];
			else treble += this.smoothed[i];
		}
		this.bass = bass / (BAR_COUNT * .18);
		this.mid = mid / (BAR_COUNT * .44);
		this.treble = treble / (BAR_COUNT * .38);
		this.energy = energy / BAR_COUNT;
		const rising = this.energy - this.lastEnergy;
		this.lastEnergy = this.energy;
		const beatHit = this.bass > .42 && rising > .035 ? 1 : 0;
		this.beat = Math.max(this.beat * Math.exp(-dt * 6), beatHit);
	}
	getWaveform() {
		return this.timeBytes;
	}
	sampleIdle(dt) {
		const t = performance.now() / 1e3;
		let energy = 0;
		let bass = 0;
		for (let i = 0; i < BAR_COUNT; i++) {
			const n = i / BAR_COUNT;
			const wave = .18 + .12 * Math.sin(t * .55 + n * 6.2) + .08 * Math.sin(t * 1.15 + n * 14) + .05 * Math.sin(t * .28 + n * 2.4);
			const target = Math.max(.04, wave * (.55 + .45 * Math.sin(n * Math.PI)));
			const k = 1 - Math.exp(-dt * 6);
			this.smoothed[i] += (target - this.smoothed[i]) * k;
			if (this.smoothed[i] > this.peaks[i]) this.peaks[i] = this.smoothed[i];
			else this.peaks[i] *= Math.exp(-dt * .9);
			energy += this.smoothed[i];
			if (i < BAR_COUNT * .18) bass += this.smoothed[i];
		}
		this.bass = bass / (BAR_COUNT * .18);
		this.mid = .16;
		this.treble = .1;
		this.energy = energy / BAR_COUNT;
		this.beat *= Math.exp(-dt * 4);
	}
	startTimeLoop() {
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
	stopTimeLoop() {
		if (this.timeRaf) {
			window.clearTimeout(this.timeRaf);
			this.timeRaf = 0;
		}
	}
	startDemoClock() {
		const tick = () => {
			this.scheduleDemo();
			this.demoTimer = window.setTimeout(tick, 25);
		};
		tick();
	}
	stopDemoClock() {
		if (this.demoTimer != null) {
			window.clearTimeout(this.demoTimer);
			this.demoTimer = null;
		}
	}
	scheduleDemo() {
		const ctx = this.ctx;
		const master = this.master;
		if (!ctx || !master || this.source !== "demo") return;
		const secondsPerStep = 60 / 96 / 4;
		const horizon = ctx.currentTime + .12;
		while (this.demoNextNote < horizon) {
			const step = this.demoStep % 16;
			const t = this.demoNextNote;
			if (step === 0 || step === 6 || step === 10) this.kick(t);
			if (step === 4 || step === 12) this.snare(t);
			if (step % 2 === 1) this.hat(t, step % 4 === 3 ? .08 : .045);
			if (step === 0 || step === 8) this.pad(t, secondsPerStep * 8);
			if ([
				0,
				3,
				6,
				8,
				11,
				14
			].includes(step)) this.lead(t, step);
			if (step % 2 === 0) this.bassNote(t, step);
			this.demoNextNote += secondsPerStep;
			this.demoStep += 1;
		}
	}
	kick(time) {
		const ctx = this.ctx;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(148, time);
		osc.frequency.exponentialRampToValueAtTime(42, time + .12);
		gain.gain.setValueAtTime(1e-4, time);
		gain.gain.exponentialRampToValueAtTime(.95, time + .008);
		gain.gain.exponentialRampToValueAtTime(1e-4, time + .28);
		osc.connect(gain);
		gain.connect(this.master);
		osc.start(time);
		osc.stop(time + .3);
		this.track(osc, gain);
	}
	snare(time) {
		const ctx = this.ctx;
		const noise = this.noise(.18);
		const filter = ctx.createBiquadFilter();
		filter.type = "highpass";
		filter.frequency.value = 900;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(1e-4, time);
		gain.gain.exponentialRampToValueAtTime(.35, time + .005);
		gain.gain.exponentialRampToValueAtTime(1e-4, time + .16);
		const osc = ctx.createOscillator();
		osc.type = "triangle";
		osc.frequency.value = 180;
		const og = ctx.createGain();
		og.gain.setValueAtTime(.18, time);
		og.gain.exponentialRampToValueAtTime(1e-4, time + .12);
		noise.connect(filter);
		filter.connect(gain);
		gain.connect(this.master);
		osc.connect(og);
		og.connect(this.master);
		noise.start(time);
		noise.stop(time + .2);
		osc.start(time);
		osc.stop(time + .14);
		this.track(noise, filter, gain, osc, og);
	}
	hat(time, dur) {
		const ctx = this.ctx;
		const noise = this.noise(dur + .04);
		const filter = ctx.createBiquadFilter();
		filter.type = "highpass";
		filter.frequency.value = 7e3;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(1e-4, time);
		gain.gain.exponentialRampToValueAtTime(.12, time + .004);
		gain.gain.exponentialRampToValueAtTime(1e-4, time + dur);
		noise.connect(filter);
		filter.connect(gain);
		gain.connect(this.master);
		noise.start(time);
		noise.stop(time + dur + .02);
		this.track(noise, filter, gain);
	}
	bassNote(time, step) {
		const ctx = this.ctx;
		const scale = [
			41.2,
			49,
			55,
			61.74
		];
		const freq = scale[Math.floor(step / 2) % scale.length];
		const osc = ctx.createOscillator();
		const filter = ctx.createBiquadFilter();
		const gain = ctx.createGain();
		osc.type = "sawtooth";
		osc.frequency.value = freq;
		filter.type = "lowpass";
		filter.frequency.setValueAtTime(420, time);
		filter.frequency.exponentialRampToValueAtTime(180, time + .22);
		gain.gain.setValueAtTime(1e-4, time);
		gain.gain.exponentialRampToValueAtTime(.22, time + .02);
		gain.gain.exponentialRampToValueAtTime(1e-4, time + .28);
		osc.connect(filter);
		filter.connect(gain);
		gain.connect(this.master);
		osc.start(time);
		osc.stop(time + .3);
		this.track(osc, filter, gain);
	}
	lead(time, step) {
		const ctx = this.ctx;
		const notes = [
			329.63,
			392,
			440,
			493.88,
			587.33,
			659.26
		];
		const freq = notes[step % notes.length];
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "triangle";
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(1e-4, time);
		gain.gain.exponentialRampToValueAtTime(.12, time + .01);
		gain.gain.exponentialRampToValueAtTime(1e-4, time + .22);
		osc.connect(gain);
		gain.connect(this.master);
		osc.start(time);
		osc.stop(time + .24);
		this.track(osc, gain);
	}
	pad(time, dur) {
		const ctx = this.ctx;
		for (const f of [
			164.81,
			196,
			246.94
		]) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = f;
			gain.gain.setValueAtTime(1e-4, time);
			gain.gain.exponentialRampToValueAtTime(.05, time + .4);
			gain.gain.exponentialRampToValueAtTime(1e-4, time + dur);
			osc.connect(gain);
			gain.connect(this.master);
			osc.start(time);
			osc.stop(time + dur + .05);
			this.track(osc, gain);
		}
	}
	noise(duration) {
		const ctx = this.ctx;
		const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
		const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
		const src = ctx.createBufferSource();
		src.buffer = buffer;
		return src;
	}
	track(...nodes) {
		this.demoNodes.push(...nodes);
		if (this.demoNodes.length > 240) {
			const drop = this.demoNodes.splice(0, 80);
			for (const n of drop) try {
				n.disconnect();
			} catch {}
		}
	}
};
function permissionMessage(err) {
	const name = err instanceof DOMException ? err.name : "";
	if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Microphone access was blocked. Open a track or play the demo instead.";
	if (name === "NotFoundError") return "No microphone was found. Open a track or play the demo instead.";
	return "Microphone is unavailable here. Open a track or play the demo instead.";
}
var audioEngine = new AudioEngine();
var THEMES = {
	nocturne: {
		id: "nocturne",
		name: "Nocturne",
		bg: [
			7,
			8,
			12
		],
		wash: [
			28,
			36,
			52
		],
		bars: [
			[
				214,
				222,
				232
			],
			[
				150,
				176,
				198
			],
			[
				96,
				128,
				158
			]
		],
		glow: [
			190,
			210,
			230
		],
		accent: [
			220,
			228,
			236
		],
		peak: [
			236,
			240,
			246
		]
	},
	aurora: {
		id: "aurora",
		name: "Aurora",
		bg: [
			4,
			12,
			12
		],
		wash: [
			12,
			48,
			44
		],
		bars: [
			[
				160,
				240,
				214
			],
			[
				72,
				196,
				188
			],
			[
				36,
				140,
				148
			]
		],
		glow: [
			90,
			230,
			210
		],
		accent: [
			180,
			255,
			230
		],
		peak: [
			220,
			255,
			244
		]
	},
	ember: {
		id: "ember",
		name: "Ember",
		bg: [
			12,
			6,
			4
		],
		wash: [
			56,
			22,
			10
		],
		bars: [
			[
				255,
				186,
				120
			],
			[
				232,
				110,
				58
			],
			[
				176,
				52,
				32
			]
		],
		glow: [
			255,
			140,
			64
		],
		accent: [
			255,
			210,
			160
		],
		peak: [
			255,
			232,
			200
		]
	},
	ice: {
		id: "ice",
		name: "Ice",
		bg: [
			5,
			10,
			18
		],
		wash: [
			16,
			40,
			72
		],
		bars: [
			[
				196,
				226,
				255
			],
			[
				96,
				164,
				230
			],
			[
				48,
				104,
				186
			]
		],
		glow: [
			140,
			200,
			255
		],
		accent: [
			230,
			244,
			255
		],
		peak: [
			245,
			250,
			255
		]
	}
};
var THEME_ORDER = [
	"nocturne",
	"aurora",
	"ember",
	"ice"
];
var MODE_ORDER = [
	"bars",
	"orbit",
	"wave"
];
var MODE_LABEL = {
	bars: "Bars",
	orbit: "Orbit",
	wave: "Wave"
};
var STORAGE_KEY = "auralis:v1";
function load() {
	const fallback = {
		mode: "orbit",
		theme: "nocturne",
		sensitivity: 1.15
	};
	if (typeof window === "undefined") return fallback;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw);
		return {
			mode: MODE_ORDER.includes(parsed.mode) ? parsed.mode : fallback.mode,
			theme: THEME_ORDER.includes(parsed.theme) ? parsed.theme : fallback.theme,
			sensitivity: typeof parsed.sensitivity === "number" ? Math.min(2.4, Math.max(.4, parsed.sensitivity)) : fallback.sensitivity
		};
	} catch {
		return fallback;
	}
}
function persist(state) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {}
}
var useVizStore = create((set, get) => ({
	mode: "orbit",
	theme: "nocturne",
	sensitivity: 1.15,
	controlsVisible: true,
	setMode: (mode) => {
		set({ mode });
		persist({
			mode,
			theme: get().theme,
			sensitivity: get().sensitivity
		});
	},
	cycleMode: () => {
		const { mode } = get();
		const next = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length];
		get().setMode(next);
	},
	setTheme: (theme) => {
		set({ theme });
		persist({
			mode: get().mode,
			theme,
			sensitivity: get().sensitivity
		});
	},
	setSensitivity: (value) => {
		const sensitivity = Math.min(2.4, Math.max(.4, value));
		set({ sensitivity });
		persist({
			mode: get().mode,
			theme: get().theme,
			sensitivity
		});
	},
	setControlsVisible: (controlsVisible) => set({ controlsVisible })
}));
function hydrateVizStore() {
	if (typeof window === "undefined") return;
	useVizStore.setState(load());
}
function read() {
	return {
		source: audioEngine.source,
		playing: audioEngine.playing,
		trackName: audioEngine.trackName,
		duration: audioEngine.duration,
		currentTime: audioEngine.currentTime,
		error: audioEngine.error
	};
}
function useAudioSnapshot() {
	const [snap, setSnap] = (0, import_react.useState)(read);
	(0, import_react.useEffect)(() => audioEngine.subscribe(() => setSnap(read())), []);
	return snap;
}
var MODES = [
	{
		id: "bars",
		icon: ChartColumn,
		label: "Bars"
	},
	{
		id: "orbit",
		icon: Circle,
		label: "Orbit"
	},
	{
		id: "wave",
		icon: AudioLines,
		label: "Wave"
	}
];
function ControlDock({ visible, fullscreen, onToggleFullscreen, onPickFile }) {
	const snap = useAudioSnapshot();
	const mode = useVizStore((s) => s.mode);
	const theme = useVizStore((s) => s.theme);
	const sensitivity = useVizStore((s) => s.sensitivity);
	const setMode = useVizStore((s) => s.setMode);
	const setTheme = useVizStore((s) => s.setTheme);
	const setSensitivity = useVizStore((s) => s.setSensitivity);
	const idle = snap.source === "idle";
	const canPause = snap.source === "file" || snap.source === "demo";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8", "bg-linear-to-t from-bg/80 to-transparent", "transition-[opacity,transform] duration-300 ease-out-smooth", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto w-full max-w-3xl rounded-xl bg-surface/80 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md",
			children: [
				snap.source === "file" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeekBar, {
					current: snap.currentTime,
					duration: snap.duration,
					onSeek: (r) => audioEngine.seek(r)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-1.5 sm:gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1",
							children: [
								canPause ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: snap.playing ? "Pause" : "Play",
									onClick: () => {
										if (snap.source === "file") audioEngine.toggleFilePlayback();
										else if (snap.playing) audioEngine.stopAll();
										else audioEngine.startDemo();
									},
									children: snap.playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 ml-px" })
								}) : snap.source === "mic" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "Stop microphone",
									onClick: () => void audioEngine.stopAll(),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-3.5 fill-current" })
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "Play demo",
									onClick: () => void audioEngine.startDemo(),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 ml-px" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "Use microphone",
									pressed: snap.source === "mic",
									onClick: () => {
										if (snap.source === "mic") audioEngine.stopAll();
										else audioEngine.startMic();
									},
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-4" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "Open a track",
									onClick: onPickFile,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" })
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-1 hidden h-6 w-px bg-border sm:block" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "min-w-0 flex-1 truncate px-1 font-mono text-xs text-muted tabular-nums",
							children: [idle ? "Idle" : snap.trackName, snap.source === "file" && snap.duration > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-subtle",
								children: [
									" ",
									formatTime(snap.currentTime),
									" / ",
									formatTime(snap.duration)
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center gap-0.5 rounded-md bg-fg/5 p-0.5",
							children: MODES.map((m) => {
								const Icon = m.icon;
								const active = mode === m.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": m.label,
									"aria-pressed": active,
									title: MODE_LABEL[m.id],
									onClick: () => setMode(m.id),
									className: cn("flex size-10 items-center justify-center rounded-sm transition-[background-color,color] duration-150 ease-out-smooth", active ? "bg-fg/12 text-fg" : "text-muted hover:text-fg"),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" })
								}, m.id);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center gap-1 px-1",
							children: THEME_ORDER.map((id) => {
								const t = THEMES[id];
								const active = theme === id;
								const [r, g, b] = t.glow;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": t.name,
									title: t.name,
									"aria-pressed": active,
									onClick: () => setTheme(id),
									className: "flex size-10 items-center justify-center",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("size-5 rounded-pill transition-[transform,opacity] duration-150 ease-out-smooth", active ? "scale-110" : "opacity-70"),
										style: {
											background: `rgb(${r},${g},${b})`,
											boxShadow: active ? `0 0 0 2px var(--color-bg), 0 0 0 3px rgb(${r},${g},${b})` : void 0
										}
									})
								}, id);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden items-center gap-2 sm:flex",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
								className: "size-3.5 text-subtle",
								"aria-hidden": true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
								"aria-label": "Sensitivity",
								min: .4,
								max: 2.4,
								step: .05,
								value: [sensitivity],
								onValueChange: (v) => setSensitivity(v[0] ?? 1),
								className: "w-24"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
							label: fullscreen ? "Exit fullscreen" : "Enter fullscreen",
							onClick: onToggleFullscreen,
							children: fullscreen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minimize2, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "size-4" })
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex items-center gap-2 px-2 sm:hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-subtle",
						children: "Sensitivity"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
						"aria-label": "Sensitivity",
						min: .4,
						max: 2.4,
						step: .05,
						value: [sensitivity],
						onValueChange: (v) => setSensitivity(v[0] ?? 1),
						className: "flex-1"
					})]
				})
			]
		})
	});
}
function IconBtn({ label, children, onClick, pressed }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		type: "button",
		variant: "ghost",
		size: "icon-sm",
		"aria-label": label,
		title: label,
		"aria-pressed": pressed,
		onClick,
		className: cn(pressed && "bg-fg/12"),
		children
	});
}
function SeekBar({ current, duration, onSeek }) {
	const ref = (0, import_react.useRef)(null);
	const ratio = duration > 0 ? Math.min(1, current / duration) : 0;
	function seekFromEvent(e) {
		const el = ref.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		onSeek((e.clientX - rect.left) / rect.width);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref,
		role: "slider",
		"aria-label": "Seek",
		"aria-valuemin": 0,
		"aria-valuemax": Math.round(duration),
		"aria-valuenow": Math.round(current),
		tabIndex: 0,
		className: "mb-2 h-4 cursor-pointer px-2",
		onPointerDown: seekFromEvent,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "relative top-1.5 h-1 overflow-hidden rounded-pill bg-fg/12",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-full bg-accent",
				style: { width: `${ratio * 100}%` }
			})
		})
	});
}
function formatTime(seconds) {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}
function useFullscreen(target) {
	const [fullscreen, setFullscreen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
		document.addEventListener("fullscreenchange", onChange);
		return () => document.removeEventListener("fullscreenchange", onChange);
	}, []);
	async function toggle() {
		const el = target.current;
		if (!el) return;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await el.requestFullscreen();
		} catch {}
	}
	return {
		fullscreen,
		toggle
	};
}
var VisualizerRenderer = class {
	canvas;
	ctx;
	engine;
	raf = 0;
	last = 0;
	rotation = 0;
	waveHistory = [];
	running = false;
	reducedMotion = false;
	getMode;
	getTheme;
	getSensitivity;
	constructor(canvas, engine, opts) {
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
	loop = (now) => {
		if (!this.running) return;
		const dt = Math.min(.05, (now - this.last) / 1e3) || .016;
		this.last = now;
		this.resize();
		this.engine.sample(dt, this.getSensitivity());
		const theme = THEMES[this.getTheme()];
		const mode = this.getMode();
		this.draw(dt, theme, mode);
		this.raf = requestAnimationFrame(this.loop);
	};
	draw(dt, theme, mode) {
		const { ctx, canvas, engine } = this;
		const w = canvas.width;
		const h = canvas.height;
		const [br, bg, bb] = theme.bg;
		ctx.fillStyle = `rgb(${br},${bg},${bb})`;
		ctx.fillRect(0, 0, w, h);
		const pulse = engine.bass * .55 + engine.beat * .45;
		const [wr, wg, wb] = theme.wash;
		const wash = ctx.createRadialGradient(w * .5, h * .48, 0, w * .5, h * .48, Math.max(w, h) * .62);
		wash.addColorStop(0, `rgba(${wr},${wg},${wb},${.18 + pulse * .28})`);
		wash.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
		ctx.fillStyle = wash;
		ctx.fillRect(0, 0, w, h);
		if (mode === "bars") this.drawBars(theme, w, h);
		else if (mode === "orbit") this.drawOrbit(dt, theme, w, h);
		else this.drawWave(theme, w, h);
		const vig = ctx.createRadialGradient(w * .5, h * .5, Math.min(w, h) * .25, w * .5, h * .5, Math.max(w, h) * .72);
		vig.addColorStop(0, "rgba(0,0,0,0)");
		vig.addColorStop(1, `rgba(${br},${bg},${bb},0.55)`);
		ctx.fillStyle = vig;
		ctx.fillRect(0, 0, w, h);
	}
	colorAt(theme, t, alpha = 1) {
		const stops = theme.bars;
		const x = Math.min(.999, Math.max(0, t)) * (stops.length - 1);
		const i = Math.floor(x);
		const f = x - i;
		const a = stops[i];
		const b = stops[Math.min(stops.length - 1, i + 1)];
		const r = a[0] + (b[0] - a[0]) * f;
		const g = a[1] + (b[1] - a[1]) * f;
		const bl = a[2] + (b[2] - a[2]) * f;
		return `rgba(${r | 0},${g | 0},${bl | 0},${alpha})`;
	}
	drawBars(theme, w, h) {
		const { ctx, engine } = this;
		const n = engine.barCount;
		const marginX = w * .07;
		const baseY = h * .62;
		const maxH = h * .42;
		const gap = Math.max(1.5, (w - marginX * 2) / n * .22);
		const barW = Math.max(2, (w - marginX * 2 - gap * (n - 1)) / n);
		const radius = Math.min(barW * .45, 6);
		for (let i = 0; i < n; i++) {
			const v = engine.smoothed[i] ?? 0;
			const peak = engine.peaks[i] ?? 0;
			const x = marginX + i * (barW + gap);
			const bh = Math.max(2, v * maxH);
			const t = i / (n - 1);
			ctx.fillStyle = this.colorAt(theme, t, .95);
			roundRect(ctx, x, baseY - bh, barW, bh, radius);
			ctx.fill();
			const py = baseY - peak * maxH;
			ctx.fillStyle = `rgba(${theme.peak[0]},${theme.peak[1]},${theme.peak[2]},0.85)`;
			ctx.fillRect(x, py - 2, barW, 2);
			const rh = bh * .38;
			const grad = ctx.createLinearGradient(0, baseY, 0, baseY + rh + 8);
			grad.addColorStop(0, this.colorAt(theme, t, .28));
			grad.addColorStop(1, this.colorAt(theme, t, 0));
			ctx.fillStyle = grad;
			roundRect(ctx, x, baseY + 4, barW, rh, radius);
			ctx.fill();
		}
		ctx.fillStyle = `rgba(${theme.accent[0]},${theme.accent[1]},${theme.accent[2]},0.18)`;
		ctx.fillRect(marginX, baseY, w - marginX * 2, 1);
	}
	drawOrbit(dt, theme, w, h) {
		const { ctx, engine } = this;
		const n = engine.barCount;
		const cx = w * .5;
		const cy = h * .48;
		const min = Math.min(w, h);
		const inner = min * (.16 + engine.bass * .03);
		const maxLen = min * .28;
		if (!this.reducedMotion) this.rotation += dt * (.12 + engine.treble * .35);
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(this.rotation);
		const disc = ctx.createRadialGradient(0, 0, inner * .15, 0, 0, inner);
		disc.addColorStop(0, `rgba(${theme.glow[0]},${theme.glow[1]},${theme.glow[2]},${.22 + engine.bass * .45})`);
		disc.addColorStop(1, `rgba(${theme.glow[0]},${theme.glow[1]},${theme.glow[2]},0)`);
		ctx.fillStyle = disc;
		ctx.beginPath();
		ctx.arc(0, 0, inner * 1.35, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = `rgba(${theme.accent[0]},${theme.accent[1]},${theme.accent[2]},0.28)`;
		ctx.lineWidth = Math.max(1, min * .002);
		ctx.beginPath();
		ctx.arc(0, 0, inner, 0, Math.PI * 2);
		ctx.stroke();
		const barW = Math.PI * 2 * inner / n * .55;
		for (let i = 0; i < n; i++) {
			const v = engine.smoothed[i] ?? 0;
			const peak = engine.peaks[i] ?? 0;
			const ang = i / n * Math.PI * 2 - Math.PI / 2;
			const len = Math.max(min * .012, v * maxLen);
			const t = i / (n - 1);
			ctx.save();
			ctx.rotate(ang);
			ctx.fillStyle = this.colorAt(theme, t, .92);
			roundRect(ctx, inner, -barW / 2, len, barW, barW / 2);
			ctx.fill();
			ctx.fillStyle = `rgba(${theme.peak[0]},${theme.peak[1]},${theme.peak[2]},0.8)`;
			ctx.fillRect(inner + peak * maxLen, -barW / 2, 2, barW);
			ctx.restore();
		}
		ctx.beginPath();
		for (let i = 0; i <= n; i++) {
			const idx = i % n;
			const v = engine.smoothed[idx] ?? 0;
			const ang = idx / n * Math.PI * 2 - Math.PI / 2;
			const r = inner + Math.max(min * .012, v * maxLen) + min * .018;
			const x = Math.cos(ang) * r;
			const y = Math.sin(ang) * r;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.strokeStyle = `rgba(${theme.glow[0]},${theme.glow[1]},${theme.glow[2]},0.28)`;
		ctx.lineWidth = Math.max(1.2, min * .003);
		ctx.stroke();
		ctx.restore();
	}
	drawWave(theme, w, h) {
		const { ctx, engine } = this;
		const n = engine.barCount;
		const midY = h * .5;
		const amp = h * .28;
		const samples = 160;
		const points = [];
		for (let i = 0; i < samples; i++) {
			const t = i / 159;
			const idx = t * (n - 1);
			const a = Math.floor(idx);
			const b = Math.min(n - 1, a + 1);
			const f = idx - a;
			const v = (engine.smoothed[a] ?? 0) * (1 - f) + (engine.smoothed[b] ?? 0) * f;
			const sign = i % 2 === 0 ? 1 : -1;
			points.push(v * (.55 + .45 * Math.sin(t * Math.PI)) * sign);
		}
		this.waveHistory.unshift(Float32Array.from(points));
		if (this.waveHistory.length > 3) this.waveHistory.pop();
		const time = engine.getWaveform();
		if (time && engine.source !== "idle" && engine.playing) {
			const step = Math.max(1, Math.floor(time.length / samples));
			for (let i = 0; i < samples; i++) {
				const s = time[i * step] ?? 128;
				points[i] = (s - 128) / 128 * (.35 + engine.energy * .9);
			}
		}
		const layers = [
			{
				data: this.waveHistory[2],
				alpha: .18,
				width: 1.2
			},
			{
				data: this.waveHistory[1],
				alpha: .32,
				width: 1.6
			},
			{
				data: points,
				alpha: .95,
				width: 2.2
			}
		];
		for (const layer of layers) {
			const data = layer.data;
			if (!data) continue;
			ctx.beginPath();
			for (let i = 0; i < samples; i++) {
				const x = i / 159 * w;
				const y = midY - (data[i] ?? 0) * amp;
				if (i === 0) ctx.moveTo(x, y);
				else {
					const px = (i - 1) / 159 * w;
					const py = midY - (data[i - 1] ?? 0) * amp;
					const cpx = (px + x) / 2;
					ctx.quadraticCurveTo(px, py, cpx, (py + y) / 2);
				}
			}
			ctx.strokeStyle = this.colorAt(theme, .35, layer.alpha);
			ctx.lineWidth = layer.width * Math.min(2, window.devicePixelRatio || 1);
			ctx.lineJoin = "round";
			ctx.lineCap = "round";
			ctx.stroke();
		}
		ctx.beginPath();
		ctx.moveTo(0, midY);
		for (let i = 0; i < samples; i++) {
			const x = i / 159 * w;
			const y = midY - (points[i] ?? 0) * amp;
			ctx.lineTo(x, y);
		}
		ctx.lineTo(w, midY);
		ctx.closePath();
		const fill = ctx.createLinearGradient(0, midY - amp, 0, midY + amp * .2);
		fill.addColorStop(0, this.colorAt(theme, .15, .22));
		fill.addColorStop(1, this.colorAt(theme, .8, 0));
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.fillStyle = `rgba(${theme.accent[0]},${theme.accent[1]},${theme.accent[2]},0.16)`;
		ctx.fillRect(w * .08, midY, w * .84, 1);
	}
};
function roundRect(ctx, x, y, w, h, r) {
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
function VisualizerCanvas() {
	const canvasRef = (0, import_react.useRef)(null);
	const mode = useVizStore((s) => s.mode);
	const theme = useVizStore((s) => s.theme);
	const sensitivity = useVizStore((s) => s.sensitivity);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const renderer = new VisualizerRenderer(canvas, audioEngine, {
			getMode: () => useVizStore.getState().mode,
			getTheme: () => useVizStore.getState().theme,
			getSensitivity: () => useVizStore.getState().sensitivity
		});
		renderer.start();
		const onResize = () => renderer.resize();
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
			renderer.stop();
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		className: "absolute inset-0 size-full",
		"data-mode": mode,
		"data-theme": theme,
		"data-sensitivity": sensitivity.toFixed(2),
		"aria-hidden": "true"
	});
}
function VisualizerApp() {
	const rootRef = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	const hideTimer = (0, import_react.useRef)(0);
	const snap = useAudioSnapshot();
	const setControlsVisible = useVizStore((s) => s.setControlsVisible);
	const controlsVisible = useVizStore((s) => s.controlsVisible);
	const setSensitivity = useVizStore((s) => s.setSensitivity);
	const { fullscreen, toggle } = useFullscreen(rootRef);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const idle = snap.source === "idle";
	const reveal = (0, import_react.useCallback)(() => {
		setControlsVisible(true);
		window.clearTimeout(hideTimer.current);
		if (audioEngine.source === "idle") return;
		hideTimer.current = window.setTimeout(() => {
			setControlsVisible(false);
		}, 2800);
	}, [setControlsVisible]);
	(0, import_react.useEffect)(() => {
		hydrateVizStore();
	}, []);
	(0, import_react.useEffect)(() => {
		const resume = () => audioEngine.resume();
		const onVis = () => {
			if (document.visibilityState === "visible") resume();
		};
		document.addEventListener("visibilitychange", onVis);
		window.addEventListener("focus", resume);
		return () => {
			document.removeEventListener("visibilitychange", onVis);
			window.removeEventListener("focus", resume);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		reveal();
		return () => window.clearTimeout(hideTimer.current);
	}, [reveal, snap.source]);
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			const tag = e.target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			if (e.code === "Space") {
				e.preventDefault();
				if (audioEngine.source === "file") audioEngine.toggleFilePlayback();
				else if (audioEngine.source === "demo") {
					if (audioEngine.playing) audioEngine.stopAll();
					else audioEngine.startDemo();
				} else if (audioEngine.source === "idle") audioEngine.startDemo();
			} else if (e.key === "f" || e.key === "F") {
				e.preventDefault();
				toggle();
			} else if (e.key === "m" || e.key === "M") {
				if (audioEngine.source === "mic") audioEngine.stopAll();
				else audioEngine.startMic();
			} else if (e.key === "1") useVizStore.getState().setMode("bars");
			else if (e.key === "2") useVizStore.getState().setMode("orbit");
			else if (e.key === "3") useVizStore.getState().setMode("wave");
			else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSensitivity(useVizStore.getState().sensitivity + .1);
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				setSensitivity(useVizStore.getState().sensitivity - .1);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [setSensitivity, toggle]);
	function onFiles(files) {
		const file = files?.[0];
		if (!file) return;
		audioEngine.loadFile(file);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		ref: rootRef,
		className: "relative h-dvh min-h-dvh overflow-hidden bg-bg text-fg",
		onPointerMove: reveal,
		onPointerDown: reveal,
		onDragOver: (e) => {
			e.preventDefault();
			setDragging(true);
		},
		onDragLeave: () => setDragging(false),
		onDrop: (e) => {
			e.preventDefault();
			setDragging(false);
			onFiles(e.dataTransfer.files);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VisualizerCanvas, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 opacity-5 mix-blend-overlay",
				style: { backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")" },
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-sm font-semibold tracking-widest text-fg/80",
					children: "AURALIS"
				}) }), !idle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs uppercase tracking-widest text-subtle",
					children: snap.source === "mic" ? "Live" : snap.playing ? "Playing" : "Paused"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: cn("absolute inset-0 z-10 flex flex-col items-center justify-center px-6 pb-36 pt-16 text-center transition-[opacity,transform,filter] duration-300 ease-out-smooth", idle ? "opacity-100" : "pointer-events-none opacity-0 translate-y-2 blur-[2px]"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl font-semibold tracking-tight text-fg",
						children: "See the sound"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-md text-sm text-muted sm:text-base",
						children: "A quiet visualizer for your microphone or a track. Bars, orbit, and wave — tuned, not noisy."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							onClick: () => void audioEngine.startMic(),
							className: "sm:min-w-40",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-4" }), "Microphone"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => fileRef.current?.click(),
							className: "sm:min-w-40",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), "Open track"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => void audioEngine.startDemo(),
						className: "mt-4 inline-flex h-11 items-center gap-2 px-3 text-sm text-muted transition-colors duration-150 hover:text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5 ml-px" }), "Play a short demo"]
					}),
					snap.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "mt-5 max-w-sm text-sm text-danger",
						children: snap.error
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlDock, {
				visible: idle || controlsVisible,
				fullscreen,
				onToggleFullscreen: () => void toggle(),
				onPickFile: () => fileRef.current?.click()
			}),
			dragging && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-3 z-30 flex items-center justify-center rounded-xl border border-dashed border-accent/40 bg-bg/60 text-sm text-fg backdrop-blur-sm",
				children: "Drop an audio file to play"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: fileRef,
				type: "file",
				accept: "audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac",
				className: "sr-only",
				suppressHydrationWarning: true,
				onChange: (e) => {
					onFiles(e.target.files);
					e.target.value = "";
				}
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VisualizerApp, {});
}
//#endregion
export { Home as component };
