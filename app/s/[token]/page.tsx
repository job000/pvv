"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Clock, Shield } from "lucide-react";
import { useParams } from "next/navigation";

export default function SharedAssessmentPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const data = useQuery(api.assessmentShareLinks.getPublic, { token });

  if (data === undefined) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Laster …</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Shield className="text-muted-foreground mx-auto mb-4 size-12" />
        <h1 className="font-heading text-xl font-semibold">
          Lenken er ikke tilgjengelig
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Den kan være utløpt, slettet eller feil i adressen. Be om en ny lenke
          fra eier av vurderingen.
        </p>
      </div>
    );
  }

  const { computed } = data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <Clock className="text-amber-700 dark:text-amber-400 mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">Begrenset visning</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Kun lesetilgang til sammendrag. Utløper{" "}
            {new Date(data.expiresAt).toLocaleString("nb-NO", {
              dateStyle: "full",
              timeStyle: "short",
            })}
            .
          </p>
        </div>
      </div>

      <header className="mb-8">
        <p className="text-muted-foreground text-xs">
          {data.workspaceName ?? "Arbeidsområde"}
        </p>
        <h1 className="font-heading mt-1 text-2xl font-semibold leading-tight">
          {data.title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {data.processName}
          {data.candidateId ? ` · ${data.candidateId}` : ""}
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-muted-foreground text-xs">Pipelinestatus</p>
          <p className="mt-1 font-medium">{data.pipelineLabel}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-muted-foreground text-xs">Foreslått prioritet</p>
          <p className="mt-1 font-medium tabular-nums">
            {computed.priorityScore.toFixed(1)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-muted-foreground text-xs">Risiko (ROS)</p>
          <p className="mt-1 font-medium">{data.rosLabel}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-muted-foreground text-xs">Personvern (PDD)</p>
          <p className="mt-1 font-medium">{data.pddLabel}</p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border bg-muted/20 p-4">
        <h2 className="font-medium text-sm">Nøkkeltall (veiledende)</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Automatiseringspotensial</dt>
            <dd className="tabular-nums">{computed.ap.toFixed(1)} %</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Viktighet og konsekvens</dt>
            <dd className="tabular-nums">{computed.criticality.toFixed(1)} %</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Porteføljeprioritet</dt>
            <dd className="tabular-nums">{computed.priorityScore.toFixed(1)} / 100</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Gjennomførbarhet</dt>
            <dd className="tabular-nums">
              {computed.ease.toFixed(1)} % ({computed.easeLabel})
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Timer spart / år (est.)</dt>
            <dd className="tabular-nums">{computed.benH.toFixed(0)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Besparelse / år (est.)</dt>
            <dd className="tabular-nums">
              {Math.round(computed.benC).toLocaleString("nb-NO")} kr
            </dd>
          </div>
        </dl>
      </section>

      {(() => {
        const profile: Array<[string, string | undefined]> = [
          ["Helhetlig beskrivelse", data.processDescription],
          ["Mål og verdi", data.processGoal],
          ["Flyt og hovedtrinn", data.processFlowSummary],
          ["Roller og ansvar", data.processActors],
          ["Systemer og data", data.processSystems],
          ["Volum og mønster", data.processVolumeNotes],
          ["Begrensninger og risiko", data.processConstraints],
          ["Videre og oppfølging", data.processFollowUp],
        ];
        const filled = profile.filter(([, v]) => (v ?? "").trim().length > 0);
        if (filled.length === 0) return null;
        return (
          <section className="space-y-3">
            <h2 className="font-heading font-semibold">Prosessprofil</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {filled.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/70 bg-gradient-to-br from-muted/25 to-card p-4"
                >
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="text-foreground mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <p className="text-muted-foreground mt-10 text-center text-xs">
        PVV · delt sammendrag · ikke sensitiv rådata
      </p>
    </div>
  );
}
