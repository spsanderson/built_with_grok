import { useEffect, useState } from "react";
import { audioEngine, type AudioSource } from "@/lib/visualizer/audio-engine";

export interface AudioSnapshot {
  source: AudioSource;
  playing: boolean;
  trackName: string | null;
  duration: number;
  currentTime: number;
  error: string | null;
}

function read(): AudioSnapshot {
  return {
    source: audioEngine.source,
    playing: audioEngine.playing,
    trackName: audioEngine.trackName,
    duration: audioEngine.duration,
    currentTime: audioEngine.currentTime,
    error: audioEngine.error,
  };
}

export function useAudioSnapshot() {
  const [snap, setSnap] = useState<AudioSnapshot>(read);
  useEffect(() => audioEngine.subscribe(() => setSnap(read())), []);
  return snap;
}
