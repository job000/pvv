"use client";

import { cn } from "@/lib/utils";
import { useMemo } from "react";

type Props = {
  name: string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
};

function initialsFromName(name: string | null | undefined): string {
  const s = name?.trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[parts.length - 1][0];
    if (a && b) return (a + b).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

export function UserAvatar({ name, className, size = "sm", title }: Props) {
  const initials = useMemo(() => initialsFromName(name), [name]);
  const sizeClass =
    size === "lg"
      ? "size-12 text-base"
      : size === "md"
        ? "size-10 text-sm"
        : "size-8 text-xs";

  return (
    <div
      className={cn(
        "bg-primary/12 text-primary ring-background flex shrink-0 items-center justify-center rounded-full font-semibold ring-2",
        sizeClass,
        className,
      )}
      title={title ?? name ?? undefined}
      aria-hidden
    >
      {initials}
    </div>
  );
}
