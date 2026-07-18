"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InviteEmailSuggestInput } from "@/components/user/invite-email-suggest-input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

function roleLabel(role: "owner" | "editor" | "viewer") {
  if (role === "owner") return "Eier";
  if (role === "editor") return "Skriver";
  return "Leser";
}

export function PulsBoardMembersPanel({
  boardId,
  canManage,
}: {
  boardId: Id<"pulsBoards">;
  canManage: boolean;
}) {
  const members = useQuery(api.pulsBoards.listMembers, { boardId });
  const pending = useQuery(
    api.pulsBoards.listPendingInvites,
    canManage ? { boardId } : "skip",
  );
  const inviteByEmail = useMutation(api.pulsBoards.inviteByEmail);
  const setMemberRole = useMutation(api.pulsBoards.setMemberRole);
  const removeMember = useMutation(api.pulsBoards.removeMember);
  const revokeInvite = useMutation(api.pulsBoards.revokeInvite);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().includes("@");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Medlemmer</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Eier administrerer. Skriver kan redigere kort. Leser ser tavlen.
        </p>
      </div>

      {canManage ? (
        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3">
          <InviteEmailSuggestInput
            id="puls-invite-user"
            label="Legg til person"
            value={email}
            onChange={setEmail}
            disabled={busy}
            placeholder="Søk navn eller e-post…"
            source={{ kind: "pulsBoard", boardId }}
            inputClassName="min-h-11 rounded-lg sm:min-h-9"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 space-y-1.5 sm:w-40">
              <Label htmlFor="puls-invite-role" className="text-xs">
                Rettighet
              </Label>
              <select
                id="puls-invite-role"
                className="border-input bg-background min-h-11 w-full rounded-lg border px-2 text-sm sm:min-h-9"
                value={role}
                disabled={busy}
                onChange={(e) =>
                  setRole(e.target.value as "editor" | "viewer")
                }
              >
                <option value="editor">Skriver</option>
                <option value="viewer">Leser</option>
              </select>
            </div>
            <Button
              type="button"
              className="min-h-11 sm:min-h-9"
              disabled={busy || !canSubmit}
              onClick={() => {
                setBusy(true);
                void inviteByEmail({
                  boardId,
                  email: email.trim(),
                  role,
                })
                  .then((r) => {
                    if (r.kind === "linked") toast.success("Medlem lagt til");
                    else if (r.kind === "pending")
                      toast.success("Invitasjon sendt");
                    else if (r.kind === "updated")
                      toast.success("Rolle oppdatert");
                    else toast.success("Allerede medlem");
                    setEmail("");
                  })
                  .catch((err: unknown) =>
                    toast.error(
                      err instanceof Error ? err.message : "Kunne ikke invitere",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Legg til
            </Button>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Velg en person fra forslagene, eller skriv en e-post for å invitere
            noen uten konto.
          </p>
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {(members ?? []).map((m) => (
          <li
            key={m.membershipId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.name}</p>
              {m.email ? (
                <p className="text-muted-foreground truncate text-[11px]">
                  {m.email}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {canManage ? (
                <select
                  className="border-input bg-background h-9 rounded-lg border px-2 text-xs"
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.value as
                      | "owner"
                      | "editor"
                      | "viewer";
                    setBusy(true);
                    void setMemberRole({
                      boardId,
                      userId: m.userId,
                      role: next,
                    })
                      .then(() => toast.success("Rolle oppdatert"))
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Kunne ikke endre",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  <option value="owner">Eier</option>
                  <option value="editor">Skriver</option>
                  <option value="viewer">Leser</option>
                </select>
              ) : (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    "bg-muted text-muted-foreground",
                  )}
                >
                  {roleLabel(m.role)}
                </span>
              )}
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 text-xs"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Fjerne ${m.name} fra tavlen?`)) return;
                    setBusy(true);
                    void removeMember({ boardId, userId: m.userId })
                      .then(() => toast.success("Medlem fjernet"))
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Kunne ikke fjerne",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Fjern
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {canManage && pending && pending.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ventende invitasjoner
          </h4>
          <ul className="space-y-1.5">
            {pending.map((inv) => (
              <li
                key={inv.inviteId}
                className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border/50 px-3 py-2 text-sm"
              >
                <span>
                  {inv.email}{" "}
                  <span className="text-muted-foreground text-xs">
                    ({roleLabel(inv.role)})
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void revokeInvite({ inviteId: inv.inviteId })
                      .then(() => toast.success("Invitasjon trukket"))
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Kunne ikke trekke",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Trekk
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
