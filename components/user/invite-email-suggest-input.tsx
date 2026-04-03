"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

function useDebouncedValue(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

type WorkspaceSuggest = {
  kind: "workspace";
  workspaceId: Id<"workspaces">;
};

type AssessmentSuggest = {
  kind: "assessment";
  assessmentId: Id<"assessments">;
};

export type InviteEmailSuggestSource = WorkspaceSuggest | AssessmentSuggest;

export function InviteEmailSuggestInput({
  id: idProp,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  className,
  inputClassName,
  source,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  source: InviteEmailSuggestSource;
}) {
  const reactId = useId();
  const inputId = idProp ?? `invite-email-${reactId}`;
  const listId = `${inputId}-suggestions`;

  const debounced = useDebouncedValue(value.trim(), 220);
  const canSearch = debounced.length >= 2 && !disabled;

  const workspaceHits = useQuery(
    api.workspaces.suggestUsersForWorkspaceInvite,
    source.kind === "workspace" && canSearch
      ? { workspaceId: source.workspaceId, prefix: debounced }
      : "skip",
  );

  const assessmentHits = useQuery(
    api.assessments.suggestUsersForCollaboratorInvite,
    source.kind === "assessment" && canSearch
      ? { assessmentId: source.assessmentId, prefix: debounced }
      : "skip",
  );

  const hits =
    source.kind === "workspace" ? workspaceHits : assessmentHits;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showList =
    open && canSearch && hits !== undefined && hits.length > 0;

  const cancelBlur = useCallback(() => {
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelBlur();
    blurTimeout.current = setTimeout(() => setOpen(false), 120);
  }, [cancelBlur]);

  useEffect(() => {
    return () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = useCallback(
    (email: string, blocked: boolean) => {
      if (blocked) {
        return;
      }
      onChange(email);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <div
      ref={wrapRef}
      data-invite-email-root={inputId}
      className={cn("relative min-w-0 flex-1 space-y-1.5", className)}
    >
      <Label htmlFor={inputId} className="text-xs">
        {label}
      </Label>
      <Input
        id={inputId}
        type="email"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={Boolean(showList)}
        aria-controls={showList ? listId : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          cancelBlur();
          setOpen(true);
        }}
        onBlur={scheduleClose}
        placeholder={placeholder}
        className={cn("rounded-xl", inputClassName)}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="border-border/60 bg-popover text-popover-foreground absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {hits.map((row) => {
            const blocked =
              "alreadyMember" in row
                ? row.alreadyMember
                : row.alreadyCollaborator;
            const hint = blocked
              ? "alreadyMember" in row
                ? "Allerede medlem"
                : "Allerede på vurderingen"
              : null;
            return (
              <li key={row.email} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={blocked}
                  className={cn(
                    "hover:bg-muted/80 flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors",
                    blocked && "text-muted-foreground cursor-not-allowed opacity-70",
                  )}
                  onMouseDown={() => pick(row.email, blocked)}
                >
                  <span className="truncate font-medium">{row.email}</span>
                  {row.name ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {row.name}
                    </span>
                  ) : null}
                  {hint ? (
                    <span className="text-muted-foreground text-[10px]">
                      {hint}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && canSearch && hits !== undefined && hits.length === 0 ? (
        <p className="border-border/60 bg-popover text-muted-foreground pointer-events-none absolute left-0 top-full z-50 mt-1 w-full rounded-xl border px-3 py-2 text-xs shadow-md">
          Ingen registrerte brukere matcher «{debounced}». Du kan fortsatt skrive en
          e-post og invitere noen som ikke har konto ennå.
        </p>
      ) : null}
      {canSearch && hits === undefined ? (
        <p className="text-muted-foreground pointer-events-none absolute left-0 top-full z-40 mt-1 text-xs">
          Søker …
        </p>
      ) : null}
    </div>
  );
}
