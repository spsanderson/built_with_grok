import * as React from "react";
import { cn } from "@/lib/utils";

type SliderProps = {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number[]) => void;
  className?: string;
  "aria-label"?: string;
};

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, min = 0, max = 1, step = 0.01, onValueChange, ...props }, ref) => {
    const current = value[0] ?? min;
    const pct = ((current - min) / (max - min)) * 100;
    return (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        suppressHydrationWarning
        onChange={(e) => onValueChange([Number(e.target.value)])}
        className={cn("range-input", className)}
        style={{
          background: `linear-gradient(to right, var(--color-accent) ${pct}%, color-mix(in oklab, var(--color-fg) 12%, transparent) ${pct}%)`,
        }}
        {...props}
      />
    );
  },
);
Slider.displayName = "Slider";
