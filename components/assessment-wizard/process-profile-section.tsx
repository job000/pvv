"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  clampProcessText,
  PROCESS_TEXT_FIELD_MAX,
} from "@/lib/assessment-process-profile";
import { cn } from "@/lib/utils";
import { FileText, Info } from "lucide-react";

const TITLE = "Helhetlig beskrivelse";
const WHAT =
  "Samlet fortelling om dagens prosess og problemet dere vil løse.";
const HINT =
  "Skriv fritt. Her bygger du historien som andre kan lese senere.";
const PLACEHOLDER =
  "F.eks. «Saksbehandler henter journalnotat fra A og registrerer i B manuelt. Tar 20–40 min per sak, avhengig av kompleksitet …»";

export function ProcessProfileSection({
  payload,
  canEdit,
  update,
  compact = false,
}: {
  payload: AssessmentPayload;
  canEdit: boolean;
  update: <K extends keyof AssessmentPayload>(
    key: K,
    value: AssessmentPayload[K],
  ) => void;
  /** Kortere layout når steget deles i faner */
  compact?: boolean;
}) {
  const key = "processDescription" as const;
  const raw = (payload[key] as string | undefined) ?? "";
  const value = raw;
  const len = value.length;
  const atMax = len >= PROCESS_TEXT_FIELD_MAX;
  const hintId = "hint-processDescription";
  const countId = "count-processDescription";

  return (
    <div className="space-y-4">
      {!compact ? (
        <Alert className="border-primary/25 bg-primary/[0.06]">
          <Info className="size-4 text-primary" aria-hidden />
          <AlertTitle className="text-foreground">
            Tekstfelt — ikke poenggrunnlag
          </AlertTitle>
          <AlertDescription className="space-y-2 text-pretty">
            <p>
              Beskrivelsen lagres som kontekst og rapport. Den påvirker ikke den
              automatiske poengsummen — strukturerte vurderinger og
              tallfestede KPI fyller du i de andre stegene.
            </p>
            <p className="text-muted-foreground text-xs">
              Maks {PROCESS_TEXT_FIELD_MAX.toLocaleString("nb-NO")} tegn.
              Innholdet valideres og klippes ved lagring om du skulle lime inn
              for mye.
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Tekst for rapport og kontekst — ikke poeng. Maks{" "}
          {PROCESS_TEXT_FIELD_MAX.toLocaleString("nb-NO")} tegn.
        </p>
      )}

      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm transition-[box-shadow] duration-200 hover:shadow-md",
          compact ? "p-4" : "p-5",
        )}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mb-4 flex flex-wrap items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <FileText className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {TITLE}
              </h2>
              <Badge variant="secondary" className="font-normal text-[10px]">
                Tekstfelt
              </Badge>
            </div>
            <p className="text-foreground text-xs font-medium leading-snug">
              {WHAT}
            </p>
            <p
              id={hintId}
              className="text-muted-foreground text-xs leading-relaxed"
            >
              {HINT}
            </p>
          </div>
        </div>
        <Textarea
          id={`process-${key}`}
          value={value}
          onChange={(e) => {
            const next = clampProcessText(e.target.value);
            update(key, next);
          }}
          disabled={!canEdit}
          rows={5}
          maxLength={PROCESS_TEXT_FIELD_MAX}
          aria-describedby={`${hintId} ${countId}`}
          className={cn(
            "min-h-0 resize-y border-border/80 bg-background/80 text-sm transition-colors focus-visible:border-primary/40",
            atMax && "border-amber-500/50",
          )}
          placeholder={PLACEHOLDER}
        />
        <p
          id={countId}
          className={cn(
            "mt-1.5 text-right text-[11px] tabular-nums",
            atMax
              ? "font-medium text-amber-700 dark:text-amber-400"
              : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {len.toLocaleString("nb-NO")} /{" "}
          {PROCESS_TEXT_FIELD_MAX.toLocaleString("nb-NO")} tegn
          {atMax ? " (maks nådd)" : ""}
        </p>
      </div>
    </div>
  );
}

