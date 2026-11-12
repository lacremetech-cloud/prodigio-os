import { describe, expect, it } from "vitest";
import { canPiloter, CRM_ROLES } from "@/modules/crm/auth/roles";
import { universDeLaRoute } from "@/components/crm/shell/crm-shell";

/**
 * LE PILOTAGE EST RÉSERVÉ À L'ADMINISTRATEUR (décision du 12/11/2026).
 *
 * L'écran se règle sur `canPiloter` ; la base, elle, refuse de toute façon
 * (RLS et fonctions `crm_pilotage_*`, voir `migration.test.ts`). Ce test
 * verrouille le premier étage : aucun autre rôle ne voit l'entrée ni les pages.
 */
describe("qui voit le pilotage", () => {
  it("l'administrateur, et lui seul", () => {
    for (const role of CRM_ROLES) {
      expect(canPiloter([role]), role).toBe(role === "administrateur");
    }
  });

  it("un manager reste dehors, même cumulé à d'autres rôles non administrateurs", () => {
    expect(canPiloter(["manager", "setter", "commercial"])).toBe(false);
    expect(canPiloter(["manager", "administrateur"])).toBe(true);
    expect(canPiloter([])).toBe(false);
  });

  it("les pages du pilotage s'ouvrent dans l'univers Biens, où vit son entrée de menu", () => {
    expect(universDeLaRoute("/crm/pilotage/donnees")).toBe("biens");
    expect(universDeLaRoute("/crm/pilotage/donnees/6f1d2c3b-4a5e-4f60-8a9b-0c1d2e3f4a5b")).toBe("biens");
  });
});
