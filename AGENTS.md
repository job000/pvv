<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Layout and responsive UX

**Do not assume desktop is the primary context.** When choosing structure, spacing, navigation, density, and interactions, mentally validate three modes:

1. **Desktop power user** — keyboard, large screen, possibly many panels; still avoid unnecessary clutter.
2. **Tablet in meetings** — thumb reach, portrait/landscape, glare; touch targets and tap affordances matter; avoid hover-only critical actions.
3. **Mobile PWA** — safe areas, sheet/drawer navigation, scroll length, offline-ish feel; primary tasks must work one-handed where reasonable.

Prefer mobile-first breakpoints, touch-friendly targets, and patterns that degrade gracefully up to desktop rather than the reverse.

## Product feel (not internal admin)

If a screen feels like an **internal admin system** (dense tables, jargon, no clear next step, walls of settings), **simplify until it feels like a product**: clear purpose, one obvious primary action, scannable hierarchy, plain language, and progressive disclosure for advanced or rare tasks.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
