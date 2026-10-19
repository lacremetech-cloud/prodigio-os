import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buyerAuditEventLabels } from "./labels";

/**
 * TOUT ÉVÉNEMENT ÉCRIT DOIT ÊTRE ACCEPTÉ ET NOMMABLE.
 *
 * `crm_buyer_set_interest_stage` écrivait « acquereur_etape ». La contrainte
 * `audit_events_event_type_check` n'accepte que « acquereur_stade ». La
 * fonction n'avale pas l'erreur : la transaction entière échouait.
 *
 * Résultat, du 14 au 19 octobre 2026 : déplacer une carte renvoyait au
 * commercial le texte brut de la contrainte PostgreSQL, le sélecteur d'étape
 * de la fiche échouait pareil, et caler une visite disait « déplacez-le à la
 * main » — ce qui échouait aussi. Huit changements d'étape tracés en tout,
 * le dernier le 14 octobre.
 *
 * Rien ne pouvait l'attraper : ni le typage, ni le linter, ni les tests. Une
 * lettre dans une chaîne de caractères, refusée par la base seulement au
 * moment où quelqu'un clique.
 *
 * Ce test lit la DERNIÈRE définition de chaque fonction — une migration plus
 * récente remplace la précédente — et vérifie que chaque événement acquéreur
 * qu'elle écrit porte un libellé. Sans libellé, l'historique affiche une
 * chaîne brute ; et c'est précisément ce qui manquait ici.
 */

const DOSSIER = "supabase/migrations";

/** Dernière définition de chaque fonction, migrations lues dans l'ordre. */
function definitionsEffectives(): Map<string, string> {
  const effectives = new Map<string, string>();
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".sql")).sort();

  for (const fichier of fichiers) {
    const sql = readFileSync(join(DOSSIER, fichier), "utf8");
    const entetes = [
      ...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi),
    ];
    for (let i = 0; i < entetes.length; i += 1) {
      const nom = entetes[i]![1]!;
      const debut = entetes[i]!.index!;
      const fin = i + 1 < entetes.length ? entetes[i + 1]!.index! : sql.length;
      // Une migration plus récente écrase : on garde la dernière vue.
      effectives.set(nom, sql.slice(debut, fin));
    }
  }
  return effectives;
}

/** Les `event_type` acquéreur écrits dans un corps de fonction. */
function evenementsAcquereur(corps: string): string[] {
  const valeurs = [
    ...corps.matchAll(
      /values\s*\([^;]*?'(?:buyer_profile|buyer_interest)'\s*,[^,]+,\s*'(acquereur_[a-z_]+)'/gi,
    ),
  ].map((m) => m[1]!);
  return [...new Set(valeurs)];
}

describe("journal d'audit acquéreur", () => {
  const effectives = definitionsEffectives();

  it("lit bien les migrations — sinon le test passerait en ne regardant rien", () => {
    expect(effectives.size).toBeGreaterThan(20);
    expect(effectives.has("crm_buyer_set_interest_stage")).toBe(true);
  });

  it("chaque événement écrit porte un libellé", () => {
    const orphelins: string[] = [];
    for (const [nom, corps] of effectives) {
      for (const e of evenementsAcquereur(corps)) {
        if (!(e in buyerAuditEventLabels)) orphelins.push(`${nom} écrit « ${e} »`);
      }
    }
    expect(orphelins, orphelins.join(" ; ")).toEqual([]);
  });

  it("le déplacement de carte écrit « acquereur_stade », jamais « acquereur_etape »", () => {
    const corps = effectives.get("crm_buyer_set_interest_stage")!;
    expect(evenementsAcquereur(corps)).toEqual(["acquereur_stade"]);
  });

  it("l'extracteur attrape vraiment la faute d'origine", () => {
    // Sans cette vérification, une expression régulière qui ne trouve rien
    // ferait passer le test précédent pour toujours.
    const faux = `values (v_uid, 'buyer_profile', v_profile, 'acquereur_etape',`;
    expect(evenementsAcquereur(faux)).toEqual(["acquereur_etape"]);
    expect("acquereur_etape" in buyerAuditEventLabels).toBe(false);
  });
});
