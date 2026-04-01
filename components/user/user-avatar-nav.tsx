"use client";

import { userProfileInitials } from "@/lib/user-profile-initials";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function UserAvatarNav() {
  const pathname = usePathname();
  const profile = useQuery(api.users.getMyProfile);
  const active = pathname?.startsWith("/bruker/") ?? false;

  if (profile === undefined) {
    return (
      <div
        className="border-border/45 bg-muted/60 size-10 shrink-0 animate-pulse rounded-full border shadow-inner"
        aria-hidden
      />
    );
  }

  if (profile === null) {
    return (
      <Link
        href="/bruker/innstillinger"
        className={cn(
          "border-border/50 bg-background/80 text-muted-foreground hover:bg-background focus-visible:ring-ring inline-flex size-10 shrink-0 items-center justify-center rounded-full border shadow-sm transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          active && "ring-primary/40 ring-2 ring-offset-1 ring-offset-background",
        )}
        aria-label="Brukerinnstillinger"
        title="Brukerinnstillinger"
      >
        <User className="size-[1.2rem]" aria-hidden />
      </Link>
    );
  }

  const { user, settings, profileImageUrl } = profile;
  const initials = userProfileInitials(
    settings?.firstName,
    settings?.lastName,
    user?.name,
    user?.email ?? undefined,
  );

  return (
    <Link
      href="/bruker/innstillinger"
      className={cn(
        "border-border/50 bg-background/90 focus-visible:ring-ring relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm transition-all hover:border-primary/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        active && "ring-primary/45 ring-2 ring-offset-1 ring-offset-background",
      )}
      aria-label="Brukerinnstillinger"
      title="Brukerinnstillinger"
    >
      {profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Convex URL; avoids next/image remote config
        <img
          src={profileImageUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <span className="text-primary flex size-full items-center justify-center bg-gradient-to-br from-primary/12 to-primary/[0.06] text-xs font-semibold tracking-tight">
          {initials === "?" ? (
            <User className="size-[1.2rem] opacity-80" aria-hidden />
          ) : (
            initials
          )}
        </span>
      )}
    </Link>
  );
}
