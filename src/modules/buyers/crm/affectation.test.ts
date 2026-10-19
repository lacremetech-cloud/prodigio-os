import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { canOperate, canTreatBuyers } from "@/modules/crm/auth/roles";

/**
 * QUI PEUT TRAITER UN DOSSIER PEUT LE CONFIER.
 *
 * `crm_buyer_assign` exigeait administrateur, manager ou setter. La règle
 * venait d'une crainte — « deux associés se reprendraient leurs dossiers sans
 * que l'autre le sache » — qui ne correspond pas à cette agence : les
 * commerciaux voient tous les leads de leurs biens, se les attribuent et se
 * les confient entre eux. Leur refuser ce geste les obligeait à passer par
 * quelqu'un d'autre, chaque jour.
 *
 * La porte est désormais `crm_buyer_can_operate` — exactement celle du
 * changement d'étape et de l'enregistrement d'un échange.
 */

const DOSSIER = "supabase/migrations";

/** Dernière définition d'une fonction, migrations lues dans l'ordre. */
function definitionEffective(nom: string): string {
  let trouvee = "";
  for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(DOSSIER, fichier), "utf8");
    const entetes = [
      ...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi),
    ];
    for (let i = 0; i < entetes.length; i += 1) {
      if (entetes[i]![1] !== nom) continue;
      const fin = i + 1 < entetes.length ? entetes[i + 1]!.index! : sql.length;
      trouvee = sql.slice(entetes[i]!.index!, fin);
    }
  }
  return trouvee;
}

describe("confier un dossier acquéreur", () => {
  const assign = definitionEffective("crm_buyer_assign");

  it("la migration la plus récente est bien celle qu'on lit", () => {
    expect(assign).not.toBe("");
    expect(assign).toContain("crm_buyer_assign");
  });

  it("n'exige plus un rôle d'encadrement", () => {
    expect(assign).not.toContain("crm_require_role");
  });

  it("passe par la MÊME porte que le changement d'étape", () => {
    expect(assign).toContain("crm_buyer_can_operate");
    expect(definitionEffective("crm_buyer_set_interest_stage")).toContain("crm_buyer_can_operate");
  });

  it("garde ce qui doit rester : membre actif, et trace de l'auteur", () => {
    // Travailler ensemble suppose de voir qui a confié quoi.
    expect(assign).toContain("utilisateur cible non membre actif");
    expect(assign).toContain("assigned_by");
    expect(assign).toContain("acquereur_affectation");
  });

  it("côté interface, c'est « qui traite » et non « qui encadre »", () => {
    expect(canTreatBuyers(["commercial"])).toBe(true);
    // L'ancienne règle, pour mémoire : elle excluait le commercial.
    expect(canOperate(["commercial"])).toBe(false);
    // Et l'encadrement ne perd rien au passage.
    for (const r of ["administrateur", "manager", "setter"]) {
      expect(canTreatBuyers([r]), r).toBe(true);
    }
  });

  it("les deux pages passent bien le droit au panneau", () => {
    for (const f of [
      "src/app/crm/acquereurs/page.tsx",
      "src/app/crm/acquereurs/pipeline/page.tsx",
    ]) {
      const source = readFileSync(f, "utf8");
      expect(source, f).toContain("peutAffecterAutrui={canTreatBuyers(session.roles)}");
    }
  });
});
