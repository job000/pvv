"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
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

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Navn</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Kode</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Label className="text-xs">Organisasjonsenhet (valgfritt)</Label>
        <select
          className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none"
          value={orgUnitId}
          onChange={(e) => setOrgUnitId(e.target.value)}
          disabled={!canEdit}
        >
          <option value="">— Ikke knyttet —</option>
          {orgUnits.map((u) => (
            <option key={u._id} value={u._id}>
              [{ORG_UNIT_KIND_LABELS[u.kind]}] {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 space-y-2">
        <Label className="text-xs">Notater</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={!canEdit}
        />
      </div>
      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              void onUpdate({
                candidateId: c._id,
                name,
                code,
                notes: notes.trim() === "" ? null : notes,
                orgUnitId:
                  orgUnitId === "" ? null : (orgUnitId as Id<"orgUnits">),
              })
            }
          >
            Lagre
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
                  window.confirm("Slette denne kandidaten?")
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
