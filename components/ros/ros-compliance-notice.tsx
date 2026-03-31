"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROS_COMPLIANCE_UI_TAGLINE_NB } from "@/lib/ros-compliance";
import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";
import Link from "next/link";

type Props = {
  className?: string;
  /** Hash på samme side (#…) eller full sti til ROS med anker for undersider */
  standardsDetailHref: string;
};

export function RosComplianceNotice({ className, standardsDetailHref }: Props) {
  return (
    <Alert
      className={cn(
        "border-primary/15 bg-primary/[0.04] text-foreground",
        className,
      )}
    >
      <Scale className="size-4 shrink-0 text-primary" aria-hidden />
      <AlertDescription className="text-xs leading-relaxed sm:text-sm [&_a]:font-medium">
        <span className="text-foreground/95">{ROS_COMPLIANCE_UI_TAGLINE_NB}</span>{" "}
        <Link
          href={standardsDetailHref}
          className="text-primary underline-offset-4 hover:underline"
        >
          Mer om standarder, EU/Norge og ansvar
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
