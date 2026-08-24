import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Play, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControlDock, useFullscreen } from "@/components/control-dock";
import { VisualizerCanvas } from "@/components/visualizer-canvas";
import { cn } from "@/lib/utils";
import { audioEngine } from "@/lib/visualizer/audio-engine";
import { useVizStore, hydrateVizStore } from "@/lib/visualizer/store";
import { useAudioSnapshot } from "@/hooks/use-audio-snapshot";

export function VisualizerApp() {
  const rootRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hideTimer = useRef<number>(0);
  const snap = useAudioSnapshot();
  const setControlsVisible = useVizStore((s) => s.setControlsVisible);
  const controlsVisible = useVizStore((s) => s.controlsVisible);
  const setSensitivity = useVizStore((s) => s.setSensitivity);
  const { fullscreen, toggle } = useFullscreen(rootRef);
  const [dragging, setDragging] = useState(false);
  const idle = snap.source === "idle";

  const reveal = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    if (audioEngine.source === "idle") return;
    hideTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2800);
  }, [setControlsVisible]);

  useEffect(() => {
    hydrateVizStore();
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    reveal();
    return () => window.clearTimeout(hideTimer.current);
  }, [reveal, snap.source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (audioEngine.source === "file") void audioEngine.toggleFilePlayback();
        else if (audioEngine.source === "demo") {
          if (audioEngine.playing) void audioEngine.stopAll();
          else void audioEngine.startDemo();
        } else if (audioEngine.source === "idle") void audioEngine.startDemo();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggle();
      } else if (e.key === "m" || e.key === "M") {
        if (audioEngine.source === "mic") void audioEngine.stopAll();
        else void audioEngine.startMic();
      } else if (e.key === "1") useVizStore.getState().setMode("bars");
      else if (e.key === "2") useVizStore.getState().setMode("orbit");
      else if (e.key === "3") useVizStore.getState().setMode("wave");
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSensitivity(useVizStore.getState().sensitivity + 0.1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSensitivity(useVizStore.getState().sensitivity - 0.1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSensitivity, toggle]);

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    void audioEngine.loadFile(file);
  }

  return (
    <main
      ref={rootRef}
      className="relative h-dvh min-h-dvh overflow-hidden bg-bg text-fg"
      onPointerMove={reveal}
      onPointerDown={reveal}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <VisualizerCanvas />
      <div
        className="pointer-events-none absolute inset-0 opacity-5 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")",
        }}
        aria-hidden
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <div>
          <p className="font-display text-sm font-semibold tracking-widest text-fg/80">AURALIS</p>
        </div>
        {!idle && (
          <p className="font-mono text-xs uppercase tracking-widest text-subtle">
            {snap.source === "mic" ? "Live" : snap.playing ? "Playing" : "Paused"}
          </p>
        )}
      </header>

      <section
        className={cn(
          "absolute inset-0 z-10 flex flex-col items-center justify-center px-6 pb-36 pt-16 text-center transition-[opacity,transform,filter] duration-300 ease-out-smooth",
          idle ? "opacity-100" : "pointer-events-none opacity-0 translate-y-2 blur-[2px]",
        )}
      >
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
          See the sound
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
          A quiet visualizer for your microphone or a track. Bars, orbit, and wave — tuned, not noisy.
        </p>
        <div className="mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={() => void audioEngine.startMic()} className="sm:min-w-40">
            <Mic className="size-4" />
            Microphone
          </Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="sm:min-w-40">
            <Upload className="size-4" />
            Open track
          </Button>
        </div>
        <button
          type="button"
          onClick={() => void audioEngine.startDemo()}
          className="mt-4 inline-flex h-11 items-center gap-2 px-3 text-sm text-muted transition-colors duration-150 hover:text-fg"
        >
          <Play className="size-3.5 ml-px" />
          Play a short demo
        </button>
        {snap.error && (
          <p role="alert" className="mt-5 max-w-sm text-sm text-danger">
            {snap.error}
          </p>
        )}
      </section>

      <ControlDock
        visible={idle || controlsVisible}
        fullscreen={fullscreen}
        onToggleFullscreen={() => void toggle()}
        onPickFile={() => fileRef.current?.click()}
      />

      {dragging && (
        <div className="absolute inset-3 z-30 flex items-center justify-center rounded-xl border border-dashed border-accent/40 bg-bg/60 text-sm text-fg backdrop-blur-sm">
          Drop an audio file to play
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
        className="sr-only"
        suppressHydrationWarning
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </main>
  );
}
