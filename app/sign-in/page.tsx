import { AuthForm } from "@/components/auth/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Innlogging",
  description: "Logg inn på FRO med e-post og passord.",
};

export default function SignInPage() {
  return <AuthForm defaultMode="signIn" />;
}
