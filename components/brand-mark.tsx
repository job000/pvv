import Image from "next/image";
import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/brand";
import { cn } from "@/lib/utils";

const MARK_SRC = "/icons/zorlin-mark.svg";

/** Merke: Zorlin (ZL i SVG). */
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
      alt={`${PRODUCT_NAME} (${PRODUCT_SHORT})`}
      width={size}
      height={size}
      priority={priority}
      className={cn("h-auto w-auto shrink-0 rounded-2xl shadow-sm", className)}
    />
  );
}
