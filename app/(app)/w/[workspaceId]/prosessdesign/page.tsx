"use client";

import {
  ProductEmptyState,
  ProductLoadingBlock,
  ProductPageHeader,
} from "@/components/product";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ArrowRight, FileText, ScrollText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WorkspaceProcessDesignHubPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const wid = String(workspaceId);
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });

  if (assessments === undefined) {
    return (
      <ProductLoadingBlock
        label="Laster prosessdesign …"
        className="min-h-[40vh]"
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-8 sm:px-6 lg:px-0">
      <ProductPageHeader
        title="Prosessdesign (RPA)"
        description="Dokumenter prosessflyt, trinn og automatiseringskrav for hver vurdering."
      />

      {assessments.length === 0 ? (
        <ProductEmptyState
          icon={FileText}
          title="Ingen vurderinger ennå"
          description="Opprett en vurdering for å komme i gang med prosessdesign."
          action={
            <Link
              href={`/w/${wid}/vurderinger`}
              className={buttonVariants({ variant: "default" })}
            >
              Gå til vurderinger
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {assessments.map((a) => (
            <li key={a._id}>
              <Link
                href={`/w/${wid}/a/${a._id}/prosessdesign`}
                className="flex touch-manipulation items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-border active:bg-muted/30"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ScrollText
                    className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Åpne prosessdesign
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
