"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_STATUS_ORDER,
  type ComplianceStatusKey,
} from "@/lib/helsesector-labels";
import { useMutation, useQuery } from "convex/react";
import { Building2, ExternalLink, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

export function AssessmentContextCard({
  assessmentId,
  workspaceId,
  assessment,
  canEdit,
  processScope = "unsure",
}: {
  assessmentId: Id<"assessments">;
  workspaceId: Id<"workspaces">;
  assessment: Doc<"assessments">;
  canEdit: boolean;
  /** Fra vurderingsskjema — styrer hjelpetekst */
  processScope?: "single" | "multi" | "unsure";
}) {
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });
  const breadcrumb = useQuery(
    api.orgUnits.getBreadcrumb,
    assessment.orgUnitId
      ? { orgUnitId: assessment.orgUnitId }
      : "skip",
  );
  const workspace = useQuery(api.workspaces.get, { workspaceId });

  const setOrg = useMutation(api.assessments.setAssessmentOrgUnit);
  const setCompliance = useMutation(api.assessments.updateAssessmentCompliance);

  /** Remount tekstfelt når serverdata endres (uten å bruke updatedAt fra utkast). */
  const complianceFieldsKey = useMemo(
    () =>
      [
        assessment._id,
        assessment.rosUrl ?? "",
        assessment.rosNotes ?? "",
        assessment.pddUrl ?? "",
        assessment.pddNotes ?? "",
      ].join("\x1e"),
    [
      assessment._id,
      assessment.rosUrl,
      assessment.rosNotes,
      assessment.pddUrl,
      assessment.pddNotes,
    ],
  );

  const rosStatus = (assessment.rosStatus ??
    "not_started") as ComplianceStatusKey;
  const pddStatus = (assessment.pddStatus ??
    "not_started") as ComplianceStatusKey;

  return (
    <Card className="border-primary/15 bg-muted/10">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
          <CardTitle className="text-lg">Hvor hører prosessen hjemme?</CardTitle>
        </div>
        <CardDescription className="leading-relaxed">
          Velg avdeling eller seksjon. Under finner du felter for dokumentasjon
          av risiko og personvern — vanlig i offentlig sektor og helse. Lenker kan
          gå til sak i verktøy dere allerede bruker.
        </CardDescription>
        {processScope === "multi" ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Du har sagt at prosessen spenner flere enheter — dokumenter gjerne
            samordning her, og koble til den enheten som eier innsatsen.
          </p>
        ) : processScope === "single" ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Du har sagt at prosessen primært hører til én linje — velg riktig
            enhet i listen under.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Når dere vet om prosessen er lokal eller på tvers, kan du oppdatere
            valget under «Kandidat».
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {(workspace?.organizationNumber || workspace?.institutionIdentifier) ? (
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
            <p className="text-muted-foreground text-xs font-medium">
              Arbeidsområde (virksomhet)
            </p>
            {workspace?.organizationNumber ? (
              <p>
                <span className="text-muted-foreground">Org.nr: </span>
                {workspace.organizationNumber}
              </p>
            ) : null}
            {workspace?.institutionIdentifier ? (
              <p>
                <span className="text-muted-foreground">HER / institusjons-ID: </span>
                {workspace.institutionIdentifier}
              </p>
            ) : null}
          </div>
        ) : null}

        <section className="space-y-3" aria-labelledby="org-context-heading">
          <h3 id="org-context-heading" className="font-medium text-sm">
            Plassering i organisasjonen
          </h3>
          {breadcrumb?.chain && breadcrumb.chain.length > 0 ? (
            <p className="text-muted-foreground text-sm">
              {breadcrumb.chain.map((u) => u.name).join(" → ")}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Ingen enhet valgt — velg hvor prosessen hører hjemme.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="assessment-org-unit">Organisasjonsenhet</Label>
              <select
                id="assessment-org-unit"
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                disabled={!canEdit}
                value={assessment.orgUnitId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  void setOrg({
                    assessmentId,
                    orgUnitId:
                      v === "" ? null : (v as Id<"orgUnits">),
                  });
                }}
              >
                <option value="">— Velg enhet —</option>
                {orgUnits?.map((u) => (
                  <option key={u._id} value={u._id}>
                    [{ORG_SHORT[u.kind]}] {u.name}
                  </option>
                ))}
              </select>
            </div>
            <Link
              href={`/w/${workspaceId}/organisasjon`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Rediger kart
            </Link>
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="ros-heading">
          <div className="flex flex-wrap items-center gap-2">
            <Shield className="h-4 w-4" aria-hidden />
            <h3 id="ros-heading" className="font-medium text-sm">
              Risiko før endring (ROS)
            </h3>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Vis hvor langt dere er kommet, og legg inn lenke til ferdig dokument
            eller sak når den finnes.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ros-status">Hvor er dere?</Label>
              <select
                id="ros-status"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                disabled={!canEdit}
                value={rosStatus}
                onChange={(e) => {
                  const v = e.target.value as ComplianceStatusKey;
                  void setCompliance({
                    assessmentId,
                    rosStatus: v,
                  });
                }}
              >
                {COMPLIANCE_STATUS_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {COMPLIANCE_STATUS_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ros-url">Lenke til dokument / sak</Label>
              <Input
                key={`ros-url-${complianceFieldsKey}`}
                id="ros-url"
                type="url"
                defaultValue={assessment.rosUrl ?? ""}
                disabled={!canEdit}
                onBlur={(e) => {
                  if (!canEdit) return;
                  const v = e.currentTarget.value.trim();
                  void setCompliance({
                    assessmentId,
                    rosUrl: v === "" ? null : v,
                  });
                }}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ros-notes">Notater</Label>
              <Textarea
                key={`ros-notes-${complianceFieldsKey}`}
                id="ros-notes"
                defaultValue={assessment.rosNotes ?? ""}
                disabled={!canEdit}
                onBlur={(e) => {
                  if (!canEdit) return;
                  const v = e.currentTarget.value.trim();
                  void setCompliance({
                    assessmentId,
                    rosNotes: v === "" ? null : v,
                  });
                }}
                rows={2}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                const el = document.getElementById(
                  "ros-url",
                ) as HTMLInputElement | null;
                const url = (
                  el?.value ??
                  assessment.rosUrl ??
                  ""
                ).trim();
                if (url) {
                  window.open(url, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <ExternalLink className="mr-2 size-4" />
              Åpne dokument
            </Button>
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void setCompliance({
                    assessmentId,
                    rosStatus: "in_progress",
                  })
                }
              >
                Marker som pågår
              </Button>
            ) : null}
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="pdd-heading">
          <div className="flex flex-wrap items-center gap-2">
            <Shield className="h-4 w-4" aria-hidden />
            <h3 id="pdd-heading" className="font-medium text-sm">
              Personvern (personvernkonsekvens / PDD)
            </h3>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Når dere behandler personopplysninger, dokumenterer dere ofte
            vurderingen i eget verktøy. Her holder dere styr på status og lenke.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pdd-status">Hvor er dere?</Label>
              <select
                id="pdd-status"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                disabled={!canEdit}
                value={pddStatus}
                onChange={(e) => {
                  const v = e.target.value as ComplianceStatusKey;
                  void setCompliance({
                    assessmentId,
                    pddStatus: v,
                  });
                }}
              >
                {COMPLIANCE_STATUS_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {COMPLIANCE_STATUS_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pdd-url">Lenke til dokument / sak</Label>
              <Input
                key={`pdd-url-${complianceFieldsKey}`}
                id="pdd-url"
                type="url"
                defaultValue={assessment.pddUrl ?? ""}
                disabled={!canEdit}
                onBlur={(e) => {
                  if (!canEdit) return;
                  const v = e.currentTarget.value.trim();
                  void setCompliance({
                    assessmentId,
                    pddUrl: v === "" ? null : v,
                  });
                }}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pdd-notes">Notater</Label>
              <Textarea
                key={`pdd-notes-${complianceFieldsKey}`}
                id="pdd-notes"
                defaultValue={assessment.pddNotes ?? ""}
                disabled={!canEdit}
                onBlur={(e) => {
                  if (!canEdit) return;
                  const v = e.currentTarget.value.trim();
                  void setCompliance({
                    assessmentId,
                    pddNotes: v === "" ? null : v,
                  });
                }}
                rows={2}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                const el = document.getElementById(
                  "pdd-url",
                ) as HTMLInputElement | null;
                const url = (
                  el?.value ??
                  assessment.pddUrl ??
                  ""
                ).trim();
                if (url) {
                  window.open(url, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <ExternalLink className="mr-2 size-4" />
              Åpne dokument
            </Button>
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void setCompliance({
                    assessmentId,
                    pddStatus: "in_progress",
                  })
                }
              >
                Marker som pågår
              </Button>
            ) : null}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

const ORG_SHORT: Record<Doc<"orgUnits">["kind"], string> = {
  helseforetak: "HF",
  avdeling: "Avd.",
  seksjon: "Seks.",
};
