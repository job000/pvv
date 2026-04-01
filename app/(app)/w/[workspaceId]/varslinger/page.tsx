"use client";

import { Bell, Mail, FileText, ShieldAlert } from "lucide-react";

function NotificationToggle({
  icon: Icon,
  title,
  description,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-sm ring-1 ring-black/[0.04] transition-all dark:ring-white/[0.06] ${disabled ? "opacity-50" : "hover:shadow-md"}`}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" disabled={disabled} className="peer sr-only" />
        <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-disabled:cursor-not-allowed" />
      </label>
    </div>
  );
}

export default function WorkspaceNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
          Varslinger
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Velg hvilke varsler du ønsker å motta.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">E-postvarsler</p>
        <div className="space-y-2">
          <NotificationToggle
            icon={Mail}
            title="Ny invitasjon"
            description="Varsle meg når noen inviterer meg til en vurdering eller et arbeidsområde"
            disabled
          />
          <NotificationToggle
            icon={FileText}
            title="Påminnelse om utkast"
            description="Ukentlig sammendrag av åpne vurderinger som trenger oppmerksomhet"
            disabled
          />
          <NotificationToggle
            icon={ShieldAlert}
            title="Sikkerhetsvarsler"
            description="Varsle meg ved innlogging fra ny enhet eller mistenkelig aktivitet"
            disabled
          />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-muted/20 px-5 py-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
          <Bell className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium">Kommer snart</p>
          <p className="text-muted-foreground text-xs">
            Varslingsinnstillinger aktiveres i en kommende oppdatering.
          </p>
        </div>
      </div>
    </div>
  );
}
