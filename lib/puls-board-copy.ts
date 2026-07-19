/**
 * Produkttekster for Puls-tavlen (arbeidskort / delkort).
 * Unngår «sak»/«issue» som høres ut som GitHub eller saksbehandling.
 */

export const pulsBoardCopy = {
  navLabel: "Puls",
  pageTitle: "Puls",
  pageSubtitle:
    "Hold rytmen — prioriter kort, koble dem til arbeid og flytt fremover.",
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
  createHint: "Gi kortet en tittel. Du kan koble til flere ting samtidig.",
  createHintSub: "Blir et eget kort under valgt forelder.",
  createLinkLabel: "Koblinger",
  createLinkHint: "Valgfritt — vurdering, prosess, ROS, PDD og/eller skjema.",
  createLinkShow: "Vis koblinger",
  createLinkHide: "Skjul koblinger",
  createLinkNone: "Ingen",
  createLinkAssessment: "Vurdering",
  createLinkProcess: "Prosess",
  createLinkRos: "ROS",
  createLinkPdd: "PDD",
  createLinkForm: "Skjema",
  createLinkSearch: "Filtrer …",
  createMore: "Mer (kolonne, datoer, tildeling)",
  createLess: "Skjul ekstra",
  createSizeFull: "Fullskjerm",
  createSizeExitFull: "Lukk fullskjerm",
  parentNone: "Ingen — toppnivå",
  parentUnder: (label: string) => `Under: ${label}`,
  parentHint: "Du kan legge delkort under andre delkort — flere nivåer.",
  parentLabel: "Under kort",
  subcardChip: "Delkort",
  underOf: (title: string) => `Under: ${title}`,
  directSubcards: "Direkte delkort",
  createSubcardCta: "Opprett delkort",
  checklistPromoteHint: "Høyreklikk sjekkboks for å lage kort",
  checklistPromoteError: "Fant ikke sjekkpunktet i beskrivelsen",
  checklistPromoteRestored: "Sjekkpunktet er tilbakestilt i beskrivelsen",
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

/**
 * Hub: `/puls`. Tavle: `/puls/[boardId]`.
 * Kort i dialog: `?task=`. Egen side: `/puls/[boardId]/task/[taskId]`.
 */
export function pulsBoardPath(
  workspaceId: string,
  boardId?: string,
  taskId?: string,
  opts?: { page?: boolean },
) {
  if (boardId && taskId && opts?.page) {
    return `/w/${workspaceId}/puls/${boardId}/task/${encodeURIComponent(taskId)}`;
  }
  if (boardId && taskId) {
    return `/w/${workspaceId}/puls/${boardId}?task=${encodeURIComponent(taskId)}`;
  }
  if (boardId) {
    return `/w/${workspaceId}/puls/${boardId}`;
  }
  return `/w/${workspaceId}/puls`;
}
