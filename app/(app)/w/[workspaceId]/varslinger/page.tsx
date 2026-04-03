"use client";

import { api } from "@/convex/_generated/api";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Bell, FileText, Mail, ShieldAlert } from "lucide-react";
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
        "flex items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-sm ring-1 ring-black/[0.04] transition-all dark:ring-white/[0.06]",
        disabled ? "opacity-60" : "hover:shadow-md",
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="size-5 text-primary" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-medium">
          {title}
        </label>
        <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
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
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
          Varslinger
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Velg hvilke e-postvarsler du ønsker. Du kan endre dette når som helst.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          E-postvarsler
        </p>
        <div className="space-y-2">
          <NotificationToggle
            id="notify-invites"
            icon={Mail}
            title="Ny invitasjon"
            description="E-post når du blir lagt inn i et arbeidsområde eller en vurdering. Invitasjoner til e-postadresser uten konto sendes alltid (med lenke/logg inn-info)."
            checked={settings.notifyEmailInvitations}
            disabled={busyKey !== null}
            onCheckedChange={(v) => void patch("invites", v)}
          />
          <NotificationToggle
            id="notify-draft"
            icon={FileText}
            title="Ukentlig sammendrag av åpne vurderinger"
            description="Omtrent én gang i uken: liste over vurderinger du eier som ikke er markert som ferdig. Krever at FRO er konfigurert med e-post (Resend) på serveren."
            checked={settings.notifyEmailDraftSummaryWeekly}
            disabled={busyKey !== null}
            onCheckedChange={(v) => void patch("draft", v)}
          />
          <NotificationToggle
            id="notify-security"
            icon={ShieldAlert}
            title="Sikkerhetsvarsler"
            description="Vi lagrer valget ditt nå. E-post ved mistenkelig aktivitet eller ny enhet kommer i en senere oppdatering."
            checked={settings.notifyEmailSecurityAlerts}
            disabled={busyKey !== null}
            onCheckedChange={(v) => void patch("security", v)}
          />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-muted/20 px-5 py-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Bell className="size-5 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium">Slik fungerer det</p>
          <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
            <li>
              Varsler gjelder hele kontoen din, ikke bare dette arbeidsområdet.
            </li>
            <li>
              Uten <code className="text-foreground rounded bg-muted px-1 py-0.5 text-[0.7rem]">
                RESEND_API_KEY
              </code>{" "}
              på serveren sendes ingen e-post — innstillingene lagres likevel.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
