"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";

const baseInputClass =
  "h-11 min-h-11 w-full min-w-0 border border-input/80 bg-background text-base shadow-sm ring-1 ring-black/[0.04] transition-[padding,box-shadow,border-color] placeholder:text-muted-foreground/85 focus-visible:ring-2 focus-visible:ring-ring/35 dark:bg-input/30 dark:ring-white/[0.06] md:h-10 md:min-h-10 md:text-sm";

export function SearchInput({
  className,
  inputClassName,
  id,
  value,
  defaultValue,
  onChange,
  ...props
}: ComponentProps<typeof Input> & { inputClassName?: string }) {
  const isControlled = value !== undefined;
  const [uncontrolledHasText, setUncontrolledHasText] = useState(() => {
    if (typeof defaultValue === "string") return defaultValue.length > 0;
    if (Array.isArray(defaultValue)) return defaultValue.length > 0;
    return false;
  });

  const controlledHasText =
    value !== undefined &&
    value !== null &&
    String(value).length > 0;

  const showIcon = isControlled ? !controlledHasText : !uncontrolledHasText;

  return (
    <div className={cn("relative min-w-0 w-full", className)}>
      {showIcon ? (
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 opacity-75"
          aria-hidden
        />
      ) : null}
      <Input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        data-slot="search-input"
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => {
          if (!isControlled) {
            setUncontrolledHasText(e.target.value.length > 0);
          }
          onChange?.(e);
        }}
        className={cn(
          baseInputClass,
          showIcon ? "pl-[2.875rem] pr-3 md:pl-11" : "px-3",
          inputClassName,
        )}
        {...props}
      />
    </div>
  );
}
