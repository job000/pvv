"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Mobil først: stablet kolonne; fra `sm` rad med wrap og justert bunn for kontroller.
 */
export function FilterToolbar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch md:items-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
