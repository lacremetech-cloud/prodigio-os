import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ASSIGNABLE_ROLES, CRM_ROLES } from "./roles";

/**
 * UN RÔLE VIT DANS PLUSIEURS CONTRAINTES. IL FAUT LES TENIR ENSEMBLE.
 *
 * Le 12 octobre, le rôle `commercial` est créé : la migration élargit
 * `organization_memberships_role_check` et `crm_role_is_assignable`, mais
 * oublie `organization_invitations_role_check`. Les deux premières disent « ce
 * rôle existe et s'attribue depuis l'interface » ; la troisième, restée en
 * arrière, refuse la ligne.
 *
 * Personne ne l'a vu pendant presque un mois, parce que les trois commerciaux
 * existants n'avaient jamais été invités par ce chemin. Le défaut est sorti le
 * 6 novembre, en préparant l'accès d'Édouard ROWLANDSON, qui doit traiter les
 * leads des 2 Alpes : la fonction validait le rôle, puis la base refusait
 * l'écriture — un message illisible, sur une action qui aurait dû marcher.
 *
 * C'est la même forme d'erreur que les types d'événements d'audit du
 * 28 octobre : une liste de valeurs recopiée à plusieurs endroits finit par
 * diverger, et la divergence ne se voit que le jour où quelqu'un clique.
 */

const DOSSIER = "supabase/migrations";

/** La dernière définition d'une contrainte, migrations lues dans l'ordre. */
function derniereContrainte(nom: string): string {
  let trouvee = "";
  for (const f of readdirSync(DOSSIER).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(DOSSIER, f), "utf8");
    const i = sql.lastIndexOf(`add constraint ${nom}`);
    if (i > -1) trouvee = sql.slice(i, i + 600);
  }
  return trouvee;
}

const ADHESIONS = "organization_memberships_role_check";
const INVITATIONS = "organization_invitations_role_check";

describe("les deux contraintes de rôle disent la même chose", () => {
  it("on lit bien les migrations", () => {
    expect(derniereContrainte(ADHESIONS)).not.toBe("");
    expect(derniereContrainte(INVITATIONS)).not.toBe("");
  });

  it("LE DÉFAUT DU 6 NOVEMBRE : un rôle d'adhésion absent des invitations", () => {
    // Si un rôle peut être porté mais pas invité, on ne peut pas faire entrer
    // la personne par la porte prévue.
    const adhesions = derniereContrainte(ADHESIONS);
    const invitations = derniereContrainte(INVITATIONS);
    const manquants = CRM_ROLES.filter(
      (r) => adhesions.includes(`'${r}'`) && !invitations.includes(`'${r}'`),
    );
    expect(manquants, `invitables nulle part : ${manquants.join(", ")}`).toEqual([]);
  });

  it("tout rôle attribuable depuis l'interface est invitable", () => {
    const invitations = derniereContrainte(INVITATIONS);
    for (const r of ASSIGNABLE_ROLES) {
      expect(invitations, r).toContain(`'${r}'`);
    }
  });

  it("`commercial` en particulier — c'est lui qui manquait", () => {
    expect(derniereContrainte(INVITATIONS)).toContain("'commercial'");
    expect(ASSIGNABLE_ROLES).toContain("commercial");
  });
});
