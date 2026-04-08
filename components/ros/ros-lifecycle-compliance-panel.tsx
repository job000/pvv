"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ROS_PRODUCT_RESPONSIBILITY_LONG_NB,
  ROS_PRODUCT_SCOPE_MVP_NB,
} from "@/lib/ros-compliance";
import {
  ROS_COMPLIANCE_SCOPE_TAGS,
  type RosRequirementRef,
  type RosRequirementSource,
} from "@/lib/ros-requirement-catalog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

const SOURCE_OPTIONS: { value: RosRequirementSource; label: string }[] = [
  { value: "iso31000", label: "ISO 31000" },
  { value: "iso27005", label: "ISO/IEC 27005" },
  { value: "gdpr", label: "GDPR" },
  { value: "norwegian_law", label: "Norsk lov" },
  { value: "nis2", label: "NIS2" },
  { value: "internal", label: "Internt" },
];

type Props = {
  methodologyStatement: string;
  contextSummary: string;
  scopeAndCriteria: string;
  riskCriteriaVersion: string;
  axisScaleNotes: string;
  complianceScopeTags: string[];
  requirementRefs: RosRequirementRef[];
  /** Vises som informativ tag (satt ved opprettelse fra sektor-pakke) */
  sectorPackLabel?: string | null;
  onChange: (patch: {
    methodologyStatement?: string;
    contextSummary?: string;
    scopeAndCriteria?: string;
    riskCriteriaVersion?: string;
    axisScaleNotes?: string;
    complianceScopeTags?: string[];
    requirementRefs?: RosRequirementRef[];
  }) => void;
};

export function RosLifecycleCompliancePanel({
  methodologyStatement,
  contextSummary,
  scopeAndCriteria,
  riskCriteriaVersion,
  axisScaleNotes,
  complianceScopeTags,
  requirementRefs,
  sectorPackLabel,
  onChange,
}: Props) {
  const toggleTag = (id: string) => {
    const next = complianceScopeTags.includes(id)
      ? complianceScopeTags.filter((x) => x !== id)
      : [...complianceScopeTags, id];
    onChange({ complianceScopeTags: next });
  };

  const updateRef = (index: number, patch: Partial<RosRequirementRef>) => {
    const next = requirementRefs.map((r, i) =>
      i === index ? { ...r, ...patch } : r,
    );
    onChange({ requirementRefs: next });
  };

  const removeRef = (index: number) => {
    onChange({
      requirementRefs: requirementRefs.filter((_, i) => i !== index),
    });
  };

  const addRef = () => {
    onChange({
      requirementRefs: [...requirementRefs, { source: "gdpr" }],
    });
  };

  return (
    <div className="space-y-6">
      {sectorPackLabel?.trim() ? (
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>Sektor ved opprettelse:</span>
          <Badge variant="secondary" className="font-normal">
            {sectorPackLabel.trim()}
          </Badge>
        </p>
      ) : null}
      <Alert>
        <AlertTitle className="text-sm">Produktomfang og ansvar</AlertTitle>
        <AlertDescription className="text-muted-foreground space-y-2 text-sm leading-relaxed">
          <p>{ROS_PRODUCT_SCOPE_MVP_NB}</p>
          <p>{ROS_PRODUCT_RESPONSIBILITY_LONG_NB}</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Livssyklus og kontekst (ISO 31000)
          </CardTitle>
          <CardDescription>
            Dokumenter egen tilnærming: omfang, kriterier for risiko og
            eventuell metodikkversjon — slik revisjon og tilsyn kan se hva som
            ligger til grunn.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="ros-methodology">Metodikk / prosess (kort)</Label>
            <Textarea
              id="ros-methodology"
              value={methodologyStatement}
              onChange={(e) =>
                onChange({ methodologyStatement: e.target.value })
              }
              rows={2}
              placeholder="F.eks. kvalitativ matrise, årlig gjennomgang, beslutningsforum …"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ros-context">Kontekst (hva vurderes)</Label>
            <Textarea
              id="ros-context"
              value={contextSummary}
              onChange={(e) => onChange({ contextSummary: e.target.value })}
              rows={3}
              placeholder="System, prosess, grenser, antakelser …"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ros-scope-criteria">Omfang og risikokriterier</Label>
            <Textarea
              id="ros-scope-criteria"
              value={scopeAndCriteria}
              onChange={(e) => onChange({ scopeAndCriteria: e.target.value })}
              rows={3}
              placeholder="Hva inngår / utelates; hvordan tolkes akser og nivåer …"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ros-risk-ver">Versjon av kriterier / skala</Label>
            <Input
              id="ros-risk-ver"
              value={riskCriteriaVersion}
              onChange={(e) =>
                onChange({ riskCriteriaVersion: e.target.value })
              }
              placeholder="F.eks. v2025-Q1, intern mal 3.2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ros-axis-scale">Definisjon av nivå 0–5 (valgfritt)</Label>
            <Textarea
              id="ros-axis-scale"
              value={axisScaleNotes}
              onChange={(e) => onChange({ axisScaleNotes: e.target.value })}
              rows={4}
              placeholder="Beskriv hva som menes med hvert nivå på rad/kolonne — vises i PDF."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rammer som gjelder (merking)</CardTitle>
          <CardDescription>
            Velg relevante profiler. NIS2 er valgfri merking — ikke full
            etterlevelsesmodul.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {ROS_COMPLIANCE_SCOPE_TAGS.map((t) => (
            <label
              key={t.id}
              className="border-border/60 bg-muted/10 flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm"
            >
              <Checkbox
                checked={complianceScopeTags.includes(t.id)}
                onCheckedChange={() => toggleTag(t.id)}
                className="mt-0.5"
              />
              <span>
                <span className="text-foreground font-medium">{t.label}</span>
                <span className="text-muted-foreground block text-xs leading-snug">
                  {t.description}
                </span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Krav- og kildehenvisninger
            </CardTitle>
            <CardDescription>
              Strukturerte pekere (artikkel, notat, lenke). Erstatter ikke
              juridisk vurdering.
            </CardDescription>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addRef}>
            <Plus className="mr-1 size-4" />
            Legg til rad
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {requirementRefs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ingen henvisninger ennå — bruk «Legg til rad» ved behov.
            </p>
          ) : (
            requirementRefs.map((ref, index) => (
              <div
                key={index}
                className="border-border/60 space-y-3 rounded-xl border p-3"
              >
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px] flex-1 space-y-1">
                    <Label>Kilde</Label>
                    <select
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={ref.source}
                      onChange={(e) =>
                        updateRef(index, {
                          source: e.target.value as RosRequirementSource,
                        })
                      }
                    >
                      {SOURCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => removeRef(index)}
                    aria-label="Fjern rad"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Paragraf / artikkel</Label>
                    <Input
                      value={ref.article ?? ""}
                      onChange={(e) =>
                        updateRef(index, { article: e.target.value })
                      }
                      placeholder="f.eks. art. 32"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Lenke til dokumentasjon</Label>
                    <Input
                      value={ref.documentationUrl ?? ""}
                      onChange={(e) =>
                        updateRef(index, { documentationUrl: e.target.value })
                      }
                      placeholder="https://…"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Notat</Label>
                    <Textarea
                      value={ref.note ?? ""}
                      onChange={(e) =>
                        updateRef(index, { note: e.target.value })
                      }
                      rows={2}
                      className="min-h-0"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
