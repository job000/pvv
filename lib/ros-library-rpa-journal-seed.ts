/**
 * Eksempeltekster til ROS-bibliotek: RPA i møte med journalsystemer (DIPS, MetaVision, Medanets).
 * Innsettes via `api.rosLibrary.seedRpaJournalLibraryExamples` og kan redigeres/slettes som vanlig.
 */
export const RPA_JOURNAL_SEED_CATEGORY_NAME = "RPA – journalsystemer (eksempler)";

/** Felles tag for idempotent innlegging og enkel filtrering */
export const RPA_JOURNAL_SEED_TAG = "seed-rpa-journal";

export type RpaJournalSeedItem = {
  title: string;
  riskText: string;
  tiltakText: string;
  /** Brukes som tag sammen med seed-taggen */
  system: "DIPS" | "MetaVision" | "Medanets";
};

export const RPA_JOURNAL_SEED_ITEMS: readonly RpaJournalSeedItem[] = [
  // —— DIPS ——
  {
    system: "DIPS",
    title: "RPA-feil ved journalføring av lab-svar",
    riskText:
      "Boten tolker feil laboratoriekode eller pasientkobling og journalfører på feil episode, slik at klinisk beslutning kan tas på feil grunnlag.",
    tiltakText:
      "Eksplisitte valideringsregler mot nasjonale kodeverk, stopp ved lav konfidens, manuell bekreftelse for kritiske resultater, og overvåkning med avvik ved avvikende mønstre.",
  },
  {
    system: "DIPS",
    title: "Tilgang og rolle ved RPA-konto i DIPS",
    riskText:
      "Tjenestekonto brukt av RPA har bredere rettigheter enn nødvendig, eller deles med manuelle brukere, noe som øker risiko for uautorisert visning og endring av journal.",
    tiltakText:
      "Prinsipp om minste privilegium, egen tjenestekonto per bot, periodisk attestasjon av roller, MFA der det støttes, og revisjon av innlogging og hendelseslogg.",
  },
  {
    system: "DIPS",
    title: "Ytelse og kø ved massiv RPA-trafikk",
    riskText:
      "Høy parallellitet fra RPA kan belaste DIPS-grensesnitt eller mellomlag, med forsinkelse for klinikere eller tap av meldinger i kø.",
    tiltakText:
      "Rate limiting, vinduer for batch-kjøringer, overvåkning av responstid, varsel ved kødybde, og avtalt kapasitet med drift/leverandør.",
  },
  {
    system: "DIPS",
    title: "Personvern: samling av sensitive data i RPA-logg",
    riskText:
      "Logger og skjermbilder fra RPA kan inneholde helseopplysninger utenfor journalens kontrollerte miljø.",
    tiltakText:
      "Minimering av logging, maskering, kort oppbevaringstid, kryptering og tilgangskontroll på bot-miljø, DPIA og rutiner for sletting.",
  },
  {
    system: "DIPS",
    title: "Versjonssprang og endringsstyring",
    riskText:
      "Oppgradering av DIPS eller integrasjon endrer felt/flows slik at RPA-skript feiler stille eller delvis.",
    tiltakText:
      "Regresjonstester før produksjon, feature flags, overvåkning av sukessrate, og eier av bot med ansvar for vedlikehold ved endringskø.",
  },

  // —— MetaVision ——
  {
    system: "MetaVision",
    title: "Alarm og monitor: falsk trygghet fra RPA",
    riskText:
      "RPA bekrefter eller kvitterer alarmer uten at klinisk kontekst er vurdert, slik at reelle forverringer kan overses.",
    tiltakText:
      "Skille mellom administrativ kvittering og klinisk bekreftelse, tydelige regler for hva som aldri kan automatiseres, og eskalering til vakt ved avvik.",
  },
  {
    system: "MetaVision",
    title: "Ordinering og legemiddelkobling",
    riskText:
      "Automatisert overføring av ordinasjoner mellom system kan gi feil dose, dobbeltforordning eller interaksjoner som ikke fanget opp.",
    tiltakText:
      "Kobling mot legemiddelstøtte der det finnes, hard stopp ved manglende obligatoriske felt, og sporbarhet for hvem som godkjente automatisk steg.",
  },
  {
    system: "MetaVision",
    title: "Integrasjon mot laboratorium / billeddiagnostikk",
    riskText:
      "RPA flytter resultater til feil pasient eller feil tidspunkt i MetaVision, med risiko for feil behandling.",
    tiltakText:
      "To-faktor matching (pasient-ID + prøve-ID), syntaksvalidering, og manuell trinn for kritiske funn i tråd med lokale prosedyrer.",
  },
  {
    system: "MetaVision",
    title: "Driftsavhengighet og failover",
    riskText:
      "Ved nedetid i integrasjon fortsetter RPA å forsøke operasjoner som køes eller kastes, med inkonsistent tilstand mellom systemer.",
    tiltakText:
      "Idempotente operasjoner, dead letter-kø, alarm ved gjentatte feil, og manuell «rydde»-rutine etter gjenoppretting.",
  },
  {
    system: "MetaVision",
    title: "Opplæring og situasjonsbevissthet",
    riskText:
      "Personell stoler blindt på at «MetaVision er oppdatert» uten å vite at RPA feilet delvis.",
    tiltakText:
      "Synlig indikator for siste vellykkede synk, opplæring i begrensninger, og krav om klinisk sjekk ved kritiske beslutningspunkter.",
  },

  // —— Medanets ——
  {
    system: "Medanets",
    title: "Mobil arbeidsflate og RPA",
    riskText:
      "RPA oppdaterer Medanets mens helsepersonell arbeider mobil, uten sanntidsvarsling om konfliktende endringer.",
    tiltakText:
      "Optimistisk låsing eller versjonsfelt, varsling ved samtidig redigering, og begrensning av automatiske skriv i samme skjema som bruker.",
  },
  {
    system: "Medanets",
    title: "Kartlegging og triage – feil prioritet",
    riskText:
      "RPA justerer triage eller status basert på forenklet regelverk og overser kontekst som krever klinisk skjønn.",
    tiltakText:
      "Menneske i sløyfen for opprioritering, tydelige terskler, og revisjon av tilfeller der RPA har endret prioritet.",
  },
  {
    system: "Medanets",
    title: "Synkronisering av medikamentliste",
    riskText:
      "Automatisk avstemming mellom Medanets og andre kilder kan overskrive nyere manuelle korreksjoner.",
    tiltakText:
      "Tidsstempel og kilde på siste endring, regel om «siste vinner» vs manuell overstyring, og revisjonslogg for bot-endringer.",
  },
  {
    system: "Medanets",
    title: "Pasientsikkerhet ved nettverksbrudd",
    riskText:
      "RPA fortsetter lokalt med cachet data og synker senere, med risiko for utdaterte beslutninger.",
    tiltakText:
      "Blokkering av skriv ved manglende sync, tydelig offline-indikator, og begrenset lesetilgang til kritisk informasjon til nett er tilbake.",
  },
  {
    system: "Medanets",
    title: "RPA som endringsagent uten klinisk eierskap",
    riskText:
      "Forretningsdrevet RPA endrer arbeidsflyt i Medanets uten at klinisk fagmiljø har godkjent konsekvensene.",
    tiltakText:
      "Beslutningsforum med klinikk og IKT, dokumentert risiko- og gevinstvurdering før produksjon, og årlig gjennomgang.",
  },
];
