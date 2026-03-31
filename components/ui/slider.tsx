"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Native range input — avoids Base UI Slider’s inline `<script>` prehydration,
 * which triggers React 19 “script tag in component” warnings.
 */
export type SliderProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  defaultValue?: number[];
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
};

function Slider({
  className,
  defaultValue,
  value: valueProp,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  id,
  onValueChange,
  ...rest
}: SliderProps) {
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = React.useState(
    () => defaultValue?.[0] ?? min,
  );
  const raw = isControlled ? (valueProp[0] ?? min) : internal;

  return (
    <div
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      data-slot="slider"
      data-disabled={disabled ? "" : undefined}
    >
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={raw}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!isControlled) setInternal(n);
          onValueChange?.([n]);
        }}
        className={cn(
          "h-1 w-full cursor-pointer appearance-none rounded-full bg-muted",
          "accent-primary",
          "disabled:pointer-events-none",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:shrink-0 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ring [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-ring/50 [&::-webkit-slider-thumb]:transition-[box-shadow]",
          "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted",
          "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:shrink-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ring [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:ring-2 [&::-moz-range-thumb]:ring-ring/50",
          "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted",
        )}
        {...rest}
      />
    </div>
  );
}

export { Slider };
