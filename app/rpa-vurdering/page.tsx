import { redirect } from "next/navigation";

/** Gammel URL — vurderinger ligger nå under /dashboard og /w/... */
export default function LegacyRpaPage() {
  redirect("/dashboard");
}
