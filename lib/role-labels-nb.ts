/** Norske etiketter for arbeidsområde-roller (workspaceMembers.role) */
export const WORKSPACE_ROLE_LABEL_NB: Record<string, string> = {
  owner: "Eier",
  admin: "Administrator",
  member: "Medlem",
  viewer: "Kun visning",
};

export const WORKSPACE_ROLE_DESC_NB: Record<string, string> = {
  owner:
    "Full kontroll, kan slette arbeidsområdet. Overordnet team og innstillinger.",
  admin:
    "Invitere og fjerne medlemmer, endre roller, redigere navn og notater for området.",
  member:
    "Opprette og redigere vurderinger, ROS, kandidater og annet innhold.",
  viewer: "Se alt i arbeidsområdet uten å gjøre endringer.",
};

/** Roller på enkeltvurdering (assessmentCollaborators.role) */
export const ASSESSMENT_COLLAB_ROLE_LABEL_NB: Record<string, string> = {
  owner: "Eier",
  editor: "Redaktør",
  reviewer: "Gjennomganger",
  viewer: "Visning",
};

export const ASSESSMENT_COLLAB_ROLE_DESC_NB: Record<string, string> = {
  owner: "Opprettet vurderingen; kan ikke fjernes herfra.",
  editor: "Full redigering av skjema, milepæler, notater og deling.",
  reviewer:
    "Ser vurderingen. Redigering av skjema følger samme regler som ellers (f.eks. arbeidsområde-admin eller «delt med alle»).",
  viewer: "Kun lese vurderingen uten å endre skjema.",
};
