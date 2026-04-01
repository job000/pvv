"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { WorkspaceOverviewViewSettings } from "@/components/workspace/workspace-overview-view-settings";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { userProfileInitials } from "@/lib/user-profile-initials";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  Building2,
  Camera,
  Check,
  ExternalLink,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  Loader2,
  Mail,
  Monitor,
  Moon,
  PanelsTopLeft,
  Sun,
  User,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/app-toast";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-muted/35 ring-border/50 h-52 animate-pulse rounded-2xl ring-1"
        />
      ))}
    </div>
  );
}

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
      await patch({
        firstName,
        lastName,
        age,
      });
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
        toast.error(
          e instanceof Error ? e.message : "Kunne ikke lagre visningsmåte.",
        );
      }
    },
    [patch],
  );

  const onTutorial = useCallback(
    async (enabled: boolean) => {
      try {
        await patch({ prosessregisterTutorialEnabled: enabled });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Kunne ikke lagre veiledningsvalg.",
        );
      }
    },
    [patch],
  );

  const onAppEntryPreference = useCallback(
    async (value: "dashboard" | "workspace") => {
      try {
        await patch({ appEntryPreference: value });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Kunne ikke lagre startsted.",
        );
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
      if (!file.type.startsWith("image/")) {
        toast.error("Velg en bildefil.");
        return;
      }
      if (file.size > MAX_PROFILE_IMAGE_BYTES) {
        toast.error("Bildet er for stort (maks 5 MB).");
        return;
      }
      setUploadingImage(true);
      try {
        const postUrl = await generateUploadUrl();
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) {
          throw new Error(`Opplasting feilet (${res.status})`);
        }
        const json = (await res.json()) as { storageId: string };
        await setProfileImage({
          storageId: json.storageId as Id<"_storage">,
        });
        toast.success("Profilbilde oppdatert.");
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Kunne ikke laste opp bilde.";
        const missingFn =
          raw.includes("Could not find public function") ||
          raw.includes("Could not find function");
        toast.error(
          missingFn
            ? "Convex-backend er ikke oppdatert med siste funksjoner. Kjør «npx convex dev» i prosjektmappen (la den stå på mens du utvikler), eller kjør «npx convex deploy» mot produksjon."
            : raw,
        );
      } finally {
        setUploadingImage(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
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
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke fjerne profilbilde.",
      );
    } finally {
      setUploadingImage(false);
    }
  }, [setProfileImage]);

  if (profile === undefined) {
    return <SettingsSkeleton />;
  }

  if (profile === null) {
    return (
      <div className="border-border/60 bg-card/80 ring-border/40 rounded-2xl border p-10 text-center shadow-sm ring-1">
        <div className="bg-muted/50 mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl">
          <User className="text-muted-foreground size-7" aria-hidden />
        </div>
        <p className="text-foreground font-medium">Innlogging kreves</p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Logg inn for å se og endre brukerinnstillinger.
        </p>
      </div>
    );
  }

  const tutorialOn = settings?.prosessregisterTutorialEnabled !== false;
  const density = settings?.uiDensity ?? "comfortable";
  const themePref = settings?.themePreference ?? "system";
  const appEntryPref =
    settings?.appEntryPreference === "workspace" ? "workspace" : "dashboard";
  const defaultWorkspaceId = settings?.defaultWorkspaceId;
  const defaultWorkspace =
    defaultWorkspaceId != null && myWorkspaces
      ? myWorkspaces.find((w) => w.workspace._id === defaultWorkspaceId)
          ?.workspace
      : undefined;
  const profileImageUrl = profile.profileImageUrl;
  const avatarInitials = userProfileInitials(
    settings?.firstName,
    settings?.lastName,
    user?.name,
    user?.email ?? undefined,
  );

  const cardShell =
    "shadow-sm ring-border/55 overflow-hidden rounded-2xl ring-1 transition-shadow hover:shadow-md";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
      {/* Profil */}
      <Card className={cn(cardShell, "from-muted/25 border-border/50 bg-gradient-to-b to-card")}>
        <CardHeader className="border-border/40 from-muted/30 to-transparent border-b bg-gradient-to-br pb-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <label
              htmlFor="user-profile-photo-input"
              className={cn(
                "group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                uploadingImage
                  ? "pointer-events-none cursor-wait"
                  : "cursor-pointer",
              )}
              aria-label="Bytt profilbilde — velg nytt bilde fra enheten"
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
              <div
                className={cn(
                  "border-background bg-muted/30 relative size-28 overflow-hidden rounded-full border-4 shadow-lg ring-2 ring-primary/10 transition-transform sm:size-32",
                  !uploadingImage && "group-hover:ring-primary/25 group-active:scale-[0.98]",
                )}
              >
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Convex URL
                  <img
                    src={profileImageUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-primary flex size-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 text-3xl font-semibold tracking-tight">
                    {avatarInitials === "?" ? (
                      <User className="size-12 opacity-70" aria-hidden />
                    ) : (
                      avatarInitials
                    )}
                  </span>
                )}
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full transition-colors",
                    uploadingImage
                      ? "bg-background/65"
                      : "bg-black/0 group-hover:bg-black/45",
                  )}
                  aria-hidden
                >
                  {uploadingImage ? (
                    <Loader2 className="text-primary size-8 animate-spin" />
                  ) : (
                    <>
                      <Camera className="size-7 text-white opacity-0 drop-shadow-sm transition-opacity group-hover:opacity-100" />
                      <span className="text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                        Bytt bilde
                      </span>
                    </>
                  )}
                </div>
              </div>
            </label>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Profil
                </CardTitle>
                <CardDescription className="mt-2 text-[15px] leading-relaxed">
                  Navn og valgfri alder brukes i visning og søk i team. E-post
                  kommer fra innloggingen og kan ikke endres her.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2 rounded-lg shadow-none"
                  disabled={uploadingImage}
                  onClick={() => onPickProfileImage()}
                >
                  {uploadingImage ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="size-4" aria-hidden />
                  )}
                  {uploadingImage ? "Behandler …" : "Last opp bilde"}
                </Button>
                {profileImageUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={uploadingImage}
                    onClick={() => void removeProfileImage()}
                  >
                    Fjern bilde
                  </Button>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                JPG, PNG, GIF eller WebP · maks 5 MB · vises i toppmenyen og her.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {user?.email ? (
            <div className="border-border/55 bg-muted/20 rounded-xl border px-4 py-3.5">
              <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
                E-post
              </div>
              <div className="text-foreground flex items-center gap-2.5 text-sm font-medium">
                <Mail className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-all">{user.email}</span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-fn" className="text-foreground text-sm font-medium">
                Fornavn
              </Label>
              <Input
                id="user-fn"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                maxLength={120}
                className="bg-background/80 h-11 rounded-xl border-border/70 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-ln" className="text-foreground text-sm font-medium">
                Etternavn
              </Label>
              <Input
                id="user-ln"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                maxLength={120}
                className="bg-background/80 h-11 rounded-xl border-border/70 shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="user-age" className="text-foreground text-sm font-medium">
              Alder <span className="text-muted-foreground font-normal">(valgfritt)</span>
            </Label>
            <Input
              id="user-age"
              inputMode="numeric"
              value={ageRaw}
              onChange={(e) => setAgeRaw(e.target.value.replace(/\D/g, ""))}
              placeholder="f.eks. 35"
              className="bg-background/80 h-11 rounded-xl border-border/70 shadow-sm"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Brukes ikke i vurderingslogikk — kun om dere vil dokumentere
              målgruppe lokalt.
            </p>
          </div>
        </CardContent>

        <CardFooter className="border-border/50 bg-muted/25 border-t px-4 py-4 sm:px-6">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs sm:max-w-[55%]">
              Husk å lagre etter du har endret navn eller alder.
            </p>
            <Button
              type="button"
              size="lg"
              className="shrink-0 rounded-xl px-6 shadow-sm"
              onClick={() => void saveProfile()}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Lagrer …
                </>
              ) : (
                "Lagre profil"
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Utseende */}
      <Card className={cardShell}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Utseende
          </CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">
            Lys, mørk eller følg systemets innstilling. Lagres på kontoen slik at
            det følger deg på andre enheter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="grid gap-3 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Tema"
          >
            {(
              [
                { value: "light" as const, label: "Lys", desc: "Alltid lyst", Icon: Sun },
                { value: "dark" as const, label: "Mørk", desc: "Alltid mørkt", Icon: Moon },
                {
                  value: "system" as const,
                  label: "System",
                  desc: "Følger OS",
                  Icon: Monitor,
                },
              ] as const
            ).map(({ value, label, desc, Icon }) => {
              const selected = themePref === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => void onTheme(value)}
                  className={cn(
                    "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-primary bg-primary/5 ring-primary/25 shadow-sm ring-2"
                      : "border-border/70 bg-card hover:border-muted-foreground/20 hover:bg-muted/25",
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="bg-muted/60 text-foreground flex size-10 items-center justify-center rounded-lg">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    {selected ? (
                      <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full shadow-sm">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                    ) : (
                      <span className="size-6 shrink-0" aria-hidden />
                    )}
                  </div>
                  <div>
                    <div className="text-foreground font-medium">{label}</div>
                    <div className="text-muted-foreground mt-0.5 text-xs">{desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Visningsmåte */}
      <Card className={cardShell}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Visningsmåte
          </CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">
            Kompakt gir litt mindre luft og litt mindre skrift i appen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Visningsmåte"
          >
            {(
              [
                {
                  value: "comfortable" as const,
                  label: "Standard",
                  desc: "Mer luft og standard tekststørrelse",
                  Icon: LayoutList,
                },
                {
                  value: "compact" as const,
                  label: "Kompakt",
                  desc: "Tettere layout for mer innhold på skjermen",
                  Icon: LayoutGrid,
                },
              ] as const
            ).map(({ value, label, desc, Icon }) => {
              const selected = density === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => void onDensity(value)}
                  className={cn(
                    "relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-primary bg-primary/5 ring-primary/25 shadow-sm ring-2"
                      : "border-border/70 bg-card hover:border-muted-foreground/20 hover:bg-muted/25",
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="bg-muted/60 text-foreground flex size-10 items-center justify-center rounded-lg">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    {selected ? (
                      <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full shadow-sm">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                    ) : (
                      <span className="size-6 shrink-0" aria-hidden />
                    )}
                  </div>
                  <div>
                    <div className="text-foreground font-medium">{label}</div>
                    <div className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Startsted */}
      <Card className={cardShell} id="startsted">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Startsted
          </CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">
            Når du logger inn eller åpner appen uten annen destinasjon, kan du
            gå rett til oversikten over arbeidsområder eller til{" "}
            <strong className="text-foreground font-medium">
              standard arbeidsområde
            </strong>
            . Standard arbeidsområde er det samme som du velger med stjerne på
            oversikten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Startsted"
          >
            {(
              [
                {
                  value: "dashboard" as const,
                  label: "Oversikt",
                  desc: "Vis alle arbeidsområder (FRO-oversikt)",
                  Icon: LayoutDashboard,
                },
                {
                  value: "workspace" as const,
                  label: "Standard arbeidsområde",
                  desc: "Gå direkte til arbeidsområdet du har merket som standard",
                  Icon: Building2,
                },
              ] as const
            ).map(({ value, label, desc, Icon }) => {
              const selected = appEntryPref === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => void onAppEntryPreference(value)}
                  className={cn(
                    "relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-primary bg-primary/5 ring-primary/25 shadow-sm ring-2"
                      : "border-border/70 bg-card hover:border-muted-foreground/20 hover:bg-muted/25",
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="bg-muted/60 text-foreground flex size-10 items-center justify-center rounded-lg">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    {selected ? (
                      <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full shadow-sm">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                    ) : (
                      <span className="size-6 shrink-0" aria-hidden />
                    )}
                  </div>
                  <div>
                    <div className="text-foreground font-medium">{label}</div>
                    <div className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {appEntryPref === "workspace" && !defaultWorkspaceId ? (
            <p className="text-muted-foreground border-border/60 bg-muted/20 rounded-xl border px-3 py-2.5 text-sm leading-relaxed">
              Du har ikke valgt standard arbeidsområde ennå.{" "}
              <Link
                href="/dashboard?oversikt=1"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Åpne oversikten
              </Link>{" "}
              og trykk på stjernen ved arbeidsområdet du vil bruke som startsted.
            </p>
          ) : appEntryPref === "workspace" && defaultWorkspace ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Nå:{" "}
              <span className="text-foreground font-medium">
                {defaultWorkspace.name}
              </span>
              .
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Dashboard per arbeidsområde */}
      <Card className={cardShell} id="dashboard-arbeidsomrader">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="bg-primary/12 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-primary/15">
              <PanelsTopLeft className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Dashboard per arbeidsområde
              </CardTitle>
              <CardDescription className="text-[15px] leading-relaxed">
                Velg hvilke nøkkeltall, lister, snarveier og begreper som vises på
                arbeidsområdets forside. Dette er{" "}
                <strong className="text-foreground font-medium">dine egne</strong>{" "}
                valg per arbeidsområde — andre medlemmer påvirkes ikke.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {myWorkspaces === undefined ? (
            <div className="space-y-2">
              <div className="bg-muted/40 h-12 animate-pulse rounded-xl" />
              <div className="bg-muted/40 h-12 animate-pulse rounded-xl" />
            </div>
          ) : myWorkspaces.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Du er ikke medlem av noen arbeidsområder ennå. Når du har tilgang,
              kan du tilpasse visningen her eller fra arbeidsområdets dashboard.
            </p>
          ) : (
            <ul className="divide-border/60 divide-y rounded-xl border border-border/60 bg-muted/10">
              {myWorkspaces.map(({ workspace }) => (
                <li
                  key={workspace._id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {workspace.name}
                    </p>
                    <Link
                      href={`/w/${workspace._id}`}
                      className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                    >
                      Åpne dashboard
                      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
                    </Link>
                  </div>
                  <WorkspaceOverviewViewSettings
                    workspaceId={workspace._id}
                    workspaceName={workspace.name}
                    compactTrigger
                    triggerClassName="shrink-0 self-start sm:self-center"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Veiledning */}
      <Card className={cardShell} id="veiledning-prosessregister">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <div className="bg-primary/12 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-primary/15">
              <BookOpen className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Veiledning for prosessregister
              </CardTitle>
              <CardDescription className="text-[15px] leading-relaxed">
                Popuper som forklarer rekkefølgen (registrer prosess → vurdering).
                Når du slår på igjen, tilbakestilles «ikke vis mer» slik at
                veiledningen kan vises på nytt.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="mb-5 bg-border/60" />
          <label
            htmlFor="tutorial-prosessregister-settings"
            className="border-border/60 bg-muted/15 hover:bg-muted/30 has-[:focus-visible]:ring-ring flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2"
          >
            <Checkbox
              id="tutorial-prosessregister-settings"
              className="mt-0.5 size-[18px]"
              checked={tutorialOn}
              onCheckedChange={(c) => void onTutorial(c === true)}
            />
            <span className="min-w-0">
              <Label
                htmlFor="tutorial-prosessregister-settings"
                className="text-foreground cursor-pointer text-[15px] font-medium leading-snug"
              >
                Vis veiledning for prosessregister
              </Label>
              <span className="text-muted-foreground mt-2 block text-sm leading-relaxed">
                Av: ingen automatiske popup-vinduer på prosessregister-fanen. På:
                første gang du åpner fanen, eller når du åpner veiledning manuelt.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
