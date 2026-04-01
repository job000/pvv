import { toast } from "@/lib/app-toast";

const DEFAULT_DELAY_MS = 5000;

/**
 * Viser toast med «Angre» og utfører `onCommit` etter `delayMs` hvis brukeren ikke angir.
 * Lukking av toast (X) avbryter sletting, samme som Angre.
 */
export function toastDeleteWithUndo(options: {
  /** Kort tittel i toasten */
  title: string;
  /** Vises i beskrivelsen (f.eks. analyse- eller elementnavn) */
  itemLabel: string;
  delayMs?: number;
  onCommit: () => Promise<void>;
  /** Kalles hvis `onCommit` kaster (etter feil-toast) */
  onFailed?: (error: unknown) => void;
}): void {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  let cancelled = false;

  const timeoutHolder: { id?: number } = {};

  const toastId = toast.message(options.title, {
    description: `«${options.itemLabel}» slettes om noen sekunder. Trykk Angre for å beholde den.`,
    duration: Infinity,
    closeButton: true,
    onDismiss: () => {
      if (timeoutHolder.id !== undefined) {
        window.clearTimeout(timeoutHolder.id);
      }
      cancelled = true;
    },
    action: {
      label: "Angre",
      onClick: () => {
        cancelled = true;
        if (timeoutHolder.id !== undefined) {
          window.clearTimeout(timeoutHolder.id);
        }
        toast.dismiss(toastId);
        toast.message("Sletting avbrutt.");
      },
    },
  });

  timeoutHolder.id = window.setTimeout(() => {
    if (cancelled) return;
    void (async () => {
      try {
        await options.onCommit();
        toast.dismiss(toastId);
        toast.success("Slettet.");
      } catch (e) {
        toast.dismiss(toastId);
        toast.error(
          e instanceof Error ? e.message : "Kunne ikke fullføre sletting.",
        );
        options.onFailed?.(e);
      }
    })();
  }, delayMs) as number;
}
