import { describe, expect, it } from "vitest";
import { buildRpaDeliveryDescription } from "./rpa-delivery-task-template";

describe("buildRpaDeliveryDescription", () => {
  it("includes checklist, team and intake context", () => {
    const md = buildRpaDeliveryDescription({
      assessmentTitle: "Fakturabehandling",
      developerName: "Ada",
      coDeveloperName: "Grace",
      processSystems: "SAP, Outlook",
      processActors: "Økonomi",
      processGoal: "Redusere manuell tid",
      processDescription: "Lese fakturaer",
      intakeFormTitle: "RPA-innmelding",
      intakeSubmitter: "Ola · ola@ex.com",
      intakeRosSummary: "Persondata i e-post",
      intakeRiskLines: ["Uautorisert tilgang"],
      intakePersonData: true,
      intakePvvFlags: ["personvern"],
      rosTitle: "ROS Faktura",
      rosStatus: "in_progress",
      pddExists: false,
      pddProcessTitle: null,
      applicationNames: ["SAP"],
    });

    expect(md).toContain("Fakturabehandling");
    expect(md).toContain("prioritert for leveranse");
    expect(md).toContain("**Utvikler:** Ada");
    expect(md).toContain("**Coutvikler:** Grace");
    expect(md).toContain("RPA-innmelding");
    expect(md).toContain("Tilgang/testbruker for «SAP»");
    expect(md).toContain("- [ ] Utvikling av robot");
    expect(md).toContain("- [x] ROS gjennomført");
    expect(md).toContain("- [ ] PDD");
  });
});
