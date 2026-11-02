import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { budgetCorrespond, budgetEffectif, libelleBudget } from "./budget";
import type { BuyerInboxRow } from "./queries";

/**
 * CORRIGER UN BUDGET MAL DÉCLARÉ, SANS EFFACER CE QUI A ÉTÉ DÉCLARÉ.
 *
 * Yves GUENIN, le 2 novembre : coché « 500 000 € – 1 M€ » pour un projet
 * au-dessus du million. Avant ce travail, aucune fonction n'écrivait
 * `budget_choice` après l'envoi du formulaire — il a fallu écrire en base à la
 * main, puis rendre sa déclaration quand le mécanisme a existé.
 *
 * Deux choses sont en jeu, et ce fichier garde les deux.
 */

function ligne(budgetChoice: string | null): BuyerInboxRow {
  return { budgetChoice } as BuyerInboxRow;
}

const DOSSIER = "supabase/migrations";

function toutLeSql(): string {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(DOSSIER, f), "utf8"))
    .join("\n");
}

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

describe("quel budget fait foi", () => {
  it("la correction prime sur la déclaration", () => {
    expect(budgetEffectif("500k_1m", "plus_1m")).toBe("plus_1m");
  });

  it("sans correction, c'est la déclaration — rien ne change pour personne", () => {
    // 181 fiches sur 182 n'ont aucune correction : leur comportement doit
    // rester exactement celui d'avant.
    expect(budgetEffectif("500k_1m", null)).toBe("500k_1m");
    expect(budgetEffectif("500k_1m", undefined)).toBe("500k_1m");
    expect(budgetEffectif(null, null)).toBeNull();
  });

  it("une correction tient même sans déclaration", () => {
    // Un dépôt peut ne porter aucun budget ; l'équipe peut quand même savoir.
    expect(budgetEffectif(null, "plus_1m")).toBe("plus_1m");
  });
});

describe("la correction gouverne PARTOUT, ou elle ne sert à rien", () => {
  /*
   * LE POINT QUI JUSTIFIE CE BLOC. Si un seul écran continuait à lire la
   * déclaration, un prospect corrigé apparaîtrait sous « Plus d'1 M€ » dans la
   * liste et sous « 500 k – 1 M€ » dans le récapitulatif du soir. Deux
   * chiffres pour une personne, et plus personne pour dire lequel est bon.
   */

  it("le filtre de tranche suit la correction", () => {
    // La ligne porte déjà le budget EFFECTIF : c'est `queries.ts` qui tranche,
    // une fois, pour tout le monde.
    expect(budgetCorrespond(ligne("plus_1m"), "plus_1m")).toBe(true);
    expect(budgetCorrespond(ligne("plus_1m"), "500k_1m")).toBe(false);
  });

  it("le libellé affiché suit la correction", () => {
    expect(libelleBudget({ budgetChoice: "plus_1m" })).toContain("1 M€");
  });

  it("un seul endroit tranche, et c'est le chargeur de liste", () => {
    const queries = readFileSync("src/modules/buyers/crm/queries.ts", "utf8");
    expect(queries).toContain("budgetEffectif(");
    expect(queries).toContain("profile.budget_choice_corrige");
    // La déclaration reste lisible à côté : la fiche doit pouvoir dire
    // « il avait déclaré X ».
    expect(queries).toContain("budgetDeclare");
  });

  it("le récapitulatif par e-mail lit la correction, lui aussi", () => {
    // C'est l'écran qu'on oublie : il ne passe pas par `loadBuyerList` pour
    // la liste des leads, il interroge la table directement.
    const recap = readFileSync("src/app/api/recap-leads/route.ts", "utf8");
    expect(recap).toContain("budgetEffectif(");
    expect(recap).toContain("budget_choice_corrige");
    // Et il ne doit plus lire la déclaration brute pour le budget affiché.
    expect(recap).not.toContain("budgetChoice: i.budget_choice");
  });
});

describe("la déclaration n'est JAMAIS écrasée", () => {
  const fn = definitionEffective("crm_buyer_set_budget");

  it("la fonction existe et porte la bonne porte", () => {
    expect(fn).not.toBe("");
    // La MÊME que changer l'étape ou qualifier : commerciaux compris, parce
    // que c'est au téléphone qu'on s'aperçoit que la case est fausse.
    expect(fn).toContain("crm_buyer_can_operate");
  });

  it("elle n'écrit QUE la correction, jamais la réponse du formulaire", () => {
    // Le défaut qu'on refuse : écraser `buyer_interests.budget_choice`
    // rendrait la correction indiscernable d'une déclaration.
    expect(fn).not.toMatch(/update\s+(public\.)?buyer_interests/i);
    expect(fn).toContain("budget_choice_corrige");
  });

  it("elle sait RETIRER la correction et rendre la déclaration", () => {
    // Sans cette sortie, une correction posée par erreur serait définitive.
    expect(fn).toContain("v_choix is null");
  });

  it("elle journalise, et le type est déclaré dans la contrainte", () => {
    expect(fn).toContain("acquereur_budget");
    const sql = toutLeSql();
    const derniere = sql.lastIndexOf("audit_events_event_type_check check");
    expect(derniere).toBeGreaterThan(-1);
    expect(sql.slice(derniere)).toContain("'acquereur_budget'");
  });

  it("le journal garde la déclaration d'origine, pas seulement la correction", () => {
    // « Mais il avait dit quoi, lui ? » est la question qu'on posera dans
    // trois semaines.
    expect(fn).toContain("'declare', v_declare");
  });
});
