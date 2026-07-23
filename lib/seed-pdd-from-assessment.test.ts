import { describe, expect, it } from "vitest";
import { buildSeedPddPayload } from "./seed-pdd-from-assessment";

describe("buildSeedPddPayload", () => {
  it("fills core fields from assessment draft and intake", () => {
    const payload = buildSeedPddPayload({
      assessmentTitle: "Fakturabehandling",
      payload: {
        processName: "Faktura",
        processDescription: "Les og bokfør",
        processGoal: "Mindre manuell tid",
        processActors: "Økonomi",
        processSystems: "SAP, Outlook",
      },
      intakeRosSummary: "Persondata i e-post",
      intakeSubmitter: { name: "Ola", email: "ola@ex.com" },
      rosTitle: "ROS · Faktura",
    });

    expect(payload.processTitle).toBe("Faktura");
    expect(payload.executiveSummary).toContain("Les og bokfør");
    expect(payload.executiveSummary).toContain("Persondata i e-post");
    expect(payload.asIsApplications?.map((a) => a.name)).toEqual([
      "SAP",
      "Outlook",
    ]);
    expect(payload.keyContacts?.some((c) => c.name === "Ola")).toBe(true);
    expect(payload.inScope).toContain("ROS · Faktura");
  });
});
