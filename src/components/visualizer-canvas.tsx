import { useEffect, useRef } from "react";
import { audioEngine } from "@/lib/visualizer/audio-engine";
import { VisualizerRenderer } from "@/lib/visualizer/renderer";
import { useVizStore } from "@/lib/visualizer/store";

export function VisualizerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useVizStore((s) => s.mode);
  const theme = useVizStore((s) => s.theme);
  const sensitivity = useVizStore((s) => s.sensitivity);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new VisualizerRenderer(canvas, audioEngine, {
      getMode: () => useVizStore.getState().mode,
      getTheme: () => useVizStore.getState().theme,
      getSensitivity: () => useVizStore.getState().sensitivity,
    });
    renderer.start();
    const onResize = () => renderer.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      renderer.stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full"
      data-mode={mode}
      data-theme={theme}
      data-sensitivity={sensitivity.toFixed(2)}
      aria-hidden="true"
    />
  );
}
