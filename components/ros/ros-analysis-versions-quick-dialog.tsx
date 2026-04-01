"use client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { History, Layers, Settings2, X } from "lucide-react";
import Link from "next/link";

function formatTs(ms: number) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspaces">;
  analysisId: Id<"rosAnalyses"> | null;
  analysisTitle: string;
};

export function RosAnalysisVersionsQuickDialog({
  open,
  onOpenChange,
  workspaceId,
  analysisId,
  analysisTitle,
}: Props) {
  const versions = useQuery(
    api.ros.listVersions,
    open && analysisId ? { analysisId } : "skip",
  );

  const titleId = "ros-quick-versions-title";
  const descId = "ros-quick-versions-desc";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        titleId={titleId}
        descriptionId={descId}
        className="max-h-[min(92vh,36rem)]"
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                id={titleId}
                className="text-foreground flex items-center gap-2 text-base font-semibold tracking-tight"
              >
                <Layers className="text-primary size-5 shrink-0" aria-hidden />
                <span className="truncate">Lagrede versjoner</span>
              </p>
              <p id={descId} className="text-muted-foreground mt-1 text-sm">
                <span className="text-foreground font-medium">
                  {analysisTitle || "ROS-analyse"}
                </span>
                {" · "}
                Øyeblikksbilder du kan gjenopprette eller slette i analysen.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Lukk"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {versions === undefined ? (
            <p className="text-muted-foreground text-sm">Henter versjoner …</p>
          ) : versions.length === 0 ? (
            <div className="border-border/60 bg-muted/20 rounded-xl border border-dashed px-4 py-6 text-center">
              <History
                className="text-muted-foreground/60 mx-auto mb-2 size-8"
                aria-hidden
              />
              <p className="text-foreground text-sm font-medium">
                Ingen lagrede versjoner ennå
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Lag en ved å bruke «Lagre versjon» eller «Lagre endringer» inne i
                analysen.
              </p>
            </div>
          ) : (
            <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
              {versions.map((v) => (
                  <li
                    key={v._id}
                    className="border-border/50 bg-card/40 flex flex-col gap-1 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="bg-primary/12 text-primary rounded-md px-1.5 py-0.5 font-mono text-sm font-semibold tabular-nums">
                          v{v.version}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatTs(v.createdAt)}
                        </span>
                      </div>
                      {v.note ? (
                        <p className="text-muted-foreground mt-1 text-xs leading-snug">
                          {v.note}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground order-2 text-left text-xs sm:order-1 sm:max-w-[50%]">
            For forhåndsvisning, gjenoppretting og sletting: bruk full
            versjonskontroll (Innstillinger i analysen).
          </p>
          <div className="order-1 flex w-full flex-wrap justify-end gap-2 sm:order-2 sm:w-auto">
            {analysisId ? (
              <>
                <Link
                  href={`/w/${workspaceId}/ros/a/${analysisId}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-9 gap-1.5",
                  )}
                  onClick={() => onOpenChange(false)}
                >
                  Åpne analyse
                </Link>
                <Link
                  href={`/w/${workspaceId}/ros/a/${analysisId}#versjoner`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-9 gap-1.5",
                  )}
                  onClick={() => onOpenChange(false)}
                >
                  <Settings2 className="size-3.5" aria-hidden />
                  Versjonskontroll
                </Link>
              </>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
