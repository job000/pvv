"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import type { Doc } from "@/convex/_generated/dataModel";
import { History, Users } from "lucide-react";
import { useMemo, useState } from "react";

type Collab = {
  _id: Doc<"assessmentCollaborators">["_id"];
  userId: Doc<"assessmentCollaborators">["userId"];
  role: string;
  name: string | null;
  email: string | null;
};

type VersionRow = {
  _id: string;
  version: number;
  createdAt: number;
  note?: string | null;
};

type Props = {
  collaborators: Collab[] | undefined;
  versions: VersionRow[] | undefined;
  /** Når utkastet sist ble lagret (auto) — skilles fra navngitte milepæler */
  draftUpdatedAt?: number | null;
  onOpenTeamAndVersions: () => void;
  /** Åpner forhåndsvisning av en lagret milepæl (fører til Samarbeid og dialog). */
  onPickVersionPreview: (version: number) => void;
};

export function AssessmentWizardMeta({
  collaborators,
  versions,
  draftUpdatedAt,
  onOpenTeamAndVersions,
  onPickVersionPreview,
}: Props) {
  const list = collaborators ?? [];
  const maxShow = 5;
  const shown = list.slice(0, maxShow);
  const rest = Math.max(0, list.length - shown.length);
  const versionCount = versions?.length ?? 0;
  const versionOptions = useMemo(() => {
    const rows = versions ?? [];
    return [...rows].sort((a, b) => b.version - a.version);
  }, [versions]);
  const latestMilestone = versionOptions[0];
  const [versionPickValue, setVersionPickValue] = useState("");
  const draftLabel =
    draftUpdatedAt != null
      ? new Date(draftUpdatedAt).toLocaleString("nb-NO", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="border-border/60 bg-card/50 flex flex-col gap-3 rounded-xl border px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Med i vurderingen
          </span>
        </div>
        {list.length === 0 ? (
          <p className="text-muted-foreground text-sm">Laster eller ingen ennå …</p>
        ) : (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Personer med tilgang">
            {shown.map((c) => {
              const display = c.name ?? c.email ?? String(c.userId);
              return (
                <li key={c._id} title={`${display} (${c.role})`}>
                  <UserAvatar name={display} size="md" />
                </li>
              );
            })}
            {rest > 0 ? (
              <li className="text-muted-foreground bg-muted/80 flex size-10 items-center justify-center rounded-full text-xs font-semibold">
                +{rest}
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 border-border/50 border-t pt-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-4 sm:gap-y-2 sm:border-t-0 sm:pt-0">
        <div className="min-w-0 space-y-1">
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
            <History className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span>
              <strong className="text-foreground font-semibold tabular-nums">
                {versionCount}
              </strong>{" "}
              {versionCount === 1 ? "milepæl" : "milepæler"}
              {latestMilestone ? (
                <>
                  {" "}
                  · siste{" "}
                  <time
                    dateTime={new Date(latestMilestone.createdAt).toISOString()}
                  >
                    {new Date(latestMilestone.createdAt).toLocaleDateString(
                      "nb-NO",
                      {
                        day: "numeric",
                        month: "short",
                      },
                    )}
                  </time>
                </>
              ) : null}
            </span>
          </div>
        {draftLabel && draftUpdatedAt != null ? (
          <p className="text-muted-foreground text-[11px] leading-snug">
            Lagret{" "}
            <time dateTime={new Date(draftUpdatedAt).toISOString()}>
              {draftLabel}
            </time>
          </p>
        ) : (
            <p className="text-muted-foreground text-[11px] leading-snug">
              Milepæler er valgfrie — under Samarbeid.
            </p>
          )}
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-[min(100%,20rem)]">
          <Label
            htmlFor="meta-milepick"
            className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide"
          >
            Versjon
          </Label>
          <select
            id="meta-milepick"
            className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
            value={versionPickValue}
            disabled={versionOptions.length === 0}
            aria-label="Velg lagret milepæl for forhåndsvisning"
            onChange={(e) => {
              const raw = e.target.value;
              if (!raw) return;
              const num = Number(raw);
              if (Number.isFinite(num) && num > 0) {
                onPickVersionPreview(num);
              }
              setVersionPickValue("");
            }}
          >
            <option value="">
              {versionOptions.length === 0
                ? "Ingen milepæler ennå"
                : "Forhåndsvis versjon …"}
            </option>
            {versionOptions.map((v) => (
              <option key={v._id} value={String(v.version)}>
                v{v.version}
                {v.note
                  ? ` — ${v.note.length > 42 ? `${v.note.slice(0, 40)}…` : v.note}`
                  : ""}{" "}
                (
                {new Date(v.createdAt).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "short",
                })}
                )
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={onOpenTeamAndVersions}
        >
          <Users className="size-3.5" aria-hidden />
          Team, milepæler, deling
        </Button>
      </div>
    </div>
  );
}
