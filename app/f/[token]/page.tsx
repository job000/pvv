"use client";

import { IntakePublicForm } from "@/components/intake-form/intake-public-form";
import { useParams } from "next/navigation";

export default function IntakePublicPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  return <IntakePublicForm key={token} token={token} />;
}
