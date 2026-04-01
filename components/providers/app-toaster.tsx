"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/** Global toast — legges i rot-layout inne i ThemeProvider. */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  /** Alltid samme tre på SSR og første klient-render (unngår hydreringsfeil). */
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <Toaster
      richColors
      position="top-center"
      closeButton
      theme={theme}
    />
  );
}
