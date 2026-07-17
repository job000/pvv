"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceOverviewViewSettings } from "@/components/workspace/workspace-overview-view-settings";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { userProfileInitials } from "@/lib/user-profile-initials";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Camera,
  ChevronRight,
  ExternalLink,
  Loader2,
  Mail,
  User,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/app-toast";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export function UserSettingsPanel() {
  const profile = useQuery(api.users.getMyProfile);
  const myWorkspaces = useQuery(api.workspaces.listMine);
  const patch = useMutation(api.users.patchMyUserSettings);
  const generateUploadUrl = useMutation(api.users.generateProfileImageUploadUrl);
  const setProfileImage = useMutation(api.users.setMyProfileImage);
  const { setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [ageRaw, setAgeRaw] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!profile?.settings) return;
    setFirstName(profile.settings.firstName ?? "");
    setLastName(profile.settings.lastName ?? "");
    setAgeRaw(
      profile.settings.age !== undefined && profile.settings.age !== null
        ? String(profile.settings.age)
        : "",
    );
  }, [profile?.settings]);

  const settings = profile?.settings;
  const user = profile?.user;

  const saveProfile = useCallback(async () => {
    setSavingProfile(true);
    try {
      let age: number | null | undefined = undefined;
      const t = ageRaw.trim();
      if (t === "") {
        age = null;
      } else {
        const n = Number(t);
        if (!Number.isInteger(n) || n < 0 || n > 120) {
          toast.error("Alder må være et heltall mellom 0 og 120, eller stå tom.");
          setSavingProfile(false);
          return;
        }
        age = n;
      }
      await patch({ firstName, lastName, age });
      toast.success("Profil lagret.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke lagre profil.");
    } finally {
      setSavingProfile(false);
    }
  }, [ageRaw, firstName, lastName, patch]);

  const onTheme = useCallback(
    async (value: "light" | "dark" | "system") => {
      setTheme(value);
      try {
        await patch({ themePreference: value });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunne ikke lagre tema.");
      }
    },
    [patch, setTheme],
  );

  const onDensity = useCallback(
    async (value: "comfortable" | "compact") => {
      try {
        await patch({ uiDensity: value });
        document.documentElement.setAttribute("data-ui-density", value);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunne ikke lagre visningsmåte.");
      }
    },
    [patch],
  );

  const onTutorial = useCallback(
    async (enabled: boolean) => {
      try {
        await patch({ prosessregisterTutorialEnabled: enabled });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunne ikke lagre veiledningsvalg.");
      }
    },
    [patch],
  );

  const onAppEntryPreference = useCallback(
    async (value: "dashboard" | "workspace") => {
      try {
        await patch({ appEntryPreference: value });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunne ikke lagre startsted.");
      }
    },
    [patch],
  );

  const onPickProfileImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onProfileImageFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) { toast.error("Velg en bildefil."); return; }
      if (file.size > MAX_PROFILE_IMAGE_BYTES) { toast.error("Bildet er for stort (maks 5 MB)."); return; }
      setUploadingImage(true);
      try {
        const postUrl = await generateUploadUrl();
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Opplasting feilet (${res.status})`);
        const json = (await res.json()) as { storageId: string };
        await setProfileImage({ storageId: json.storageId as Id<"_storage"> });
        toast.success("Profilbilde oppdatert.");
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Kunne ikke laste opp bilde.";
        const missingFn = raw.includes("Could not find public function") || raw.includes("Could not find function");
        toast.error(
          missingFn
            ? "Convex-backend er ikke oppdatert med siste funksjoner. Kjør «npx convex dev» i prosjektmappen."
            : raw,
        );
      } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [generateUploadUrl, setProfileImage],
  );

  const removeProfileImage = useCallback(async () => {
    setUploadingImage(true);
    try {
      await setProfileImage({ clear: true });
      toast.success("Profilbilde fjernet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke fjerne profilbilde.");
    } finally {
      setUploadingImage(false);
    }
  }, [setProfileImage]);

  if (profile === undefined) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="rounded-xl border border-border/50 p-10 text-center">
        <User className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
        <p className="font-medium">Innlogging kreves</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Logg inn for å se og endre brukerinnstillinger.
        </p>
      </div>
    );
  }

  const tutorialOn = settings?.prosessregisterTutorialEnabled !== false;
  const density = settings?.uiDensity ?? "comfortable";
  const themePref = settings?.themePreference ?? "system";
  const appEntryPref = settings?.appEntryPreference === "workspace" ? "workspace" : "dashboard";
  const defaultWorkspaceId = settings?.defaultWorkspaceId;
  const defaultWorkspace =
    defaultWorkspaceId != null && myWorkspaces
      ? myWorkspaces.find((w) => w.workspace._id === defaultWorkspaceId)?.workspace
      : undefined;
  const profileImageUrl = profile.profileImageUrl;
  const avatarInitials = userProfileInitials(
    settings?.firstName, settings?.lastName, user?.name, user?.email ?? undefined,
  );

  return (
    <div className="space-y-10">
      {/* ── Profil ── */}
      <SettingsSection>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <label
            htmlFor="user-profile-photo-input"
            className={cn(
              "group relative shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
              uploadingImage && "pointer-events-none cursor-wait",
            )}
            aria-label="Bytt profilbilde"
          >
            <input
              id="user-profile-photo-input"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              disabled={uploadingImage}
              onChange={(e) => void onProfileImageFile(e.target.files?.[0])}
            />
            <div className="relative size-24 overflow-hidden rounded-full bg-muted/30 ring-2 ring-border/40 transition-all group-hover:ring-primary/30 sm:size-28">
              {profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center bg-primary/5 text-2xl font-semibold text-primary">
                  {avatarInitials === "?" ? <User className="size-10 opacity-60" aria-hidden /> : avatarInitials}
                </span>
              )}
              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center gap-0.5 transition-colors",
                  uploadingImage ? "bg-background/60" : "bg-black/0 group-hover:bg-black/40",
                )}
                aria-hidden
              >
                {uploadingImage ? (
                  <Loader2 className="size-6 animate-spin text-primary" />
                ) : (
                  <Camera className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>
            </div>
          </label>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Profil</h2>
            <p className="text-sm text-muted-foreground">
              Navn og alder brukes i visning og søk. E-post kommer fra innloggingen.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploadingImage}
                onClick={onPickProfileImage}
              >
                {uploadingImage
                  ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  : <Camera className="size-3.5" aria-hidden />}
                {uploadingImage ? "Behandler …" : "Last opp bilde"}
              </Button>
              {profileImageUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={uploadingImage}
                  onClick={() => void removeProfileImage()}
                >
                  Fjern bilde
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {user?.email && (
            <div className="rounded-lg border border-border/40 bg-muted/15 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">E-post</p>
              <p className="mt-0.5 flex items-center gap-2 text-sm">
                <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                {user.email}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-fn">Fornavn</Label>
              <Input id="user-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-ln">Etternavn</Label>
              <Input id="user-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
          </div>

          <div className="space-y-1.5 sm:max-w-[200px]">
            <Label htmlFor="user-age">Alder <span className="font-normal text-muted-foreground">(valgfritt)</span></Label>
            <Input
              id="user-age"
              inputMode="numeric"
              value={ageRaw}
              onChange={(e) => setAgeRaw(e.target.value.replace(/\D/g, ""))}
              placeholder="—"
            />
          </div>

          <div className="flex items-center justify-end border-t border-border/30 pt-4">
            <Button
              className="h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              onClick={() => void saveProfile()}
              disabled={savingProfile}
            >
              {savingProfile ? <><Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />Lagrer …</> : "Lagre profil"}
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* ── Preferanser ── */}
      <SettingsSection title="Preferanser">
        <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
          <PreferenceRow label="Tema">
            <SegmentedControl
              ariaLabel="Tema"
              value={themePref}
              onChange={(v) => void onTheme(v as "light" | "dark" | "system")}
              options={[
                { value: "light", label: "Lys" },
                { value: "dark", label: "Mørk" },
                { value: "system", label: "System" },
              ]}
            />
          </PreferenceRow>
          <PreferenceRow label="Tetthet">
            <SegmentedControl
              ariaLabel="Visningsmåte"
              value={density}
              onChange={(v) => void onDensity(v as "comfortable" | "compact")}
              options={[
                { value: "comfortable", label: "Standard" },
                { value: "compact", label: "Kompakt" },
              ]}
            />
          </PreferenceRow>
          <PreferenceRow
            label="Startsted"
            hint={
              appEntryPref === "workspace" && defaultWorkspace
                ? defaultWorkspace.name
                : undefined
            }
          >
            <SegmentedControl
              ariaLabel="Startsted"
              value={appEntryPref}
              onChange={(v) =>
                void onAppEntryPreference(v as "dashboard" | "workspace")
              }
              options={[
                { value: "dashboard", label: "Oversikt" },
                { value: "workspace", label: "Arbeidsområde" },
              ]}
            />
          </PreferenceRow>
        </div>
        {appEntryPref === "workspace" && !defaultWorkspaceId && (
          <p className="text-sm text-muted-foreground">
            Velg standard arbeidsområde med stjernen på{" "}
            <Link href="/dashboard?oversikt=1" className="font-medium text-foreground underline-offset-2 hover:underline">
              oversikten
            </Link>
            .
          </p>
        )}
      </SettingsSection>

      {/* ── Dashboard per arbeidsområde ── */}
      {myWorkspaces && myWorkspaces.length > 0 && (
        <details className="group overflow-hidden rounded-2xl border border-border/50 bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden sm:px-5">
            <span className="font-semibold text-foreground">Dashboard-tilpasning</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <div className="divide-y divide-border/30 border-t border-border/40">
            {myWorkspaces.map(({ workspace }) => (
              <div key={workspace._id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{workspace.name}</p>
                  <Link
                    href={`/w/${workspace._id}`}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Åpne <ExternalLink className="size-3 opacity-60" aria-hidden />
                  </Link>
                </div>
                <WorkspaceOverviewViewSettings
                  workspaceId={workspace._id}
                  workspaceName={workspace.name}
                  compactTrigger
                  triggerClassName="shrink-0"
                />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Veiledning ── */}
      <SettingsSection title="Veiledning" description="Popuper som forklarer rekkefølgen i prosessregisteret.">
        <label
          htmlFor="tutorial-toggle"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-muted/10 p-3.5 transition-colors hover:bg-muted/20"
        >
          <Checkbox
            id="tutorial-toggle"
            className="mt-0.5"
            checked={tutorialOn}
            onCheckedChange={(c) => void onTutorial(c === true)}
          />
          <span className="min-w-0">
            <span className="text-sm font-medium">Vis veiledning for prosessregister</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Av: ingen automatiske popup-vinduer. På: veiledning vises ved første besøk.
            </span>
          </span>
        </label>
      </SettingsSection>
    </div>
  );
}

/* ── Shared helpers ── */

function SettingsSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      {title && (
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function PreferenceRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 rounded-full border border-border/50 bg-background p-1"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === opt.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
