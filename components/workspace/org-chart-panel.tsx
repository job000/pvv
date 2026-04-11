"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { COMPLIANCE_STATUS_LABELS } from "@/lib/helsesector-labels";
import { OrgUnitRosKpiStrip, type OrgRosRollup } from "@/components/workspace/org-unit-ros-kpi-strip";
import { OrgUnitTreeOverviewStrip } from "@/components/workspace/org-unit-tree-overview-strip";
import { ProcessCoverageOverview } from "@/components/workspace/process-coverage-overview";
import { toast } from "@/lib/app-toast";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRightLeft,
  Building2,
  ChevronDown,
  ChevronRight,
  Hand,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  PenLine,
  Plus,
  Shield,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type OrgChartInteraction = {
  registerCardRef: (id: Id<"orgUnits">, el: HTMLDivElement | null) => void;
  focusPulse: { id: Id<"orgUnits">; token: number } | null;
  highlightedUnitId: Id<"orgUnits"> | null;
  onCardSurfaceActivate: (id: Id<"orgUnits">) => void;
};

const OrgChartInteractionContext = createContext<OrgChartInteraction | null>(
  null,
);

/** Alle noder under `rootId` (ikke med selve roten). */
function computeDescendantIds(
  rootId: Id<"orgUnits">,
  childrenByParent: Map<string, Doc<"orgUnits">[]>,
): Set<Id<"orgUnits">> {
  const out = new Set<Id<"orgUnits">>();
  const walk = (id: Id<"orgUnits">) => {
    for (const k of childrenByParent.get(id) ?? []) {
      out.add(k._id);
      walk(k._id);
    }
  };
  walk(rootId);
  return out;
}

/** Mulige foreldre ved flytting (avdeling → HF, seksjon → avdeling, team → seksjon eller team). */
function validParentOptionsForMove(
  unit: Doc<"orgUnits">,
  all: Doc<"orgUnits">[],
  descendants: Set<Id<"orgUnits">>,
): { id: Id<"orgUnits">; label: string }[] {
  if (unit.kind === "helseforetak") {
    return [];
  }
  if (unit.kind === "avdeling") {
    return all
      .filter((u) => u.kind === "helseforetak" && !descendants.has(u._id))
      .sort((a, b) => a.name.localeCompare(b.name, "nb"))
      .map((u) => ({ id: u._id, label: u.name }));
  }
  if (unit.kind === "seksjon") {
    return all
      .filter((u) => u.kind === "avdeling" && !descendants.has(u._id))
      .sort((a, b) => a.name.localeCompare(b.name, "nb"))
      .map((u) => ({ id: u._id, label: u.name }));
  }
  return all
    .filter(
      (u) =>
        (u.kind === "seksjon" || u.kind === "team") &&
        !descendants.has(u._id) &&
        u._id !== unit._id,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "nb"))
    .map((u) => ({
      id: u._id,
      label: `${ORG_UNIT_KIND_LABELS[u.kind]} · ${u.name}`,
    }));
}

function MerkantilContactRow({
  contact,
  canEdit,
}: {
  contact: Doc<"orgUnitContacts">;
  canEdit: boolean;
}) {
  const updateContact = useMutation(api.orgUnits.updateContact);
  const removeContact = useMutation(api.orgUnits.removeContact);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(contact.name);
  const [title, setTitle] = useState(contact.title ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const editTitleId = `org-contact-edit-${contact._id}`;

  useEffect(() => {
    if (!editOpen) return;
    setName(contact.name);
    setTitle(contact.title ?? "");
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setNotes(contact.notes ?? "");
  }, [editOpen, contact]);

  async function save() {
    await updateContact({
      contactId: contact._id,
      name,
      title: title.trim() === "" ? null : title,
      email: email.trim() === "" ? null : email,
      phone: phone.trim() === "" ? null : phone,
      notes: notes.trim() === "" ? null : notes,
    });
    setEditOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/80 px-3 py-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05] sm:gap-3 sm:px-3.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:size-9">
          <span className="text-[11px] font-bold text-primary sm:text-xs">
            {contact.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{contact.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {contact.title ? (
              <span className="text-muted-foreground max-w-full truncate text-[10px]">
                {contact.title}
              </span>
            ) : null}
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="text-primary max-w-[11rem] truncate text-[10px] hover:underline sm:max-w-[14rem]"
                onClick={(e) => e.stopPropagation()}
              >
                {contact.email}
              </a>
            ) : null}
            {contact.phone ? (
              <a
                href={`tel:${contact.phone.replace(/\s/g, "")}`}
                className="text-primary text-[10px] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {contact.phone}
              </a>
            ) : null}
          </div>
          {contact.notes?.trim() ? (
            <p className="text-muted-foreground mt-1 line-clamp-1 text-[10px] leading-snug">
              {contact.notes.trim()}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 shrink-0 gap-1 rounded-lg px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setEditOpen(true);
            }}
            aria-label={`Rediger ${contact.name}`}
          >
            <PenLine className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Rediger</span>
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent size="md" titleId={editTitleId} className="max-h-[min(90vh,32rem)]">
            <DialogHeader className="px-5 py-4 sm:px-6">
              <h2 id={editTitleId} className="text-foreground text-base font-semibold tracking-tight">
                Rediger kontakt
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">{contact.name}</p>
            </DialogHeader>
            <DialogBody className="space-y-3 sm:space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Navn
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Stilling
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    E-post
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Telefon
                  </Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-9 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notater
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="rounded-xl text-sm"
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive mr-auto rounded-xl"
                onClick={() => {
                  if (typeof window !== "undefined" && window.confirm("Fjerne kontakten?")) {
                    void removeContact({ contactId: contact._id });
                    setEditOpen(false);
                  }
                }}
              >
                Fjern kontakt
              </Button>
              <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={() => setEditOpen(false)}>
                Avbryt
              </Button>
              <Button type="button" size="sm" className="rounded-xl" onClick={() => void save()}>
                Lagre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function MerkantilContactsBlock({
  unit,
  contacts,
  canEdit,
  embedded = false,
}: {
  unit: Doc<"orgUnits">;
  contacts: Doc<"orgUnitContacts">[];
  canEdit: boolean;
  /** Inni accordion: ingen egen seksjonstittel, kortere intro. */
  embedded?: boolean;
}) {
  const addContact = useMutation(api.orgUnits.addContact);
  const importLegacy = useMutation(api.orgUnits.importLegacyContact);

  const [addName, setAddName] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const addDialogTitleId = `org-contact-add-${unit._id}`;

  const hasLegacy =
    !!(unit.merkantilContactName ||
      unit.merkantilContactEmail ||
      unit.merkantilContactPhone);

  async function submitAdd(ev: React.FormEvent) {
    ev.preventDefault();
    setAddMsg(null);
    const n = addName.trim();
    if (!n) {
      setAddMsg("Navn er påkrevd.");
      return;
    }
    try {
      await addContact({
        orgUnitId: unit._id,
        name: n,
        title: addTitle.trim() || undefined,
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
        notes: addNotes.trim() || undefined,
      });
      setAddName("");
      setAddTitle("");
      setAddEmail("");
      setAddPhone("");
      setAddNotes("");
      setAddDialogOpen(false);
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Kunne ikke legge til.");
    }
  }

  return (
    <div className="space-y-2.5">
      {!embedded ? (
        <>
          <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-wide">
            Kontaktpersoner
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Registrer én eller flere personer per enhet — f.eks. økonomi, innkjøp,
            IT, avtaler eller annet som er relevant for deres bransje.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-[11px] leading-snug">
          Kort visning i kortet — bruk <span className="font-medium text-foreground/80">Rediger</span>{" "}
          eller <span className="font-medium text-foreground/80">Legg til</span> for fullt skjema.
        </p>
      )}

      {contacts.length === 0 && hasLegacy ? (
        <div className="rounded-2xl bg-amber-500/5 p-4 ring-1 ring-amber-500/20">
          <p className="text-sm font-medium">Eldre registrering</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Importer til kontaktlisten for å kunne legge til flere.
          </p>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-card px-3 py-2 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {(unit.merkantilContactName ?? "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 text-sm">
              {unit.merkantilContactName && (
                <p className="font-medium">
                  {unit.merkantilContactName}
                  {unit.merkantilContactTitle ? ` · ${unit.merkantilContactTitle}` : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-x-2">
                {unit.merkantilContactEmail && (
                  <a href={`mailto:${unit.merkantilContactEmail}`} className="text-primary text-[10px] hover:underline">
                    {unit.merkantilContactEmail}
                  </a>
                )}
                {unit.merkantilContactPhone && (
                  <span className="text-muted-foreground text-[10px]">{unit.merkantilContactPhone}</span>
                )}
              </div>
            </div>
          </div>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3 rounded-xl"
              onClick={() => void importLegacy({ orgUnitId: unit._id })}
            >
              Importer til kontaktliste
            </Button>
          )}
        </div>
      ) : null}

      {contacts.length > 0 ? (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={`${c._id}-${[c.name, c.title ?? "", c.email ?? "", c.phone ?? "", c.notes ?? ""].join("\x1f")}`}
            >
              <MerkantilContactRow contact={c} canEdit={canEdit} />
            </li>
          ))}
        </ul>
      ) : !hasLegacy ? (
        <p className="text-muted-foreground text-xs">Ingen kontaktpersoner ennå.</p>
      ) : null}

      {canEdit ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-dashed"
            onClick={() => {
              setAddMsg(null);
              setAddDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Legg til kontakt
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent size="md" titleId={addDialogTitleId} className="max-h-[min(90vh,34rem)]">
              <DialogHeader className="px-5 py-4 sm:px-6">
                <h2 id={addDialogTitleId} className="text-foreground text-base font-semibold tracking-tight">
                  Ny kontaktperson
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">{unit.name}</p>
              </DialogHeader>
              <form onSubmit={(ev) => void submitAdd(ev)} className="flex min-h-0 flex-1 flex-col">
                <DialogBody className="space-y-3 sm:space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Navn *
                      </Label>
                      <Input
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        className="h-9 rounded-xl text-sm"
                        placeholder="Fornavn Etternavn"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Stilling
                      </Label>
                      <Input
                        value={addTitle}
                        onChange={(e) => setAddTitle(e.target.value)}
                        className="h-9 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        E-post
                      </Label>
                      <Input
                        type="email"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        className="h-9 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Telefon
                      </Label>
                      <Input
                        type="tel"
                        value={addPhone}
                        onChange={(e) => setAddPhone(e.target.value)}
                        className="h-9 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Notater
                    </Label>
                    <Textarea
                      value={addNotes}
                      onChange={(e) => setAddNotes(e.target.value)}
                      rows={3}
                      className="rounded-xl text-sm"
                      placeholder="Ansvarsområde, avtalereferanse …"
                    />
                  </div>
                  {addMsg ? (
                    <p className="text-destructive text-xs" role="alert">
                      {addMsg}
                    </p>
                  ) : null}
                </DialogBody>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    Avbryt
                  </Button>
                  <Button type="submit" size="sm" className="rounded-xl" disabled={!addName.trim()}>
                    Legg til
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

function OrgBranch({
  workspaceId,
  unit,
  parentOfUnit,
  childrenByParent,
  allOrgUnits,
  contactsByUnit,
  rosByUnit,
  depth,
  canEdit,
  isAdmin,
  onRemove,
  onMove,
}: {
  workspaceId: Id<"workspaces">;
  unit: Doc<"orgUnits">;
  /** Forelder til denne noden (for etiketter ved «samme nivå»). Null for rot. */
  parentOfUnit: Doc<"orgUnits"> | null;
  childrenByParent: Map<string, Doc<"orgUnits">[]>;
  /** Hele registeret (velge ny forelder ved flytting). */
  allOrgUnits: Doc<"orgUnits">[];
  contactsByUnit: Map<string, Doc<"orgUnitContacts">[]>;
  rosByUnit: Record<string, OrgRosRollup> | undefined;
  depth: number;
  canEdit: boolean;
  isAdmin: boolean;
  onRemove: (id: Id<"orgUnits">) => void | Promise<void>;
  onMove: (
    orgUnitId: Id<"orgUnits">,
    newParentId: Id<"orgUnits"> | null,
  ) => void | Promise<void>;
}) {
  const contactsForUnit = contactsByUnit.get(unit._id) ?? [];
  const kids = childrenByParent.get(unit._id) ?? [];
  /** Rot vises utvidet som standard; undernivå starter kompakt. */
  const [cardExpanded, setCardExpanded] = useState(depth === 0);
  const rollup =
    rosByUnit?.[unit._id] ?? {
      candidateCount: 0,
      analysisCount: 0,
      maxBefore: 0,
      maxAfter: 0,
      assessmentCount: 0,
      pddCount: 0,
      pddCompletedCount: 0,
      intakeSubmissionCount: 0,
      intakeFormCount: 0,
    };

  const hasRosActivity =
    rollup.candidateCount > 0 || rollup.analysisCount > 0;
  const assessmentCount = rollup.assessmentCount ?? 0;
  const pddCount = rollup.pddCount ?? 0;
  const pddCompletedCount = rollup.pddCompletedCount ?? 0;
  const hasLegacyUnit =
    !!(unit.merkantilContactName ||
      unit.merkantilContactEmail ||
      unit.merkantilContactPhone);

  /** Start lukket — kortet blir kortere; brukeren åpner ROS / kontakter ved behov. */
  const [rosPanelOpen, setRosPanelOpen] = useState(false);
  const [contactsPanelOpen, setContactsPanelOpen] = useState(false);

  const wasExpandedRef = useRef(cardExpanded);
  useEffect(() => {
    if (cardExpanded && !wasExpandedRef.current) {
      setRosPanelOpen(false);
      setContactsPanelOpen(false);
    }
    wasExpandedRef.current = cardExpanded;
  }, [cardExpanded]);

  const [addDialog, setAddDialog] = useState<null | "child" | "sibling">(null);
  const addDialogTitleId = `org-add-${unit._id}-title`;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveSelectValue, setMoveSelectValue] = useState("");

  const descendants = useMemo(
    () => computeDescendantIds(unit._id, childrenByParent),
    [unit._id, childrenByParent],
  );
  const moveParentOptions = useMemo(
    () => validParentOptionsForMove(unit, allOrgUnits, descendants),
    [unit, allOrgUnits, descendants],
  );

  const orgChartCtx = useContext(OrgChartInteractionContext);

  const cardShellRef = useCallback(
    (node: HTMLDivElement | null) => {
      orgChartCtx?.registerCardRef(unit._id, node);
    },
    [orgChartCtx, unit._id],
  );

  useEffect(() => {
    if (orgChartCtx?.focusPulse?.id === unit._id) {
      setCardExpanded(true);
    }
  }, [orgChartCtx?.focusPulse?.id, orgChartCtx?.focusPulse?.token, unit._id]);

  useEffect(() => {
    const syncHash = () => {
      const h = window.location.hash;
      if (h === `#add-child-${unit._id}`) {
        setAddDialog("child");
      } else if (h === `#add-sibling-${unit._id}`) {
        setAddDialog("sibling");
      } else {
        setAddDialog(null);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [unit._id]);

  function openAddDialog(mode: "child" | "sibling") {
    setAddDialog(mode);
    const tail = mode === "child" ? `add-child-${unit._id}` : `add-sibling-${unit._id}`;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${tail}`,
    );
  }

  function closeAddDialog() {
    setAddDialog(null);
    const h = window.location.hash;
    if (
      h === `#add-child-${unit._id}` ||
      h === `#add-sibling-${unit._id}`
    ) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }

  const depthAccentPalette = [
    "border-l-primary/55",
    "border-l-sky-400/30",
    "border-l-emerald-400/30",
    "border-l-violet-400/30",
    "border-l-amber-400/30",
  ] as const;
  const depthAccent = depthAccentPalette[depth % depthAccentPalette.length];

  return (
    <div
      className="flex flex-col items-center"
      role="treeitem"
      aria-expanded={kids.length > 0}
    >
      <div
        className={cn(
          "group/card relative w-full min-w-[188px] max-w-[15.5rem] sm:min-w-[200px] sm:max-w-[16.5rem]",
          canEdit && "pb-4 sm:pb-5",
        )}
      >
      <div
        ref={cardShellRef}
        data-org-chart-card
        className={cn(
          "w-full overflow-hidden rounded-xl border border-border/40 bg-card/90 shadow-sm backdrop-blur-sm transition-[box-shadow,transform,border-color] duration-200 hover:border-border/60 hover:shadow-md dark:bg-card/95 dark:border-white/[0.06]",
          "border-l-2",
          depthAccent,
          orgChartCtx &&
            "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          orgChartCtx?.highlightedUnitId === unit._id &&
            "ring-1 ring-primary/60 ring-offset-2 ring-offset-background dark:ring-offset-background",
        )}
        onClick={(e) => {
          if (!orgChartCtx) return;
          const t = e.target as HTMLElement;
          if (t.closest("button, a, summary")) return;
          orgChartCtx.onCardSurfaceActivate(unit._id);
        }}
      >
        <div className="flex items-start gap-2 px-3 pb-2 pt-3 sm:gap-2.5 sm:px-4 sm:pb-2.5 sm:pt-3.5">
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted/50 hover:text-foreground mt-px flex size-7 shrink-0 items-center justify-center rounded-md transition-colors sm:size-7"
            onClick={() => setCardExpanded(!cardExpanded)}
            aria-expanded={cardExpanded}
            aria-label={
              cardExpanded
                ? "Skjul detaljer for enheten"
                : "Vis detaljer for enheten"
            }
            title={cardExpanded ? "Skjul detaljer" : "Vis detaljer"}
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200 sm:size-4",
                cardExpanded ? "rotate-180" : "",
              )}
              aria-hidden
            />
          </button>
          <div className="min-w-0 flex-1">
            {unit.localCode ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground font-mono text-[10px] font-medium tabular-nums">
                  {unit.localCode}
                </span>
              </div>
            ) : null}
            <p
              className={cn(
                "font-heading text-sm font-semibold leading-snug tracking-tight text-foreground/95 sm:text-[0.9375rem]",
                unit.localCode ? "mt-0.5" : "mt-0.5",
              )}
            >
              {unit.name}
            </p>
            {!cardExpanded &&
            (kids.length > 0 ||
              contactsForUnit.length > 0 ||
              rollup.analysisCount > 0 ||
              rollup.candidateCount > 0 ||
              assessmentCount > 0 ||
              pddCount > 0 ||
              (rollup.intakeSubmissionCount ?? 0) > 0 ||
              (rollup.intakeFormCount ?? 0) > 0) ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {kids.length > 0 && (
                  <span className="text-muted-foreground border-border/40 inline-flex items-center rounded border px-1 py-px text-[9px] font-medium sm:px-1.5 sm:text-[10px]">
                    {kids.length} underenhet{kids.length === 1 ? "" : "er"}
                  </span>
                )}
                {contactsForUnit.length > 0 && (
                  <span className="text-muted-foreground border-border/40 inline-flex items-center rounded border px-1 py-px text-[9px] font-medium sm:px-1.5 sm:text-[10px]">
                    {contactsForUnit.length} kontakt{contactsForUnit.length === 1 ? "" : "er"}
                  </span>
                )}
                {pddCount > 0 && (
                  <span className="inline-flex items-center rounded border border-blue-500/20 bg-blue-500/10 px-1 py-px text-[9px] font-medium text-blue-700 dark:text-blue-300 sm:px-1.5 sm:text-[10px]">
                    {pddCount} PDD
                  </span>
                )}
              </div>
            ) : null}
            {cardExpanded && unit.shortName ? (
              <p className="text-muted-foreground mt-1.5 text-sm">{unit.shortName}</p>
            ) : null}
            {cardExpanded && unit.extraInfo ? (
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed whitespace-pre-wrap">
                {unit.extraInfo}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-border/30 border-t px-2 py-2 sm:px-3 sm:py-2">
          <OrgUnitTreeOverviewStrip
            compact
            workspaceId={workspaceId}
            stats={rollup}
          />
        </div>

        {cardExpanded ? (
          <>
            <div className="border-t border-border/35 px-4 py-3 sm:px-5">
              <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                <div className="flex items-start gap-2.5">
                  <div className="bg-blue-500/10 text-blue-700 dark:text-blue-300 flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Workflow className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Prosessdesign (RPA)
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {pddCount > 0
                            ? `${pddCount} vurdering${pddCount === 1 ? "" : "er"} med påbegynt prosessdesign i denne grenen`
                            : "Ingen påbegynte prosessdesign i denne grenen ennå"}
                        </p>
                      </div>
                      <Link
                        href={`/w/${workspaceId}/prosessdesign`}
                        className="text-primary text-[11px] font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Åpne prosessdesign
                      </Link>
                    </div>
                    {assessmentCount > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-full border border-border/50 bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                          {pddCompletedCount} ferdig dokumentert
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border/50 bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                          {Math.max(
                            assessmentCount - pddCompletedCount,
                            0,
                          )} gjenstår / pågår
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <details
              className="group border-t border-border/35"
              open={rosPanelOpen}
              onToggle={(e) => setRosPanelOpen(e.currentTarget.open)}
            >
              <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors sm:px-5 [&::-webkit-details-marker]:hidden">
                <div className="bg-muted/50 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Shield className="size-3.5" aria-hidden />
                </div>
                <span className="min-w-0 flex-1 font-medium leading-tight">
                  <span className="text-foreground">ROS</span>
                  <span className="text-muted-foreground ml-1.5 block text-xs font-normal sm:inline sm:ml-1.5">
                    {hasRosActivity
                      ? `${rollup.analysisCount} analyse${rollup.analysisCount === 1 ? "" : "r"} · ${rollup.candidateCount} prosess${rollup.candidateCount === 1 ? "" : "er"}`
                      : "Ingen data i treet"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/w/${workspaceId}/ros`}
                    className="text-primary text-[11px] font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Åpne ROS
                  </Link>
                  <ChevronRight className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
                </span>
              </summary>
              <div className="border-border/25 bg-muted/5 border-t px-4 pb-3 pt-2 sm:px-5">
                <OrgUnitRosKpiStrip
                  embedded
                  workspaceId={workspaceId}
                  stats={rollup}
                  variant="full"
                />
              </div>
            </details>

            <details
              className="group border-t border-border/35"
              open={contactsPanelOpen}
              onToggle={(e) => setContactsPanelOpen(e.currentTarget.open)}
            >
              <summary className="hover:bg-muted/30 flex cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors sm:px-5 [&::-webkit-details-marker]:hidden">
                <div className="bg-muted/50 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Users className="size-3.5" aria-hidden />
                </div>
                <span className="min-w-0 flex-1 font-medium leading-tight">
                  <span className="text-foreground">Kontaktpersoner</span>
                  <span className="text-muted-foreground ml-1.5 block text-xs font-normal sm:inline sm:ml-1.5">
                    {contactsForUnit.length > 0
                      ? `${contactsForUnit.length} registrert${contactsForUnit.length === 1 ? "" : "e"}`
                      : hasLegacyUnit
                        ? "Eldre registrering"
                        : "Ingen ennå"}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-border/35 border-t px-4 pb-3 pt-2 sm:px-5">
                <MerkantilContactsBlock
                  embedded
                  unit={unit}
                  contacts={contactsForUnit}
                  canEdit={canEdit}
                />
              </div>
            </details>
          </>
        ) : (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/25 w-full border-t border-border/25 px-4 py-2.5 text-left text-xs font-medium transition-colors sm:px-5"
            onClick={() => setCardExpanded(true)}
          >
            Vis ROS, kontakter og mer …
          </button>
        )}

        {canEdit ? (
          <div className="border-border/25 flex items-center justify-end gap-0.5 rounded-b-2xl border-t bg-muted/[0.03] px-2 py-1.5 sm:px-3">
            {moveParentOptions.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground size-10 min-h-10 min-w-10 shrink-0 rounded-xl sm:size-9 sm:min-h-9 sm:min-w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveSelectValue(
                    unit.parentId ? String(unit.parentId) : "",
                  );
                  setMoveOpen(true);
                }}
                aria-label={`Flytt ${unit.name}`}
                title="Flytt til annen overordnet"
              >
                <ArrowRightLeft className="size-4 opacity-80" aria-hidden />
              </Button>
            ) : null}
            {isAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive size-10 min-h-10 min-w-10 shrink-0 rounded-xl disabled:opacity-40 sm:size-9 sm:min-h-9 sm:min-w-9"
                disabled={kids.length > 0}
                title={
                  kids.length > 0
                    ? `Kan ikke slette: ${kids.length} underenhet${kids.length === 1 ? "" : "er"}. Flytt eller slett dem først.`
                    : `Slett «${unit.name}»`
                }
                aria-label={
                  kids.length > 0
                    ? "Kan ikke slette — fjern underenheter først"
                    : `Slett ${unit.name}`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <>
          <button
            type="button"
            className={cn(
              "border-border/55 bg-background/95 text-primary hover:bg-primary/10 hover:border-primary/35 absolute left-0 top-1/2 z-30 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-md ring-1 ring-black/[0.04] backdrop-blur-sm transition-[opacity,transform,box-shadow] hover:shadow-lg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 dark:ring-white/[0.06]",
              "touch-manipulation opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              openAddDialog("sibling");
            }}
            aria-label={`Ny enhet ved siden av ${unit.name}`}
            title="Ny på samme nivå (søsken)"
          >
            <Plus className="size-3.5 stroke-[2.5]" aria-hidden />
          </button>
          <button
            type="button"
            className={cn(
              "border-border/55 bg-background/95 text-primary hover:bg-primary/10 hover:border-primary/35 absolute right-0 top-1/2 z-30 flex size-8 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-md ring-1 ring-black/[0.04] backdrop-blur-sm transition-[opacity,transform,box-shadow] hover:shadow-lg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 dark:ring-white/[0.06]",
              "touch-manipulation opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              openAddDialog("sibling");
            }}
            aria-label={`Ny enhet ved siden av ${unit.name}`}
            title="Ny på samme nivå (søsken)"
          >
            <Plus className="size-3.5 stroke-[2.5]" aria-hidden />
          </button>
          <button
            type="button"
            className={cn(
              "border-border/55 bg-background/95 text-primary hover:bg-primary/10 hover:border-primary/35 absolute bottom-0 left-1/2 z-30 flex size-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border shadow-md ring-1 ring-black/[0.04] backdrop-blur-sm transition-[opacity,transform,box-shadow] hover:shadow-lg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 dark:ring-white/[0.06]",
              "touch-manipulation opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              openAddDialog("child");
            }}
            aria-label={`Ny underenhet under ${unit.name}`}
            title="Ny underenhet"
          >
            <Plus className="size-3.5 stroke-[2.5]" aria-hidden />
          </button>
        </>
      ) : null}
      </div>

      {kids.length > 0 ? (
        <>
          <div
            className={cn(
              "w-0.5 shrink-0 rounded-full bg-foreground/38 ring-2 ring-muted/90 dark:bg-foreground/48 dark:ring-muted",
              kids.length === 1 ? "h-8" : "h-5",
            )}
            aria-hidden
          />
          <div
            className="relative w-full min-w-max max-w-[min(100vw-2rem,72rem)] px-1"
            role="group"
            aria-label={`Underenheter av ${unit.name}`}
          >
            <div
              className={cn(
                "grid w-full gap-x-3 gap-y-5",
                kids.length > 1 &&
                  "border-t-2 border-foreground/25 pt-5 dark:border-foreground/32",
                kids.length === 1 && "justify-items-center",
              )}
              style={{
                gridTemplateColumns: `repeat(${kids.length}, minmax(168px, 1fr))`,
              }}
            >
              {kids.map((ch) => (
                <div
                  key={ch._id}
                  className="flex flex-col items-center"
                >
                  {kids.length > 1 ? (
                    <div
                      className="mb-0 h-3 w-0.5 shrink-0 rounded-full bg-foreground/38 ring-2 ring-muted/90 dark:bg-foreground/48 dark:ring-muted"
                      aria-hidden
                    />
                  ) : null}
                  <OrgBranch
                    workspaceId={workspaceId}
                    unit={ch}
                    parentOfUnit={unit}
                    childrenByParent={childrenByParent}
                    allOrgUnits={allOrgUnits}
                    contactsByUnit={contactsByUnit}
                    rosByUnit={rosByUnit}
                    depth={depth + 1}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                    onRemove={onRemove}
                    onMove={onMove}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {canEdit ? (
        <Dialog
          open={addDialog !== null}
          onOpenChange={(o) => {
            if (!o) closeAddDialog();
          }}
        >
          <DialogContent
            size="md"
            titleId={addDialogTitleId}
            className="max-h-[min(92vh,40rem)]"
          >
            <DialogHeader className="px-5 py-4 sm:px-6 sm:py-4">
              <h2
                id={addDialogTitleId}
                className="text-foreground text-lg font-semibold tracking-tight"
              >
                {addDialog === "child"
                  ? (() => {
                      const k =
                        unit.kind === "helseforetak"
                          ? ORG_UNIT_KIND_LABELS.avdeling
                          : unit.kind === "avdeling"
                            ? ORG_UNIT_KIND_LABELS.seksjon
                            : unit.kind === "seksjon" || unit.kind === "team"
                              ? ORG_UNIT_KIND_LABELS.team
                              : "";
                      return `Ny ${k} under ${unit.name}`;
                    })()
                  : addDialog === "sibling"
                    ? unit.kind === "helseforetak" && !parentOfUnit
                      ? `Ny hovedenhet ved siden av ${unit.name}`
                      : parentOfUnit
                        ? `Ny ${ORG_UNIT_KIND_LABELS[unit.kind]} ved siden av ${unit.name}`
                        : `Ny ${ORG_UNIT_KIND_LABELS[unit.kind]} ved siden av ${unit.name}`
                    : ""}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-snug">
                {addDialog === "child"
                  ? "Opprettes ett nivå under denne enheten i treet."
                  : addDialog === "sibling"
                    ? "Får samme overordnede enhet som noden du står på."
                    : ""}
              </p>
            </DialogHeader>
            <DialogBody className="px-5 py-4 sm:px-6 sm:py-4">
              {addDialog === "child" ? (
                <AddChildFormFields
                  formId={`form-add-child-${unit._id}`}
                  workspaceId={unit.workspaceId}
                  parent={unit}
                  onSuccessfulCreate={(newId) => {
                    closeAddDialog();
                    if (newId) orgChartCtx?.onCardSurfaceActivate(newId);
                  }}
                />
              ) : null}
              {addDialog === "sibling" ? (
                <AddSiblingFormFields
                  formId={`form-add-sibling-${unit._id}`}
                  workspaceId={unit.workspaceId}
                  siblingOf={unit}
                  onSuccessfulCreate={(newId) => {
                    closeAddDialog();
                    if (newId) orgChartCtx?.onCardSurfaceActivate(newId);
                  }}
                />
              ) : null}
            </DialogBody>
          </DialogContent>
        </Dialog>
      ) : null}
      {isAdmin ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent
            size="sm"
            titleId={`org-del-${unit._id}`}
            className="max-h-[min(92vh,28rem)]"
          >
            <DialogHeader className="px-5 py-4 sm:px-6 sm:py-4">
              <h2
                id={`org-del-${unit._id}`}
                className="text-foreground text-lg font-semibold tracking-tight"
              >
                Slette «{unit.name}»?
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Enheten fjernes fra organisasjonskartet. Hvis den fortsatt er
                knyttet til vurderinger, prosesser, ROS eller inntaksskjema, får
                du en tydelig melding om hva som må ryddes først.
              </p>
            </DialogHeader>
            <DialogFooter className="px-5 pb-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="rounded-lg"
                disabled={deleteBusy}
                onClick={() => {
                  void (async () => {
                    setDeleteBusy(true);
                    try {
                      await onRemove(unit._id);
                      toast.success("Enheten er slettet.");
                      setDeleteOpen(false);
                    } catch (e) {
                      toast.error(
                        formatUserFacingError(e, "Kunne ikke slette enheten."),
                      );
                    } finally {
                      setDeleteBusy(false);
                    }
                  })();
                }}
              >
                {deleteBusy ? "Sletter …" : "Slett"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {canEdit && moveParentOptions.length > 0 ? (
        <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
          <DialogContent
            size="md"
            titleId={`org-move-${unit._id}`}
            className="max-h-[min(92vh,36rem)]"
          >
            <DialogHeader className="px-5 py-4 sm:px-6 sm:py-4">
              <h2
                id={`org-move-${unit._id}`}
                className="text-foreground text-lg font-semibold tracking-tight"
              >
                Flytt «{unit.name}»
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {unit.kind === "avdeling"
                  ? "Velg hvilket hovedselskap (HF) avdelingen skal ligge under."
                  : unit.kind === "seksjon"
                    ? "Velg hvilken avdeling teamet skal ligge under."
                    : "Velg hvilken seksjon eller team-enhet denne enheten skal ligge under."}
              </p>
            </DialogHeader>
            <DialogBody className="space-y-2 px-5 pb-2 sm:px-6">
              <Label htmlFor={`move-parent-${unit._id}`}>Overordnet enhet</Label>
              <select
                id={`move-parent-${unit._id}`}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                value={moveSelectValue}
                onChange={(e) => setMoveSelectValue(e.target.value)}
              >
                {moveParentOptions.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </DialogBody>
            <DialogFooter className="px-5 pb-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                disabled={moveBusy}
                onClick={() => setMoveOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                className="rounded-lg"
                disabled={moveBusy || !moveSelectValue}
                onClick={() => {
                  void (async () => {
                    if (!moveSelectValue) {
                      toast.error("Velg overordnet enhet.");
                      return;
                    }
                    setMoveBusy(true);
                    try {
                      await onMove(
                        unit._id,
                        moveSelectValue as Id<"orgUnits">,
                      );
                      toast.success("Enheten er flyttet.");
                      setMoveOpen(false);
                    } catch (e) {
                      toast.error(
                        formatUserFacingError(e, "Kunne ikke flytte enheten."),
                      );
                    } finally {
                      setMoveBusy(false);
                    }
                  })();
                }}
              >
                {moveBusy ? "Flytter …" : "Flytt hit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function AddChildFormFields({
  formId,
  workspaceId,
  parent,
  onSuccessfulCreate,
}: {
  formId: string;
  workspaceId: Id<"workspaces">;
  parent: Doc<"orgUnits">;
  onSuccessfulCreate: (newUnitId?: Id<"orgUnits">) => void;
}) {
  const create = useMutation(api.orgUnits.create);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const childKind =
    parent.kind === "helseforetak"
      ? ("avdeling" as const)
      : parent.kind === "avdeling"
        ? ("seksjon" as const)
        : parent.kind === "seksjon" || parent.kind === "team"
          ? ("team" as const)
          : null;

  if (childKind === null) {
    return null;
  }
  const kindForChild: "avdeling" | "seksjon" | "team" = childKind;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const newId = await create({
        workspaceId,
        parentId: parent._id,
        kind: kindForChild,
        name,
        extraInfo: extra.trim() || undefined,
      });
      setName("");
      setExtra("");
      onSuccessfulCreate(newId);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Kunne ikke opprette.");
    }
  }

  return (
    <form id={formId} onSubmit={(e) => void submit(e)} className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`${formId}-name`} className="text-xs">
            Navn
          </Label>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="F.eks. Salg Nord eller HR"
            className="rounded-xl"
            autoFocus
          />
        </div>
        <details className="group rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1">
              Valgfritt · tilleggsinfo
              <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
            </span>
          </summary>
          <div className="mt-2 space-y-1">
            <Label htmlFor={`${formId}-extra`} className="sr-only">
              Annen informasjon
            </Label>
            <Textarea
              id={`${formId}-extra`}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={2}
              placeholder="Koststed, lokasjon, særlige forhold …"
              className="rounded-xl text-sm"
            />
          </div>
        </details>
      </div>
      {msg ? (
        <p className="text-destructive text-sm" role="alert">
          {msg}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" size="sm" className="rounded-xl" disabled={!name.trim()}>
          Opprett underenhet
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl text-muted-foreground"
          onClick={() => onSuccessfulCreate()}
        >
          Avbryt
        </Button>
      </div>
    </form>
  );
}

function AddSiblingFormFields({
  formId,
  workspaceId,
  siblingOf,
  onSuccessfulCreate,
}: {
  formId: string;
  workspaceId: Id<"workspaces">;
  siblingOf: Doc<"orgUnits">;
  onSuccessfulCreate: (newUnitId?: Id<"orgUnits">) => void;
}) {
  const create = useMutation(api.orgUnits.create);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [localCode, setLocalCode] = useState("");
  const [extra, setExtra] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const kind = siblingOf.kind;

  if (kind !== "helseforetak" && siblingOf.parentId === undefined) {
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      let newId: Id<"orgUnits">;
      if (kind === "helseforetak") {
        newId = await create({
          workspaceId,
          parentId: null,
          kind: "helseforetak",
          name,
          shortName: shortName.trim() || undefined,
          localCode: localCode.trim() || undefined,
          extraInfo: extra.trim() || undefined,
        });
      } else {
        const p = siblingOf.parentId;
        if (!p) {
          setMsg("Manglende overordnet enhet.");
          return;
        }
        newId = await create({
          workspaceId,
          parentId: p,
          kind,
          name,
          extraInfo: extra.trim() || undefined,
        });
      }
      setName("");
      setShortName("");
      setLocalCode("");
      setExtra("");
      onSuccessfulCreate(newId);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Kunne ikke opprette.");
    }
  }

  return (
    <form id={formId} onSubmit={(e) => void submit(e)} className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`${formId}-sib-name`} className="text-xs">
            Navn
          </Label>
          <Input
            id={`${formId}-sib-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={
              kind === "helseforetak"
                ? "F.eks. annet HF eller konsern"
                : "F.eks. Salg Nord eller HR"
            }
            className="rounded-xl"
            autoFocus
          />
        </div>
        {kind === "helseforetak" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label
                htmlFor={`${formId}-sib-short`}
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Kortnavn (valgfritt)
              </Label>
              <Input
                id={`${formId}-sib-short`}
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="F.eks. kortnavn"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor={`${formId}-sib-code`}
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Intern kode (valgfritt)
              </Label>
              <Input
                id={`${formId}-sib-code`}
                value={localCode}
                onChange={(e) => setLocalCode(e.target.value)}
                placeholder="F.eks. ID"
                className="rounded-xl"
              />
            </div>
          </div>
        ) : null}
        <details className="group rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1">
              Valgfritt · tilleggsinfo
              <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
            </span>
          </summary>
          <div className="mt-2 space-y-1">
            <Label htmlFor={`${formId}-sib-extra`} className="sr-only">
              Annen informasjon
            </Label>
            <Textarea
              id={`${formId}-sib-extra`}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={2}
              placeholder="Koststed, lokasjon, særlige forhold …"
              className="rounded-xl text-sm"
            />
          </div>
        </details>
      </div>
      {msg ? (
        <p className="text-destructive text-sm" role="alert">
          {msg}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" size="sm" className="rounded-xl" disabled={!name.trim()}>
          Opprett
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl text-muted-foreground"
          onClick={() => onSuccessfulCreate()}
        >
          Avbryt
        </Button>
      </div>
    </form>
  );
}

function AddRootOrganizationForm({
  workspaceId,
  defaultExpanded = false,
}: {
  workspaceId: Id<"workspaces">;
  defaultExpanded?: boolean;
}) {
  const create = useMutation(api.orgUnits.create);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [localCode, setLocalCode] = useState("");
  const [extra, setExtra] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      if (typeof window !== "undefined" && window.location.hash === "#ny-hovedenhet") {
        setExpanded(true);
      }
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await create({
        workspaceId,
        parentId: null,
        kind: "helseforetak",
        name,
        shortName: shortName.trim() || undefined,
        localCode: localCode.trim() || undefined,
        extraInfo: extra.trim() || undefined,
      });
      setName("");
      setShortName("");
      setLocalCode("");
      setExtra("");
      setMsg("Hovedenhet opprettet.");
      setExpanded(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Kunne ikke opprette.");
    }
  }

  return (
    <div
      id="ny-hovedenhet"
      className="scroll-mt-28 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
    >
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="border-border/50 hover:bg-muted/30 flex w-full items-center gap-4 border border-dashed px-4 py-4 text-left transition-colors sm:px-5 sm:py-5"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Plus className="size-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-foreground font-semibold tracking-tight sm:text-lg">
              Ny hovedenhet
            </p>
            <p className="text-muted-foreground text-sm leading-snug">
              Rot-nivå (selskap, HF, kommune …) — trykk for å fylle ut
            </p>
          </div>
          <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
        </button>
      ) : (
        <>
          <div className="border-border/40 bg-muted/10 flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Building2 className="size-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold tracking-tight sm:text-xl">
                  Ny hovedenhet
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Rot-nivå i kartet — typisk selskap, konsern eller juridisk enhet.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => {
                setExpanded(false);
                setMsg(null);
              }}
            >
              Lukk
            </Button>
          </div>
          <div className="px-4 py-5 sm:px-6">
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label
                    htmlFor="hf-name"
                    className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Navn
                  </Label>
                  <Input
                    id="hf-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="F.eks. Acme AS, Kommune X, eller Helseforetak Y"
                    className="h-11 rounded-xl text-base"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="hf-short"
                    className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Kortnavn (valgfritt)
                  </Label>
                  <Input
                    id="hf-short"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    placeholder="F.eks. Acme"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="hf-code"
                    className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Intern kode (valgfritt)
                  </Label>
                  <Input
                    id="hf-code"
                    value={localCode}
                    onChange={(e) => setLocalCode(e.target.value)}
                    placeholder="F.eks. regnskapskode eller avdelings-ID"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <details className="group rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                <summary className="text-muted-foreground cursor-pointer list-none text-xs font-medium [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1">
                    Valgfritt · tilleggsinformasjon
                    <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                  </span>
                </summary>
                <div className="mt-2 space-y-1.5">
                  <Label htmlFor="hf-extra" className="sr-only">
                    Tilleggsinformasjon
                  </Label>
                  <Textarea
                    id="hf-extra"
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    rows={3}
                    placeholder="F.eks. organisasjonsnummer, hovedkontor, felles tjenester …"
                    className="min-h-[5.5rem] rounded-xl"
                  />
                </div>
              </details>
              {msg ? (
                <p
                  className={cn(
                    "text-sm",
                    msg.includes("opprettet")
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                  role="status"
                >
                  {msg}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-xl px-6 font-semibold shadow-sm"
                  disabled={!name.trim()}
                >
                  Opprett hovedenhet
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="text-muted-foreground rounded-xl"
                  onClick={() => {
                    setExpanded(false);
                    setMsg(null);
                  }}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

const ORG_CHART_ZOOM_MIN = 0.22;
const ORG_CHART_ZOOM_MAX = 2.5;
const ORG_CHART_ZOOM_STEP = 1.1;
/** Standard startvisning: litt zoomet ut + kompakte kort gir bedre oversikt. */
const ORG_CHART_ZOOM_INITIAL = 0.88;

function clampOrgChartZoom(z: number) {
  return Math.min(ORG_CHART_ZOOM_MAX, Math.max(ORG_CHART_ZOOM_MIN, z));
}

export function OrgChartPanel({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const rows = useQuery(api.orgUnits.listByWorkspace, { workspaceId });
  const allContacts = useQuery(api.orgUnits.listContactsByWorkspace, {
    workspaceId,
  });
  const removeUnit = useMutation(api.orgUnits.remove);
  const moveUnit = useMutation(api.orgUnits.move);
  const rosRollup = useQuery(api.orgUnits.rosRollupByOrgUnit, { workspaceId });

  const handleRemoveOrgUnit = useCallback(
    async (id: Id<"orgUnits">) => {
      await removeUnit({ orgUnitId: id });
    },
    [removeUnit],
  );

  const handleMoveOrgUnit = useCallback(
    async (orgUnitId: Id<"orgUnits">, newParentId: Id<"orgUnits"> | null) => {
      await moveUnit({ orgUnitId, newParentId });
    },
    [moveUnit],
  );

  const canEdit =
    membership &&
    (membership.role === "owner" ||
      membership.role === "admin" ||
      membership.role === "member");
  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  const { roots, childrenByParent } = useMemo(() => {
    if (!rows) {
      return {
        roots: [] as Doc<"orgUnits">[],
        childrenByParent: new Map<string, Doc<"orgUnits">[]>(),
      };
    }
    const m = new Map<string, Doc<"orgUnits">[]>();
    for (const r of rows) {
      const key = r.parentId ?? "__root__";
      if (!m.has(key)) {
        m.set(key, []);
      }
      m.get(key)!.push(r);
    }
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb"),
      );
    }
    return {
      roots: m.get("__root__") ?? [],
      childrenByParent: m,
    };
  }, [rows]);

  const contactsByUnit = useMemo(() => {
    const m = new Map<Id<"orgUnits">, Doc<"orgUnitContacts">[]>();
    if (!allContacts) {
      return m;
    }
    for (const c of allContacts) {
      if (!m.has(c.orgUnitId)) {
        m.set(c.orgUnitId, []);
      }
      m.get(c.orgUnitId)!.push(c);
    }
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb"),
      );
    }
    return m;
  }, [allContacts]);

  const [chartZoom, setChartZoom] = useState(ORG_CHART_ZOOM_INITIAL);
  const [chartPanMode, setChartPanMode] = useState(false);
  const [chartIsPanning, setChartIsPanning] = useState(false);
  const chartZoomRef = useRef(chartZoom);
  useEffect(() => {
    chartZoomRef.current = chartZoom;
  }, [chartZoom]);
  const pinchBaseZoomRef = useRef(1);
  const chartViewportRef = useRef<HTMLDivElement>(null);
  const chartHostRef = useRef<HTMLDivElement>(null);
  const [chartIsFullscreen, setChartIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const host = chartHostRef.current;
      setChartIsFullscreen(
        !!host && document.fullscreenElement === host,
      );
    };
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleChartFullscreen = useCallback(async () => {
    const el = chartHostRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Må koble wheel etter at viewport finnes i DOM. Første render kan være
   * lasteskjelett uten ref — da ble lytter aldri registrert med []-deps.
   */
  useEffect(() => {
    const el = chartViewportRef.current;
    if (!el) return;

    /**
     * Zoom kun med Ctrl (Win/Linux) eller Cmd (macOS) + hjul — standard for
     * «pinch-to-zoom»-simulering på trackpad i Chrome/Safari.
     * Uten modifikator: vanlig vertikal rulling i viewport (pan).
     * Shift+hjul: horisontal rulling (ikke zoom).
     * Safari pinch: gesturechange (under).
     */
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        return;
      }
      const zoomChord = e.ctrlKey || e.metaKey;
      if (!zoomChord) {
        return;
      }
      e.preventDefault();
      const dy = e.deltaY;
      if (dy === 0) return;
      // Jevn zoom: liten faktor per piksel (trackpad) og fortsatt fornuftig med musehjul
      const intensity =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 0.18
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? 0.45
            : 0.0085;
      const next = chartZoomRef.current * Math.exp(-dy * intensity);
      setChartZoom(clampOrgChartZoom(next));
    };

    /** Safari / WebKit: sporingsflate pinch (scale relativt til gesturestart). */
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      pinchBaseZoomRef.current = chartZoomRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const scale = (e as unknown as { scale?: number }).scale;
      if (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0) {
        return;
      }
      setChartZoom(clampOrgChartZoom(pinchBaseZoomRef.current * scale));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart, { passive: false });
    el.addEventListener("gesturechange", onGestureChange, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
  }, [rows]);

  const panSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startSl: number;
    startSt: number;
  } | null>(null);

  useEffect(() => {
    const el = chartViewportRef.current;
    if (!el) return;

    const interactiveSelector =
      "button, a, summary, input, textarea, select, label, [role='dialog']";

    const shouldStartPan = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return false;
      const t = e.target as HTMLElement | null;
      if (!t || !el.contains(t)) return false;
      if (t.closest(interactiveSelector)) return false;

      if (e.button === 1) {
        e.preventDefault();
        return true;
      }
      if (e.button !== 0) return false;
      if (e.altKey) return true;
      if (chartPanMode && !t.closest("[data-org-chart-card]")) return true;
      return false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!shouldStartPan(e)) return;
      panSessionRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startSl: el.scrollLeft,
        startSt: el.scrollTop,
      };
      setChartIsPanning(true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = panSessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      el.scrollLeft = s.startSl - (e.clientX - s.startX);
      el.scrollTop = s.startSt - (e.clientY - s.startY);
    };

    const endPan = (e: PointerEvent) => {
      const s = panSessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      panSessionRef.current = null;
      setChartIsPanning(false);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPan);
    el.addEventListener("pointercancel", endPan);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPan);
      el.removeEventListener("pointercancel", endPan);
    };
  }, [chartPanMode, rows]);

  const zoomOut = useCallback(() => {
    setChartZoom((z) => clampOrgChartZoom(z / ORG_CHART_ZOOM_STEP));
  }, []);
  const zoomIn = useCallback(() => {
    setChartZoom((z) => clampOrgChartZoom(z * ORG_CHART_ZOOM_STEP));
  }, []);
  const resetZoom = useCallback(
    () => setChartZoom(ORG_CHART_ZOOM_INITIAL),
    [],
  );

  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const registerCardRef = useCallback(
    (id: Id<"orgUnits">, el: HTMLDivElement | null) => {
      if (el) {
        cardRefs.current.set(id, el);
      } else {
        cardRefs.current.delete(id);
      }
    },
    [],
  );

  const [highlightedUnitId, setHighlightedUnitId] = useState<Id<"orgUnits"> | null>(
    null,
  );
  const [focusPulse, setFocusPulse] = useState<{
    id: Id<"orgUnits">;
    token: number;
  } | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const orgSearchWrapRef = useRef<HTMLDivElement | null>(null);

  const onCardSurfaceActivate = useCallback((id: Id<"orgUnits">) => {
    setHighlightedUnitId(id);
    setChartZoom((z) => clampOrgChartZoom(z < 1 ? 1 : z));
    setFocusPulse({ id, token: Date.now() });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cardRefs.current.get(id)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      });
    });
  }, []);

  const interactionValue = useMemo<OrgChartInteraction>(
    () => ({
      registerCardRef,
      focusPulse,
      highlightedUnitId,
      onCardSurfaceActivate,
    }),
    [
      registerCardRef,
      focusPulse,
      highlightedUnitId,
      onCardSurfaceActivate,
    ],
  );

  const orgSearchMatches = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q || rows === undefined) return [];
    return rows.filter((u) => {
      if (u.name.toLowerCase().includes(q)) return true;
      const code = u.localCode?.trim().toLowerCase() ?? "";
      return code.length > 0 && code.includes(q);
    });
  }, [rows, orgSearch]);

  if (
    rows === undefined ||
    membership === undefined ||
    allContacts === undefined
  ) {
    return (
      <div className="space-y-4" aria-busy>
        <div className="bg-muted/40 h-36 animate-pulse rounded-2xl ring-1 ring-border/40" />
        <div className="bg-muted/30 h-24 animate-pulse rounded-xl ring-1 ring-border/30" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <details className="group border-border/50 bg-muted/25 open:bg-muted/35 rounded-2xl border px-4 py-3 shadow-sm ring-1 ring-black/[0.04] transition-colors dark:ring-white/[0.05]">
        <summary className="cursor-pointer list-none leading-snug [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2.5">
            <span className="bg-background/80 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 shadow-sm">
              <Layers className="size-4" aria-hidden />
            </span>
            <span className="text-foreground font-medium">
              Slik fungerer organisasjonskartet
            </span>
            <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0 transition-transform duration-200 group-open:rotate-90" />
          </span>
        </summary>
        <div className="text-muted-foreground mt-4 space-y-3 border-t border-border/50 pt-4 text-sm leading-relaxed">
          <p>
            Strukturen starter med <strong className="text-foreground font-medium">selskap eller konsern</strong>,
            deretter avdeling eller forretningsenhet, så team eller seksjon — og du kan legge til{" "}
            <strong className="text-foreground font-medium">flere team-nivåer</strong> under en seksjon
            etter behov. Navn tilpasses deres modell.
          </p>
          <p>
            Hvert nivå kan ha{" "}
            <strong className="text-foreground font-medium">kontaktpersoner</strong>{" "}
            (utvid kortet). Bruk knappen «Vis detaljer» eller snarveien under
            oversiktsraden for å vise eller skjule ROS, kontakter og mer tekst.
            Underenheter vises i trestruktur med tydelige linjer mellom nivåene (tilpasset lys og mørk modus).
          </p>
          <p>
            <strong className="text-foreground font-medium">Zoom</strong> med knappene over kartet,{" "}
            <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>{" "}
            (Mac: <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">⌘</kbd>
            ) + musehjul eller to fingre på styreflate, eller knip i Safari.{" "}
            <strong className="text-foreground font-medium">Flytt utsnitt:</strong> aktiver «Dra kart» og dra i
            området utenfor kortene, eller hold{" "}
            <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Alt</kbd>{" "}
            (Mac: Valg) og dra med mus; midtknapp fungerer også.
          </p>
          <p>
            <strong className="text-foreground font-medium">+</strong> til venstre eller høyre
            på kortet (ved peker over kortet på større skjerm) oppretter en søskenenhet;{" "}
            <strong className="text-foreground font-medium">+</strong> under kortet legger til
            ett nivå under (f.eks. team under seksjon, eller team under team). Flytt og slett finner du nederst i
            kortet.
          </p>
          <p>
            Under enhetsnavnet vises en <strong className="text-foreground font-medium">firfeltet oversikt</strong>{" "}
            (prosess, ROS, PDD, vurdering, inntak): tallene omfatter underenheter og er snarveier til
            arbeidsflatene.
          </p>
        </div>
      </details>

      {canEdit ? (
        <AddRootOrganizationForm
          workspaceId={workspaceId}
          defaultExpanded={roots.length === 0}
        />
      ) : null}

      {rosRollup &&
      (rosRollup.unassigned.candidateCount > 0 ||
        rosRollup.unassigned.analysisCount > 0 ||
        (rosRollup.unassigned.assessmentCount ?? 0) > 0 ||
        (rosRollup.unassigned.intakeSubmissionCount ?? 0) > 0 ||
        (rosRollup.unassigned.intakeFormCount ?? 0) > 0) ? (
        <div className="border-border/50 bg-amber-500/[0.07] rounded-2xl border px-4 py-3 ring-1 ring-amber-500/20">
          <p className="text-foreground text-sm font-medium">
            Elementer uten plass i organisasjonstreet
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {(() => {
              const u = rosRollup.unassigned;
              const bits: string[] = [];
              if (u.candidateCount > 0) {
                bits.push(
                  `${u.candidateCount} prosess${u.candidateCount === 1 ? "" : "er"} uten enhet`,
                );
              }
              if (u.analysisCount > 0) {
                bits.push(
                  `${u.analysisCount} ROS-analyse${u.analysisCount === 1 ? "" : "r"} (via prosess uten enhet)`,
                );
              }
              const ac = u.assessmentCount ?? 0;
              if (ac > 0) {
                bits.push(
                  `${ac} PVV-vurdering${ac === 1 ? "" : "er"} uten org.-enhet`,
                );
              }
              const ic = u.intakeSubmissionCount ?? 0;
              if (ic > 0) {
                bits.push(
                  `${ic} inntak (godkjent eller mangler enhet på vurdering)`,
                );
              }
              const fc = u.intakeFormCount ?? 0;
              if (fc > 0) {
                bits.push(
                  `${fc} inntaksskjema uten org.-enhet`,
                );
              }
              return (
                <>
                  {bits.join(" · ")}. Knytt til enhet der det er mulig for riktig trevisning.
                </>
              );
            })()}
          </p>
          <div className="mt-3">
            <OrgUnitRosKpiStrip
              workspaceId={workspaceId}
              stats={rosRollup.unassigned}
              variant="full"
            />
          </div>
        </div>
      ) : null}

      {roots.length === 0 ? (
        <div className="border-border/50 from-muted/20 to-card/80 rounded-2xl border border-dashed bg-gradient-to-b px-6 py-12 text-center shadow-inner">
          <div className="bg-muted/60 mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl">
            <Building2 className="text-muted-foreground size-7" aria-hidden />
          </div>
          <p className="text-foreground font-medium">Ingen enheter ennå</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
            {canEdit
              ? "Start med å opprette en hovedenhet over — deretter kan du legge til avdelinger og team under."
              : "En administrator må opprette organisasjonsstrukturen."}
          </p>
        </div>
      ) : (
        <OrgChartInteractionContext.Provider value={interactionValue}>
        <div
          ref={chartHostRef}
          className={cn(
            "border-border/50 bg-muted/5 flex flex-col gap-3 rounded-2xl border p-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
            "[&:fullscreen]:border-0 [&:fullscreen]:bg-background [&:fullscreen]:p-3 [&:fullscreen]:shadow-none [&:fullscreen]:ring-0",
            "[&:fullscreen]:fixed [&:fullscreen]:inset-0 [&:fullscreen]:z-[100] [&:fullscreen]:h-[100dvh] [&:fullscreen]:max-h-[100dvh] [&:fullscreen]:min-h-0 [&:fullscreen]:flex-col [&:fullscreen]:overflow-x-hidden",
            "[&:fullscreen]:p-2 [&:fullscreen]:pt-[max(0.5rem,env(safe-area-inset-top))] [&:fullscreen]:pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:[&:fullscreen]:p-3",
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-3",
              chartIsFullscreen && "min-h-0 flex-1",
            )}
          >
            {chartIsFullscreen ? (
              <div className="relative z-20 flex min-w-0 shrink-0 flex-row flex-wrap items-center gap-2 overflow-visible border-b border-border/40 pb-2">
                <div
                  ref={orgSearchWrapRef}
                  className="relative z-30 min-w-0 max-w-none flex-1 overflow-visible sm:max-w-[min(100%,28rem)]"
                >
                  <SearchInput
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    placeholder="Søk etter enhet eller kode …"
                    aria-label="Søk i organisasjonskartet"
                    aria-controls="org-chart-search-results"
                    aria-expanded={
                      orgSearch.trim().length > 0 && orgSearchMatches.length > 0
                    }
                  />
                  {orgSearch.trim().length > 0 && orgSearchMatches.length > 0 ? (
                    <ul
                      id="org-chart-search-results"
                      role="listbox"
                      className="border-border/60 bg-card absolute left-0 right-0 top-full z-[200] mt-1.5 max-h-60 overflow-auto rounded-xl border py-1 shadow-lg ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                    >
                      {orgSearchMatches.slice(0, 14).map((u) => (
                        <li key={u._id} role="presentation">
                          <button
                            type="button"
                            role="option"
                            className="hover:bg-muted/80 flex w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm transition-colors"
                            onClick={() => {
                              onCardSurfaceActivate(u._id);
                              setOrgSearch("");
                            }}
                          >
                            <span className="text-foreground min-w-0 flex-1 font-medium leading-snug">
                              {u.name}
                            </span>
                            {u.localCode?.trim() ? (
                              <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
                                {u.localCode.trim()}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : orgSearch.trim().length > 0 && orgSearchMatches.length === 0 ? (
                    <p className="border-border/60 bg-card text-muted-foreground absolute left-0 right-0 top-full z-[200] mt-1.5 rounded-xl border px-3 py-2.5 text-xs shadow-lg ring-1 ring-black/[0.06]">
                      Ingen treff — prøv et annet søkeord.
                    </p>
                  ) : null}
                </div>
                <div
                  className="bg-muted/30 border-border/60 inline-flex min-w-0 shrink-0 flex-wrap items-center gap-0.5 overflow-x-auto rounded-xl border p-0.5 shadow-inner [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="toolbar"
                  aria-label="Visning og zoom"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-10 min-h-10 min-w-10 shrink-0 touch-manipulation rounded-lg px-0"
                    onClick={() => void toggleChartFullscreen()}
                    aria-pressed={chartIsFullscreen}
                    aria-label="Avslutt fullskjerm for kart"
                    title="Avslutt fullskjerm"
                  >
                    <Minimize2 className="mx-auto size-4" aria-hidden />
                  </Button>
                  <div className="bg-border mx-0.5 h-6 w-px shrink-0 self-center" aria-hidden />
                  <Button
                    type="button"
                    variant={chartPanMode ? "secondary" : "ghost"}
                    size="sm"
                    className="size-10 min-h-10 min-w-10 shrink-0 touch-manipulation rounded-lg px-0"
                    onClick={() => setChartPanMode((v) => !v)}
                    aria-pressed={chartPanMode}
                    aria-label="Dra for å flytte kartet"
                    title="Dra-kart: dra i bakgrunnen utenfor kort, eller hold Alt og dra. Midtklikk panorerer også."
                  >
                    <Hand className="mx-auto size-4" aria-hidden />
                  </Button>
                  <div className="bg-border mx-0.5 h-6 w-px shrink-0 self-center" aria-hidden />
                  <div className="flex items-center gap-0.5" role="group" aria-label="Zoom">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-10 min-h-10 min-w-10 touch-manipulation rounded-lg px-0"
                      onClick={zoomOut}
                      disabled={chartZoom <= ORG_CHART_ZOOM_MIN + 1e-6}
                      aria-label="Zoom ut"
                      title="Zoom ut"
                    >
                      <Minus className="mx-auto size-4" aria-hidden />
                    </Button>
                    <span
                      className="text-muted-foreground tabular-nums min-w-[2.75rem] px-0.5 text-center text-[11px] font-semibold"
                      aria-live="polite"
                    >
                      {Math.round(chartZoom * 100)}%
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-10 min-h-10 min-w-10 touch-manipulation rounded-lg px-0"
                      onClick={zoomIn}
                      disabled={chartZoom >= ORG_CHART_ZOOM_MAX - 1e-6}
                      aria-label="Zoom inn"
                      title="Zoom inn"
                    >
                      <Plus className="mx-auto size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-10 min-h-10 min-w-[2.75rem] shrink-0 touch-manipulation rounded-lg px-1.5 text-[11px] font-semibold"
                      onClick={resetZoom}
                      title={`Tilbakestill til standardvisning (${Math.round(ORG_CHART_ZOOM_INITIAL * 100)} %)`}
                      aria-label={`Tilbakestill zoom til standardvisning ${Math.round(ORG_CHART_ZOOM_INITIAL * 100)} prosent`}
                    >
                      Std
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
                      Organisasjonskart
                    </p>
                    <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                      <strong className="text-foreground font-medium">Trykk på et kort</strong> for å
                      zoome til minst 100 % og sentrere enheten.{" "}
                      <strong className="text-foreground font-medium">Zoom:</strong> knapper, eller hold{" "}
                      <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>
                      /{" "}
                      <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">⌘</kbd>
                      {" "}og rull (mus eller styreflate). <strong className="text-foreground font-medium">Flytt kart:</strong>{" "}
                      «Dra kart» + dra i bakgrunnen,{" "}
                      <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Alt</kbd>{" "}
                      + dra, eller midtknapp. <strong className="text-foreground font-medium">Rull:</strong> to fingre;{" "}
                      <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Shift</kbd>{" "}
                      + scroll for horisontalt.
                    </p>
                  </div>
                  <div
                    ref={orgSearchWrapRef}
                    className="relative w-full min-w-0 shrink-0 lg:max-w-[min(100%,22rem)]"
                  >
                    <SearchInput
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Søk etter enhet eller kode …"
                      aria-label="Søk i organisasjonskartet"
                      aria-controls="org-chart-search-results"
                      aria-expanded={
                        orgSearch.trim().length > 0 && orgSearchMatches.length > 0
                      }
                    />
                    {orgSearch.trim().length > 0 && orgSearchMatches.length > 0 ? (
                      <ul
                        id="org-chart-search-results"
                        role="listbox"
                        className="border-border/60 bg-card absolute left-0 right-0 top-full z-[200] mt-1.5 max-h-60 overflow-auto rounded-xl border py-1 shadow-lg ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                      >
                        {orgSearchMatches.slice(0, 14).map((u) => (
                          <li key={u._id} role="presentation">
                            <button
                              type="button"
                              role="option"
                              className="hover:bg-muted/80 flex w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm transition-colors"
                              onClick={() => {
                                onCardSurfaceActivate(u._id);
                                setOrgSearch("");
                              }}
                            >
                              <span className="text-foreground min-w-0 flex-1 font-medium leading-snug">
                                {u.name}
                              </span>
                              {u.localCode?.trim() ? (
                                <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
                                  {u.localCode.trim()}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : orgSearch.trim().length > 0 && orgSearchMatches.length === 0 ? (
                      <p className="border-border/60 bg-card text-muted-foreground absolute left-0 right-0 top-full z-[200] mt-1.5 rounded-xl border px-3 py-2.5 text-xs shadow-lg ring-1 ring-black/[0.06]">
                        Ingen treff — prøv et annet søkeord.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <div
                    className="bg-muted/30 border-border/60 inline-flex flex-wrap items-center gap-0.5 rounded-2xl border p-1 shadow-inner"
                    role="toolbar"
                    aria-label="Visning og zoom"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 min-h-11 touch-manipulation gap-2 rounded-xl px-3 sm:h-10 sm:min-h-10"
                      onClick={() => void toggleChartFullscreen()}
                      aria-pressed={chartIsFullscreen}
                      aria-label="Fullskjerm for kart"
                      title="Vis kart i fullskjerm"
                    >
                      <Maximize2 className="size-4 shrink-0" aria-hidden />
                      <span className="max-w-[9rem] truncate text-xs font-medium sm:inline">
                        Fullskjerm
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant={chartPanMode ? "secondary" : "ghost"}
                      size="sm"
                      className="h-11 min-h-11 touch-manipulation gap-1.5 rounded-xl px-2.5 sm:h-10 sm:min-h-10 sm:px-3"
                      onClick={() => setChartPanMode((v) => !v)}
                      aria-pressed={chartPanMode}
                      aria-label="Dra for å flytte kartet"
                      title="Dra i bakgrunnen utenfor kort, eller Alt + dra / midtklikk"
                    >
                      <Hand className="size-4 shrink-0" aria-hidden />
                      <span className="max-w-[5.5rem] truncate text-xs font-medium sm:inline">
                        Dra kart
                      </span>
                    </Button>
                    <div
                      className="bg-border mx-0.5 hidden h-7 w-px self-center sm:block"
                      aria-hidden
                    />
                    <div
                      className="flex flex-wrap items-center gap-0.5"
                      role="group"
                      aria-label="Zoom"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-11 min-h-11 min-w-11 touch-manipulation rounded-xl sm:size-10 sm:min-h-10 sm:min-w-10"
                        onClick={zoomOut}
                        disabled={chartZoom <= ORG_CHART_ZOOM_MIN + 1e-6}
                        aria-label="Zoom ut"
                        title="Zoom ut"
                      >
                        <Minus className="size-5 sm:size-4" aria-hidden />
                      </Button>
                      <span
                        className="text-muted-foreground tabular-nums min-w-[3.5rem] px-1 text-center text-xs font-semibold"
                        aria-live="polite"
                      >
                        {Math.round(chartZoom * 100)}%
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-11 min-h-11 min-w-11 touch-manipulation rounded-xl sm:size-10 sm:min-h-10 sm:min-w-10"
                        onClick={zoomIn}
                        disabled={chartZoom >= ORG_CHART_ZOOM_MAX - 1e-6}
                        aria-label="Zoom inn"
                        title="Zoom inn"
                      >
                        <Plus className="size-5 sm:size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-11 min-h-11 touch-manipulation rounded-xl px-3 text-xs font-semibold sm:h-10 sm:min-h-10"
                        onClick={resetZoom}
                        title={`Tilbakestill til standardvisning (${Math.round(ORG_CHART_ZOOM_INITIAL * 100)} %)`}
                        aria-label={`Tilbakestill zoom til standardvisning ${Math.round(ORG_CHART_ZOOM_INITIAL * 100)} prosent`}
                      >
                        Std
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div
              ref={chartViewportRef}
              className={cn(
                "border-border/50 from-muted/15 to-muted/5 max-h-[min(85vh,56rem)] overflow-auto rounded-2xl border bg-gradient-to-b py-5 shadow-inner ring-1 ring-inset ring-foreground/[0.07] overscroll-contain touch-pan-x touch-pan-y",
                "transition-[box-shadow] duration-200",
                chartPanMode && !chartIsPanning && "cursor-grab",
                chartIsPanning && "cursor-grabbing select-none",
                chartIsFullscreen && "relative z-0 max-h-none min-h-0 flex-1",
              )}
              role="tree"
              aria-label="Organisasjonstre"
            >
              <div
                className="flex min-w-min flex-wrap justify-center gap-8 px-5 pb-2 sm:gap-10 sm:px-6"
                style={{
                  zoom: chartZoom,
                  transition: "zoom 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                }}
              >
                {roots.map((u) => (
                  <OrgBranch
                    key={u._id}
                    workspaceId={workspaceId}
                    unit={u}
                    parentOfUnit={null}
                    childrenByParent={childrenByParent}
                    allOrgUnits={rows ?? []}
                    contactsByUnit={contactsByUnit}
                    rosByUnit={rosRollup?.byOrgUnitId}
                    depth={0}
                    canEdit={!!canEdit}
                    isAdmin={!!isAdmin}
                    onRemove={handleRemoveOrgUnit}
                    onMove={handleMoveOrgUnit}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        </OrgChartInteractionContext.Provider>
      )}

      <section className="space-y-3 rounded-2xl border border-border/50 bg-card/70 p-4 shadow-sm sm:p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Dokumentasjon i organisasjonen
          </h2>
          <p className="text-sm text-muted-foreground">
            Finn prosesser og deres PVV, risiko og PDD fra samme sted, også når du starter i organisasjonsvisningen.
          </p>
        </div>
        <ProcessCoverageOverview
          workspaceId={workspaceId}
          title="Prosesser og tilknyttet dokumentasjon"
        />
      </section>
    </div>
  );
}
