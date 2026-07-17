import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/brand";
import { cn } from "@/lib/utils";

const MARK_SRC = "/icons/zorlin-mark.svg";

type BrandMarkProps = {
  size?: number;
  className?: string;
  /** Decorative when parent already names the product. */
  decorative?: boolean;
  priority?: boolean;
};

/**
 * Zorlin-merke — futuristisk geometrisk Z med priority-node.
 * Inline SVG for skarphet overalt (auth, nav, PWA).
 */
export function BrandMark({
  size = 48,
  className,
  decorative = false,
  priority: _priority,
}: BrandMarkProps) {
  void _priority;
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-[22%]",
        "shadow-[0_8px_28px_-12px_rgba(15,118,110,0.55)] ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
      style={{ width: size, height: size }}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${PRODUCT_NAME} (${PRODUCT_SHORT})`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- merke-SVG, ikke foto */}
      <img
        src={MARK_SRC}
        alt=""
        width={size}
        height={size}
        className="size-full object-cover"
        draggable={false}
      />
    </span>
  );
}
