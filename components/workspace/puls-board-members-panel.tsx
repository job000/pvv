"use client";

import { Button } from "@/components/ui/button";
import { InviteEmailSuggestInput } from "@/components/user/invite-email-suggest-input";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";

type BoardRole = "owner" | "editor" | "viewer";

function roleLabel(role: BoardRole) {
  if (role === "owner") return "Eier";
  if (role === "editor") return "Skriver";
  return "Leser";
}

function roleTone(role: BoardRole) {
  if (role === "owner")
    return "bg-amber-500/12 text-amber-900 dark:text-amber-200";
  if (role === "editor") return "bg-sky-500/12 text-sky-900 dark:text-sky-200";
  return "bg-muted text-muted-foreground";
}

const ROLE_HINTS: { role: BoardRole; label: string; hint: string }[] = [
  { role: "owner", label: "Eier", hint: "Administrerer" },
  { role: "editor", label: "Skriver", hint: "Redigerer kort" },
  { role: "viewer", label: "Leser", hint: "Ser tavlen" },
];

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
  const memberCount = members?.length ?? 0;
  const pendingCount = pending?.length ?? 0;

  const loading = members === undefined;

  const sortedPending = useMemo(
    () => [...(pending ?? [])].sort((a, b) => a.email.localeCompare(b.email, "nb")),
    [pending],
  );

  const submitInvite = () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    void inviteByEmail({
      boardId,
      email: email.trim(),
      role,
    })
      .then((r) => {
        if (r.kind === "linked") toast.success("Medlem lagt til");
        else if (r.kind === "pending") toast.success("Invitasjon sendt");
        else if (r.kind === "updated") toast.success("Rolle oppdatert");
        else toast.success("Allerede medlem");
        setEmail("");
      })
      .catch((err: unknown) =>
        toast.error(
          err instanceof Error ? err.message : "Kunne ikke invitere",
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <h3 className="font-heading text-lg font-semibold tracking-tight">
                Medlemmer
              </h3>
              {!loading ? (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                  {memberCount}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm">
              Hvem som kan se og jobbe på tavlen.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_HINTS.map((item) => (
            <span
              key={item.role}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                roleTone(item.role),
              )}
            >
              {item.label}
              <span className="opacity-70">· {item.hint}</span>
            </span>
          ))}
        </div>
      </header>

      {canManage ? (
        <section
          aria-label="Legg til person"
          className="space-y-3 rounded-2xl border border-border/50 bg-muted/15 p-4"
        >
          <div className="flex items-center gap-2">
            <div className="bg-background flex size-8 items-center justify-center rounded-full shadow-xs ring-1 ring-border/50">
              <UserPlus className="size-3.5 text-foreground/80" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Legg til person</p>
              <p className="text-muted-foreground text-xs">
                Søk blant brukere, eller skriv e-post for å invitere.
              </p>
            </div>
          </div>

          <InviteEmailSuggestInput
            id="puls-invite-user"
            label="Person"
            value={email}
            onChange={setEmail}
            disabled={busy}
            placeholder="Søk navn eller e-post…"
            source={{ kind: "pulsBoard", boardId }}
            className="[&_label]:sr-only"
            inputClassName="min-h-11 rounded-xl sm:min-h-10"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              role="group"
              aria-label="Rettighet"
              className="bg-background/80 flex flex-wrap gap-1 rounded-xl p-1 ring-1 ring-border/50"
            >
              {(
                [
                  ["editor", "Skriver"],
                  ["viewer", "Leser"],
                ] as const
              ).map(([value, label]) => {
                const active = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => setRole(value)}
                    className={cn(
                      "inline-flex h-9 min-w-[5.5rem] flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium touch-manipulation transition-colors sm:flex-none",
                      active
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              className="min-h-11 rounded-xl sm:ml-auto sm:min-h-10 sm:min-w-[7.5rem]"
              disabled={busy || !canSubmit}
              onClick={submitInvite}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Legger til …
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" aria-hidden />
                  Legg til
                </>
              )}
            </Button>
          </div>
        </section>
      ) : null}

      <section aria-label="Medlemsliste" className="space-y-2">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted/30 h-16 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : memberCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center">
            <Users className="text-muted-foreground mx-auto size-8 opacity-50" aria-hidden />
            <p className="mt-3 text-sm font-medium">Ingen medlemmer ennå</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {canManage
                ? "Legg til noen over for å dele tavlen."
                : "Du er den eneste her ennå."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
            {members.map((m) => (
              <li
                key={m.membershipId}
                className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={m.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight">
                      {m.name}
                    </p>
                    {m.email ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {m.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {canManage ? (
                    <select
                      aria-label={`Rolle for ${m.name}`}
                      className="border-input bg-background h-10 min-w-[7.5rem] rounded-xl border px-2.5 text-sm touch-manipulation sm:h-9"
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.value as BoardRole;
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
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                        roleTone(m.role),
                      )}
                    >
                      {roleLabel(m.role)}
                    </span>
                  )}
                  {canManage ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive size-10 rounded-xl sm:size-9"
                      disabled={busy}
                      aria-label={`Fjern ${m.name}`}
                      title="Fjern"
                      onClick={() => {
                        if (!window.confirm(`Fjerne ${m.name} fra tavlen?`))
                          return;
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
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && pendingCount > 0 ? (
        <section className="space-y-2" aria-label="Ventende invitasjoner">
          <div className="flex items-center gap-2 px-0.5">
            <Mail className="text-muted-foreground size-3.5" aria-hidden />
            <h4 className="text-sm font-semibold">Ventende invitasjoner</h4>
            <span className="text-muted-foreground text-xs tabular-nums">
              {pendingCount}
            </span>
          </div>
          <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-dashed border-border/60 bg-muted/10">
            {sortedPending.map((inv) => (
              <li
                key={inv.inviteId}
                className="flex items-center justify-between gap-3 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      roleTone(inv.role),
                    )}
                  >
                    {roleLabel(inv.role)}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive h-9 shrink-0 rounded-xl text-xs"
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
        </section>
      ) : null}
    </div>
  );
}
