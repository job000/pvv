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
import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ChevronRight, Trash2 } from "lucide-react";
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
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <p className="font-medium">{contact.name}</p>
        {contact.title ? (
          <p className="text-muted-foreground text-xs">{contact.title}</p>
        ) : null}
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="text-primary text-xs underline">
            {contact.email}
          </a>
        ) : null}
        {contact.phone ? (
          <p className="text-xs">
            <a
              href={`tel:${contact.phone.replace(/\s/g, "")}`}
              className="text-primary underline"
            >
              {contact.phone}
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Navn</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stilling</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">E-post</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefon</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notater</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => void save()}>
          Lagre
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
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
        Merkantile kontakter
      </p>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Du kan registrere flere personer per enhet (innkjøp, avtaler, faktura
        osv.).
      </p>

      {contacts.length === 0 && hasLegacy ? (
        <div className="rounded-lg border border-dashed bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">Eldre registrering (én kontakt)</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Tidligere lagret som ett felt på enheten. Importer til listen for å
            kunne legge til flere.
          </p>
          {unit.merkantilContactName ? (
            <p className="mt-2">
              {unit.merkantilContactName}
              {unit.merkantilContactTitle
                ? ` · ${unit.merkantilContactTitle}`
                : ""}
            </p>
          ) : null}
          {unit.merkantilContactEmail ? (
            <p className="text-xs">
              <a href={`mailto:${unit.merkantilContactEmail}`} className="underline">
                {unit.merkantilContactEmail}
              </a>
            </p>
          ) : null}
          {unit.merkantilContactPhone ? (
            <p className="text-xs">{unit.merkantilContactPhone}</p>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => void importLegacy({ orgUnitId: unit._id })}
            >
              Importer til kontaktliste
            </Button>
          ) : null}
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
        <p className="text-muted-foreground text-xs">Ingen merkantile kontakter ennå.</p>
      ) : null}

      {canEdit ? (
        <form
          onSubmit={(ev) => void submitAdd(ev)}
          className="space-y-2 rounded-lg border border-dashed p-3"
        >
          <p className="font-medium text-sm">Legg til kontakt</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Navn *</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="h-8 text-sm"
                placeholder="Fornavn Etternavn"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stilling</Label>
              <Input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-post</Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notater</Label>
            <Textarea
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              rows={2}
              className="text-sm"
              placeholder="Ansvarsområde, avtalereferanse …"
            />
          </div>
          {addMsg ? (
            <p className="text-destructive text-xs" role="alert">
              {addMsg}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={!addName.trim()}>
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
  const [open, setOpen] = useState(depth < 2);

  return (
    <li className="list-none">
      <div
        className="rounded-xl border bg-card"
        style={{ marginLeft: depth === 0 ? 0 : Math.min(depth * 12, 48) }}
      >
        <button
          type="button"
          className="flex w-full items-start gap-2 px-4 py-3 text-left"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <ChevronRight
            className={`text-muted-foreground mt-0.5 size-4 shrink-0 transition ${
              open ? "rotate-90" : ""
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-wide">
              {ORG_UNIT_KIND_LABELS[unit.kind]}
              {unit.localCode ? ` · ${unit.localCode}` : ""}
            </p>
            <p className="font-heading font-semibold">{unit.name}</p>
            {unit.shortName ? (
              <p className="text-muted-foreground text-sm">{unit.shortName}</p>
            ) : null}
            {unit.extraInfo ? (
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed whitespace-pre-wrap">
                {unit.extraInfo}
              </p>
            ) : null}
          </div>
        </button>
        <div className="border-t px-4 py-3">
          <MerkantilContactsBlock
            unit={unit}
            contacts={contactsForUnit}
            canEdit={canEdit}
          />
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2 border-t px-4 py-2">
            <a
              href={`#add-child-${unit._id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Legg til underenhet
            </a>
            {isAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
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
                <Trash2 className="size-4" />
                Slett
              </Button>
            ) : null}
          </div>
        ) : null}
        {open && kids.length > 0 ? (
          <ul className="space-y-2 border-t px-2 py-3">
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
      className="border-muted mt-3 ml-4 space-y-3 rounded-xl border border-dashed p-4"
    >
      <p className="font-medium text-sm">
        Ny {ORG_UNIT_KIND_LABELS[kindForChild]} under {parent.name}
      </p>
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Navn</Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="F.eks. Medisinsk klinikk"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-extra`}>Annen informasjon</Label>
        <Textarea
          id={`${id}-extra`}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          placeholder="Åpningstider, avtalereferanser, rom …"
        />
      </div>
      {msg ? (
        <p className="text-muted-foreground text-sm" role="status">
          {msg}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={!name.trim()}>
        Opprett underenhet
      </Button>
    </form>
  );
}

function AddHelseforetakForm({
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
      setMsg("Helseforetak opprettet.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Kunne ikke opprette.");
    }
  }

  return (
    <Card id="ny-helseforetak">
      <CardHeader>
        <CardTitle className="text-base">Nytt helseforetak</CardTitle>
        <CardDescription>
          Start organisasjonskartet her. Merkantile kontakter legges inn under
          hver enhet etter opprettelse (flere personer per HF/avdeling/seksjon).
          Under hvert helseforetak legger du avdelinger, og under avdelinger
          seksjoner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hf-name">Navn på helseforetak</Label>
              <Input
                id="hf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="F.eks. Helse Bergen HF"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hf-short">Kortnavn (valgfritt)</Label>
              <Input
                id="hf-short"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hf-code">Lokal kode (valgfritt)</Label>
              <Input
                id="hf-code"
                value={localCode}
                onChange={(e) => setLocalCode(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hf-extra">Annen nødvendig informasjon</Label>
            <Textarea
              id="hf-extra"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={3}
              placeholder="F.eks. avtalereferanser, åpningstider, interne kanaler …"
            />
          </div>
          {msg ? (
            <p className="text-muted-foreground text-sm" role="status">
              {msg}
            </p>
          ) : null}
          <Button type="submit" disabled={!name.trim()}>
            Opprett helseforetak
          </Button>
        </form>
      </CardContent>
    </Card>
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
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Organisasjonskart</CardTitle>
          <CardDescription>
            Hierarki: helseforetak → avdeling → seksjon. Legg inn flere
            merkantile kontakter per enhet (innkjøp, avtaler, faktura osv.).
            Strukturen støtter flere helseforetak i samme arbeidsområde.
          </CardDescription>
        </CardHeader>
      </Card>

      {canEdit ? <AddHelseforetakForm workspaceId={workspaceId} /> : null}

      {roots.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Ingen enheter ennå. {canEdit ? "Opprett et helseforetak over." : ""}
        </p>
      ) : (
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
      )}
    </div>
  );
}
