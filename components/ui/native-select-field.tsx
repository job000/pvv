"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

const nativeSelectClass =
  "border-input bg-background flex h-11 min-h-11 w-full min-w-0 cursor-pointer appearance-none rounded-xl border px-3 pr-10 text-base shadow-sm ring-1 ring-black/[0.04] transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30 dark:ring-white/[0.06] md:h-10 md:min-h-10 md:text-sm";

type NativeSelectFieldProps = ComponentProps<"select"> & {
  id: string;
  label?: string;
  /** Når true (standard): skjul synlig etikett på små skjermer (kun `aria-label` på select). */
  compactLabel?: boolean;
  className?: string;
  selectClassName?: string;
};

export function NativeSelectField({
  id,
  label,
  compactLabel = true,
  className,
  selectClassName,
  children,
  "aria-label": ariaLabel,
  ...props
}: NativeSelectFieldProps) {
  const name = ariaLabel ?? label;
  return (
    <div className={cn("flex min-w-0 w-full flex-col gap-1.5", className)}>
      {label ? (
        <span
          className={cn(
            "text-muted-foreground text-xs font-medium",
            compactLabel && "hidden sm:block",
          )}
        >
          {label}
        </span>
      ) : null}
      <div className="relative">
        <select
          id={id}
          aria-label={name}
          className={cn(nativeSelectClass, selectClassName)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-70"
          aria-hidden
        />
      </div>
    </div>
  );
}
