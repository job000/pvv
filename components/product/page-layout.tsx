import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Standard sidehode: tittel, kort forklaring, primær handling til høyre (desktop).
 * Bruk på tvers av appen for forutsigbar hierarki.
 */
export function ProductPageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? <p className="product-section-eyebrow">{eyebrow}</p> : null}
        <h1 className="product-page-title">{title}</h1>
        {description ? <div className="product-page-desc">{description}</div> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

/** Seksjon med valgfri tittel og støttetekst */
export function ProductSection({
  title,
  description,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("space-y-4", className)}>
      {title || description ? (
        <div className="space-y-1">
          {title ? (
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Vertikal rytme for hovedinnhold (innrykk fra ytre shell håndteres der). */
export function ProductStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-8 sm:space-y-10", className)}>{children}</div>;
}
