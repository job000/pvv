/**
 * Tekster for prosessregister — generelt for små og store virksomheter:
 * ett navn alle forstår, én teknisk referanse for vurdering og ROS, valgfri kobling
 * til organisasjonskart for ansvar og spørsmålsruting.
 */

export const prosessRegisterCopy = {
  displayName: {
    label: "Prosessnavn",
    hint: "Det dere kaller prosessen i praksis — f.eks. «Innleggelse elektiv» eller «Fakturering leverandør». Vises i lister og rapporter.",
  },
  /** «Kode» alene forvirrer; dette er den tekniske nøkkelen */
  referenceCode: {
    label: "Prosess-ID (kort referanse)",
    hint: "En fast, unik kode i dette arbeidsområdet som kobler prosessen til vurderinger og ROS (samme kode i utkast og referanse). Typisk kort: bokstaver og tall, f.eks. INN-EL-01 eller FAKT-LEV-02. Uavhengig av hvilken avdeling som «eier» prosessen akkurat nå.",
    placeholder: "F.eks. INN-EL-01",
  },
  orgUnit: {
    label: "Primær organisatorisk tilhørighet",
    optional: "valgfritt",
    hint: "Organisasjonskartet kan ha flere nivåer (f.eks. selskap → avdeling → team). Her angir dere hvor spørsmål og dokumentasjon først og fremst hører hjemme — uten å låse prosessen til én enhet (mange prosesser går på tvers). Tomt felt betyr «ikke knyttet til ett sted i kartet».",
    emptyOption: "Ikke satt — prosess på tvers eller felles",
  },
  notes: {
    label: "Notat til teamet",
    hint: "F.eks. kjente systemer, kontaktpunkt eller særlige forhold — ikke påkrevd.",
  },
} as const;
