"use client";

import { api } from "@/convex/_generated/api";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { FileText, Mail, ShieldAlert } from "lucide-react";
import { useCallback, useState } from "react";

function NotificationToggle({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3.5 sm:px-5",
        disabled && "opacity-60",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {title}
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer sr-only focus-visible:outline-none"
        />
        <span
          className={cn(
            "relative inline-block h-6 w-11 shrink-0 rounded-full bg-muted transition-colors after:absolute after:left-[2px] after:top-[2px] after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          )}
          aria-hidden
        />
      </label>
    </div>
  );
}

export default function WorkspaceNotificationsPage() {
  const settings = useQuery(api.users.getMyNotificationSettings, {});
  const patchSettings = useMutation(api.users.patchMyUserSettings);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const patch = useCallback(
    async (
      key: "invites" | "draft" | "security",
      value: boolean,
    ) => {
      setBusyKey(key);
      try {
        if (key === "invites") {
          await patchSettings({ notifyEmailInvitations: value });
        } else if (key === "draft") {
          await patchSettings({ notifyEmailDraftSummaryWeekly: value });
        } else {
          await patchSettings({ notifyEmailSecurityAlerts: value });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunne ikke lagre.");
      } finally {
        setBusyKey(null);
      }
    },
    [patchSettings],
  );

  if (settings === undefined) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="bg-muted h-7 w-40 animate-pulse rounded-lg" />
          <div className="bg-muted h-4 w-full max-w-md animate-pulse rounded-lg" />
        </div>
        <div className="space-y-2">
          <div className="bg-muted h-4 w-32 animate-pulse rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-[4.5rem] animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (settings === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Logg inn for å administrere varslinger.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Varslinger
        </h1>
        <p className="text-sm text-muted-foreground">
          Velg hvilke e-postvarsler du ønsker.
        </p>
      </header>

      <section className="space-y-3">
        <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
          <NotificationToggle
            id="notify-invites"
            icon={Mail}
            title="Ny invitasjon"
            description="Når noen legger deg til i et arbeidsområde eller en vurdering."
            checked={settings.notifyEmailInvitations}
            disabled={busyKey !== null}
            onCheckedChange={(v) => void patch("invites", v)}
          />
          <NotificationToggle
            id="notify-draft"
            icon={FileText}
            title="Ukentlig sammendrag"
            description="Åpne vurderinger du eier."
            checked={settings.notifyEmailDraftSummaryWeekly}
            disabled={busyKey !== null}
            onCheckedChange={(v) => void patch("draft", v)}
          />
          <NotificationToggle
            id="notify-security"
            icon={ShieldAlert}
            title="Sikkerhetsvarsler"
            description="Ved mistenkelig aktivitet på kontoen."
            checked={settings.notifyEmailSecurityAlerts}
            disabled={busyKey !== null}
            onCheckedChange={(v) => void patch("security", v)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Varslene gjelder hele kontoen din.
        </p>
      </section>
    </div>
  );
}
