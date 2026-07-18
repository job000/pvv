/**
 * Produkttekster for Puls-tavlen (arbeidskort / delkort).
 * Unngår «sak»/«issue» som høres ut som GitHub eller saksbehandling.
 */

export const pulsBoardCopy = {
  navLabel: "Puls",
  pageTitle: "Puls",
  pageSubtitle:
    "Hold rytmen — prioriter kort, koble dem til vurderinger og flytt fremover.",
  tabBoard: "Tavle",
  tabPipeline: "Pipeline",
  pipelineSubtitle: "Se vurderinger gjennom livssyklusen.",
  filterPlaceholder: "Søk i kort…",
  filterAria: "Søk i kort",
  processFilterAria: "Filtrer på prosess",
  allProcesses: "Alle prosesser",
  cardCount: (n: number) => `${n} kort`,
  newCard: "Nytt kort",
  newSubcard: "Nytt delkort",
  emptyBoard:
    "Ingen kort ennå. Opprett et kort — delkort blir egne kort på tavlen når du kobler dem.",
  createTitle: "Nytt kort",
  createSubTitle: "Nytt delkort",
  createHint: "Blir synlig på tavlen med en gang.",
  createHintSub: "Blir et eget kort, koblet under valgt kort.",
  parentNone: "Ingen — toppnivå",
  parentUnder: (label: string) => `Under: ${label}`,
  parentHint: "Du kan legge delkort under andre delkort — flere nivåer.",
  parentLabel: "Kobling til kort",
  subcardChip: "Delkort",
  underOf: (title: string) => `Under: ${title}`,
  directSubcards: "Direkte delkort",
  createSubcardCta: "Opprett delkort",
  openCard: "Åpne kort",
  detailTitle: "Kort",
  saved: "Kort lagret",
  created: "Kort opprettet",
  createdSub: "Delkort opprettet",
  deleted: "Kort slettet",
  completed: "Kort markert ferdig",
  completedTree: "Kort og delkort markert ferdig",
  completePromptBody: (title: string) =>
    `«${title}» har åpne delkort. Velg om hele treet også skal markeres ferdig.`,
  completeAll: "Fullfør kort og delkort",
  completeOnly: "Kun dette kortet",
  openBoard: "Åpne Puls",
  notifyBody: (assessmentTitle: string) =>
    `På vurderingen «${assessmentTitle}». Åpne kortet under Puls.`,
  notifyAssigned: (title: string) => `Du er tildelt «${title}»`,
} as const;

export const pulsBoardPath = (workspaceId: string, taskId?: string) =>
  taskId
    ? `/w/${workspaceId}/puls?task=${taskId}`
    : `/w/${workspaceId}/puls`;
