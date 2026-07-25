/** Åpne paletten programmatisk (f.eks. mobil-søk-ikon). */
export const COMMAND_PALETTE_EVENT = "pvv:command-palette";

export type CommandPaletteOpenDetail = {
  query?: string;
};

/** Åpne kommandopaletten, valgfritt med ferdig utfylt søketekst. */
export function openCommandPalette(detail?: CommandPaletteOpenDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CommandPaletteOpenDetail>(COMMAND_PALETTE_EVENT, {
      detail: detail ?? {},
    }),
  );
}
