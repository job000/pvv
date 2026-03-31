"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Crosshair, ScrollText, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

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

export function RosJournalPanel({
  analysisId,
  rowLabels,
  colLabels,
  afterRowLabels,
  afterColLabels,
  afterSeparate,
  onJumpToCell,
}: {
  analysisId: Id<"rosAnalyses">;
  rowLabels: string[];
  colLabels: string[];
  /** Når «etter tiltak» har eget rutenett — må matche dimensjonen til etter-matrisen */
  afterRowLabels?: string[];
  afterColLabels?: string[];
  /** Om etter-matrisen bruker egne akser (ulikt «før») */
  afterSeparate?: boolean;
  /** matrixPhase styrer hvilken fane som åpnes ved «Hopp til celle» */
  onJumpToCell: (row: number, col: number, matrixPhase?: "before" | "after") => void;
}) {
  const entries = useQuery(api.ros.listJournalEntries, { analysisId });
  const append = useMutation(api.ros.appendJournalEntry);
  const remove = useMutation(api.ros.removeJournalEntry);

  const [body, setBody] = useState("");
  const [linkRow, setLinkRow] = useState("");
  const [linkCol, setLinkCol] = useState("");
  const [linkPhase, setLinkPhase] = useState<"before" | "after" | "">("");
  const [busy, setBusy] = useState(false);

  const effRowLabels =
    linkPhase === "after" && afterSeparate
      ? (afterRowLabels ?? rowLabels)
      : rowLabels;
  const effColLabels =
    linkPhase === "after" && afterSeparate
      ? (afterColLabels ?? colLabels)
      : colLabels;

  const submitManual = useCallback(async () => {
    const t = body.trim();
    if (!t) return;
    setBusy(true);
    try {
      let r: number | undefined;
      let c: number | undefined;
      const ri = parseInt(linkRow, 10);
      const ci = parseInt(linkCol, 10);
      if (
        linkRow.trim() !== "" &&
        linkCol.trim() !== "" &&
        !Number.isNaN(ri) &&
        !Number.isNaN(ci) &&
        ri >= 1 &&
        ci >= 1 &&
        ri <= effRowLabels.length &&
        ci <= effColLabels.length
      ) {
        r = ri - 1;
        c = ci - 1;
      }
      await append({
        analysisId,
        body: t,
        matrixPhase:
          linkPhase === "" ? undefined : linkPhase,
        linkedRow: r,
        linkedCol: c,
      });
      setBody("");
      setLinkRow("");
      setLinkCol("");
      setLinkPhase("");
    } finally {
      setBusy(false);
    }
  }, [
    analysisId,
    append,
    body,
    linkRow,
    linkCol,
    linkPhase,
    effRowLabels.length,
    effColLabels.length,
  ]);

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-muted/10">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="size-4" aria-hidden />
          Risikologg
        </CardTitle>
        <CardDescription>
          <strong className="text-foreground">Automatisk:</strong> hver gang du lagrer
          og nivå i en celle endres, legges en linje inn.{" "}
          <strong className="text-foreground">Manuelt:</strong> notater, møtereferat,
          beslutninger — valgfritt med kobling til celle (rad/kolonne) og «Hopp til
          celle».
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <form
          className="space-y-3 rounded-xl border border-dashed p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitManual();
          }}
        >
          <p className="text-sm font-medium">Nytt manuelt innlegg</p>
          <div className="space-y-2">
            <Label htmlFor="ros-journal-body">Tekst</Label>
            <Textarea
              id="ros-journal-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="F.eks. Avklart i møte 12.3: vi aksepterer rest risiko …"
              className="min-h-[4rem]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ros-journal-phase">Cellekobling gjelder (valgfritt)</Label>
            <select
              id="ros-journal-phase"
              className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
              value={linkPhase}
              onChange={(e) =>
                setLinkPhase(
                  e.target.value === ""
                    ? ""
                    : (e.target.value as "before" | "after"),
                )
              }
            >
              <option value="">Ikke angitt (eldre stil / generelt)</option>
              <option value="before">Før tiltak-matrise</option>
              <option value="after">Etter tiltak-matrise</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ros-journal-r">Koble til rad (valgfritt, 1–{effRowLabels.length})</Label>
              <Input
                id="ros-journal-r"
                inputMode="numeric"
                value={linkRow}
                onChange={(e) => setLinkRow(e.target.value)}
                placeholder="Tom = ingen celle"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ros-journal-c">Koble til kolonne (valgfritt, 1–{effColLabels.length})</Label>
              <Input
                id="ros-journal-c"
                inputMode="numeric"
                value={linkCol}
                onChange={(e) => setLinkCol(e.target.value)}
                placeholder="Tom = ingen celle"
              />
            </div>
          </div>
          <Button type="submit" disabled={busy || !body.trim()}>
            {busy ? "Legger til …" : "Legg til i logg"}
          </Button>
        </form>

        {entries === undefined ? (
          <p className="text-muted-foreground text-sm">Henter logg …</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ingen logglinjer ennå. De kommer når du lagrer med endrede celleverdier, eller
            når du legger inn tekst over.
          </p>
        ) : (
          <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {entries.map((e) => (
              <li
                key={e._id}
                className="border-border/50 bg-card rounded-xl border px-3 py-2.5 text-sm shadow-sm"
              >
                <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="flex flex-wrap items-center gap-2">
                    {e.matrixPhase === "after" ? (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Etter tiltak
                      </Badge>
                    ) : e.matrixPhase === "before" ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Før tiltak
                      </Badge>
                    ) : null}
                    <span>
                      {formatTs(e.createdAt)} · {e.authorName}
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {e.linkedRow !== undefined &&
                    e.linkedCol !== undefined ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() =>
                          onJumpToCell(
                            e.linkedRow!,
                            e.linkedCol!,
                            e.matrixPhase,
                          )
                        }
                      >
                        <Crosshair className="size-3" />
                        Hopp til celle (
                        {e.linkedRow! + 1},{e.linkedCol! + 1})
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-7 px-2"
                      onClick={() => {
                        if (
                          typeof window !== "undefined" &&
                          window.confirm("Slette denne logglinjen?")
                        ) {
                          void remove({ entryId: e._id });
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                  {e.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
