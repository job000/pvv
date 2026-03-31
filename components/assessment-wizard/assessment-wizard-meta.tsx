"use client";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import type { Doc } from "@/convex/_generated/dataModel";
import { History, Users } from "lucide-react";

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
};

export function AssessmentWizardMeta({
  collaborators,
  versions,
  draftUpdatedAt,
  onOpenTeamAndVersions,
}: Props) {
  const list = collaborators ?? [];
  const maxShow = 5;
  const shown = list.slice(0, maxShow);
  const rest = Math.max(0, list.length - shown.length);
  const versionCount = versions?.length ?? 0;
  const latest = versions?.[0];
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

      <div className="flex min-w-0 flex-1 flex-col gap-2 border-border/50 border-t pt-2 sm:flex-row sm:items-end sm:justify-between sm:border-t-0 sm:pt-0">
        <div className="min-w-0 space-y-1">
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
            <History className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span>
              <strong className="text-foreground font-semibold tabular-nums">
                {versionCount}
              </strong>{" "}
              {versionCount === 1
                ? "navngitt milepæl"
                : "navngitte milepæler"}
              {latest ? (
                <>
                  {" "}
                  · siste milepæl{" "}
                  <time dateTime={new Date(latest.createdAt).toISOString()}>
                    {new Date(latest.createdAt).toLocaleDateString("nb-NO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </>
              ) : null}
            </span>
          </div>
        {draftLabel && draftUpdatedAt != null ? (
          <p className="text-muted-foreground max-w-prose text-[11px] leading-snug">
            Utkast auto-lagret{" "}
            <time dateTime={new Date(draftUpdatedAt).toISOString()}>
              {draftLabel}
            </time>
            . Milepæler må du opprette selv under Samarbeid.
          </p>
        ) : (
            <p className="text-muted-foreground max-w-prose text-[11px] leading-snug">
              Skjemaet lagres fortløpende som utkast. Navngitte milepæler er
              valgfrie og opprettes under Samarbeid.
            </p>
          )}
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
