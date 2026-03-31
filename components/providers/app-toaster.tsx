"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";

/** Global toast — legges i rot-layout inne i ThemeProvider. */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Toaster
      richColors
      position="top-center"
      closeButton
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
