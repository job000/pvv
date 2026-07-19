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
import { OrgUnitRosKpiStrip, type OrgRosRollup } from "@/components/workspace/org-unit-ros-kpi-strip";
import { OrgUnitTreeOverviewStrip } from "@/components/workspace/org-unit-tree-overview-strip";
import { OrgUnitWorkPanel } from "@/components/workspace/org-unit-work-panel";
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
  Maximize2,
  Minimize2,
  Minus,
  PenLine,
  Plus,
  Scan,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type OrgChartInteraction = {
  registerCardRef: (id: Id<"orgUnits">, el: HTMLElement | null) => void;
  focusPulse: { id: Id<"orgUnits">; token: number } | null;
  highlightedUnitId: Id<"orgUnits"> | null;
  onCardSurfaceActivate: (id: Id<"orgUnits">) => void;
  /** Under ~55 % zoom: kompakte noder (unngår uleselig «full»-kort). */
  overviewMode: boolean;
  /**
   * Motskalering av tekst i oversiktsnoder: fonten settes større jo lenger ut
   * man zoomer, slik at navnet holder ~lesbar størrelse PÅ SKJERMEN uansett zoom.
   * Kvantisert i trinn så ikke hele treet re-rendres for hver zoom-frame.
   */
  overviewLabelScale: number;
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
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(unit.name);
  const [nameSaveBusy, setNameSaveBusy] = useState(false);
  const updateOrgUnit = useMutation(api.orgUnits.update);

  useEffect(() => {
    if (!nameEditOpen) {
      setNameDraft(unit.name);
    }
  }, [unit.name, nameEditOpen]);

  const descendants = useMemo(
    () => computeDescendantIds(unit._id, childrenByParent),
    [unit._id, childrenByParent],
  );
  const moveParentOptions = useMemo(
    () => validParentOptionsForMove(unit, allOrgUnits, descendants),
    [unit, allOrgUnits, descendants],
  );

  const orgChartCtx = useContext(OrgChartInteractionContext);
  const overviewMode = orgChartCtx?.overviewMode ?? false;
  const labelScale = orgChartCtx?.overviewLabelScale ?? 1;

  const cardShellRef = useCallback(
    (node: HTMLElement | null) => {
      orgChartCtx?.registerCardRef(unit._id, node);
    },
    [orgChartCtx, unit._id],
  );

  const childBranches = (
    <div
      className={cn(
        "relative w-full min-w-max px-2",
        overviewMode ? "px-1" : "px-3 sm:px-2 lg:px-1",
      )}
      role="group"
      aria-label={`Underenheter av ${unit.name}`}
    >
      <div
        className={cn(
          "grid w-max gap-y-6",
          overviewMode ? "gap-x-5" : "gap-x-8 sm:gap-x-6 lg:gap-x-5 gap-y-8 sm:gap-y-6",
          kids.length > 1 && "border-t border-foreground/20 pt-5 sm:pt-5",
          kids.length === 1 && "justify-items-center",
        )}
        style={{
          /* Fast kolonnebredde — unngår at 1fr klemmer kort når treet er bredt. */
          gridTemplateColumns: `repeat(${Math.max(kids.length, 1)}, ${
            overviewMode ? "11.75rem" : "15.25rem"
          })`,
        }}
      >
        {kids.map((ch) => (
          <div key={ch._id} className="flex flex-col items-center">
            {kids.length > 1 ? (
              <div
                className="mb-0 h-3 w-px shrink-0 bg-foreground/20"
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

  if (overviewMode) {
    return (
      <div
        className="flex w-[11.75rem] flex-col items-center"
        role="treeitem"
        aria-expanded={kids.length > 0}
      >
        <button
          type="button"
          ref={cardShellRef}
          data-org-chart-card
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-xl border border-border/70 bg-card px-3 py-3 text-center shadow-sm transition-[box-shadow,border-color] hover:border-border hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-white/[0.1]",
            orgChartCtx?.highlightedUnitId === unit._id &&
              "ring-1 ring-primary/60 ring-offset-2 ring-offset-background",
          )}
          onClick={() => orgChartCtx?.onCardSurfaceActivate(unit._id)}
        >
          {/* Motskalert tekst: lesbar på skjermen uansett zoomnivå */}
          <span
            className="text-foreground line-clamp-2 w-full font-semibold leading-snug"
            style={{ fontSize: `calc(0.875rem * ${labelScale})` }}
          >
            {unit.name}
          </span>
          <span
            className="text-muted-foreground w-full truncate"
            style={{ fontSize: `calc(0.66rem * ${labelScale})` }}
          >
            {unit.localCode?.trim() ? `${unit.localCode.trim()} · ` : ""}
            {ORG_UNIT_KIND_LABELS[unit.kind]}
          </span>
          {kids.length > 0 ? (
            <span
              className="bg-primary/10 text-primary mt-0.5 inline-flex items-center rounded-full px-2 py-px font-semibold tabular-nums"
              style={{ fontSize: `calc(0.66rem * ${labelScale})` }}
            >
              {kids.length} under
            </span>
          ) : null}
        </button>
        {kids.length > 0 ? (
          <>
            <div
              className={cn(
                "w-px shrink-0 bg-foreground/20",
                kids.length === 1 ? "h-6" : "h-4",
              )}
              aria-hidden
            />
            {childBranches}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex w-[15.25rem] flex-col items-center"
      role="treeitem"
      aria-expanded={kids.length > 0}
    >
      <div
        className={cn(
          "group/card relative w-full",
          /* Rom til store touch-mål for + rundt kortet (mobil/penn). */
          canEdit && "px-5 pb-8 pt-1 sm:px-3 sm:pb-6 sm:pt-0",
        )}
      >
      <div
        ref={cardShellRef}
        data-org-chart-card
        className={cn(
          "w-full overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md dark:border-white/[0.08]",
          orgChartCtx &&
            "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          orgChartCtx?.highlightedUnitId === unit._id &&
            "ring-1 ring-primary/60 ring-offset-2 ring-offset-background dark:ring-offset-background",
        )}
        onClick={(e) => {
          if (!orgChartCtx) return;
          const t = e.target as HTMLElement;
          if (t.closest("button, a, summary, input, textarea, select")) return;
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
            {canEdit && nameEditOpen ? (
              <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  disabled={nameSaveBusy}
                  autoFocus
                  aria-label="Navn på organisasjonsenhet"
                  className="font-heading h-9 text-sm font-semibold sm:text-[0.9375rem]"
                  onBlur={() => {
                    void (async () => {
                      const trimmed = nameDraft.trim();
                      if (!trimmed) {
                        setNameDraft(unit.name);
                        setNameEditOpen(false);
                        return;
                      }
                      if (trimmed === unit.name) {
                        setNameEditOpen(false);
                        return;
                      }
                      setNameSaveBusy(true);
                      try {
                        await updateOrgUnit({
                          orgUnitId: unit._id,
                          name: trimmed,
                        });
                        toast.success("Navn oppdatert.");
                        setNameEditOpen(false);
                      } catch (e) {
                        toast.error(
                          formatUserFacingError(e, "Kunne ikke lagre navnet."),
                        );
                        setNameDraft(unit.name);
                      } finally {
                        setNameSaveBusy(false);
                      }
                    })();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setNameDraft(unit.name);
                      setNameEditOpen(false);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="mt-0.5 flex min-w-0 items-start gap-1">
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      className={cn(
                        "font-heading text-left text-sm font-semibold leading-snug tracking-tight text-foreground/95 sm:text-[0.9375rem]",
                        "hover:text-foreground rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                        "min-w-0 flex-1 touch-manipulation",
                      )}
                      title="Trykk for å redigere navn"
                      aria-label={`Rediger navn: ${unit.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setNameEditOpen(true);
                      }}
                    >
                      <span className="line-clamp-3">{unit.name}</span>
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:bg-muted/60 hover:text-foreground mt-0.5 shrink-0 rounded-md p-1 touch-manipulation"
                      title="Rediger navn"
                      aria-label="Rediger navn på enheten"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNameEditOpen(true);
                      }}
                    >
                      <PenLine className="size-3.5 sm:size-4" aria-hidden />
                    </button>
                  </>
                ) : (
                  <p
                    className={cn(
                      "font-heading text-sm font-semibold leading-snug tracking-tight text-foreground/95 sm:text-[0.9375rem]",
                    )}
                  >
                    {unit.name}
                  </p>
                )}
              </div>
            )}
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
            orgUnitId={unit._id}
          />
        </div>

        {cardExpanded ? (
          <>
            <details
              className="group border-t border-border/30"
              open={rosPanelOpen}
              onToggle={(e) => setRosPanelOpen(e.currentTarget.open)}
            >
              <summary className="hover:bg-muted/25 flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-left text-xs transition-colors sm:px-4 [&::-webkit-details-marker]:hidden">
                <Shield className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                <span className="text-foreground min-w-0 flex-1 font-medium">
                  ROS
                  {hasRosActivity ? (
                    <span className="text-muted-foreground ml-1 font-normal">
                      {rollup.analysisCount} · {rollup.candidateCount} pr.
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="text-muted-foreground size-3.5 transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-border/25 border-t px-3 pb-2.5 pt-1.5 sm:px-4">
                <OrgUnitRosKpiStrip
                  embedded
                  workspaceId={workspaceId}
                  stats={rollup}
                  variant="full"
                />
              </div>
            </details>

            <details
              className="group border-t border-border/30"
              open={contactsPanelOpen}
              onToggle={(e) => setContactsPanelOpen(e.currentTarget.open)}
            >
              <summary className="hover:bg-muted/25 flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-left text-xs transition-colors sm:px-4 [&::-webkit-details-marker]:hidden">
                <Users className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                <span className="text-foreground min-w-0 flex-1 font-medium">
                  Kontakter
                  {contactsForUnit.length > 0 ? (
                    <span className="text-muted-foreground ml-1 font-normal">
                      {contactsForUnit.length}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="text-muted-foreground size-3.5 shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-border/25 border-t px-3 pb-2.5 pt-1.5 sm:px-4">
                <MerkantilContactsBlock
                  embedded
                  unit={unit}
                  contacts={contactsForUnit}
                  canEdit={canEdit}
                />
              </div>
            </details>
          </>
        ) : null}

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
          {/* Venstre + skjules under lg — unngår kollisjon mellom nabokort på mobil/nettbrett. */}
          <button
            type="button"
            className={cn(
              "border-border/55 bg-background/95 text-primary hover:bg-primary/10 hover:border-primary/35 absolute left-0 top-1/2 z-30 hidden size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-md ring-1 ring-black/[0.04] backdrop-blur-sm transition-[opacity,transform,box-shadow] hover:shadow-lg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 lg:flex lg:size-9 dark:ring-white/[0.06]",
              "touch-manipulation opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 lg:group-focus-within/card:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              openAddDialog("sibling");
            }}
            aria-label={`Ny enhet ved siden av ${unit.name}`}
            title="Ny på samme nivå (søsken)"
          >
            <Plus className="size-4 stroke-[2.5] lg:size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={cn(
              "border-border/55 bg-background/95 text-primary hover:bg-primary/10 hover:border-primary/35 absolute right-0 top-1/2 z-30 flex size-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-md ring-1 ring-black/[0.04] backdrop-blur-sm transition-[opacity,transform,box-shadow] hover:shadow-lg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 sm:size-10 lg:size-9 dark:ring-white/[0.06]",
              "touch-manipulation opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 lg:group-focus-within/card:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              openAddDialog("sibling");
            }}
            aria-label={`Ny enhet ved siden av ${unit.name}`}
            title="Ny på samme nivå (søsken)"
          >
            <Plus className="size-4 stroke-[2.5] lg:size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={cn(
              "border-border/55 bg-background/95 text-primary hover:bg-primary/10 hover:border-primary/35 absolute bottom-0 left-1/2 z-30 flex size-11 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border shadow-md ring-1 ring-black/[0.04] backdrop-blur-sm transition-[opacity,transform,box-shadow] hover:shadow-lg focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 sm:size-10 lg:size-9 dark:ring-white/[0.06]",
              "touch-manipulation opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 lg:group-focus-within/card:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              openAddDialog("child");
            }}
            aria-label={`Ny underenhet under ${unit.name}`}
            title="Ny underenhet"
          >
            <Plus className="size-4 stroke-[2.5] lg:size-3.5" aria-hidden />
          </button>
        </>
      ) : null}
      </div>

      {kids.length > 0 ? (
        <>
          <div
            className={cn(
              "w-px shrink-0 bg-foreground/20",
              kids.length === 1 ? "h-8" : "h-5",
            )}
            aria-hidden
          />
          {childBranches}
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

const ORG_CHART_ZOOM_MIN = 0.28;
const ORG_CHART_ZOOM_MAX = 2.5;
const ORG_CHART_ZOOM_STEP = 1.1;
/** Desktop-standard. Mobil/nettbrett settes via surface. */
const ORG_CHART_ZOOM_INITIAL = 0.88;
/** Under denne zoomen vises oversikts-noder (ikke fullt kortinnhold). */
const ORG_CHART_OVERVIEW_ZOOM = 0.58;

type OrgChartSurface = "phone" | "tablet" | "desktop";

function getOrgChartSurface(): OrgChartSurface {
  if (typeof window === "undefined") return "desktop";
  if (window.matchMedia("(max-width: 767px)").matches) return "phone";
  if (window.matchMedia("(max-width: 1023px)").matches) return "tablet";
  return "desktop";
}

function initialZoomForSurface(surface: OrgChartSurface): number {
  if (surface === "phone") return 0.52;
  if (surface === "tablet") return 0.68;
  return ORG_CHART_ZOOM_INITIAL;
}

function structureHintForSurface(
  surface: OrgChartSurface,
  canEdit: boolean,
): string {
  if (surface === "phone") {
    return "Dra for å flytte · knip for å zoome · trykk enhet";
  }
  if (surface === "tablet") {
    return "Dra eller knip · tilpass for hele treet · trykk enhet";
  }
  return canEdit
    ? "Scroll, Ctrl/Cmd+hjul for zoom, mellomrom+dra for å flytte"
    : "Scroll i kartet · Ctrl/Cmd+hjul zoomer";
}

function viewportClassForSurface(
  surface: OrgChartSurface,
  immersive: boolean,
): string {
  if (surface === "phone") {
    return immersive
      ? "h-full max-h-none min-h-0 touch-none pb-24 pt-16"
      : "max-h-[min(80dvh,40rem)] min-h-[min(68dvh,26rem)] touch-none pb-40 pt-[5.5rem]";
  }
  if (surface === "tablet") {
    return immersive
      ? "h-full max-h-none min-h-0 touch-none pb-20 pt-14"
      : "max-h-[min(74dvh,48rem)] min-h-[min(58dvh,32rem)] touch-none pb-36 pt-[5.75rem]";
  }
  return immersive
    ? "h-full max-h-none min-h-0 touch-pan-x touch-pan-y pb-28 pt-[5rem]"
    : "max-h-[min(78vh,56rem)] min-h-[28rem] touch-pan-x touch-pan-y pb-28 pt-[5rem]";
}

function clampOrgChartZoom(z: number) {
  return Math.min(ORG_CHART_ZOOM_MAX, Math.max(ORG_CHART_ZOOM_MIN, z));
}

function useOrgChartSurface(): OrgChartSurface {
  const [surface, setSurface] = useState<OrgChartSurface>("desktop");
  useEffect(() => {
    const sync = () => setSurface(getOrgChartSurface());
    sync();
    const mqPhone = window.matchMedia("(max-width: 767px)");
    const mqTablet = window.matchMedia("(max-width: 1023px)");
    mqPhone.addEventListener("change", sync);
    mqTablet.addEventListener("change", sync);
    return () => {
      mqPhone.removeEventListener("change", sync);
      mqTablet.removeEventListener("change", sync);
    };
  }, []);
  return surface;
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

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";
  /** Kun admin/eier bygger orgkart — alle medlemmer kan se. */
  const canEdit = isAdmin;

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

  const chartSurface = useOrgChartSurface();
  const touchFirst =
    chartSurface === "phone" || chartSurface === "tablet";

  const [chartZoom, setChartZoom] = useState(() =>
    initialZoomForSurface(getOrgChartSurface()),
  );
  /** Desktop: valgfri dra-modus. Touch: alltid pan (knapp skjules). */
  const [chartPanMode, setChartPanMode] = useState(false);
  const [spacePanHeld, setSpacePanHeld] = useState(false);
  const [chartIsPanning, setChartIsPanning] = useState(false);
  const [chartPinchActive, setChartPinchActive] = useState(false);
  const chartZoomRef = useRef(chartZoom);
  useEffect(() => {
    chartZoomRef.current = chartZoom;
  }, [chartZoom]);
  const chartPanModeRef = useRef(chartPanMode);
  useEffect(() => {
    chartPanModeRef.current = chartPanMode;
  }, [chartPanMode]);
  const spacePanHeldRef = useRef(spacePanHeld);
  useEffect(() => {
    spacePanHeldRef.current = spacePanHeld;
  }, [spacePanHeld]);
  const chartSurfaceRef = useRef(chartSurface);
  useEffect(() => {
    chartSurfaceRef.current = chartSurface;
  }, [chartSurface]);
  const pinchBaseZoomRef = useRef(1);
  const chartViewportRef = useRef<HTMLDivElement>(null);
  const chartHostRef = useRef<HTMLDivElement>(null);
  const structureDetailsRef = useRef<HTMLDetailsElement>(null);
  const chartNaturalSizeLiveRef = useRef({ w: 0, h: 0 });
  /**
   * CSS-immersiv «full skjerm» — iOS/iPadOS støtter ikke requestFullscreen på
   * vilkårlige elementer; native API feilet stille før.
   */
  const [chartIsFullscreen, setChartIsFullscreen] = useState(false);

  useEffect(() => {
    if (!chartIsFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChartIsFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [chartIsFullscreen]);

  /** Mellomrom = midlertidig dra på desktop (som Figma/Maps). */
  useEffect(() => {
    if (chartSurface !== "desktop") {
      setSpacePanHeld(false);
      return;
    }
    const isTypingTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTypingTarget(e.target)) return;
      e.preventDefault();
      setSpacePanHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePanHeld(false);
    };
    const onBlur = () => setSpacePanHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [chartSurface]);

  const fitChartToViewRef = useRef<(attempt?: number) => void>(() => {});

  const fitChartToView = useCallback((attempt = 0) => {
    const vp = chartViewportRef.current;
    const size = chartNaturalSizeLiveRef.current;
    if (!vp) return;
    /* Closed <details> eller måling ikke klar ennå — prøv igjen. */
    if (vp.clientWidth < 32 || size.w < 8 || size.h < 8) {
      if (attempt < 12) {
        window.setTimeout(() => fitChartToView(attempt + 1), 60);
      }
      return;
    }
    const surface = chartSurfaceRef.current;
    const padX = surface === "phone" ? 24 : surface === "tablet" ? 40 : 56;
    const padY = surface === "phone" ? 140 : surface === "tablet" ? 120 : 96;
    const scale = Math.min(
      (vp.clientWidth - padX) / size.w,
      (vp.clientHeight - padY) / size.h,
      surface === "desktop" ? 1 : 1.05,
    );
    setChartZoom(clampOrgChartZoom(scale));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = chartViewportRef.current;
        if (!el) return;
        el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
        el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) * 0.06);
      });
    });
  }, []);

  useEffect(() => {
    fitChartToViewRef.current = fitChartToView;
  }, [fitChartToView]);

  const toggleChartFullscreen = useCallback(() => {
    setChartIsFullscreen((v) => {
      const next = !v;
      if (next) {
        setOrgSearch("");
        if (chartSurfaceRef.current !== "desktop") {
          window.setTimeout(() => fitChartToViewRef.current(0), 120);
        }
      }
      return next;
    });
  }, []);

  /**
   * Må koble wheel etter at viewport finnes i DOM. Første render kan være
   * lasteskjelett uten ref — da ble lytter aldri registrert med []-deps.
   */
  useEffect(() => {
    const el = chartViewportRef.current;
    if (!el) return;

    /**
     * Ctrl/Cmd + hjul = zoom (desktop + mus/trackpad på nettbrett).
     * Vanlig hjul/to-finger-scroll: native overflow. Pinch: pointer/gesture.
     */
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) return;
      const zoomChord = e.ctrlKey || e.metaKey;
      if (!zoomChord) return;
      e.preventDefault();
      const dy = e.deltaY;
      if (dy === 0) return;
      const intensity =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 0.18
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? 0.45
            : 0.0085;
      const next = chartZoomRef.current * Math.exp(-dy * intensity);
      setChartZoom(clampOrgChartZoom(next));
    };

    /** Safari / WebKit trackpad pinch. */
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
    armed: boolean;
    captured: boolean;
    moved: boolean;
  } | null>(null);

  const touchPointersRef = useRef(
    new Map<number, { x: number; y: number }>(),
  );
  const pinchSessionRef = useRef<{
    startDist: number;
    startZoom: number;
  } | null>(null);
  /** Unngå at pan/knip utløser kort-klikk etterpå. */
  const suppressNextClickRef = useRef(false);
  const pinchDidZoomRef = useRef(false);

  useEffect(() => {
    const el = chartViewportRef.current;
    if (!el) return;

    const interactiveSelector =
      "button, a, summary, input, textarea, select, label, [role='dialog'], [role='listbox'], [role='option'], [role='toolbar']";

    const pointerDist = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => Math.hypot(a.x - b.x, a.y - b.y);

    const armClickSuppress = () => {
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 450);
    };

    const shouldArmPan = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !el.contains(t)) return false;
      if (t.closest(interactiveSelector)) return false;
      if (touchPointersRef.current.size >= 2) return false;
      if (pinchSessionRef.current) return false;

      const surface = chartSurfaceRef.current;
      const isMouse = e.pointerType === "mouse";
      const isTouchOrPen =
        e.pointerType === "touch" || e.pointerType === "pen";
      const onCard = !!t.closest("[data-org-chart-card]");

      if (isMouse) {
        if (e.button === 1) {
          e.preventDefault();
          return true;
        }
        if (e.button !== 0) return false;
        if (e.altKey || spacePanHeldRef.current) return true;
        /* Desktop hånd-modus: pan i bakgrunn; kort forblir klikkbare uten dra. */
        if (chartPanModeRef.current) return !onCard;
        return false;
      }

      if (!isTouchOrPen) return false;

      /* Mobil/nettbrett: alltid én-finger-pan (med terskel). */
      if (surface === "phone" || surface === "tablet") return true;
      if (chartPanModeRef.current) return true;
      return !onCard;
    };

    const endPan = (e: PointerEvent) => {
      const s = panSessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (s.moved) armClickSuppress();
      if (s.captured) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      panSessionRef.current = null;
      setChartIsPanning(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        touchPointersRef.current.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
        });
        if (touchPointersRef.current.size === 2) {
          endPan(e);
          const pts = [...touchPointersRef.current.values()];
          const dist = pointerDist(pts[0]!, pts[1]!);
          if (dist > 8) {
            pinchSessionRef.current = {
              startDist: dist,
              startZoom: chartZoomRef.current,
            };
            pinchDidZoomRef.current = false;
            setChartPinchActive(true);
            e.preventDefault();
          }
          return;
        }
      }

      if (!shouldArmPan(e)) return;

      panSessionRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startSl: el.scrollLeft,
        startSt: el.scrollTop,
        armed: true,
        captured: false,
        moved: false,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (
        (e.pointerType === "touch" || e.pointerType === "pen") &&
        touchPointersRef.current.has(e.pointerId)
      ) {
        touchPointersRef.current.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
        });
      }

      const pinch = pinchSessionRef.current;
      if (pinch && touchPointersRef.current.size >= 2) {
        const pts = [...touchPointersRef.current.values()];
        const dist = pointerDist(pts[0]!, pts[1]!);
        if (dist > 8 && pinch.startDist > 8) {
          e.preventDefault();
          const next = clampOrgChartZoom(
            pinch.startZoom * (dist / pinch.startDist),
          );
          if (Math.abs(next - chartZoomRef.current) > 0.002) {
            pinchDidZoomRef.current = true;
          }
          setChartZoom(next);
        }
        return;
      }

      const s = panSessionRef.current;
      if (!s || e.pointerId !== s.pointerId || !s.armed) return;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      const slop =
        chartSurfaceRef.current === "phone"
          ? 14
          : chartSurfaceRef.current === "tablet"
            ? 12
            : 8;

      if (!s.moved) {
        if (Math.hypot(dx, dy) < slop) return;
        s.moved = true;
        s.captured = true;
        setChartIsPanning(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      e.preventDefault();
      el.scrollLeft = s.startSl - dx;
      el.scrollTop = s.startSt - dy;
    };

    const onPointerUp = (e: PointerEvent) => {
      touchPointersRef.current.delete(e.pointerId);
      if (touchPointersRef.current.size < 2) {
        if (pinchSessionRef.current && pinchDidZoomRef.current) {
          armClickSuppress();
        }
        pinchSessionRef.current = null;
        pinchDidZoomRef.current = false;
        setChartPinchActive(false);
      }
      endPan(e);
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!suppressNextClickRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressNextClickRef.current = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [rows]);

  const zoomOut = useCallback(() => {
    setChartZoom((z) => clampOrgChartZoom(z / ORG_CHART_ZOOM_STEP));
  }, []);
  const zoomIn = useCallback(() => {
    setChartZoom((z) => clampOrgChartZoom(z * ORG_CHART_ZOOM_STEP));
  }, []);
  const resetZoom = useCallback(() => {
    setChartZoom(initialZoomForSurface(chartSurfaceRef.current));
  }, []);

  const cardRefs = useRef(new Map<string, HTMLElement>());
  const registerCardRef = useCallback(
    (id: Id<"orgUnits">, el: HTMLElement | null) => {
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
  const [activeOrgUnitId, setActiveOrgUnitId] = useState<Id<"orgUnits"> | "">("");
  const orgSearchWrapRef = useRef<HTMLDivElement | null>(null);

  const overviewMode = chartZoom < ORG_CHART_OVERVIEW_ZOOM;

  /**
   * Skjermlesbar tekst i oversiktsnoder: mål ≈ 11px på skjermen.
   * 0.8/zoom, avrundet til 0.05-trinn (unngår re-render per frame), tak 2.6.
   */
  const overviewLabelScale = useMemo(() => {
    if (!overviewMode) return 1;
    const raw = Math.min(2.6, Math.max(1, 0.8 / Math.max(chartZoom, ORG_CHART_ZOOM_MIN)));
    return Math.round(raw * 20) / 20;
  }, [overviewMode, chartZoom]);

  const onCardSurfaceActivate = useCallback((id: Id<"orgUnits">) => {
    setActiveOrgUnitId(id);
    setHighlightedUnitId(id);
    /* Fra oversikt: zoom inn til lesbart kort. */
    setChartZoom((z) =>
      clampOrgChartZoom(z < ORG_CHART_OVERVIEW_ZOOM ? 1 : z < 1 ? 1 : z),
    );
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
      overviewMode,
      overviewLabelScale,
    }),
    [
      registerCardRef,
      focusPulse,
      highlightedUnitId,
      onCardSurfaceActivate,
      overviewMode,
      overviewLabelScale,
    ],
  );

  const chartContentRef = useRef<HTMLDivElement>(null);
  const [chartNaturalSize, setChartNaturalSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = chartContentRef.current;
    if (!el) return;
    const measure = () => {
      const next = {
        w: Math.ceil(el.scrollWidth),
        h: Math.ceil(el.scrollHeight),
      };
      chartNaturalSizeLiveRef.current = next;
      setChartNaturalSize(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows, overviewMode, canEdit]);

  /** Mobil/nettbrett: tilpass kart når struktur åpnes. */
  useEffect(() => {
    const details = structureDetailsRef.current;
    if (!details) return;
    const onToggle = () => {
      if (!details.open) return;
      if (chartSurfaceRef.current === "desktop") return;
      window.setTimeout(() => fitChartToView(0), 80);
    };
    details.addEventListener("toggle", onToggle);
    return () => details.removeEventListener("toggle", onToggle);
  }, [fitChartToView, rows]);

  /** Rotasjon / større layout-endring: tilpass på touch-flater. */
  useEffect(() => {
    if (!touchFirst) return;
    let timer: number | undefined;
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    const scheduleFit = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fitChartToView(0), 180);
    };
    const onResize = () => {
      const dw = Math.abs(window.innerWidth - lastW);
      const dh = Math.abs(window.innerHeight - lastH);
      if (dw < 48 && dh < 48) return;
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      scheduleFit();
    };
    window.addEventListener("orientationchange", scheduleFit);
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("orientationchange", scheduleFit);
      window.removeEventListener("resize", onResize);
    };
  }, [touchFirst, fitChartToView]);

  const orgSearchMatches = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q || rows === undefined) return [];
    return rows.filter((u) => {
      if (u.name.toLowerCase().includes(q)) return true;
      const code = u.localCode?.trim().toLowerCase() ?? "";
      return code.length > 0 && code.includes(q);
    });
  }, [rows, orgSearch]);

  useEffect(() => {
    if (!rows || rows.length === 0) return;
    if (activeOrgUnitId && rows.some((u) => u._id === activeOrgUnitId)) return;
    setActiveOrgUnitId(rows[0]!._id);
  }, [rows, activeOrgUnitId]);

  const activeOrgUnit = useMemo(
    () => rows?.find((u) => u._id === activeOrgUnitId) ?? null,
    [rows, activeOrgUnitId],
  );
  const activeRollup = useMemo(() => {
    if (!activeOrgUnit || !rosRollup) return null;
    return rosRollup.byOrgUnitId[activeOrgUnit._id] ?? null;
  }, [activeOrgUnit, rosRollup]);

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
    <div className="space-y-6">
      {canEdit ? (
        <AddRootOrganizationForm
          workspaceId={workspaceId}
          defaultExpanded={roots.length === 0}
        />
      ) : null}

      {rows.length > 0 ? (
        <OrgUnitWorkPanel
          workspaceId={workspaceId}
          orgUnits={rows}
          activeOrgUnitId={activeOrgUnitId}
          onSelectOrgUnit={(id) => {
            setActiveOrgUnitId(id);
            onCardSurfaceActivate(id);
          }}
          activeRollup={activeRollup}
          unassignedCount={rosRollup?.unassigned.candidateCount ?? 0}
        />
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
        <details
          ref={structureDetailsRef}
          className="group/structure rounded-2xl border border-border/50 bg-card/40 open:bg-card/60 open:shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 text-left sm:px-5 [&::-webkit-details-marker]:hidden">
            <Building2 className="text-muted-foreground size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {canEdit ? "Struktur" : "Organisasjonskart"}
              </p>
              <p className="text-muted-foreground text-xs leading-snug">
                {structureHintForSurface(chartSurface, !!canEdit)}
              </p>
            </div>
            <ChevronRight className="text-muted-foreground size-5 shrink-0 transition-transform group-open/structure:rotate-90" />
          </summary>
          <div className="border-t border-border/40 px-2 pb-3 pt-2 sm:px-3 sm:pb-4">
        <OrgChartInteractionContext.Provider value={interactionValue}>
        <div
          ref={chartHostRef}
          className={cn(
            "border-border/50 relative isolate overflow-hidden rounded-2xl border bg-background",
            chartIsFullscreen &&
              "fixed inset-0 z-[180] h-[100dvh] max-h-[100dvh] rounded-none border-0 shadow-2xl",
          )}
        >
          <div
            ref={chartViewportRef}
            className={cn(
              "overflow-auto overscroll-contain",
              viewportClassForSurface(chartSurface, chartIsFullscreen),
              chartSurface === "desktop" &&
                !chartIsFullscreen &&
                "md:min-h-[32rem] lg:min-h-[36rem]",
              // Prikk-rutenett som canvas-bakgrunn
              "bg-[radial-gradient(color-mix(in_oklab,var(--border)_75%,transparent)_1px,transparent_1px)] [background-size:22px_22px]",
              (touchFirst || chartPanMode || spacePanHeld) &&
                !chartIsPanning &&
                "cursor-grab",
              (chartIsPanning || chartPinchActive || spacePanHeld) &&
                "cursor-grabbing select-none",
            )}
            role="tree"
            aria-label="Organisasjonstre"
          >
            {/*
              transform:scale (ikke CSS zoom) — zoom deformerte kort i Safari/iOS.
              Ytre boks får layout-størrelse = naturlig × skala for korrekt scroll.
            */}
            <div className="flex w-full justify-center px-4 py-3 sm:px-6">
              <div
                className="relative"
                style={{
                  width:
                    chartNaturalSize.w > 0
                      ? chartNaturalSize.w * chartZoom
                      : undefined,
                  height:
                    chartNaturalSize.h > 0
                      ? chartNaturalSize.h * chartZoom
                      : undefined,
                }}
              >
                <div
                  ref={chartContentRef}
                  className="flex w-max origin-top-left flex-wrap justify-center gap-10"
                  style={{
                    transform: `scale(${chartZoom})`,
                    transition: chartPinchActive
                      ? "none"
                      : "transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
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
            {overviewMode && !(touchFirst && chartIsFullscreen) ? (
              <p className="text-muted-foreground pointer-events-none absolute bottom-[6.5rem] left-1/2 z-10 w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 rounded-full bg-background/90 px-3 py-1.5 text-center text-[11px] font-medium shadow-sm backdrop-blur-sm md:bottom-24">
                Oversikt — trykk en enhet for å zoome inn
              </p>
            ) : null}
          </div>

          {/* Fullskjerm touch: kun tydelig lukk — ingen søk/hint over kartet. */}
          {touchFirst && chartIsFullscreen ? (
            <div
              className="pointer-events-auto absolute inset-x-0 top-0 z-50 flex justify-end px-3 pt-[max(0.65rem,env(safe-area-inset-top))]"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="secondary"
                className="h-12 min-h-12 gap-2 rounded-full px-5 text-base font-semibold shadow-lg"
                onClick={toggleChartFullscreen}
                aria-label="Lukk full skjerm"
              >
                <X className="size-5" aria-hidden />
                Lukk
              </Button>
            </div>
          ) : (
            <div
              ref={orgSearchWrapRef}
              className={cn(
                "pointer-events-auto absolute z-50 flex items-start gap-2 top-[max(0.75rem,env(safe-area-inset-top))]",
                touchFirst
                  ? "inset-x-2"
                  : "left-3 right-auto w-[min(20rem,calc(100%-1.5rem))]",
              )}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="min-w-0 flex-1">
                <SearchInput
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Søk enhet eller kode"
                  aria-label="Søk i organisasjonskartet"
                  aria-controls="org-chart-search-results"
                  aria-expanded={
                    orgSearch.trim().length > 0 && orgSearchMatches.length > 0
                  }
                  inputClassName={cn(
                    "border-border/50 bg-background/95 shadow-md backdrop-blur-md",
                    touchFirst
                      ? "h-12 rounded-2xl text-base"
                      : "h-10 rounded-full text-sm",
                  )}
                />
                {orgSearch.trim().length > 0 && orgSearchMatches.length > 0 ? (
                  <ul
                    id="org-chart-search-results"
                    role="listbox"
                    className="border-border/60 bg-card absolute left-0 right-0 top-full z-[60] mt-1.5 max-h-60 overflow-auto rounded-2xl border py-1 shadow-lg ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                  >
                    {orgSearchMatches.slice(0, 14).map((u) => (
                      <li key={u._id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          className="hover:bg-muted/80 flex min-h-11 w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm transition-colors"
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
                ) : orgSearch.trim().length > 0 &&
                  orgSearchMatches.length === 0 ? (
                  <p className="border-border/60 bg-card text-muted-foreground absolute left-0 right-0 top-full z-[60] mt-1.5 rounded-2xl border px-3 py-2.5 text-xs shadow-lg ring-1 ring-black/[0.06]">
                    Ingen treff — prøv et annet søkeord.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {/* Plattformtilpasset verktøylinje */}
          <div
            className={cn(
              "pointer-events-auto absolute z-50 bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
              touchFirst && chartIsFullscreen
                ? "right-3 left-auto"
                : touchFirst
                  ? "inset-x-2"
                  : "right-3 left-auto",
            )}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "border-border/60 bg-background/95 flex items-center gap-0.5 border shadow-xl backdrop-blur-md",
                touchFirst && chartIsFullscreen
                  ? "rounded-full p-1"
                  : touchFirst
                    ? "mx-auto w-full max-w-lg rounded-2xl p-1.5"
                    : "rounded-full p-1",
              )}
              role="toolbar"
              aria-label="Kartkontroller"
            >
              {/* Hånd kun på desktop — mobil/nettbrett panorerer alltid. */}
              {chartSurface === "desktop" ? (
                <Button
                  type="button"
                  variant={chartPanMode || spacePanHeld ? "secondary" : "ghost"}
                  size="icon-lg"
                  className="size-10 min-h-10 min-w-10 rounded-full"
                  onClick={() => setChartPanMode((v) => !v)}
                  aria-pressed={chartPanMode}
                  aria-label={
                    chartPanMode
                      ? "Dra-modus på"
                      : "Slå på dra for å flytte kart"
                  }
                  title="Dra i bakgrunnen. Hold mellomrom for midlertidig dra. Midtklikk/Alt+dra også."
                >
                  <Hand className="size-4" aria-hidden />
                </Button>
              ) : null}

              <div
                className={cn(
                  "flex min-w-0 items-center gap-0.5",
                  touchFirst && !chartIsFullscreen
                    ? "bg-muted/60 flex-1 rounded-xl p-0.5"
                    : "flex-none",
                )}
                role="group"
                aria-label="Zoom"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className={cn(
                    "rounded-xl",
                    touchFirst && !chartIsFullscreen
                      ? "size-12 min-h-12 min-w-12"
                      : "size-10 min-h-10 min-w-10 rounded-full",
                  )}
                  onClick={zoomOut}
                  disabled={chartZoom <= ORG_CHART_ZOOM_MIN + 1e-6}
                  aria-label="Zoom ut"
                  title="Zoom ut"
                >
                  <Minus
                    className={
                      touchFirst && !chartIsFullscreen ? "size-5" : "size-4"
                    }
                    aria-hidden
                  />
                </Button>
                <button
                  type="button"
                  onClick={resetZoom}
                  className={cn(
                    "text-foreground hover:bg-background/80 touch-manipulation text-center font-semibold tabular-nums transition-colors",
                    touchFirst && !chartIsFullscreen
                      ? "min-h-12 min-w-[3.75rem] flex-1 rounded-xl px-2 text-sm"
                      : "min-h-10 min-w-[3.25rem] rounded-full px-1.5 text-xs",
                  )}
                  title="Tilbakestill zoom for denne enheten"
                  aria-label={`Tilbakestill zoom til ${Math.round(initialZoomForSurface(chartSurface) * 100)} prosent`}
                >
                  <span aria-live="polite">
                    {Math.round(chartZoom * 100)}%
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className={cn(
                    "rounded-xl",
                    touchFirst && !chartIsFullscreen
                      ? "size-12 min-h-12 min-w-12"
                      : "size-10 min-h-10 min-w-10 rounded-full",
                  )}
                  onClick={zoomIn}
                  disabled={chartZoom >= ORG_CHART_ZOOM_MAX - 1e-6}
                  aria-label="Zoom inn"
                  title="Zoom inn"
                >
                  <Plus
                    className={
                      touchFirst && !chartIsFullscreen ? "size-5" : "size-4"
                    }
                    aria-hidden
                  />
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className={cn(
                  "rounded-xl",
                  touchFirst && !chartIsFullscreen
                    ? "size-12 min-h-12 min-w-12"
                    : "size-10 min-h-10 min-w-10 rounded-full",
                )}
                onClick={() => fitChartToView(0)}
                aria-label="Tilpass kartet til skjermen"
                title="Tilpass hele treet til synlig flate"
              >
                <Scan
                  className={
                    touchFirst && !chartIsFullscreen ? "size-5" : "size-4"
                  }
                  aria-hidden
                />
              </Button>

              {/* Fullskjerm-knapp: skjult på touch i fullskjerm (bruk «Lukk» øverst). */}
              {!(touchFirst && chartIsFullscreen) ? (
                <Button
                  type="button"
                  variant={chartIsFullscreen ? "secondary" : "ghost"}
                  size="icon-lg"
                  className={cn(
                    "rounded-xl",
                    touchFirst
                      ? "size-12 min-h-12 min-w-12"
                      : "size-10 min-h-10 min-w-10 rounded-full",
                  )}
                  onClick={toggleChartFullscreen}
                  aria-pressed={chartIsFullscreen}
                  aria-label={
                    chartIsFullscreen
                      ? "Lukk full skjerm"
                      : "Åpne kart i full skjerm"
                  }
                  title={
                    chartIsFullscreen
                      ? "Lukk full skjerm (Esc)"
                      : "Fyll hele skjermen"
                  }
                >
                  {chartIsFullscreen ? (
                    <Minimize2 className="size-4" aria-hidden />
                  ) : (
                    <Maximize2
                      className={touchFirst ? "size-5" : "size-4"}
                      aria-hidden
                    />
                  )}
                </Button>
              ) : null}
            </div>
            {touchFirst && !chartIsFullscreen ? (
              chartSurface === "phone" ? (
                <p className="text-muted-foreground mt-1.5 text-center text-[10px] font-medium tracking-wide">
                  Dra · knip · tilpass
                </p>
              ) : (
                <p className="text-muted-foreground mt-1.5 text-center text-[10px] font-medium tracking-wide">
                  Dra eller knip · Scan tilpasser hele treet
                </p>
              )
            ) : null}
          </div>
        </div>
        </OrgChartInteractionContext.Provider>
          </div>
        </details>
      )}
    </div>
  );
}
