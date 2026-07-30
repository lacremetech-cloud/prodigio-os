import { describe, expect, it } from "vitest";
import {
  canDecideSegment,
  canManageMembers,
  canOperate,
  canViewAudit,
  canViewContactDetails,
  hasCrmAccess,
  maskContactValue,
  primaryRole,
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
});
