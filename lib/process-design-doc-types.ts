/** Speiler Convex processDesignDocumentPayload — klient uten convex/server. */

export type ProcessDesignAppRow = {
  name: string;
  type?: string;
  env?: string;
  comments?: string;
  phase?: string;
};

export type ProcessDesignStepRow = {
  stepNo?: string;
  input?: string;
  description: string;
  details?: string;
  exception?: string;
  actions?: string;
  rules?: string;
};

export type ProcessDesignContactRow = {
  role: string;
  name: string;
  contact: string;
  notes?: string;
};

export type ProcessDesignHistoryRow = {
  date: string;
  version: string;
  role: string;
  name: string;
  organization?: string;
  comments?: string;
};

export type ProcessDesignExceptionRow = {
  id?: string;
  name: string;
  step?: string;
  params?: string;
  action: string;
};

export type ProcessDesignApprovalRow = {
  version?: string;
  flow?: string;
  role?: string;
  name?: string;
  org?: string;
  signature?: string;
};

/**
 * HUKI = Høres · Utfører · Kontrollerer · Informeres (norsk RACI).
 * Hver rad er en aktivitet, med flagg for hvilke roller som er involvert.
 */
export type ProcessDesignHukiRow = {
  activity: string;
  h?: string;
  u?: string;
  k?: string;
  i?: string;
};

export type ProcessDesignDocumentPayload = {
  /* ---- Oversikt ---- */
  processTitle?: string;
  shortDescription?: string;
  executiveSummary?: string;
  purpose?: string;
  objectives?: string;
  keyContacts?: ProcessDesignContactRow[];
  prerequisites?: string;

  /* ---- As-Is ---- */
  asIsProcessName?: string;
  asIsProcessArea?: string;
  asIsDepartment?: string;
  asIsShortDescription?: string;
  asIsRoles?: string;
  asIsSchedule?: string;
  asIsVolume?: string;
  asIsHandleTime?: string;
  asIsExecutionTime?: string;
  asIsPeak?: string;
  asIsFte?: string;
  asIsInputData?: string;
  asIsOutputData?: string;
  asIsApplications?: ProcessDesignAppRow[];
  asIsProcessMap?: string;
  /** Lagret tldraw-tegning (JSON med { document: { store, schema } }) */
  asIsDiagramSnapshot?: string;
  asIsSteps?: ProcessDesignStepRow[];

  /* ---- To-Be ---- */
  toBeMap?: string;
  toBeDiagramSnapshot?: string;
  toBeSteps?: string;
  parallelInitiatives?: string;
  inScope?: string;
  outOfScope?: string;

  /* ---- HUKI ---- */
  hukiRows?: ProcessDesignHukiRow[];

  /* ---- Risiko og feilhåndtering ---- */
  businessExceptionsKnown?: ProcessDesignExceptionRow[];
  businessExceptionsUnknown?: string;
  appErrorsKnown?: ProcessDesignExceptionRow[];
  appErrorsUnknown?: string;
  reporting?: string;

  /* ---- Tillegg ---- */
  otherObservations?: string;
  additionalSources?: string;
  targetTimeline?: string;
  appendix?: string;
  documentHistory?: ProcessDesignHistoryRow[];
  approvalRows?: ProcessDesignApprovalRow[];
};

export function emptyProcessDesignPayload(): ProcessDesignDocumentPayload {
  return {};
}
