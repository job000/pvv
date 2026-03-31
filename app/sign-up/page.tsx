import { AuthForm } from "@/components/auth/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registrer deg",
  description: "Opprett FRO-konto med e-post og passord.",
};

export default function SignUpPage() {
  return <AuthForm defaultMode="signUp" />;
}
