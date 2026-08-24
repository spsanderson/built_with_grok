import { create } from "zustand";
import { MODE_ORDER, THEME_ORDER, type ThemeId, type VizMode } from "./themes";

const STORAGE_KEY = "auralis:v1";

interface Persisted {
  mode: VizMode;
  theme: ThemeId;
  sensitivity: number;
}

function load(): Persisted {
  const fallback: Persisted = { mode: "orbit", theme: "nocturne", sensitivity: 1.15 };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      mode: MODE_ORDER.includes(parsed.mode as VizMode) ? (parsed.mode as VizMode) : fallback.mode,
      theme: THEME_ORDER.includes(parsed.theme as ThemeId) ? (parsed.theme as ThemeId) : fallback.theme,
      sensitivity:
        typeof parsed.sensitivity === "number"
          ? Math.min(2.4, Math.max(0.4, parsed.sensitivity))
          : fallback.sensitivity,
    };
  } catch {
    return fallback;
  }
}

interface VizStore extends Persisted {
  controlsVisible: boolean;
  setMode: (mode: VizMode) => void;
  cycleMode: () => void;
  setTheme: (theme: ThemeId) => void;
  setSensitivity: (value: number) => void;
  setControlsVisible: (visible: boolean) => void;
}

function persist(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export const useVizStore = create<VizStore>((set, get) => ({
  mode: "orbit",
  theme: "nocturne",
  sensitivity: 1.15,
  controlsVisible: true,
  setMode: (mode) => {
    set({ mode });
    persist({ mode, theme: get().theme, sensitivity: get().sensitivity });
  },
  cycleMode: () => {
    const { mode } = get();
    const next = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length]!;
    get().setMode(next);
  },
  setTheme: (theme) => {
    set({ theme });
    persist({ mode: get().mode, theme, sensitivity: get().sensitivity });
  },
  setSensitivity: (value) => {
    const sensitivity = Math.min(2.4, Math.max(0.4, value));
    set({ sensitivity });
    persist({ mode: get().mode, theme: get().theme, sensitivity });
  },
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
}));

export function hydrateVizStore() {
  if (typeof window === "undefined") return;
  useVizStore.setState(load());
}
