import { describe, expect, it } from "vitest";
import {
  ASSIGNABLE_ROLES,
  canArchiveBuyer,
  canConnectCalendar,
  canDecideSegment,
  canManageAppointments,
  canManageMembers,
  canOperate,
  canTreatBuyers,
  canPlanEstimation,
  canViewAudit,
  canViewContactDetails,
  hasCrmAccess,
  isCommercialOnly,
  isAssignableRole,
  maskContactValue,
  primaryRole,
  roleHome,
} from "./roles";

describe("rôles CRM", () => {
  it("hasCrmAccess vrai pour un rôle reconnu, faux sinon", () => {
    expect(hasCrmAccess(["setter"])).toBe(true);
    expect(hasCrmAccess(["administrateur"])).toBe(true);
    expect(hasCrmAccess([])).toBe(false);
    expect(hasCrmAccess(["role_inconnu"])).toBe(false);
  });

  it("canOperate réservé à admin / manager / setter", () => {
    expect(canOperate(["setter"])).toBe(true);
    expect(canOperate(["manager"])).toBe(true);
    expect(canOperate(["administrateur"])).toBe(true);
    expect(canOperate(["agent_immobilier"])).toBe(false);
    expect(canOperate(["partenaire_lecture"])).toBe(false);
  });

  it("canViewContactDetails exclut partenaire_lecture", () => {
    expect(canViewContactDetails(["setter"])).toBe(true);
    expect(canViewContactDetails(["agent_immobilier"])).toBe(true);
    expect(canViewContactDetails(["partenaire_lecture"])).toBe(false);
    expect(canViewContactDetails([])).toBe(false);
  });

  it("canDecideSegment réservé à admin / manager", () => {
    expect(canDecideSegment(["manager"])).toBe(true);
    expect(canDecideSegment(["setter"])).toBe(false);
  });

  it("canViewAudit et canManageMembers", () => {
    expect(canViewAudit(["manager"])).toBe(true);
    expect(canViewAudit(["setter"])).toBe(false);
    expect(canManageMembers(["administrateur"])).toBe(true);
    expect(canManageMembers(["manager"])).toBe(false);
  });

  it("primaryRole renvoie le rôle le plus fort", () => {
    expect(primaryRole(["setter", "administrateur"])).toBe("administrateur");
    expect(primaryRole(["setter", "manager"])).toBe("manager");
    expect(primaryRole([])).toBe(null);
  });

  it("maskContactValue masque pour les rôles non autorisés", () => {
    expect(maskContactValue("+33612345678", true)).toBe("+33612345678");
    expect(maskContactValue("+33612345678", false)).toBe("•••• masqué");
    expect(maskContactValue(null, true)).toBe(null);
    expect(maskContactValue("", false)).toBe(null);
  });

  it("ASSIGNABLE_ROLES exclut partenaire_lecture (non attribuable en V1)", () => {
    expect(isAssignableRole("administrateur")).toBe(true);
    expect(isAssignableRole("manager")).toBe(true);
    expect(isAssignableRole("setter")).toBe(true);
    expect(isAssignableRole("agent_immobilier")).toBe(true);
    expect(isAssignableRole("partenaire_lecture")).toBe(false);
    expect(isAssignableRole("role_inconnu")).toBe(false);
    expect(ASSIGNABLE_ROLES).not.toContain("partenaire_lecture");
  });

  it("canConnectCalendar : admin / manager / agent (pas le setter)", () => {
    expect(canConnectCalendar(["administrateur"])).toBe(true);
    expect(canConnectCalendar(["manager"])).toBe(true);
    expect(canConnectCalendar(["agent_immobilier"])).toBe(true);
    expect(canConnectCalendar(["setter"])).toBe(false);
    expect(canConnectCalendar(["partenaire_lecture"])).toBe(false);
  });

  it("canPlanEstimation : admin / manager / setter", () => {
    expect(canPlanEstimation(["setter"])).toBe(true);
    expect(canPlanEstimation(["manager"])).toBe(true);
    expect(canPlanEstimation(["agent_immobilier"])).toBe(false);
    expect(canPlanEstimation(["partenaire_lecture"])).toBe(false);
  });

  it("canManageAppointments : admin / manager uniquement", () => {
    expect(canManageAppointments(["administrateur"])).toBe(true);
    expect(canManageAppointments(["manager"])).toBe(true);
    expect(canManageAppointments(["setter"])).toBe(false);
    expect(canManageAppointments(["agent_immobilier"])).toBe(false);
  });

  it("roleHome : accès → /crm, sans accès → /acces (jamais de boucle /connexion)", () => {
    expect(roleHome(["administrateur"])).toBe("/crm");
    expect(roleHome(["agent_immobilier"])).toBe("/crm");
    expect(roleHome([])).toBe("/acces");
    expect(roleHome(["role_inconnu"])).toBe("/acces");
  });
});


describe("isCommercialOnly", () => {
  it("reconnaît le commercial qui n'est que commercial", () => {
    expect(isCommercialOnly(["commercial"])).toBe(true);
  });

  it("ne réduit pas l'écran de quelqu'un qui est aussi opérateur", () => {
    expect(isCommercialOnly(["commercial", "manager"])).toBe(false);
    expect(isCommercialOnly(["commercial", "setter"])).toBe(false);
    expect(isCommercialOnly(["commercial", "administrateur"])).toBe(false);
  });

  it("ni celui qui est aussi agent immobilier", () => {
    expect(isCommercialOnly(["commercial", "agent_immobilier"])).toBe(false);
  });

  it("ne donne aucun droit à qui n'est pas commercial", () => {
    expect(isCommercialOnly([])).toBe(false);
    expect(isCommercialOnly(["partenaire_lecture"])).toBe(false);
  });
});

describe("canTreatBuyers", () => {
  it("laisse le commercial traiter ses dossiers", () => {
    expect(canTreatBuyers(["commercial"])).toBe(true);
  });

  it("n'enlève rien aux opérateurs", () => {
    for (const r of ["administrateur", "manager", "setter"]) {
      expect(canTreatBuyers([r])).toBe(true);
    }
  });

  it("reste fermé à qui n'a ni l'un ni l'autre", () => {
    expect(canTreatBuyers(["partenaire_lecture"])).toBe(false);
    expect(canTreatBuyers([])).toBe(false);
  });
});

describe("canArchiveBuyer", () => {
  it("n'ouvre qu'à l'administrateur", () => {
    expect(canArchiveBuyer(["administrateur"])).toBe(true);
  });

  it("LE POINT QUI COMPTE : ferme à tous les autres, manager compris", () => {
    // La demande était explicite : « que les commerciaux, les setters, etc.
    // eux ne puissent jamais supprimer de contact ». Le manager n'y est pas
    // non plus — archiver une fiche la retire des listes de toute l'équipe.
    for (const r of ["manager", "setter", "commercial", "agent_immobilier", "partenaire_lecture"]) {
      expect(canArchiveBuyer([r]), r).toBe(false);
    }
    expect(canArchiveBuyer([])).toBe(false);
  });

  it("suffit d'être administrateur en plus d'autre chose", () => {
    expect(canArchiveBuyer(["commercial", "administrateur"])).toBe(true);
  });
});
