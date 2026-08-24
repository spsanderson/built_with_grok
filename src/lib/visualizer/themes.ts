export type ThemeId = "nocturne" | "aurora" | "ember" | "ice";
export type VizMode = "bars" | "orbit" | "wave";

export interface VizTheme {
  id: ThemeId;
  name: string;
  bg: [number, number, number];
  wash: [number, number, number];
  bars: [number, number, number][];
  glow: [number, number, number];
  accent: [number, number, number];
  peak: [number, number, number];
}

export const THEMES: Record<ThemeId, VizTheme> = {
  nocturne: {
    id: "nocturne",
    name: "Nocturne",
    bg: [7, 8, 12],
    wash: [28, 36, 52],
    bars: [
      [214, 222, 232],
      [150, 176, 198],
      [96, 128, 158],
    ],
    glow: [190, 210, 230],
    accent: [220, 228, 236],
    peak: [236, 240, 246],
  },
  aurora: {
    id: "aurora",
    name: "Aurora",
    bg: [4, 12, 12],
    wash: [12, 48, 44],
    bars: [
      [160, 240, 214],
      [72, 196, 188],
      [36, 140, 148],
    ],
    glow: [90, 230, 210],
    accent: [180, 255, 230],
    peak: [220, 255, 244],
  },
  ember: {
    id: "ember",
    name: "Ember",
    bg: [12, 6, 4],
    wash: [56, 22, 10],
    bars: [
      [255, 186, 120],
      [232, 110, 58],
      [176, 52, 32],
    ],
    glow: [255, 140, 64],
    accent: [255, 210, 160],
    peak: [255, 232, 200],
  },
  ice: {
    id: "ice",
    name: "Ice",
    bg: [5, 10, 18],
    wash: [16, 40, 72],
    bars: [
      [196, 226, 255],
      [96, 164, 230],
      [48, 104, 186],
    ],
    glow: [140, 200, 255],
    accent: [230, 244, 255],
    peak: [245, 250, 255],
  },
};

export const THEME_ORDER: ThemeId[] = ["nocturne", "aurora", "ember", "ice"];

export const MODE_ORDER: VizMode[] = ["bars", "orbit", "wave"];

export const MODE_LABEL: Record<VizMode, string> = {
  bars: "Bars",
  orbit: "Orbit",
  wave: "Wave",
};
