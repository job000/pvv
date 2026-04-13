"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { GithubSubIssuesProgress } from "@/components/github/github-sub-issues-progress";
import { prosessRegisterCopy } from "@/lib/prosess-register-copy";
import {
  Building2,
  Download,
  GitBranch,
  Hash,
  Ticket,
  Loader2,
  Settings2,
  StickyNote,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

const CANDIDATE_ROLE_OPTIONS = [
  { value: "utforende" as const, label: "Utførende" },
  { value: "vurdering" as const, label: "Vurdering (PVV)" },
  { value: "ros" as const, label: "ROS-analyse" },
  { value: "pdd" as const, label: "Prosessdesign (PDD)" },
];

export function WorkspaceCandidateRow({
  workspaceId,
  candidate: c,
  orgUnits,
  isAdmin,
  canEdit,
  onUpdate,
  onRemove,
  syncGithubDraft,
  describeGithubItem,
  githubProject,
  importFromGithub,
  as = "li",
}: {
  workspaceId: Id<"workspaces">;
  candidate: Doc<"candidates">;
  orgUnits: Doc<"orgUnits">[];
  isAdmin: boolean;
  canEdit: boolean;
  /** Etter lagring: push full PVV/ROS-tekst til GitHub-utkast */
  syncGithubDraft?: (candidateId: Id<"candidates">) => Promise<unknown>;
  /** Sjekk om kortet er utkast vs issue/PR i repo */
  describeGithubItem?: (
    candidateId: Id<"candidates">,
  ) => Promise<{
    kind: string;
    draftTitle?: string;
    issue?: {
      number: number;
      url: string;
      title: string;
      state: string;
      repoFullName: string;
      subIssuesSummary?: {
        total: number;
        completed: number;
        percentCompleted: number | null;
      };
    };
    pullRequest?: {
      number: number;
      url: string;
      title: string;
      state: string;
      repoFullName: string;
    };
    workspaceDefaultRepos: string[];
    issueMatchesDefaultRepo: boolean | null;
  }>;
  onUpdate: (args: {
    candidateId: Id<"candidates">;
    name?: string;
    code?: string;
    notes?: string | null;
    orgUnitId?: Id<"orgUnits"> | null;
    linkHintBusinessOwner?: string | null;
    linkHintSystems?: string | null;
    linkHintComplianceNotes?: string | null;
  }) => Promise<null>;
  onRemove: (args: { candidateId: Id<"candidates"> }) => Promise<null>;
  githubProject?: {
    enabled: boolean;
    loading: boolean;
    error: string | null;
    statusOptions: { id: string; name: string }[] | null;
    statusFieldName: string | null;
    onReload: () => void;
    register: (
      candidateId: Id<"candidates">,
      statusOptionId: string,
    ) => Promise<unknown>;
    /** Ekte issue i standard-repo + prosjekt (krever repo under innstillinger). */
    createRepoIssue?: (
      candidateId: Id<"candidates">,
      statusOptionId: string,
    ) => Promise<unknown>;
    updateStatus: (
      candidateId: Id<"candidates">,
      statusOptionId: string,
    ) => Promise<unknown>;
    remove: (candidateId: Id<"candidates">) => Promise<unknown>;
  };
  /** `div` når raden vises i dialog (unngå `<li>` uten `<ul>`). */
  as?: "li" | "div";
  /** Hent PVV-markerte felt fra GitHub-prosjektkort inn i skjemaet. */
  importFromGithub?: (
    candidateId: Id<"candidates">,
  ) => Promise<
    | { ok: true; updatedKeys: string[] }
    | {
        ok: false;
        reason: "empty_body" | "no_markers" | "no_extracted_fields";
      }
  >;
}) {
  const [name, setName] = useState(c.name);
  const [code, setCode] = useState(c.code);
  const [notes, setNotes] = useState(c.notes ?? "");
  const [linkOwner, setLinkOwner] = useState(c.linkHintBusinessOwner ?? "");
  const [linkSystems, setLinkSystems] = useState(c.linkHintSystems ?? "");
  const [linkComp, setLinkComp] = useState(c.linkHintComplianceNotes ?? "");
  const [orgUnitId, setOrgUnitId] = useState(c.orgUnitId ?? "");
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubItemShape, setGithubItemShape] = useState<{
    kind: string;
    draftTitle?: string;
    issue?: {
      number: number;
      url: string;
      title: string;
      state: string;
      repoFullName: string;
      subIssuesSummary?: {
        total: number;
        completed: number;
        percentCompleted: number | null;
      };
    };
    pullRequest?: {
      number: number;
      url: string;
      title: string;
      state: string;
      repoFullName: string;
    };
    workspaceDefaultRepos: string[];
    issueMatchesDefaultRepo: boolean | null;
  } | null>(null);
  const [githubItemShapeErr, setGithubItemShapeErr] = useState<string | null>(
    null,
  );
  /** 0 = ikke bedt om henting; >0 = kjør henting (økes for «oppdater»). */
  const [githubCardShapeFetchKey, setGithubCardShapeFetchKey] = useState(0);
  const [importBusy, setImportBusy] = useState(false);
  const [pushGithubBusy, setPushGithubBusy] = useState(false);

  const describeGithubItemRef = useRef(describeGithubItem);
  describeGithubItemRef.current = describeGithubItem;

  useEffect(() => {
    if (!canEdit) {
      setGithubCardShapeFetchKey(0);
      setGithubItemShape(null);
      setGithubItemShapeErr(null);
      return;
    }
    setGithubCardShapeFetchKey(c.githubProjectItemNodeId ? 1 : 0);
    setGithubItemShape(null);
    setGithubItemShapeErr(null);
  }, [c._id, c.githubProjectItemNodeId, canEdit]);

  useEffect(() => {
    if (githubCardShapeFetchKey === 0) {
      return;
    }
    if (
      !canEdit ||
      !describeGithubItem ||
      !githubProject?.enabled ||
      !c.githubProjectItemNodeId ||
      githubProject.loading ||
      githubProject.error
    ) {
      return;
    }
    let cancelled = false;
    setGithubItemShapeErr(null);
    const fn = describeGithubItemRef.current;
    if (!fn) {
      return;
    }
    void fn(c._id)
      .then((r) => {
        if (!cancelled) {
          setGithubItemShape(r);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setGithubItemShape(null);
          setGithubItemShapeErr(
            e instanceof Error
              ? e.message
              : "Kunne ikke sjekke GitHub-kortet.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    canEdit,
    githubCardShapeFetchKey,
    c._id,
    c.githubProjectItemNodeId,
    githubProject?.enabled,
    githubProject?.loading,
    githubProject?.error,
  ]);

  const selectedProjectStatus = useMemo(() => {
    return (
      statusOverride ??
      c.githubProjectStatusOptionId ??
      githubProject?.statusOptions?.[0]?.id ??
      ""
    );
  }, [
    statusOverride,
    c.githubProjectStatusOptionId,
    githubProject?.statusOptions,
  ]);

  async function handleSave() {
    const nameT = name.trim();
    const codeT = code.trim();
    if (!nameT || !codeT) {
      toast.error(
        "Prosessnavn og prosess-ID kan ikke være tomme. Prosess-ID er den korte koden som kobler til PVV og ROS (f.eks. INN-01).",
      );
      return;
    }
    try {
      await onUpdate({
        candidateId: c._id,
        name: nameT,
        code: codeT,
        notes: notes.trim() === "" ? null : notes.trim(),
        orgUnitId: orgUnitId === "" ? null : (orgUnitId as Id<"orgUnits">),
        linkHintBusinessOwner:
          linkOwner.trim() === "" ? null : linkOwner.trim(),
        linkHintSystems: linkSystems.trim() === "" ? null : linkSystems.trim(),
        linkHintComplianceNotes:
          linkComp.trim() === "" ? null : linkComp.trim(),
      });
      toast.success("Endringer lagret.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre endringene.",
      );
    }
  }

  const Wrapper = as === "div" ? "div" : "li";

  return (
    <Wrapper
      id={`cand-detail-${c._id}`}
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"
    >
      <p className="text-muted-foreground mb-4 flex flex-wrap items-center gap-2 text-xs leading-relaxed">
        <span className="bg-muted text-foreground inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold">
          {code.trim() || "—"}
        </span>
        <span>
          Rediger prosessen under. I store organisasjoner er{" "}
          <strong className="text-foreground">prosess-ID</strong> den faste
          nøkkelen på tvers av avdelinger;{" "}
          <strong className="text-foreground">organisasjon</strong> hjelper å
          vite hvor dere svarer først.
        </span>
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor={`cand-name-${c._id}`}
            className="flex items-center gap-2 text-sm font-medium"
          >
            {prosessRegisterCopy.displayName.label}
          </Label>
          <Input
            id={`cand-name-${c._id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            placeholder="F.eks. Innleggelse elektiv pasient"
            className="h-10"
          />
          <p className="text-muted-foreground text-[11px] leading-snug">
            {prosessRegisterCopy.displayName.hint}
          </p>
        </div>
        <div className="space-y-2">
          <Label
            htmlFor={`cand-code-${c._id}`}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Hash className="inline size-3.5 opacity-70" aria-hidden />
            {prosessRegisterCopy.referenceCode.label}
            <span className="text-destructive font-normal">*</span>
          </Label>
          <Input
            id={`cand-code-${c._id}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!canEdit}
            placeholder={prosessRegisterCopy.referenceCode.placeholder}
            className="h-10 font-mono text-sm"
            aria-required
          />
          <p className="text-muted-foreground text-[11px] leading-snug">
            {prosessRegisterCopy.referenceCode.hint}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Label
          htmlFor={`cand-ou-${c._id}`}
          className="flex flex-wrap items-center gap-2 text-sm font-medium"
        >
          <Building2 className="size-3.5 opacity-70" aria-hidden />
          {prosessRegisterCopy.orgUnit.label}
          <span className="text-muted-foreground font-normal">
            ({prosessRegisterCopy.orgUnit.optional})
          </span>
        </Label>
        <select
          id={`cand-ou-${c._id}`}
          className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none"
          value={orgUnitId}
          onChange={(e) => setOrgUnitId(e.target.value)}
          disabled={!canEdit}
        >
          <option value="">{prosessRegisterCopy.orgUnit.emptyOption}</option>
          {orgUnits.map((u) => (
            <option key={u._id} value={u._id}>
              {ORG_UNIT_KIND_LABELS[u.kind]} · {u.name}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-[11px] leading-snug">
          {prosessRegisterCopy.orgUnit.hint}
        </p>
        {orgUnits.length === 0 ? (
          <p className="text-muted-foreground text-[11px]">
            Ingen enheter i kartet ennå — legg inn selskap og avdelinger under{" "}
            <span className="text-foreground font-medium">Organisasjon</span>{" "}
            i menyen først.
          </p>
        ) : null}
      </div>

      <div className="mt-5 space-y-2">
        <Label
          htmlFor={`cand-notes-${c._id}`}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <StickyNote className="size-3.5 opacity-70" aria-hidden />
          {prosessRegisterCopy.notes.label}
        </Label>
        <Textarea
          id={`cand-notes-${c._id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={!canEdit}
          placeholder="Valgfritt — f.eks. systemnavn, kontaktperson …"
          className="resize-y"
        />
        <p className="text-muted-foreground text-[11px] leading-snug">
          {prosessRegisterCopy.notes.hint}
        </p>
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
        <p className="text-foreground text-sm font-medium">
          Felter som flettes inn i PVV (hvis tomme der)
        </p>
        <div className="space-y-2">
          <Label htmlFor={`cand-lo-${c._id}`} className="text-xs">
            Ansvarlig / eier → «Roller og ansvar»
          </Label>
          <Input
            id={`cand-lo-${c._id}`}
            value={linkOwner}
            onChange={(e) => setLinkOwner(e.target.value)}
            disabled={!canEdit}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`cand-ls-${c._id}`} className="text-xs">
            Systemer og data
          </Label>
          <Input
            id={`cand-ls-${c._id}`}
            value={linkSystems}
            onChange={(e) => setLinkSystems(e.target.value)}
            disabled={!canEdit}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`cand-lc-${c._id}`} className="text-xs">
            Sikkerhet og personvern
          </Label>
          <Textarea
            id={`cand-lc-${c._id}`}
            value={linkComp}
            onChange={(e) => setLinkComp(e.target.value)}
            rows={2}
            disabled={!canEdit}
            className="resize-y"
          />
        </div>
      </div>

      <CandidateAssigneesSection
        candidateId={c._id}
        workspaceId={workspaceId}
        canEdit={canEdit}
      />

      {githubProject?.enabled ? (
        <div className="mt-5 space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-foreground flex items-center gap-2 text-sm font-medium">
              <GitBranch className="text-muted-foreground size-4" aria-hidden />
              GitHub-prosjekt
            </p>
            <p className="text-muted-foreground text-[11px] leading-snug">
              <Link
                href={`/w/${workspaceId}/vurderinger`}
                className="text-primary font-medium underline underline-offset-2"
              >
                PVV-vurderinger
              </Link>
              {" · "}
              <Link
                href={`/w/${workspaceId}/ros`}
                className="text-primary font-medium underline underline-offset-2"
              >
                ROS
              </Link>
            </p>
          </div>
          {!canEdit ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Som leser kan du se koblingen til arbeidsområdets GitHub-prosjekt.{" "}
              <strong className="text-foreground font-medium">Hent til PVV</strong>,{" "}
              <strong className="text-foreground font-medium">Send til GitHub</strong> og
              redigering av tavle krever medlem-rolle.
            </p>
          ) : (
          <p className="text-muted-foreground text-xs leading-relaxed">
            <strong className="text-foreground font-medium">Hent til PVV</strong>{" "}
            leser merkede tekstfelt fra GitHub.{" "}
            <strong className="text-foreground font-medium">Send til GitHub</strong>{" "}
            oppdaterer kortet med prosess + koblede vurderinger/ROS.{" "}
            <strong className="text-foreground font-medium">Lagre</strong> lagrer i PVV.
            Bruk <strong className="text-foreground font-medium">Send til GitHub</strong> når
            tavlen skal oppdateres.
          </p>
          )}
          {canEdit &&
          c.githubProjectItemNodeId &&
          (importFromGithub || syncGithubDraft) ? (
            <div className="flex flex-wrap gap-2">
              {importFromGithub ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-2"
                disabled={importBusy || pushGithubBusy}
                onClick={() => {
                  setImportBusy(true);
                  void importFromGithub(c._id)
                    .then((r) => {
                      if (r.ok) {
                        toast.success(
                          r.updatedKeys.length > 0
                            ? `Oppdatert fra GitHub: ${r.updatedKeys.join(", ")}.`
                            : "Ingen felt å oppdatere.",
                        );
                      } else if (r.reason === "empty_body") {
                        toast.error(
                          "Tom brødtekst på GitHub — bruk «Send til GitHub» fra PVV først.",
                        );
                      } else if (r.reason === "no_markers") {
                        toast.error(
                          "Ingen PVV-synkmarkører i GitHub-teksten. Bruk «Send til GitHub» én gang, eller behold <!-- pvv:b64:… -->-blokkene når du redigerer på GitHub.",
                        );
                      } else {
                        toast.error(
                          "Fant markører men kunne ikke lese felt — sjekk at teksten ikke er ødelagt.",
                        );
                      }
                    })
                    .catch((e) =>
                      toast.error(
                        e instanceof Error ? e.message : "Kunne ikke hente fra GitHub.",
                      ),
                    )
                    .finally(() => setImportBusy(false));
                }}
              >
                {importBusy ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-4 shrink-0" aria-hidden />
                )}
                Hent til PVV
              </Button>
              ) : null}
              {syncGithubDraft ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={importBusy || pushGithubBusy}
                onClick={() => {
                  setPushGithubBusy(true);
                  void syncGithubDraft(c._id)
                    .then(() => {
                      toast.success("GitHub-kort er oppdatert fra PVV.");
                    })
                    .catch((e) =>
                      toast.error(
                        e instanceof Error
                          ? e.message
                          : "Kunne ikke sende til GitHub.",
                      ),
                    )
                    .finally(() => setPushGithubBusy(false));
                }}
              >
                {pushGithubBusy ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-4 shrink-0" aria-hidden />
                )}
                Send til GitHub
              </Button>
              ) : null}
            </div>
          ) : null}
          {canEdit &&
          c.githubProjectItemNodeId &&
          !githubProject.loading ? (
            <div
              className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs leading-relaxed"
              role="status"
            >
              {githubItemShapeErr ? (
                <div className="space-y-2">
                  <p className="text-destructive">{githubItemShapeErr}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setGithubItemShape(null);
                      setGithubItemShapeErr(null);
                      setGithubCardShapeFetchKey((k) => k + 1);
                    }}
                  >
                    Prøv igjen
                  </Button>
                </div>
              ) : !githubItemShape ? (
                <p className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  Sjekker kort på GitHub …
                </p>
              ) : githubItemShape?.kind === "draft" ? (
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">GitHub:</span>{" "}
                  fortsatt <strong className="text-foreground">utkast</strong>{" "}
                  (draft) — ikke et issue i et repo. Da kan PVV oppdatere tittel og
                  brødtekst via API. Under-saker og fremdriftslinje som på GitHub-tavlen
                  finnes bare for kort som er koblet til et issue i et repo — ikke for
                  utkast.
                </p>
              ) : githubItemShape?.kind === "issue" && githubItemShape.issue ? (
                <div className="space-y-1">
                  <p>
                    <span className="text-foreground font-medium">GitHub:</span>{" "}
                    ekte issue{" "}
                    <a
                      href={githubItemShape.issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-medium underline underline-offset-2"
                    >
                      #{githubItemShape.issue.number}
                    </a>{" "}
                    i{" "}
                    <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.7rem]">
                      {githubItemShape.issue.repoFullName || "—"}
                    </code>{" "}
                    ({githubItemShape.issue.state})
                  </p>
                  {githubItemShape.issueMatchesDefaultRepo === false ? (
                    <p className="text-amber-800 dark:text-amber-200">
                      Issue ligger ikke i arbeidsområdets standard-repo
                      {githubItemShape.workspaceDefaultRepos.length > 0
                        ? ` (${githubItemShape.workspaceDefaultRepos.join(", ")})`
                        : ""}
                      .
                    </p>
                  ) : githubItemShape.issueMatchesDefaultRepo === true ? (
                    <p className="text-emerald-800 dark:text-emerald-200">
                      Matcher et av standard-repoene under innstillinger.
                    </p>
                  ) : null}
                  {githubItemShape.issue.subIssuesSummary &&
                  githubItemShape.issue.subIssuesSummary.total > 0 ? (
                    <GithubSubIssuesProgress
                      className="mt-2"
                      summary={githubItemShape.issue.subIssuesSummary}
                    />
                  ) : null}
                </div>
              ) : githubItemShape?.kind === "pull_request" &&
                githubItemShape.pullRequest ? (
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">GitHub:</span>{" "}
                  kortet peker på en{" "}
                  <a
                    href={githubItemShape.pullRequest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    pull request #{githubItemShape.pullRequest.number}
                  </a>{" "}
                  i {githubItemShape.pullRequest.repoFullName}.
                </p>
              ) : githubItemShape?.kind === "unknown" ? (
                <p className="text-muted-foreground">
                  Kunne ikke avgjøre korttype på GitHub (tomt innhold eller ny
                  API-type).
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Uventet svar fra GitHub.
                </p>
              )}
              {githubItemShape && !githubItemShapeErr ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 text-xs text-muted-foreground"
                  onClick={() => {
                    setGithubItemShape(null);
                    setGithubCardShapeFetchKey((k) => k + 1);
                  }}
                >
                  Oppdater kortinfo
                </Button>
              ) : null}
            </div>
          ) : null}
          {canEdit && githubProject.loading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Laster statuskolonner …
            </p>
          ) : canEdit && githubProject.error ? (
            <div className="space-y-2">
              <p className="text-destructive text-sm" role="alert">
                {githubProject.error}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => githubProject.onReload()}
              >
                Prøv på nytt
              </Button>
            </div>
          ) : canEdit &&
            githubProject.statusOptions &&
            githubProject.statusOptions.length > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-[12rem] space-y-1">
                <Label className="text-xs">
                  {githubProject.statusFieldName ?? "Status"}
                </Label>
                <select
                  className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none"
                  value={selectedProjectStatus}
                  onChange={(e) => setStatusOverride(e.target.value)}
                  disabled={githubBusy}
                >
                  {githubProject.statusOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              {c.githubProjectItemNodeId ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-2"
                    disabled={githubBusy || !selectedProjectStatus}
                    onClick={() => {
                      setGithubBusy(true);
                      void githubProject
                        .updateStatus(c._id, selectedProjectStatus)
                        .then(() => toast.success("Status oppdatert på GitHub."))
                        .catch((e) =>
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : "Kunne ikke oppdatere status.",
                          ),
                        )
                        .finally(() => setGithubBusy(false));
                    }}
                  >
                    {githubBusy ? (
                      <Loader2
                        className="size-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                    ) : null}
                    Oppdater status
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive gap-2"
                    disabled={githubBusy}
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm(
                          "Fjerne kortet fra GitHub-prosjektet? Prosessen blir stående i PVV.",
                        )
                      ) {
                        setGithubBusy(true);
                        void githubProject
                          .remove(c._id)
                          .then(() =>
                            toast.success("Kort fjernet fra GitHub-prosjekt."),
                          )
                          .catch((e) =>
                            toast.error(
                              e instanceof Error
                                ? e.message
                                : "Kunne ikke fjerne fra prosjekt.",
                            ),
                          )
                          .finally(() => setGithubBusy(false));
                      }
                    }}
                  >
                    {githubBusy ? (
                      <Loader2
                        className="size-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                    ) : null}
                    Fjern fra prosjekt
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-2"
                    disabled={githubBusy || !selectedProjectStatus}
                    title="Prosjektkort (utkast) i GitHub Projects"
                    onClick={() => {
                      setGithubBusy(true);
                      void githubProject
                        .register(c._id, selectedProjectStatus)
                        .then(() =>
                          toast.success("Prosess registrert som utkast i tavle."),
                        )
                        .catch((e) =>
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : "Kunne ikke registrere i prosjekt.",
                          ),
                        )
                        .finally(() => setGithubBusy(false));
                    }}
                  >
                    {githubBusy ? (
                      <Loader2
                        className="size-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <GitBranch className="size-4 shrink-0" aria-hidden />
                    )}
                    Utkast i tavle
                  </Button>
                  {githubProject.createRepoIssue ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={githubBusy || !selectedProjectStatus}
                      title="Oppretter issue i standard-repo, legger det i tavle og synker fra PVV"
                      onClick={() => {
                        const createIssue = githubProject.createRepoIssue;
                        if (!createIssue) return;
                        setGithubBusy(true);
                        void createIssue(c._id, selectedProjectStatus)
                          .then(() =>
                            toast.success(
                              "GitHub-issue opprettet og koblet — synket fra PVV.",
                            ),
                          )
                          .catch((e) =>
                            toast.error(
                              e instanceof Error
                                ? e.message
                                : "Kunne ikke opprette issue i repo.",
                            ),
                          )
                          .finally(() => setGithubBusy(false));
                      }}
                    >
                      {githubBusy ? (
                        <Loader2
                          className="size-4 shrink-0 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <Ticket className="size-4 shrink-0" aria-hidden />
                      )}
                      Issue i repo
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ) : canEdit ? (
            <p className="text-muted-foreground text-sm">
              Ingen statuskolonner funnet for dette prosjektet.
            </p>
          ) : null}
        </div>
      ) : null}

      {!githubProject?.enabled ? (
        <div className="mt-5 space-y-3 rounded-xl border border-amber-500/35 bg-amber-500/[0.08] p-4">
          <p className="text-foreground flex items-center gap-2 text-sm font-medium">
            <GitBranch className="text-amber-700 dark:text-amber-300 size-4" aria-hidden />
            «Legg til i tavle» vises ikke ennå
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Arbeidsområdet mangler lagret{" "}
            <strong className="text-foreground font-medium">GitHub-prosjekt</strong>{" "}
            (node-ID). Da finnes ingen knapp her eller i oversiktstabellen — det er
            ikke en feil i PVV.
          </p>
          {isAdmin ? (
            <Link
              href={`/w/${workspaceId}/innstillinger#github-arbeidsomrade`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "inline-flex gap-2",
              )}
            >
              <Settings2 className="size-4" aria-hidden />
              Gå til Innstillinger (GitHub)
            </Link>
          ) : (
            <p className="text-muted-foreground text-xs">
              Be en <strong className="text-foreground font-medium">administrator</strong>{" "}
              om å konfigurere GitHub under Innstillinger for arbeidsområdet.
            </p>
          )}
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleSave}
          >
            Lagre endringer
          </Button>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm(
                    c.githubProjectItemNodeId
                      ? "Slette denne prosessen fra registeret? Fjern eventuelt kortet i GitHub-prosjekt manuelt. Eksisterende PVV-koblinger bør ryddes manuelt."
                      : "Slette denne prosessen fra registeret? Eksisterende PVV-koblinger bør ryddes manuelt.",
                  )
                ) {
                  void (async () => {
                    try {
                      await onRemove({ candidateId: c._id });
                      toast.success("Prosess slettet.");
                    } catch (e) {
                      toast.error(
                        e instanceof Error
                          ? e.message
                          : "Kunne ikke slette prosessen.",
                      );
                    }
                  })();
                }
              }}
            >
              Slett
            </Button>
          ) : null}
        </div>
      ) : null}
    </Wrapper>
  );
}

function CandidateAssigneesSection({
  candidateId,
  workspaceId,
  canEdit,
}: {
  candidateId: Id<"candidates">;
  workspaceId: Id<"workspaces">;
  canEdit: boolean;
}) {
  const assignees = useQuery(api.candidates.listAssignees, { candidateId });
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const addAssignee = useMutation(api.candidates.addAssignee);
  const removeAssignee = useMutation(api.candidates.removeAssignee);

  const [addUserId, setAddUserId] = useState<Id<"users"> | "">("");
  const [addRole, setAddRole] = useState<
    "utforende" | "vurdering" | "ros" | "pdd"
  >("utforende");

  const assigneesByRole = useMemo(() => {
    const grouped: Record<string, typeof assignees> = {};
    for (const r of CANDIDATE_ROLE_OPTIONS) {
      grouped[r.value] = [];
    }
    for (const a of assignees ?? []) {
      if (!grouped[a.role]) grouped[a.role] = [];
      grouped[a.role]!.push(a);
    }
    return grouped;
  }, [assignees]);

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="text-muted-foreground size-4" aria-hidden />
        <p className="text-foreground text-sm font-medium">
          Ansvarlige på prosessen
        </p>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Tildel hvem som utfører prosessen og hvem som har ansvar for vurdering,
        ROS-analyse og prosessdesign. Ansvarlige får varsel.
      </p>

      {(assignees ?? []).length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
          Ingen er tildelt ennå.
        </p>
      ) : (
        <div className="space-y-2">
          {CANDIDATE_ROLE_OPTIONS.map((role) => {
            const list = assigneesByRole[role.value] ?? [];
            if (list.length === 0) return null;
            return (
              <div key={role.value} className="space-y-1">
                <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                  {role.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((a) => (
                    <span
                      key={a._id}
                      className="bg-card inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-1 text-xs shadow-xs"
                    >
                      <UserAvatar
                        name={a.userName ?? "?"}
                        className="size-5"
                      />
                      <span className="max-w-[140px] truncate font-medium">
                        {a.userName ?? a.userEmail ?? "Bruker"}
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive rounded-full p-0.5"
                          aria-label={`Fjern ${a.userName}`}
                          onClick={() =>
                            void removeAssignee({ assigneeId: a._id })
                          }
                        >
                          <X className="size-3" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canEdit && members ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label className="text-xs">Person</Label>
            <select
              className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
              value={addUserId}
              onChange={(e) =>
                setAddUserId(
                  e.target.value === ""
                    ? ""
                    : (e.target.value as Id<"users">),
                )
              }
            >
              <option value="">Velg person …</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name ?? m.email ?? m.userId}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:w-44">
            <Label className="text-xs">Rolle</Label>
            <select
              className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
              value={addRole}
              onChange={(e) =>
                setAddRole(
                  e.target.value as "utforende" | "vurdering" | "ros" | "pdd",
                )
              }
            >
              {CANDIDATE_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={addUserId === ""}
            onClick={() => {
              if (addUserId === "") return;
              void addAssignee({
                candidateId,
                userId: addUserId,
                role: addRole,
              })
                .then(() => {
                  setAddUserId("");
                  toast.success("Person tildelt.");
                })
                .catch((e) =>
                  toast.error(
                    e instanceof Error ? e.message : "Kunne ikke tildele.",
                  ),
                );
            }}
          >
            Tildel
          </Button>
        </div>
      ) : null}
    </div>
  );
}
