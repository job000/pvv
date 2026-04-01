"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { RPA_JOURNAL_SEED_CATEGORY_NAME } from "@/lib/ros-library-rpa-journal-seed";
import {
  ROS_CELL_FLAG_REQUIRES_ACTION,
  ROS_CELL_FLAG_WATCH,
} from "@/lib/ros-cell-items";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BookMarked,
  Copy,
  Eye,
  FolderInput,
  Globe2,
  LayoutGrid,
  Sparkles,
  Lock,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type SortKey = "category" | "title" | "updated";

type ItemRow = {
  _id: Id<"rosLibraryItems">;
  title: string;
  riskText: string;
  tiltakText?: string;
  flags?: string[];
  visibility: "workspace" | "shared";
  categoryId?: Id<"rosLibraryCategories">;
  categoryName?: string | null;
  isFromOtherWorkspace?: boolean;
  sourceWorkspaceName?: string | null;
  updatedAt: number;
};

export function RosLibraryPanel({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const categories = useQuery(api.rosLibrary.listLibraryCategories, { workspaceId });
  const [sortBy, setSortBy] = useState<SortKey>("category");
  const items = useQuery(api.rosLibrary.listLibraryItems, { workspaceId, sortBy });
  const createItem = useMutation(api.rosLibrary.createLibraryItem);
  const updateItem = useMutation(api.rosLibrary.updateLibraryItem);
  const removeItem = useMutation(api.rosLibrary.removeLibraryItem);
  const duplicateToWorkspace = useMutation(
    api.rosLibrary.duplicateLibraryItemToWorkspace,
  );
  const createCategory = useMutation(api.rosLibrary.createLibraryCategory);
  const updateCategory = useMutation(api.rosLibrary.updateLibraryCategory);
  const removeCategory = useMutation(api.rosLibrary.removeLibraryCategory);
  const seedRpaJournalExamples = useMutation(
    api.rosLibrary.seedRpaJournalLibraryExamples,
  );

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<
    "all" | "none" | Id<"rosLibraryCategories">
  >("all");

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);

  const [title, setTitle] = useState("");
  const [riskText, setRiskText] = useState("");
  const [tiltakText, setTiltakText] = useState("");
  const [visibility, setVisibility] = useState<"workspace" | "shared">(
    "workspace",
  );
  const [categoryId, setCategoryId] = useState<
    Id<"rosLibraryCategories"> | ""
  >("");
  const [flagTiltak, setFlagTiltak] = useState(false);
  const [flagWatch, setFlagWatch] = useState(false);
  const [busy, setBusy] = useState(false);

  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<
    Id<"rosLibraryCategories"> | null
  >(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [deleteItemId, setDeleteItemId] = useState<Id<"rosLibraryItems"> | null>(
    null,
  );
  const [deleteCategoryId, setDeleteCategoryId] = useState<
    Id<"rosLibraryCategories"> | null
  >(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedReplaceDialogOpen, setSeedReplaceDialogOpen] = useState(false);

  const resetItemForm = useCallback(() => {
    setTitle("");
    setRiskText("");
    setTiltakText("");
    setVisibility("workspace");
    setCategoryId("");
    setFlagTiltak(false);
    setFlagWatch(false);
    setEditingItem(null);
  }, []);

  const openNewItem = useCallback(() => {
    resetItemForm();
    setItemDialogOpen(true);
  }, [resetItemForm]);

  const openEditItem = useCallback((row: ItemRow) => {
    setEditingItem(row);
    setTitle(row.title);
    setRiskText(row.riskText);
    setTiltakText(row.tiltakText ?? "");
    setVisibility(row.visibility);
    setCategoryId(row.categoryId ?? "");
    setFlagTiltak(row.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION) ?? false);
    setFlagWatch(row.flags?.includes(ROS_CELL_FLAG_WATCH) ?? false);
    setItemDialogOpen(true);
  }, []);

  const loadCategoryForEdit = useCallback(
    (cat: { _id: Id<"rosLibraryCategories">; name: string }) => {
      setEditingCategoryId(cat._id);
      setEditCategoryName(cat.name);
    },
    [],
  );

  const onSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const r = riskText.trim();
    if (!t || !r) {
      toast.error("Tittel og risiko er påkrevd.");
      return;
    }
    const flags: string[] = [];
    if (flagTiltak) flags.push(ROS_CELL_FLAG_REQUIRES_ACTION);
    if (flagWatch) flags.push(ROS_CELL_FLAG_WATCH);
    setBusy(true);
    try {
      if (editingItem) {
        await updateItem({
          itemId: editingItem._id,
          title: t,
          riskText: r,
          tiltakText: tiltakText.trim() || null,
          flags: flags.length ? flags : null,
          visibility,
          categoryId: categoryId === "" ? null : categoryId,
        });
        toast.success("Bibliotekelement oppdatert.");
      } else {
        await createItem({
          workspaceId,
          title: t,
          riskText: r,
          tiltakText: tiltakText.trim() || undefined,
          flags: flags.length ? flags : undefined,
          visibility,
          categoryId: categoryId === "" ? undefined : categoryId,
        });
        toast.success("Lagret i biblioteket.");
      }
      resetItemForm();
      setItemDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lagring feilet.");
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = newCategoryName.trim();
    if (!n) {
      toast.error("Skriv inn et kategorinavn.");
      return;
    }
    setCategoryBusy(true);
    try {
      await createCategory({ workspaceId, name: n });
      toast.success("Kategori opprettet.");
      setNewCategoryName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke opprette kategori.");
    } finally {
      setCategoryBusy(false);
    }
  };

  const saveCategoryName = async () => {
    if (!editingCategoryId) return;
    const n = editCategoryName.trim();
    if (!n) {
      toast.error("Navnet kan ikke være tomt.");
      return;
    }
    setCategoryBusy(true);
    try {
      await updateCategory({ categoryId: editingCategoryId, name: n });
      toast.success("Kategori oppdatert.");
      setEditingCategoryId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre.");
    } finally {
      setCategoryBusy(false);
    }
  };

  const confirmRemoveCategory = async () => {
    if (!deleteCategoryId) return;
    setCategoryBusy(true);
    try {
      await removeCategory({ categoryId: deleteCategoryId });
      toast.success("Kategori fjernet. Elementer er uten kategori.");
      setDeleteCategoryId(null);
      if (editingCategoryId === deleteCategoryId) setEditingCategoryId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sletting feilet.");
    } finally {
      setCategoryBusy(false);
    }
  };

  const confirmRemoveItem = async () => {
    if (!deleteItemId) return;
    setBusy(true);
    try {
      await removeItem({ itemId: deleteItemId });
      toast.success("Element slettet fra biblioteket.");
      setDeleteItemId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sletting feilet.");
    } finally {
      setBusy(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return (items as ItemRow[]).filter((it) => {
      if (filterCategory === "all") {
        /* ok */
      } else if (filterCategory === "none") {
        if (it.categoryId) return false;
      } else if (it.categoryId !== filterCategory) {
        return false;
      }
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.riskText.toLowerCase().includes(q) ||
        (it.tiltakText?.toLowerCase().includes(q) ?? false) ||
        (it.categoryName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, filterCategory, search]);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.03] via-background to-muted/40 p-4 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/[0.06] blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <LayoutGrid className="size-5" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Gjenbruk
              </span>
            </div>
            <h2
              id="ros-bibliotek-heading"
              className="font-heading text-lg font-semibold tracking-tight sm:text-xl"
            >
              Risiko- og tiltaksbibliotek
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Gjenbrukbare risiko- og tiltakstekster (ikke analyse-listen — den ligger under
              «Alle ROS»). Organiser med kategorier, sorter, og bruk innhold i analyser. «Delt»
              gjør tekst tilgjengelig på tvers av arbeidsområder du er medlem av. Under finner du
              «Legg inn eksempler» for RPA/journalsystem.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 w-full touch-manipulation gap-1.5 sm:min-h-9 sm:w-auto"
              onClick={() => setCategoriesDialogOpen(true)}
            >
              <Settings2 className="size-3.5" />
              Kategorier
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-11 w-full touch-manipulation gap-1.5 sm:min-h-9 sm:w-auto"
              onClick={openNewItem}
            >
              <Plus className="size-3.5" />
              Nytt element
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-border/60 bg-muted/10">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-primary/15">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Eksempler: RPA og journalsystemer</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Legg inn kategorien «{RPA_JOURNAL_SEED_CATEGORY_NAME}» med risiko og tiltak
                for{" "}
                <strong className="text-foreground font-medium">DIPS</strong>,{" "}
                <strong className="text-foreground font-medium">MetaVision</strong> og{" "}
                <strong className="text-foreground font-medium">Medanets</strong>. Du kan
                redigere eller slette hvert element etterpå — de er vanlige biblioteksposter.
                Taggen <span className="font-mono text-[11px]">seed-rpa-journal</span> brukes
                til å gjenkjenne innlagte eksempler (søk eller filtrer i listen).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 touch-manipulation gap-2 sm:min-h-10"
            disabled={seedBusy}
            onClick={() => {
              setSeedBusy(true);
              void (async () => {
                try {
                  const r = await seedRpaJournalExamples({ workspaceId });
                  if (r.inserted === 0) {
                    toast.message("Alle eksempler fantes allerede.");
                  } else {
                    toast.success(
                      `Lagt inn ${r.inserted} eksempler (${r.totalSeedItems} totalt i settet).`,
                    );
                  }
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Kunne ikke legge inn eksempler.",
                  );
                } finally {
                  setSeedBusy(false);
                }
              })();
            }}
          >
            {seedBusy ? "Legger inn …" : "Legg inn eksempler"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 touch-manipulation gap-2 sm:min-h-10"
            disabled={seedBusy}
            onClick={() => setSeedReplaceDialogOpen(true)}
          >
            Erstatt eksempler …
          </Button>
        </CardContent>
      </Card>

      <Dialog open={seedReplaceDialogOpen} onOpenChange={setSeedReplaceDialogOpen}>
        <DialogContent size="md" titleId="seed-replace-title" descriptionId="seed-replace-desc">
          <DialogHeader>
            <p id="seed-replace-title" className="font-heading text-lg font-semibold">
              Erstatt RPA-eksempler?
            </p>
            <p
              id="seed-replace-desc"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              Alle bibliotekselementer med taggen{" "}
              <span className="font-mono text-xs">seed-rpa-journal</span> i dette
              arbeidsområdet slettes, deretter legges eksemplene inn på nytt. Andre
              elementer i biblioteket påvirkes ikke.
            </p>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSeedReplaceDialogOpen(false)}
              disabled={seedBusy}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={seedBusy}
              onClick={() => {
                setSeedBusy(true);
                void (async () => {
                  try {
                    const r = await seedRpaJournalExamples({
                      workspaceId,
                      replace: true,
                    });
                    toast.success(
                      `Eksempler oppdatert: ${r.inserted} elementer lagt inn.`,
                    );
                    setSeedReplaceDialogOpen(false);
                  } catch (e) {
                    toast.error(
                      e instanceof Error
                        ? e.message
                        : "Kunne ikke erstatte eksempler.",
                    );
                  } finally {
                    setSeedBusy(false);
                  }
                })();
              }}
            >
              {seedBusy ? "Erstatter …" : "Slett og legg inn på nytt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtrer og sorter</CardTitle>
          <CardDescription>
            Søk i tekst og tittel, eller begrens til én kategori.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="lib-search" className="text-muted-foreground text-[10px]">
                Søk
              </Label>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  id="lib-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tittel, risiko, tiltak …"
                  className="min-h-11 touch-manipulation pl-9 sm:min-h-10"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:min-w-[14rem] sm:max-w-[20rem]">
              <Label htmlFor="lib-sort" className="text-muted-foreground text-[10px]">
                Sortering
              </Label>
              <select
                id="lib-sort"
                className="border-input bg-background flex min-h-11 w-full touch-manipulation rounded-lg border px-2 text-sm sm:min-h-10"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
              >
                <option value="category">Kategori, deretter tittel</option>
                <option value="title">Tittel (A–Å)</option>
                <option value="updated">Sist oppdatert</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterCategory("all")}
              className={cn(
                "min-h-10 touch-manipulation rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filterCategory === "all"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60",
              )}
            >
              Alle
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory("none")}
              className={cn(
                "min-h-10 touch-manipulation rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filterCategory === "none"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60",
              )}
            >
              Uten kategori
            </button>
              {(categories ?? []).map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => setFilterCategory(c._id)}
                  className={cn(
                    "min-h-10 touch-manipulation rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filterCategory === c._id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-foreground mb-4 flex flex-wrap items-baseline gap-2 text-sm font-semibold">
          <span>{filteredItems.length}</span>
          <span className="text-muted-foreground font-normal">
            {filteredItems.length === 1 ? "element" : "elementer"}
            {search.trim() || filterCategory !== "all"
              ? " (filtrert)"
              : ""}
          </span>
        </h3>
        {items === undefined || categories === undefined ? (
          <p className="text-muted-foreground text-sm">Henter bibliotek …</p>
        ) : filteredItems.length === 0 ? (
          <div className="text-muted-foreground rounded-2xl border border-dashed border-primary/25 bg-primary/[0.02] px-6 py-14 text-center text-sm">
            <BookMarked className="text-muted-foreground/60 mx-auto mb-3 size-10" />
            <p className="text-foreground font-medium">Ingen treff</p>
            <p className="mt-1 text-xs">
              Juster søk eller filter, eller legg til et nytt element.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {filteredItems.map((row) => {
              const badges = (
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {row.categoryName ? (
                      <Badge
                        variant="secondary"
                        className="max-w-full truncate font-normal"
                      >
                        <FolderInput className="mr-0.5 size-3 shrink-0" />
                        {row.categoryName}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Uten kategori
                      </Badge>
                    )}
                    {row.visibility === "shared" ? (
                      <Badge variant="outline" className="gap-0.5 font-normal">
                        <Globe2 className="size-3" />
                        Delt
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-0.5 font-normal">
                        <Lock className="size-3" />
                        Rom
                      </Badge>
                    )}
                    {row.isFromOtherWorkspace ? (
                      <Badge variant="outline" className="font-normal">
                        Fra {row.sourceWorkspaceName ?? "annet rom"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
              const body = (
                <>
                  <p className="font-heading text-base font-semibold leading-snug">
                    {row.title}
                  </p>
                  <p className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap">
                    {row.riskText}
                  </p>
                  {row.tiltakText ? (
                    <p className="border-border/50 text-foreground/90 border-l-2 pl-2 text-sm whitespace-pre-wrap">
                      <span className="text-muted-foreground text-xs font-medium">
                        Tiltak:{" "}
                      </span>
                      {row.tiltakText}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {row.flags?.includes(ROS_CELL_FLAG_REQUIRES_ACTION) ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-300">
                        <AlertTriangle className="size-3" />
                        Må håndteres
                      </span>
                    ) : null}
                    {row.flags?.includes(ROS_CELL_FLAG_WATCH) ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                        <Eye className="size-3" />
                        Følg med
                      </span>
                    ) : null}
                  </div>
                </>
              );
              return (
                <li
                  key={row._id}
                  className="border-border/60 group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  {row.isFromOtherWorkspace ? (
                    <div className="p-3 sm:p-4">
                      {badges}
                      <div className="min-w-0 flex-1 space-y-2">{body}</div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="hover:bg-muted/30 w-full flex-1 touch-manipulation px-3 pb-2 pt-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4 sm:pb-3 sm:pt-4"
                      onClick={() => openEditItem(row)}
                      aria-label={`Rediger bibliotekelement: ${row.title}`}
                    >
                      {badges}
                      <div className="min-w-0 flex-1 space-y-2">{body}</div>
                      <p className="text-muted-foreground mt-2 text-[10px] sm:hidden">
                        Trykk for å redigere
                      </p>
                    </button>
                  )}
                  <div
                    className={cn(
                      "flex flex-wrap gap-2 border-t border-border/40 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3",
                      row.isFromOtherWorkspace && "pt-3",
                    )}
                  >
                    {row.isFromOtherWorkspace ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="min-h-11 touch-manipulation gap-1 sm:min-h-9"
                        onClick={() => {
                          void (async () => {
                            try {
                              await duplicateToWorkspace({
                                itemId: row._id,
                                targetWorkspaceId: workspaceId,
                              });
                              toast.success("Kopi lagret i dette arbeidsområdet.");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Kunne ikke kopiere.",
                              );
                            }
                          })();
                        }}
                      >
                        <Copy className="size-3.5" />
                        Kopier hit
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="min-h-11 touch-manipulation gap-1 sm:min-h-9"
                          onClick={() => openEditItem(row)}
                        >
                          <Pencil className="size-3.5" />
                          Rediger
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive min-h-11 touch-manipulation gap-1 sm:min-h-9"
                          onClick={() => setDeleteItemId(row._id)}
                        >
                          <Trash2 className="size-3.5" />
                          Slett
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Element — opprett / rediger */}
      <Dialog
        open={itemDialogOpen}
        onOpenChange={(open) => {
          setItemDialogOpen(open);
          if (!open) resetItemForm();
        }}
      >
        <DialogContent
          size="lg"
          titleId="lib-item-dialog"
          className="max-h-[min(90vh,44rem)] overflow-y-auto"
        >
          <DialogHeader>
            <h2
              id="lib-item-dialog"
              className="font-heading text-lg font-semibold"
            >
              {editingItem ? "Rediger bibliotekelement" : "Nytt bibliotekelement"}
            </h2>
            <p className="text-muted-foreground text-sm">
              Samme struktur som i analysen: risiko, valgfritt tiltak og
              markeringer.
            </p>
          </DialogHeader>
          <form onSubmit={(e) => void onSubmitItem(e)}>
            <DialogBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lib-d-title">Tittel (kort)</Label>
                <Input
                  id="lib-d-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="F.eks. Tap av taushetsplikt"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lib-d-risk">Risiko</Label>
                <Textarea
                  id="lib-d-risk"
                  value={riskText}
                  onChange={(e) => setRiskText(e.target.value)}
                  rows={3}
                  placeholder="Hva kan gå galt?"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lib-d-tiltak">Tiltak / plan (valgfritt)</Label>
                <Textarea
                  id="lib-d-tiltak"
                  value={tiltakText}
                  onChange={(e) => setTiltakText(e.target.value)}
                  rows={2}
                  placeholder="Foreslått håndtering — settes inn som eget punkt i cellen"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lib-d-cat">Kategori</Label>
                  <select
                    id="lib-d-cat"
                    className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                    value={categoryId}
                    onChange={(e) =>
                      setCategoryId(
                        (e.target.value || "") as Id<"rosLibraryCategories"> | "",
                      )
                    }
                  >
                    <option value="">— Ingen —</option>
                    {(categories ?? []).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-muted-foreground text-[10px]">
                    Opprett kategorier under «Kategorier».
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lib-d-vis">Synlighet</Label>
                  <select
                    id="lib-d-vis"
                    className="border-input bg-background flex h-10 w-full rounded-lg border px-2 text-sm"
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as "workspace" | "shared")
                    }
                  >
                    <option value="workspace">Kun dette arbeidsområdet</option>
                    <option value="shared">Delt — alle mine arbeidsområder</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={flagTiltak}
                    onChange={(e) => setFlagTiltak(e.target.checked)}
                    className="rounded border-input"
                  />
                  <AlertTriangle className="text-orange-600 size-4" />
                  Må håndteres
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={flagWatch}
                    onChange={(e) => setFlagWatch(e.target.checked)}
                    className="rounded border-input"
                  />
                  <Eye className="text-blue-600 size-4" />
                  Følg med
                </label>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setItemDialogOpen(false);
                  resetItemForm();
                }}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Lagrer …" : editingItem ? "Lagre endringer" : "Lagre"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Kategorier */}
      <Dialog open={categoriesDialogOpen} onOpenChange={setCategoriesDialogOpen}>
        <DialogContent size="md" titleId="lib-cat-dialog">
          <DialogHeader>
            <h2 id="lib-cat-dialog" className="font-heading text-lg font-semibold">
              Kategorier
            </h2>
            <p className="text-muted-foreground text-sm">
              Kategorier brukes til filtrering og sortering i biblioteket. Sletting
              fjerner bare kategorien — elementene beholdes uten kategori.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <form onSubmit={addCategory} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ny kategori …"
                className="flex-1"
              />
              <Button type="submit" disabled={categoryBusy} className="shrink-0 gap-1">
                <Plus className="size-3.5" />
                Legg til
              </Button>
            </form>
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {(categories ?? []).length === 0 ? (
                <li className="text-muted-foreground text-sm">
                  Ingen kategorier ennå — legg til over.
                </li>
              ) : (
                (categories ?? []).map((c) => (
                  <li
                    key={c._id}
                    className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {editingCategoryId === c._id ? (
                      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                        <Input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          className="min-w-0 flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={categoryBusy}
                          onClick={() => void saveCategoryName()}
                        >
                          Lagre
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCategoryId(null)}
                        >
                          Avbryt
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 font-medium">{c.name}</span>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => loadCategoryForEdit(c)}
                          >
                            Endre navn
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleteCategoryId(c._id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCategoriesDialogOpen(false)}
            >
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bekreft slett element */}
      <Dialog open={deleteItemId !== null} onOpenChange={(o) => !o && setDeleteItemId(null)}>
        <DialogContent size="sm" titleId="lib-del-item">
          <DialogHeader>
            <h2 id="lib-del-item" className="font-heading text-lg font-semibold">
              Slette element?
            </h2>
            <p className="text-muted-foreground text-sm">
              Dette kan ikke angres. Elementet fjernes fra biblioteket.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteItemId(null)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmRemoveItem()}
            >
              {busy ? "Sletter …" : "Slett"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bekreft slett kategori */}
      <Dialog
        open={deleteCategoryId !== null}
        onOpenChange={(o) => !o && setDeleteCategoryId(null)}
      >
        <DialogContent size="sm" titleId="lib-del-cat">
          <DialogHeader>
            <h2 id="lib-del-cat" className="font-heading text-lg font-semibold">
              Fjerne kategori?
            </h2>
            <p className="text-muted-foreground text-sm">
              Elementer i denne kategorien flyttes til «uten kategori».
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteCategoryId(null)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={categoryBusy}
              onClick={() => void confirmRemoveCategory()}
            >
              {categoryBusy ? "Fjerner …" : "Fjern kategori"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
