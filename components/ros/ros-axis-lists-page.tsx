"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function useSyncedItemState(item: {
  _id: Id<"rosAxisListItems">;
  label: string;
  description?: string;
}) {
  const [label, setLabel] = useState(item.label);
  const [desc, setDesc] = useState(item.description ?? "");
  useEffect(() => {
    setLabel(item.label);
    setDesc(item.description ?? "");
  }, [item._id, item.label, item.description]);
  return { label, setLabel, desc, setDesc };
}

export function RosAxisListsPage({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const lists = useQuery(api.rosAxisLists.listAxisLists, { workspaceId });
  const createList = useMutation(api.rosAxisLists.createAxisList);
  const removeList = useMutation(api.rosAxisLists.removeAxisList);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<Id<"rosAxisLists"> | null>(null);

  const onCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const n = newName.trim();
      if (!n) return;
      setBusy(true);
      try {
        await createList({
          workspaceId,
          name: n,
          description: newDesc.trim() || undefined,
        });
        setNewName("");
        setNewDesc("");
      } finally {
        setBusy(false);
      }
    },
    [createList, newDesc, newName, workspaceId],
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-10">
      <header className="space-y-1">
        <Link
          href={`/w/${workspaceId}/ros`}
          className="text-muted-foreground hover:text-foreground mb-1 inline-flex text-sm transition-colors"
        >
          ← ROS
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Akser og etiketter
        </h1>
        <p className="text-sm text-muted-foreground">
          Skalaene som brukes i risikomatrisen.
        </p>
      </header>

      <details className="group overflow-hidden rounded-2xl border border-border/50 bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden sm:px-5">
          <span className="inline-flex items-center gap-2">
            <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-semibold text-foreground">Ny liste</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <form
          onSubmit={(e) => void onCreate(e)}
          className="flex flex-col gap-3 border-t border-border/40 px-4 py-4 sm:px-5"
        >
          <div className="space-y-2">
            <Label htmlFor="axis-new-name">Navn</Label>
            <Input
              id="axis-new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="F.eks. Konsekvens (helse)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="axis-new-desc">Beskrivelse (valgfritt)</Label>
            <Textarea
              id="axis-new-desc"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="min-h-0"
            />
          </div>
          <Button
            type="submit"
            className="self-start rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            disabled={busy || !newName.trim()}
          >
            Opprett liste
          </Button>
        </form>
      </details>

      {lists === undefined ? (
        <p className="text-muted-foreground text-sm">Henter lister …</p>
      ) : lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Ingen lister ennå. Opprett den første over.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
          {lists.map((L) => (
            <li key={L._id}>
              <div
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/25 sm:px-5"
                onClick={() => setOpenId((id) => (id === L._id ? null : L._id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId((id) => (id === L._id ? null : L._id));
                  }
                }}
                aria-expanded={openId === L._id}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium tracking-tight text-foreground">
                    {L.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className="font-mono">{L.code}</span>
                    {L.description ? ` · ${L.description}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Slett listen ${L.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      typeof window !== "undefined" &&
                      window.confirm(
                        `Slette listen «${L.name}» og alle punkter?`,
                      )
                    ) {
                      void removeList({ listId: L._id });
                      if (openId === L._id) setOpenId(null);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
                <ChevronDown
                  className={
                    openId === L._id
                      ? "size-4 shrink-0 rotate-180 text-foreground transition-transform"
                      : "size-4 shrink-0 text-muted-foreground/40 transition-transform"
                  }
                  aria-hidden
                />
              </div>
              {openId === L._id ? (
                <div className="border-t border-border/40 bg-muted/[0.06] px-4 py-4 sm:px-5">
                  <AxisListDetail listId={L._id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AxisListDetail({ listId }: { listId: Id<"rosAxisLists"> }) {
  const data = useQuery(api.rosAxisLists.getAxisListWithItems, { listId });
  const updateList = useMutation(api.rosAxisLists.updateAxisList);
  const addItem = useMutation(api.rosAxisLists.addAxisListItem);
  const updateItem = useMutation(api.rosAxisLists.updateAxisListItem);
  const removeItem = useMutation(api.rosAxisLists.removeAxisListItem);
  const reorderItems = useMutation(api.rosAxisLists.reorderAxisListItems);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data?.list) return;
    setName(data.list.name);
    setDesc(data.list.description ?? "");
    setCode(data.list.code);
  }, [listId, data?.list.updatedAt]);

  if (data === undefined) {
    return <p className="text-muted-foreground text-sm">Henter …</p>;
  }
  if (data === null) {
    return <p className="text-destructive text-sm">Listen finnes ikke.</p>;
  }

  const { list, items } = data;

  async function saveMeta() {
    setBusy(true);
    try {
      await updateList({
        listId,
        name: name.trim(),
        description: desc.trim() || null,
        code: code.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onAddItem(e: React.FormEvent) {
    e.preventDefault();
    const l = newLabel.trim();
    if (!l) return;
    setBusy(true);
    try {
      await addItem({
        listId,
        label: l,
        description: newItemDesc.trim() || undefined,
      });
      setNewLabel("");
      setNewItemDesc("");
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const order = [...items];
    const t = order[idx]!;
    order[idx] = order[next]!;
    order[next] = t;
    await reorderItems({
      listId,
      orderedItemIds: order.map((x) => x._id),
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`ln-${listId}`}>Navn</Label>
          <Input
            id={`ln-${listId}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`lc-${listId}`}>Kode</Label>
          <Input
            id={`lc-${listId}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`ld-${listId}`}>Beskrivelse</Label>
          <Textarea
            id={`ld-${listId}`}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="min-h-0"
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={busy || !name.trim()}
        onClick={() => void saveMeta()}
      >
        Lagre liste-metadata
      </Button>

      <form onSubmit={(e) => void onAddItem(e)} className="space-y-2 rounded-lg border border-dashed p-3">
        <p className="text-sm font-medium">Nytt punkt</p>
        <Input
          placeholder="Etikett"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <Textarea
          placeholder="Beskrivelse (valgfritt)"
          value={newItemDesc}
          onChange={(e) => setNewItemDesc(e.target.value)}
          rows={2}
          className="min-h-0"
        />
        <Button type="submit" size="sm" disabled={busy || !newLabel.trim()}>
          <Plus className="mr-2 size-4" />
          Legg til punkt
        </Button>
      </form>

      <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/40 bg-card">
        {items.map((it, idx) => (
          <AxisListItemRow
            key={it._id}
            item={it}
            canUp={idx > 0}
            canDown={idx < items.length - 1}
            onMoveUp={() => void moveItem(idx, -1)}
            onMoveDown={() => void moveItem(idx, 1)}
            onUpdate={updateItem}
            onRemove={removeItem}
          />
        ))}
      </ul>
    </div>
  );
}

function AxisListItemRow({
  item,
  canUp,
  canDown,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onRemove,
}: {
  item: {
    _id: Id<"rosAxisListItems">;
    label: string;
    description?: string;
    sortOrder: number;
  };
  canUp: boolean;
  canDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (args: {
    itemId: Id<"rosAxisListItems">;
    label?: string;
    description?: string | null;
  }) => Promise<unknown>;
  onRemove: (args: { itemId: Id<"rosAxisListItems"> }) => Promise<unknown>;
}) {
  const { label, setLabel, desc, setDesc } = useSyncedItemState(item);
  const [saving, setSaving] = useState(false);

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            const t = label.trim();
            if (t && t !== item.label) {
              setSaving(true);
              void onUpdate({ itemId: item._id, label: t }).finally(() =>
                setSaving(false),
              );
            }
          }}
        />
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => {
            const t = desc.trim();
            const prev = item.description ?? "";
            if (t !== prev) {
              setSaving(true);
              void onUpdate({
                itemId: item._id,
                description: t === "" ? null : t,
              }).finally(() => setSaving(false));
            }
          }}
          rows={2}
          className="min-h-0 text-sm"
          placeholder="Beskrivelse (valgfritt)"
        />
        {saving ? (
          <span className="text-muted-foreground text-xs">Lagrer …</span>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1 self-end sm:flex-col sm:self-stretch">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8"
          disabled={!canUp}
          onClick={onMoveUp}
          aria-label="Flytt opp"
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8"
          disabled={!canDown}
          onClick={onMoveDown}
          aria-label="Flytt ned"
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-destructive size-8"
          onClick={() => {
            if (window.confirm("Slette dette punktet?")) {
              void onRemove({ itemId: item._id });
            }
          }}
          aria-label="Slett"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
