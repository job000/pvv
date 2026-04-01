import { AppToaster } from "@/components/providers/app-toaster";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { UserPreferencesSync } from "@/components/user/user-preferences-sync";
import { PwaClient } from "@/components/pwa-client";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
  /** Enkel verdi — array-form ga hydreringsmismatch i MetadataWrapper (Next 16 + React 19). */
  themeColor: "#fafafa",
};

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: "FRO",
  title: {
    default: "FRO — prioriter og utfør",
    template: "%s · FRO",
  },
  description:
    "Prioriter oppgaver, prosessvurderinger og ROS — samarbeid i arbeidsområder.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FRO",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nb"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-dvh flex-col touch-manipulation"
        suppressHydrationWarning
      >
        <ConvexAuthNextjsServerProvider>
          <ConvexClientProvider>
            <ThemeProvider>
              <UserPreferencesSync />
              {children}
              <AppToaster />
              <PwaClient />
            </ThemeProvider>
          </ConvexClientProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
