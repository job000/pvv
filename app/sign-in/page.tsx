import { AuthForm } from "@/components/auth/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logg inn",
  description: "Logg inn på PVV med e-post og passord.",
};

export default function SignInPage() {
  return <AuthForm defaultMode="signIn" />;
}
