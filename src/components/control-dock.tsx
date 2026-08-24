import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  BarChart3,
  Circle,
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Play,
  Square,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { audioEngine } from "@/lib/visualizer/audio-engine";
import { MODE_LABEL, THEMES, THEME_ORDER, type VizMode } from "@/lib/visualizer/themes";
import { useVizStore } from "@/lib/visualizer/store";
import { useAudioSnapshot } from "@/hooks/use-audio-snapshot";

const MODES: { id: VizMode; icon: typeof BarChart3; label: string }[] = [
  { id: "bars", icon: BarChart3, label: "Bars" },
  { id: "orbit", icon: Circle, label: "Orbit" },
  { id: "wave", icon: AudioLines, label: "Wave" },
];

export function ControlDock({
  visible,
  fullscreen,
  onToggleFullscreen,
  onPickFile,
}: {
  visible: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onPickFile: () => void;
}) {
  const snap = useAudioSnapshot();
  const mode = useVizStore((s) => s.mode);
  const theme = useVizStore((s) => s.theme);
  const sensitivity = useVizStore((s) => s.sensitivity);
  const setMode = useVizStore((s) => s.setMode);
  const setTheme = useVizStore((s) => s.setTheme);
  const setSensitivity = useVizStore((s) => s.setSensitivity);
  const idle = snap.source === "idle";
  const canPause = snap.source === "file" || snap.source === "demo";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8",
        "bg-linear-to-t from-bg/80 to-transparent",
        "transition-[opacity,transform] duration-300 ease-out-smooth",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
      )}
    >
      <div className="pointer-events-auto w-full max-w-3xl rounded-xl bg-surface/80 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
        {snap.source === "file" && (
          <SeekBar
            current={snap.currentTime}
            duration={snap.duration}
            onSeek={(r) => audioEngine.seek(r)}
          />
        )}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1">
            {canPause ? (
              <IconBtn
                label={snap.playing ? "Pause" : "Play"}
                onClick={() => {
                  if (snap.source === "file") void audioEngine.toggleFilePlayback();
                  else if (snap.playing) void audioEngine.stopAll();
                  else void audioEngine.startDemo();
                }}
              >
                {snap.playing ? <Pause className="size-4" /> : <Play className="size-4 ml-px" />}
              </IconBtn>
            ) : snap.source === "mic" ? (
              <IconBtn label="Stop microphone" onClick={() => void audioEngine.stopAll()}>
                <Square className="size-3.5 fill-current" />
              </IconBtn>
            ) : (
              <IconBtn label="Play demo" onClick={() => void audioEngine.startDemo()}>
                <Play className="size-4 ml-px" />
              </IconBtn>
            )}
            <IconBtn
              label="Use microphone"
              pressed={snap.source === "mic"}
              onClick={() => {
                if (snap.source === "mic") void audioEngine.stopAll();
                else void audioEngine.startMic();
              }}
            >
              <Mic className="size-4" />
            </IconBtn>
            <IconBtn label="Open a track" onClick={onPickFile}>
              <Upload className="size-4" />
            </IconBtn>
          </div>

          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

          <p className="min-w-0 flex-1 truncate px-1 font-mono text-xs text-muted tabular-nums">
            {idle ? "Idle" : snap.trackName}
            {snap.source === "file" && snap.duration > 0 && (
              <span className="text-subtle">
                {" "}
                {formatTime(snap.currentTime)} / {formatTime(snap.duration)}
              </span>
            )}
          </p>

          <div className="flex items-center gap-0.5 rounded-md bg-fg/5 p-0.5">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-label={m.label}
                  aria-pressed={active}
                  title={MODE_LABEL[m.id]}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-sm transition-[background-color,color] duration-150 ease-out-smooth",
                    active ? "bg-fg/12 text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 px-1">
            {THEME_ORDER.map((id) => {
              const t = THEMES[id];
              const active = theme === id;
              const [r, g, b] = t.glow;
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={t.name}
                  title={t.name}
                  aria-pressed={active}
                  onClick={() => setTheme(id)}
                  className="flex size-10 items-center justify-center"
                >
                  <span
                    className={cn(
                      "size-5 rounded-pill transition-[transform,opacity] duration-150 ease-out-smooth",
                      active ? "scale-110" : "opacity-70",
                    )}
                    style={{
                      background: `rgb(${r},${g},${b})`,
                      boxShadow: active
                        ? `0 0 0 2px var(--color-bg), 0 0 0 3px rgb(${r},${g},${b})`
                        : undefined,
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Activity className="size-3.5 text-subtle" aria-hidden />
            <Slider
              aria-label="Sensitivity"
              min={0.4}
              max={2.4}
              step={0.05}
              value={[sensitivity]}
              onValueChange={(v) => setSensitivity(v[0] ?? 1)}
              className="w-24"
            />
          </div>

          <IconBtn label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={onToggleFullscreen}>
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </IconBtn>
        </div>
        <div className="mt-2 flex items-center gap-2 px-2 sm:hidden">
          <span className="text-xs text-subtle">Sensitivity</span>
          <Slider
            aria-label="Sensitivity"
            min={0.4}
            max={2.4}
            step={0.05}
            value={[sensitivity]}
            onValueChange={(v) => setSensitivity(v[0] ?? 1)}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  pressed,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(pressed && "bg-fg/12")}
    >
      {children}
    </Button>
  );
}

function SeekBar({
  current,
  duration,
  onSeek,
}: {
  current: number;
  duration: number;
  onSeek: (ratio: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;

  function seekFromEvent(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onSeek((e.clientX - rect.left) / rect.width);
  }

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(current)}
      tabIndex={0}
      className="mb-2 h-4 cursor-pointer px-2"
      onPointerDown={seekFromEvent}
    >
      <div className="relative top-1.5 h-1 overflow-hidden rounded-pill bg-fg/12">
        <div className="h-full bg-accent" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function useFullscreen(target: React.RefObject<HTMLElement | null>) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
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
    } catch {
      /* ignored — some embeds block fullscreen */
    }
  }

  return { fullscreen, toggle };
}
