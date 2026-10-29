import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { canArchiveBuyer, canDecideMandate, canTreatBuyers } from "@/modules/crm/auth/roles";

/**
 * SEUL L'ADMINISTRATEUR ARCHIVE UN CONTACT.
 *
 * La demande était explicite : « que les commerciaux, les setters, etc. eux ne
 * puissent jamais supprimer de contact, mais que nous, on le puisse ». Le
 * manager n'y est pas non plus — archiver une fiche la retire des listes de
 * TOUTE l'équipe, du Kanban, des six compteurs et des récapitulatifs.
 *
 * CE QUE CE TEST PROTÈGE VRAIMENT. Un droit posé dans l'écran n'est pas un
 * droit : il suffit de forger l'appel. Celui qui compte est dans la fonction
 * SQL. Et la pente naturelle, dans six mois, sera de « simplifier » en
 * remplaçant la porte par `crm_can_decide()` — qui laisse passer les managers —
 * parce que c'est ce que font la plupart des autres RPC du module. Ce test lit
 * la dernière définition en migration et refuse ce glissement.
 *
 * Il vérifie aussi que l'archivage reste RÉVERSIBLE et qu'il n'est jamais
 * devenu un `delete` : `buyer_interests` porte le nom, l'e-mail et le
 * téléphone en colonnes directes et sa clé étrangère est en `set null`, donc
 * une suppression détruirait l'historique d'appels tout en conservant les
 * données personnelles. L'inverse exact du résultat recherché.
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

/**
 * Le SQL sans ses commentaires.
 *
 * Indispensable ici : la fonction EXPLIQUE dans un commentaire qu'elle est
 * « volontairement plus strict que `crm_can_decide()` ». Chercher ce nom dans
 * le texte brut attraperait donc la prose qui dit l'inverse de ce qu'on
 * redoute. Un test sur le code doit lire le code.
 */
function sansCommentaires(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/** Toutes les migrations concaténées, dans l'ordre d'application. */
function toutLeSql(): string {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(DOSSIER, f), "utf8"))
    .join("\n");
}

describe("archiver un contact — la porte en base", () => {
  const archive = definitionEffective("crm_buyer_archive");
  const desarchive = definitionEffective("crm_buyer_desarchive");
  const archiveCode = sansCommentaires(archive);
  const desarchiveCode = sansCommentaires(desarchive);

  it("lit bien les migrations — sinon le test passerait en ne regardant rien", () => {
    expect(archive).not.toBe("");
    expect(archive).toContain("crm_buyer_archive");
    expect(desarchive).not.toBe("");
  });

  it("exige le rôle administrateur, nommément", () => {
    for (const [nom, corps] of [
      ["crm_buyer_archive", archiveCode],
      ["crm_buyer_desarchive", desarchiveCode],
    ] as const) {
      expect(corps, nom).toContain("crm_has_role('administrateur')");
    }
  });

  it("LE GLISSEMENT À REFUSER : ni crm_can_decide, ni crm_is_operator", () => {
    // `crm_can_decide()` laisse passer les managers ; `crm_is_operator()` y
    // ajoute les setters. Les deux sont plus larges que ce qui a été demandé.
    for (const [nom, corps] of [
      ["crm_buyer_archive", archiveCode],
      ["crm_buyer_desarchive", desarchiveCode],
    ] as const) {
      expect(corps, nom).not.toContain("crm_can_decide");
      expect(corps, nom).not.toContain("crm_is_operator");
      expect(corps, nom).not.toContain("crm_buyer_can_operate");
    }
  });

  it("refuse un appel non authentifié avant même de regarder le rôle", () => {
    for (const corps of [archive, desarchive]) {
      expect(corps).toContain("auth.uid()");
      expect(corps).toContain("authentification requise");
    }
  });

  it("journalise, et le type d'événement est déclaré dans la contrainte", () => {
    // La leçon du 28 octobre : un type absent de la contrainte fait échouer
    // l'insertion d'audit, qui partage la transaction de la mise à jour — tout
    // est annulé, et l'écran ne sait pas dire pourquoi.
    expect(archive).toContain("acquereur_archive");
    expect(desarchive).toContain("acquereur_desarchive");

    const sql = toutLeSql();
    const derniere = sql.lastIndexOf("audit_events_event_type_check check");
    expect(derniere).toBeGreaterThan(-1);
    const contrainte = sql.slice(derniere);
    expect(contrainte).toContain("'acquereur_archive'");
    expect(contrainte).toContain("'acquereur_desarchive'");
  });

  it("est RÉVERSIBLE : la fonction de retour existe et remet la fiche active", () => {
    expect(desarchive).toContain("archive_le = null");
  });

  it("n'est JAMAIS une suppression de la fiche", () => {
    // Un `delete` détruirait l'historique d'appels en cascade tout en laissant
    // les données personnelles dans `buyer_interests`.
    for (const corps of [archiveCode, desarchiveCode]) {
      expect(corps).not.toMatch(/delete\s+from\s+(public\.)?buyer_profiles/i);
      expect(corps).not.toMatch(/delete\s+from\s+(public\.)?contacts/i);
    }
  });

  it("n'écrase pas la trace d'origine si on rejoue l'appel", () => {
    // Qui a archivé, et quand, doit rester ce qui s'est passé la première fois.
    expect(archive).toContain("deja_archive");
  });
});

describe("archiver un contact — la porte dans l'écran", () => {
  it("est plus stricte que toutes les autres portes du module", () => {
    // Un manager décide d'un résultat commercial et rouvre un dossier
    // (`canDecideMandate`) ; un commercial traite ses dossiers
    // (`canTreatBuyers`). Aucun des deux n'archive.
    expect(canDecideMandate(["manager"])).toBe(true);
    expect(canTreatBuyers(["commercial"])).toBe(true);
    expect(canArchiveBuyer(["manager"])).toBe(false);
    expect(canArchiveBuyer(["commercial"])).toBe(false);
    expect(canArchiveBuyer(["administrateur"])).toBe(true);
  });
});

describe("les fiches archivées sortent des listes", () => {
  it("le filtre est posé sur la requête d'où TOUT dérive", () => {
    // Les lignes, le Kanban, les six compteurs et les récapitulatifs de
    // 8 h 30, 13 h et 17 h 30 dérivent tous de `profiles` dans
    // `loadBuyerList`. Un filtre par écran, et un compteur finirait par
    // annoncer « 4 en retard » devant une liste qui en montre 3.
    const queries = readFileSync("src/modules/buyers/crm/queries.ts", "utf8");
    const debut = queries.indexOf("export async function loadBuyerList");
    expect(debut).toBeGreaterThan(-1);
    const corps = queries.slice(debut, queries.indexOf("export async function", debut + 10));
    expect(corps).toContain('.is("archive_le", null)');
  });

  it("et l'administrateur peut les relire", () => {
    const queries = readFileSync("src/modules/buyers/crm/queries.ts", "utf8");
    expect(queries).toContain("export async function loadArchivedBuyers");
    expect(queries).toContain('.not("archive_le", "is", null)');
  });
});
