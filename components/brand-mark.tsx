import Image from "next/image";
import { cn } from "@/lib/utils";

const MARK_SRC = "/icons/fro-mark.svg";

/** Merke: FRO (tekst i SVG). */
export function BrandMark({
  size = 48,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={MARK_SRC}
      alt="FRO"
      width={size}
      height={size}
      priority={priority}
      className={cn("h-auto w-auto shrink-0 rounded-2xl shadow-sm", className)}
    />
  );
}
