"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProductLoadingBlock } from "@/components/product";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Warehouse,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

type Tab = "users" | "workspaces";

/* ════════════════════════════════════════════════════════════════════
   Root page — auth gate + layout wrapper
   ════════════════════════════════════════════════════════════════════ */

export default function SuperAdminPage() {
  const access = useQuery(api.superAdmin.checkAccess);
  const myWorkspaces = useQuery(api.workspaces.listMine);
  const settings = useQuery(api.workspaces.getMySettings);
  const router = useRouter();

  if (access === undefined || myWorkspaces === undefined) {
    return <ProductLoadingBlock label="Sjekker tilgang …" className="min-h-[50vh]" />;
  }

  const defaultId = settings?.defaultWorkspaceId ?? null;

  if (!access.isSuperAdmin) {
    return (
      <DashboardLayout workspaces={myWorkspaces} defaultWorkspaceId={defaultId}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
          <Shield className="size-12 text-muted-foreground/40" />
          <h1 className="text-lg font-semibold">Ingen tilgang</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Denne siden er kun for superadministratorer.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
            Tilbake til oversikt
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout workspaces={myWorkspaces} defaultWorkspaceId={defaultId}>
      <SuperAdminDashboard />
    </DashboardLayout>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Dashboard shell
   ════════════════════════════════════════════════════════════════════ */

function SuperAdminDashboard() {
  const [tab, setTab] = useState<Tab>("users");
  const allUsers = useQuery(api.superAdmin.listAllUsers);
  const allWorkspaces = useQuery(api.superAdmin.listAllWorkspaces);

  const stats = useMemo(() => {
    const saCount = allUsers?.filter((u) => u.isSuperAdmin).length ?? 0;
    return {
      users: allUsers?.length ?? "–",
      superAdmins: saCount,
      workspaces: allWorkspaces?.length ?? "–",
      assessments: allWorkspaces?.reduce((sum, w) => sum + w.assessmentCount, 0) ?? "–",
    };
  }, [allUsers, allWorkspaces]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 pb-16 pt-6 sm:px-8 lg:px-10">
      <header>
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden />
          Superadmin
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
          Administrasjon
        </h1>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Brukere" value={stats.users} />
        <StatCard label="Superadmins" value={stats.superAdmins} />
        <StatCard label="Arbeidsområder" value={stats.workspaces} />
        <StatCard label="Vurderinger" value={stats.assessments} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border/50 bg-muted/25 p-1">
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={Users}>
          Brukere
        </TabBtn>
        <TabBtn active={tab === "workspaces"} onClick={() => setTab("workspaces")} icon={Warehouse}>
          Arbeidsområder
        </TabBtn>
      </div>

      {tab === "users" ? (
        <UsersPanel users={allUsers} />
      ) : (
        <WorkspacesPanel workspaces={allWorkspaces} allUsers={allUsers} />
      )}
    </div>
  );
}

/* ── Shared small components ── */

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
      {children}
    </button>
  );
}

function Avatar({ name, email, image }: { name: string | null; email: string | null; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className="size-9 rounded-full object-cover ring-1 ring-border/40" />
    );
  }
  const letter = (name ?? email ?? "?").charAt(0).toUpperCase();
  return (
    <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
      {letter}
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  options = ["owner", "admin", "member", "viewer"],
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <select
        aria-label="Rolle"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 cursor-pointer appearance-none rounded-lg border border-border/60 bg-muted/30 pl-2 pr-6 text-xs font-medium outline-none transition-colors hover:bg-muted/50 focus:border-foreground/20"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   USERS PANEL
   ════════════════════════════════════════════════════════════════════ */

type UserRow = {
  _id: Id<"users">;
  _creationTime: number;
  name: string | null;
  email: string | null;
  image: string | null;
  isSuperAdmin: boolean;
  workspaces: { id: Id<"workspaces">; name: string; role: string }[];
};

function UsersPanel({ users }: { users: UserRow[] | undefined }) {
  const toggleSuperAdmin = useMutation(api.superAdmin.toggleSuperAdmin);
  const deleteUser = useMutation(api.superAdmin.deleteUser);

  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const filtered = useMemo(() => {
    if (!users) return [];
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term),
    );
  }, [users, q]);

  const handleToggleSA = useCallback(
    async (u: UserRow) => {
      const action = u.isSuperAdmin ? "fjerne" : "gi";
      if (!confirm(`${action === "gi" ? "Gi" : "Fjern"} superadmin-tilgang for ${u.name ?? u.email}?`)) return;
      await toggleSuperAdmin({ userId: u._id });
    },
    [toggleSuperAdmin],
  );

  const handleDelete = useCallback(
    async (u: UserRow) => {
      if (!confirm(`Slett ${u.name ?? u.email ?? "bruker"}? Alle medlemskap fjernes permanent.`)) return;
      await deleteUser({ userId: u._id });
    },
    [deleteUser],
  );

  if (users === undefined) {
    return <ProductLoadingBlock label="Laster brukere …" className="min-h-[30vh]" />;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk etter navn eller e-post …"
            className="pl-9"
          />
        </div>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">Ny bruker</span>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50">
        {/* Table header */}
        <div className="hidden border-b border-border/40 bg-muted/20 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[1fr_1fr_auto_auto]">
          <span>Bruker</span>
          <span>Arbeidsområder</span>
          <span className="w-16 text-center">Rolle</span>
          <span className="w-24 text-right">Handlinger</span>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {q ? "Ingen treff" : "Ingen brukere"}
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((u) => (
              <div
                key={u._id}
                className="group flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/20 sm:grid sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center sm:gap-4"
              >
                {/* User info */}
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} email={u.email} image={u.image} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight">
                      {u.name ?? "Uten navn"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email ?? "–"}
                    </p>
                  </div>
                </div>

                {/* Workspaces */}
                <div className="flex flex-wrap gap-1 pl-12 sm:pl-0">
                  {u.workspaces.length === 0 ? (
                    <span className="text-xs text-muted-foreground/60">Ingen</span>
                  ) : (
                    u.workspaces.map((w) => (
                      <span
                        key={w.id}
                        className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {w.name}
                        <span className="opacity-60">({w.role})</span>
                      </span>
                    ))
                  )}
                </div>

                {/* SA badge */}
                <div className="hidden w-16 justify-center sm:flex">
                  {u.isSuperAdmin ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/20">
                      <ShieldCheck className="size-3" />
                      SA
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">–</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 pl-12 sm:w-24 sm:pl-0">
                  <button
                    type="button"
                    onClick={() => setEditUser(u)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Rediger"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSA(u)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={u.isSuperAdmin ? "Fjern superadmin" : "Gi superadmin"}
                  >
                    <ShieldCheck className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(u)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Slett"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateUserDialog open={createOpen} setOpen={setCreateOpen} />
      <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />
    </>
  );
}

/* ── Create User Dialog ── */

function CreateUserDialog({ open, setOpen }: { open: boolean; setOpen: Dispatch<SetStateAction<boolean>> }) {
  const createUser = useMutation(api.superAdmin.createUser);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail("");
    setAge(""); setPassword(""); setConfirmPassword("");
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!firstName.trim()) { setError("Fornavn er påkrevd."); return; }
    if (!email.trim()) { setError("E-post er påkrevd."); return; }
    if (!password) { setError("Passord er påkrevd."); return; }
    if (password.length < 8) { setError("Passord må være minst 8 tegn."); return; }
    if (password !== confirmPassword) { setError("Passordene stemmer ikke overens."); return; }
    const parsedAge = age.trim() ? Number(age) : undefined;
    if (age.trim() && (isNaN(parsedAge!) || parsedAge! < 0 || parsedAge! > 150)) {
      setError("Ugyldig alder."); return;
    }
    setSaving(true);
    try {
      await createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        age: parsedAge,
      });
      reset();
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Noe gikk galt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <h2 className="text-lg font-semibold">Opprett ny bruker</h2>
          <p className="text-sm text-muted-foreground">
            Brukeren kan logge inn med e-post og passord.
          </p>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cu-first">Fornavn *</Label>
              <Input id="cu-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ola" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-last">Etternavn</Label>
              <Input id="cu-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nordmann" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="cu-email">E-post *</Label>
              <Input
                id="cu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ola@eksempel.no"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-age">Alder</Label>
              <Input
                id="cu-age"
                type="number"
                min={0}
                max={150}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="—"
                className="w-20"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cu-pw">Passord *</Label>
              <PasswordInput
                id="cu-pw"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 8 tegn"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-pw2">Bekreft passord *</Label>
              <PasswordInput
                id="cu-pw2"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Gjenta passord"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          </div>
          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-amber-500">Passordene stemmer ikke overens.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            <Plus className="size-4" />
            {saving ? "Oppretter …" : "Opprett bruker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Edit User Dialog ── */

function EditUserDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  return (
    <Dialog open={user !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      {user && <EditUserDialogInner user={user} onClose={onClose} />}
    </Dialog>
  );
}

function EditUserDialogInner({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const updateUser = useMutation(api.superAdmin.updateUser);
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await updateUser({
        userId: user._id,
        name: name !== (user.name ?? "") ? name : undefined,
        email: email !== (user.email ?? "") ? email : undefined,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil ved lagring.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent size="md">
      <DialogHeader>
        <h2 className="text-lg font-semibold">Rediger bruker</h2>
      </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="eu-name">Navn</Label>
            <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-email">E-post</Label>
            <Input
              id="eu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Lagrer …" : "Lagre endringer"}
          </Button>
        </DialogFooter>
    </DialogContent>
  );
}

/* ════════════════════════════════════════════════════════════════════
   WORKSPACES PANEL
   ════════════════════════════════════════════════════════════════════ */

type WsRow = {
  _id: Id<"workspaces">;
  name: string;
  ownerUserId: Id<"users">;
  ownerName: string | null;
  memberCount: number;
  assessmentCount: number;
  members: {
    _id: Id<"workspaceMembers">;
    userId: Id<"users">;
    role: string;
    name: string | null;
    email: string | null;
  }[];
};

function WorkspacesPanel({
  workspaces,
  allUsers,
}: {
  workspaces: WsRow[] | undefined;
  allUsers: UserRow[] | undefined;
}) {
  const deleteWorkspace = useMutation(api.superAdmin.deleteWorkspace);
  const removeMember = useMutation(api.superAdmin.removeMemberFromWorkspace);
  const updateRole = useMutation(api.superAdmin.updateMemberRole);
  const addMember = useMutation(api.superAdmin.addMemberToWorkspace);

  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editWs, setEditWs] = useState<WsRow | null>(null);
  const [managingWorkspaceId, setManagingWorkspaceId] = useState<Id<"workspaces"> | null>(null);

  const managingWs = useMemo(() => {
    if (!managingWorkspaceId || !workspaces) return null;
    return workspaces.find((w) => w._id === managingWorkspaceId) ?? null;
  }, [workspaces, managingWorkspaceId]);

  useEffect(() => {
    if (!managingWorkspaceId) return;
    if (workspaces === undefined) return;
    if (!workspaces.some((w) => w._id === managingWorkspaceId)) {
      queueMicrotask(() => setManagingWorkspaceId(null));
    }
  }, [managingWorkspaceId, workspaces]);

  const filtered = useMemo(() => {
    if (!workspaces) return [];
    const term = q.trim().toLowerCase();
    if (!term) return workspaces;
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        (w.ownerName ?? "").toLowerCase().includes(term),
    );
  }, [workspaces, q]);

  const handleDelete = useCallback(
    async (w: WsRow) => {
      if (!confirm(`Slett «${w.name}» permanent? Alt innhold slettes.`)) return;
      await deleteWorkspace({ workspaceId: w._id });
    },
    [deleteWorkspace],
  );

  if (workspaces === undefined || allUsers === undefined) {
    return <ProductLoadingBlock label="Laster arbeidsområder …" className="min-h-[30vh]" />;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk etter arbeidsområde …"
            className="pl-9"
          />
        </div>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nytt område</span>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="hidden border-b border-border/40 bg-muted/20 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[1fr_auto_auto_auto]">
          <span>Arbeidsområde</span>
          <span className="w-20 text-center">Medl.</span>
          <span className="w-20 text-center">Vurd.</span>
          <span className="w-28 text-right">Handlinger</span>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {q ? "Ingen treff" : "Ingen arbeidsområder"}
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((w) => (
              <div
                key={w._id}
                className="group flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/20 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-muted/60 text-sm font-bold text-muted-foreground ring-1 ring-border/40">
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{w.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Eier: {w.ownerName ?? "–"}
                    </p>
                  </div>
                </div>
                <p className="hidden w-20 text-center text-sm tabular-nums text-muted-foreground sm:block">
                  {w.memberCount}
                </p>
                <p className="hidden w-20 text-center text-sm tabular-nums text-muted-foreground sm:block">
                  {w.assessmentCount}
                </p>
                <div className="flex items-center justify-end gap-1 pl-12 sm:w-28 sm:pl-0">
                  <button
                    type="button"
                    onClick={() => setManagingWorkspaceId(w._id)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Medlemmer"
                  >
                    <Users className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditWs(w)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Rediger"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(w)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Slett"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateWorkspaceDialog open={createOpen} setOpen={setCreateOpen} allUsers={allUsers} />
      <EditWorkspaceDialog ws={editWs} onClose={() => setEditWs(null)} />
      <ManageMembersDialog
        key={managingWs?._id ?? "closed"}
        ws={managingWs}
        allUsers={allUsers}
        onClose={() => setManagingWorkspaceId(null)}
        removeMember={removeMember}
        updateRole={updateRole}
        addMember={addMember}
      />
    </>
  );
}

/* ── Create Workspace Dialog ── */

function CreateWorkspaceDialog({
  open,
  setOpen,
  allUsers,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  allUsers: UserRow[];
}) {
  const createWorkspace = useMutation(api.superAdmin.createWorkspace);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState<string>(allUsers[0]?._id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setOwnerId(allUsers[0]?._id ?? ""); setError(null); };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Navn er påkrevd."); return; }
    if (!ownerId) { setError("Velg en eier."); return; }
    setSaving(true);
    try {
      await createWorkspace({ name: name.trim(), ownerUserId: ownerId as Id<"users"> });
      reset();
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Noe gikk galt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <h2 className="text-lg font-semibold">Nytt arbeidsområde</h2>
          <p className="text-sm text-muted-foreground">Eieren blir automatisk lagt til som medlem.</p>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cw-name">Navn *</Label>
            <Input
              id="cw-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mitt nye arbeidsområde"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cw-owner">Eier *</Label>
            <div className="relative">
              <select
                id="cw-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-input bg-transparent px-3 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:rounded-lg"
              >
                <option value="" disabled>Velg eier …</option>
                {allUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name ?? u.email ?? u._id}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            <Plus className="size-4" />
            {saving ? "Oppretter …" : "Opprett"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Edit Workspace Dialog ── */

function EditWorkspaceDialog({ ws, onClose }: { ws: WsRow | null; onClose: () => void }) {
  return (
    <Dialog open={ws !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      {ws && <EditWorkspaceDialogInner ws={ws} onClose={onClose} />}
    </Dialog>
  );
}

function EditWorkspaceDialogInner({ ws, onClose }: { ws: WsRow; onClose: () => void }) {
  const updateWorkspace = useMutation(api.superAdmin.updateWorkspace);
  const [name, setName] = useState(ws.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) { setError("Navn kan ikke være tomt."); return; }
    setSaving(true);
    try {
      await updateWorkspace({ workspaceId: ws._id, name: trimmed });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil ved lagring.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent size="sm">
      <DialogHeader>
        <h2 className="text-lg font-semibold">Endre arbeidsområde</h2>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ew-name">Navn</Label>
          <Input
            id="ew-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Avbryt</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Lagrer …" : "Lagre"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ── Manage Members Dialog ── */

function ManageMembersDialog({
  ws,
  allUsers,
  onClose,
  removeMember,
  updateRole,
  addMember,
}: {
  ws: WsRow | null;
  allUsers: UserRow[];
  onClose: () => void;
  removeMember: ReturnType<typeof useMutation<typeof api.superAdmin.removeMemberFromWorkspace>>;
  updateRole: ReturnType<typeof useMutation<typeof api.superAdmin.updateMemberRole>>;
  addMember: ReturnType<typeof useMutation<typeof api.superAdmin.addMemberToWorkspace>>;
}) {
  const isOpen = ws !== null;
  const [addingUserId, setAddingUserId] = useState<string>("");
  const [addingRole, setAddingRole] = useState<string>("member");
  const [error, setError] = useState<string | null>(null);

  const existingIds = useMemo(
    () => new Set(ws?.members.map((m) => m.userId) ?? []),
    [ws],
  );
  const available = useMemo(
    () => allUsers.filter((u) => !existingIds.has(u._id)),
    [allUsers, existingIds],
  );

  const handleAdd = async () => {
    if (!ws || !addingUserId) return;
    setError(null);
    try {
      await addMember({
        workspaceId: ws._id,
        userId: addingUserId as Id<"users">,
        role: addingRole as "owner" | "admin" | "member" | "viewer",
      });
      setAddingUserId("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil.");
    }
  };

  const handleRemove = async (membershipId: Id<"workspaceMembers">, memberName: string | null) => {
    if (!confirm(`Fjern ${memberName ?? "bruker"} fra arbeidsområdet?`)) return;
    await removeMember({ membershipId });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) { onClose(); setError(null); setAddingUserId(""); } }}>
      <DialogContent size="lg">
        <DialogHeader>
          <h2 className="text-lg font-semibold">Medlemmer — {ws?.name}</h2>
          <p className="text-sm text-muted-foreground">{ws?.members.length ?? 0} medlemmer</p>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {/* Add member */}
          {available.length > 0 && (
            <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-muted/10 p-3">
              <p className="text-xs font-medium text-muted-foreground">Legg til medlem</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative min-w-0 flex-1">
                  <select
                    aria-label="Velg bruker"
                    value={addingUserId}
                    onChange={(e) => setAddingUserId(e.target.value)}
                    className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-border/60 bg-transparent px-3 pr-8 text-sm outline-none focus:border-foreground/20"
                  >
                    <option value="">Velg bruker …</option>
                    {available.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name ?? u.email ?? u._id}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
                <RoleSelect
                  value={addingRole}
                  onChange={setAddingRole}
                  options={["admin", "member", "viewer"]}
                  className="w-28"
                />
                <Button size="sm" onClick={handleAdd} disabled={!addingUserId} className="gap-1">
                  <Plus className="size-3.5" />
                  Legg til
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}

          {/* Member list */}
          {ws && ws.members.length > 0 ? (
            <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50">
              {ws.members.map((m) => (
                <div key={m._id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={m.name} email={m.email} image={null} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name ?? "Uten navn"}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email ?? "–"}</p>
                  </div>
                  <RoleSelect
                    value={m.role}
                    onChange={(r) => updateRole({ membershipId: m._id, role: r as "owner" | "admin" | "member" | "viewer" })}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(m._id, m.name)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Fjern"
                  >
                    <UserMinus className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Ingen medlemmer</p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Lukk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
