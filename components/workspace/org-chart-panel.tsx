"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Building2, ChevronRight, Layers, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

function MerkantilContactRow({
  contact,
  canEdit,
}: {
  contact: Doc<"orgUnitContacts">;
  canEdit: boolean;
}) {
  const updateContact = useMutation(api.orgUnits.updateContact);
  const removeContact = useMutation(api.orgUnits.removeContact);
  const [name, setName] = useState(contact.name);
  const [title, setTitle] = useState(contact.title ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");

  async function save() {
    await updateContact({
      contactId: contact._id,
      name,
      title: title.trim() === "" ? null : title,
      email: email.trim() === "" ? null : email,
      phone: phone.trim() === "" ? null : phone,
      notes: notes.trim() === "" ? null : notes,
    });
  }

  if (!canEdit) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <span className="text-xs font-bold text-primary">
            {contact.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{contact.name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {contact.title && (
              <span className="text-muted-foreground text-[10px]">{contact.title}</span>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="text-primary text-[10px] hover:underline">
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone.replace(/\s/g, "")}`}
                className="text-primary text-[10px] hover:underline"
              >
                {contact.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group/contact rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Navn</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 rounded-xl text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stilling</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 rounded-xl text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">E-post</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 rounded-xl text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Telefon</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 rounded-xl text-sm"
          />
        </div>
      </div>
      <div className="mt-2.5 space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notater</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="rounded-xl text-sm"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" className="rounded-xl" variant="secondary" onClick={() => void save()}>
          Lagre
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-xl text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (typeof window !== "undefined" && window.confirm("Fjerne kontakten?")) {
              void removeContact({ contactId: contact._id });
            }
          }}
        >
          Fjern
        </Button>
      </div>
    </div>
  );
}

function MerkantilContactsBlock({
  unit,
  contacts,
  canEdit,
}: {
  unit: Doc<"orgUnits">;
  contacts: Doc<"orgUnitContacts">[];
  canEdit: boolean;
}) {
  const addContact = useMutation(api.orgUnits.addContact);
  const importLegacy = useMutation(api.orgUnits.importLegacyContact);

  const [addName, setAddName] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addMsg, setAddMsg] = useState<string | null>(null);

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
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Kunne ikke legge til.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-wide">
        Kontaktpersoner
      </p>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Registrer én eller flere personer per enhet — f.eks. økonomi, innkjøp,
        IT, avtaler eller annet som er relevant for deres bransje.
      </p>

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
        <ul className="space-y-3">
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
        <form
          onSubmit={(ev) => void submitAdd(ev)}
          className="rounded-2xl bg-muted/15 p-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Legg til kontakt</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Navn *</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="h-8 rounded-xl text-sm"
                placeholder="Fornavn Etternavn"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stilling</Label>
              <Input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                className="h-8 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">E-post</Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="h-8 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Telefon</Label>
              <Input
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="h-8 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="mt-2.5 space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notater</Label>
            <Textarea
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              rows={2}
              className="rounded-xl text-sm"
              placeholder="Ansvarsområde, avtalereferanse …"
            />
          </div>
          {addMsg && (
            <p className="text-destructive mt-2 text-xs" role="alert">
              {addMsg}
            </p>
          )}
          <Button type="submit" size="sm" className="mt-3 rounded-xl" disabled={!addName.trim()}>
            Legg til kontakt
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function OrgBranch({
  unit,
  childrenByParent,
  contactsByUnit,
  depth,
  canEdit,
  isAdmin,
  onRemove,
}: {
  unit: Doc<"orgUnits">;
  childrenByParent: Map<string, Doc<"orgUnits">[]>;
  contactsByUnit: Map<string, Doc<"orgUnitContacts">[]>;
  depth: number;
  canEdit: boolean;
  isAdmin: boolean;
  onRemove: (id: Id<"orgUnits">) => void;
}) {
  const contactsForUnit = contactsByUnit.get(unit._id) ?? [];
  const kids = childrenByParent.get(unit._id) ?? [];
  const [open, setOpen] = useState(depth === 0);

  const depthAccent =
    depth === 0
      ? "border-l-primary/55"
      : depth === 1
        ? "border-l-sky-500/45"
        : "border-l-emerald-500/40";

  return (
    <li className="list-none">
      <div
        className={cn(
          "rounded-2xl border-l-4 bg-card shadow-sm ring-1 ring-black/[0.04] transition-shadow duration-200 hover:shadow-md dark:ring-white/[0.06]",
          depthAccent,
        )}
        style={{ marginLeft: depth === 0 ? 0 : Math.min(depth * 12, 48) }}
      >
        <button
          type="button"
          className="flex w-full items-start gap-3 rounded-t-2xl px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <ChevronRight
            className={`text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {ORG_UNIT_KIND_LABELS[unit.kind]}
              {unit.localCode ? ` · ${unit.localCode}` : ""}
            </p>
            <p className="font-heading mt-0.5 font-semibold">{unit.name}</p>
            {!open && (kids.length > 0 || contactsForUnit.length > 0) ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {kids.length > 0 && (
                  <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {kids.length} underenhet{kids.length === 1 ? "" : "er"}
                  </span>
                )}
                {contactsForUnit.length > 0 && (
                  <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {contactsForUnit.length} kontakt{contactsForUnit.length === 1 ? "" : "er"}
                  </span>
                )}
              </div>
            ) : null}
            {open && unit.shortName ? (
              <p className="text-muted-foreground mt-0.5 text-sm">{unit.shortName}</p>
            ) : null}
            {open && unit.extraInfo ? (
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed whitespace-pre-wrap">
                {unit.extraInfo}
              </p>
            ) : null}
          </div>
        </button>
        {open ? (
          <>
            <div className="border-t border-border/40 px-4 py-3">
              <MerkantilContactsBlock
                unit={unit}
                contacts={contactsForUnit}
                canEdit={canEdit}
              />
            </div>
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-4 py-2.5">
                <a
                  href={`#add-child-${unit._id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "rounded-xl",
                  )}
                >
                  Legg til underenhet
                </a>
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm(
                          `Slette «${unit.name}»? Krever at den ikke har underenheter eller koblinger.`,
                        )
                      ) {
                        void onRemove(unit._id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Slett
                  </Button>
                ) : null}
              </div>
            ) : null}
            {kids.length > 0 ? (
              <ul className="space-y-2 border-t border-border/40 px-2 py-3">
                {kids.map((ch) => (
                  <OrgBranch
                    key={ch._id}
                    unit={ch}
                    childrenByParent={childrenByParent}
                    contactsByUnit={contactsByUnit}
                    depth={depth + 1}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
      {canEdit ? (
        <AddChildForm
          id={`add-child-${unit._id}`}
          workspaceId={unit.workspaceId}
          parent={unit}
        />
      ) : null}
    </li>
  );
}

function AddChildForm({
  id,
  workspaceId,
  parent,
}: {
  id: string;
  workspaceId: Id<"workspaces">;
  parent: Doc<"orgUnits">;
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
        : null;

  if (childKind === null) {
    return null;
  }
  const kindForChild: "avdeling" | "seksjon" = childKind;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await create({
        workspaceId,
        parentId: parent._id,
        kind: kindForChild,
        name,
        extraInfo: extra.trim() || undefined,
      });
      setName("");
      setExtra("");
      setMsg("Opprettet.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Kunne ikke opprette.");
    }
  }

  return (
    <form
      id={id}
      onSubmit={(e) => void submit(e)}
      className="mt-3 ml-4 rounded-2xl bg-muted/15 p-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Ny {ORG_UNIT_KIND_LABELS[kindForChild]} under {parent.name}
      </p>
      <div className="mt-3 space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor={`${id}-name`} className="text-xs">Navn</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="F.eks. Salg Nord eller HR"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-extra`} className="text-xs">Annen informasjon</Label>
          <Textarea
            id={`${id}-extra`}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={2}
            placeholder="Koststed, lokasjon, særlige forhold …"
            className="rounded-xl"
          />
        </div>
      </div>
      {msg && (
        <p className="text-muted-foreground mt-2 text-sm" role="status">
          {msg}
        </p>
      )}
      <Button type="submit" size="sm" className="mt-3 rounded-xl" disabled={!name.trim()}>
        Opprett underenhet
      </Button>
    </form>
  );
}

function AddRootOrganizationForm({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const create = useMutation(api.orgUnits.create);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [localCode, setLocalCode] = useState("");
  const [extra, setExtra] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

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
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Kunne ikke opprette.");
    }
  }

  return (
    <div
      id="ny-hovedenhet"
      className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
    >
      <div className="flex items-start gap-4 border-b border-border/40 bg-muted/10 px-5 py-5 sm:px-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Building2 className="size-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-lg font-semibold tracking-tight sm:text-xl">
            Ny hovedenhet
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Rot-nivå i kartet — typisk selskap, konsern eller juridisk enhet.
            Under legger du avdelinger, deretter team.
          </p>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="hf-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Navn
              </Label>
              <Input
                id="hf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="F.eks. Acme AS, Kommune X, eller Helseforetak Y"
                className="h-11 rounded-xl text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf-short" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
              <Label htmlFor="hf-code" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
          <div className="space-y-1.5">
            <Label htmlFor="hf-extra" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Tilleggsinformasjon (valgfritt)
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
          {msg && (
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
          )}
          <Button
            type="submit"
            size="lg"
            className="rounded-xl px-6 font-semibold shadow-sm"
            disabled={!name.trim()}
          >
            Opprett hovedenhet
          </Button>
        </form>
      </div>
    </div>
  );
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
    <div className="mx-auto max-w-4xl space-y-8">
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
            Kartet har <strong className="text-foreground font-medium">tre nivåer</strong>:
            øverst selskap eller konsern, deretter avdeling eller forretningsenhet,
            og innerst team eller gruppe. Navn tilpasses deres modell.
          </p>
          <p>
            Hvert nivå kan ha{" "}
            <strong className="text-foreground font-medium">kontaktpersoner</strong>{" "}
            (fold ut enheten). Pilen ved enheten styrer om detaljer vises eller
            skjules.
          </p>
        </div>
      </details>

      {canEdit ? <AddRootOrganizationForm workspaceId={workspaceId} /> : null}

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
        <div className="space-y-2">
          <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
            Organisasjonskart
          </p>
          <ul className="space-y-4">
            {roots.map((u) => (
              <OrgBranch
                key={u._id}
                unit={u}
                childrenByParent={childrenByParent}
                contactsByUnit={contactsByUnit}
                depth={0}
                canEdit={!!canEdit}
                isAdmin={!!isAdmin}
                onRemove={(id) => void removeUnit({ orgUnitId: id })}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
