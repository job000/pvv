"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { prosessRegisterCopy } from "@/lib/prosess-register-copy";
import { Building2, Hash, StickyNote } from "lucide-react";
import { useState } from "react";

export function WorkspaceCandidateRow({
  candidate: c,
  orgUnits,
  isAdmin,
  canEdit,
  onUpdate,
  onRemove,
}: {
  candidate: Doc<"candidates">;
  orgUnits: Doc<"orgUnits">[];
  isAdmin: boolean;
  canEdit: boolean;
  onUpdate: (args: {
    candidateId: Id<"candidates">;
    name?: string;
    code?: string;
    notes?: string | null;
    orgUnitId?: Id<"orgUnits"> | null;
  }) => Promise<null>;
  onRemove: (args: { candidateId: Id<"candidates"> }) => Promise<null>;
}) {
  const [name, setName] = useState(c.name);
  const [code, setCode] = useState(c.code);
  const [notes, setNotes] = useState(c.notes ?? "");
  const [orgUnitId, setOrgUnitId] = useState(c.orgUnitId ?? "");

  function handleSave() {
    const nameT = name.trim();
    const codeT = code.trim();
    if (!nameT || !codeT) {
      window.alert(
        "Prosessnavn og prosess-ID kan ikke være tomme. Prosess-ID er den korte koden som kobler til PVV og ROS (f.eks. INN-01).",
      );
      return;
    }
    void onUpdate({
      candidateId: c._id,
      name: nameT,
      code: codeT,
      notes: notes.trim() === "" ? null : notes.trim(),
      orgUnitId: orgUnitId === "" ? null : (orgUnitId as Id<"orgUnits">),
    });
  }

  return (
    <li className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <p className="text-muted-foreground mb-4 flex flex-wrap items-center gap-2 text-xs leading-relaxed">
        <span className="bg-muted text-foreground inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold">
          {code.trim() || "—"}
        </span>
        <span>
          Rediger prosessen under. I store organisasjoner er{" "}
          <strong className="text-foreground">prosess-ID</strong> den faste
          nøkkelen på tvers av avdelinger;{" "}
          <strong className="text-foreground">organisasjon</strong> hjelper å
          vite hvor dere svarer først.
        </span>
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor={`cand-name-${c._id}`}
            className="flex items-center gap-2 text-sm font-medium"
          >
            {prosessRegisterCopy.displayName.label}
          </Label>
          <Input
            id={`cand-name-${c._id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            placeholder="F.eks. Innleggelse elektiv pasient"
            className="h-10"
          />
          <p className="text-muted-foreground text-[11px] leading-snug">
            {prosessRegisterCopy.displayName.hint}
          </p>
        </div>
        <div className="space-y-2">
          <Label
            htmlFor={`cand-code-${c._id}`}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Hash className="inline size-3.5 opacity-70" aria-hidden />
            {prosessRegisterCopy.referenceCode.label}
            <span className="text-destructive font-normal">*</span>
          </Label>
          <Input
            id={`cand-code-${c._id}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!canEdit}
            placeholder={prosessRegisterCopy.referenceCode.placeholder}
            className="h-10 font-mono text-sm"
            aria-required
          />
          <p className="text-muted-foreground text-[11px] leading-snug">
            {prosessRegisterCopy.referenceCode.hint}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Label
          htmlFor={`cand-ou-${c._id}`}
          className="flex flex-wrap items-center gap-2 text-sm font-medium"
        >
          <Building2 className="size-3.5 opacity-70" aria-hidden />
          {prosessRegisterCopy.orgUnit.label}
          <span className="text-muted-foreground font-normal">
            ({prosessRegisterCopy.orgUnit.optional})
          </span>
        </Label>
        <select
          id={`cand-ou-${c._id}`}
          className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none"
          value={orgUnitId}
          onChange={(e) => setOrgUnitId(e.target.value)}
          disabled={!canEdit}
        >
          <option value="">{prosessRegisterCopy.orgUnit.emptyOption}</option>
          {orgUnits.map((u) => (
            <option key={u._id} value={u._id}>
              {ORG_UNIT_KIND_LABELS[u.kind]} · {u.name}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-[11px] leading-snug">
          {prosessRegisterCopy.orgUnit.hint}
        </p>
        {orgUnits.length === 0 ? (
          <p className="text-muted-foreground text-[11px]">
            Ingen enheter i kartet ennå — legg inn selskap og avdelinger under{" "}
            <span className="text-foreground font-medium">Organisasjon</span>{" "}
            i menyen først.
          </p>
        ) : null}
      </div>

      <div className="mt-5 space-y-2">
        <Label
          htmlFor={`cand-notes-${c._id}`}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <StickyNote className="size-3.5 opacity-70" aria-hidden />
          {prosessRegisterCopy.notes.label}
        </Label>
        <Textarea
          id={`cand-notes-${c._id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={!canEdit}
          placeholder="Valgfritt — f.eks. systemnavn, kontaktperson …"
          className="resize-y"
        />
        <p className="text-muted-foreground text-[11px] leading-snug">
          {prosessRegisterCopy.notes.hint}
        </p>
      </div>

      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleSave}
          >
            Lagre endringer
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm(
                    "Slette denne prosessen fra registeret? Eksisterende PVV-koblinger bør ryddes manuelt.",
                  )
                ) {
                  void onRemove({ candidateId: c._id });
                }
              }}
            >
              Slett
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
