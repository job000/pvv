"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, Share, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

const DISMISS_KEY = "pvv-pwa-hint-dismissed";

export function PwaClient() {
  const [mounted, setMounted] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPrompt | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const showBanner = useMemo(() => {
    if (!mounted || isStandalone()) return false;
    if (dismissed) return false;
    if (deferred) return true;
    if (!narrow) return false;
    return true;
  }, [mounted, narrow, deferred, dismissed]);

  useEffect(() => {
    // Mount + les lagret avvisning (kan ikke leses under SSR)
    /* eslint-disable react-hooks/set-state-in-effect -- hydrering etter klient */
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(
        () => {},
      );
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [mounted]);

  const ios = useMemo(() => {
    if (!mounted || typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof document === "undefined") return;
    if (showBanner) {
      document.documentElement.dataset.pwaHint = "1";
    } else {
      delete document.documentElement.dataset.pwaHint;
    }
    return () => {
      delete document.documentElement.dataset.pwaHint;
    };
  }, [mounted, showBanner]);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setDismissed(true);
  }

  if (!mounted || isStandalone()) return null;
  if (!showBanner) return null;

  return (
    <div
      className={cn(
        "border-border/60 bg-card/95 supports-[backdrop-filter]:bg-card/90 fixed bottom-0 left-0 right-0 z-50 border-t shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md",
        !deferred && "md:hidden",
      )}
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      role="region"
      aria-label="Installer som app"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Download className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-foreground text-sm font-semibold leading-tight">
              Installer FRO på telefonen
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {ios ? (
                <>
                  Trykk{" "}
                  <span className="text-foreground inline-flex items-center gap-0.5 font-medium">
                    <Share className="size-3.5" aria-hidden />
                    Del
                  </span>
                  , deretter «Legg til på Hjem-skjerm» for fullskjerm uten
                  nettleserfelt.
                </>
              ) : deferred ? (
                "Få rask tilgang fra hjem-skjerm som en egen app (Chrome/Edge)."
              ) : (
                "Bruk nettleserens meny for å legge til snarvei på hjem-skjerm."
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={dismiss}
            aria-label="Lukk"
          >
            <X className="size-4" />
          </Button>
        </div>
        {deferred ? (
          <Button
            type="button"
            onClick={() => void install()}
            className="h-11 w-full font-medium"
          >
            Installer app
          </Button>
        ) : null}
      </div>
    </div>
  );
}
