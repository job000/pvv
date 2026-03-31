"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";

export function WorkspaceDeleteDialog({
  workspace,
  open,
  onOpenChange,
  onDeleted,
}: {
  workspace: Doc<"workspaces"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const removeWs = useMutation(api.workspaces.remove);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setError(null);
    }
  }, [open]);

  if (!open || !workspace) {
    return null;
  }

  async function handleDelete() {
    if (!workspace) return;
    setError(null);
    setDeleting(true);
    try {
      await removeWs({
        workspaceId: workspace._id,
        confirmName: confirmText,
      });
      onOpenChange(false);
      onDeleted?.();
    } catch (e) {
      setError(
        formatUserFacingError(e, "Kunne ikke slette arbeidsområdet."),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ws-delete-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Lukk"
        onClick={() => {
          if (!deleting) onOpenChange(false);
        }}
      />
      <div className="bg-card relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-lg">
        <h2
          id="ws-delete-dialog-title"
          className="font-heading text-lg font-semibold"
        >
          Slette «{workspace.name}»?
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Dette sletter alle vurderinger, kandidater, organisasjonsdata og
          oppgaver i arbeidsområdet. Skriv inn det eksakte navnet for å
          bekrefte.
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="ws-delete-confirm">Bekreft navn</Label>
          <Input
            id="ws-delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={workspace.name}
            autoComplete="off"
          />
        </div>
        {error ? (
          <p className="text-destructive mt-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={
              deleting || confirmText.trim() !== workspace.name.trim()
            }
            onClick={() => void handleDelete()}
          >
            {deleting ? "Sletter …" : "Slett permanent"}
          </Button>
        </div>
      </div>
    </div>
  );
}
