import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * UN COMMERCIAL INVITÉ NE DOIT PAS ARRIVER DANS UN CRM VIDE.
 *
 * Le 6 novembre, en préparant l'accès d'Édouard ROWLANDSON (Cimalpes) :
 * `crm_accept_invitation` créait la membership et s'arrêtait là. Or un
 * commercial ne voit que les biens de `property_assignments`. Zéro affectation,
 * donc zéro bien, donc zéro lead — et à l'écran, un CRM vide ressemble trait
 * pour trait à un refus d'accès. On aurait cherché le défaut du côté de
 * l'authentification.
 *
 * Le périmètre est donc posé sur l'invitation par l'administrateur, et
 * l'acceptation l'applique.
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

/** Le SQL sans ses commentaires : une prose ne doit pas valider une assertion. */
function sansCommentaires(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

describe("l'administrateur fixe le périmètre, et lui seul", () => {
  const fn = sansCommentaires(definitionEffective("crm_invitation_set_scope"));

  it("la fonction existe et exige le rôle administrateur", () => {
    expect(fn).not.toBe("");
    expect(fn).toContain("crm_require_role('administrateur')");
  });

  it("elle refuse un bien d'une autre organisation", () => {
    // Sans ce contrôle, on accorderait un accès hors périmètre en silence.
    expect(fn).toContain("p.organization_id = v_inv.organization_id");
    expect(fn).toMatch(/raise exception 'bien hors de l/);
  });

  it("elle écrit le périmètre sur l'invitation, pas ailleurs", () => {
    expect(fn).toContain("organization_invitations");
    expect(fn).toContain("'property_ids'");
    // Elle ne pose PAS d'affectation elle-même : l'invitation n'est pas une
    // acceptation, et la personne n'a pas encore forcément de compte.
    expect(fn).not.toMatch(/insert\s+into\s+(public\.)?property_assignments/i);
  });
});

describe("l'acceptation applique le périmètre", () => {
  const fn = sansCommentaires(definitionEffective("crm_accept_invitation"));

  it("elle lit le périmètre de l'invitation", () => {
    expect(fn).toContain("metadata -> 'property_ids'");
  });

  it("elle pose les affectations du bien", () => {
    expect(fn).toMatch(/insert\s+into\s+public\.property_assignments/i);
    expect(fn).toContain("'commercial'");
  });

  it("elle n'agit QUE sur la personne connectée", () => {
    /*
     * LE PIÈGE ÉVITÉ. Une fonction SECURITY DEFINER « affecte ce bien à cet
     * utilisateur » prenant un identifiant en paramètre serait une élévation de
     * privilège : il suffirait de passer le sien. La pose vit donc ici, où le
     * seul destinataire possible est `auth.uid()`.
     */
    const pose = fn.slice(fn.indexOf("property_assignments"));
    expect(pose).toContain("v_uid");
    expect(pose).not.toMatch(/p_user_id/);
  });

  it("elle est rejouable : une seconde acceptation ne double rien", () => {
    expect(fn).toContain("on conflict (property_id, user_id) do nothing");
    expect(fn).toContain("on conflict (user_id, organization_id) do nothing");
  });

  it("elle reste refusée sans session, et sur une invitation périmée", () => {
    expect(fn).toContain("authentification requise");
    expect(fn).toContain("invitation expirée");
    expect(fn).toContain("invitation révoquée");
  });
});

describe("aucune porte dérobée d'affectation", () => {
  it("aucune fonction SECURITY DEFINER n'affecte un bien à un user_id passé en paramètre", () => {
    /*
     * On balaie toutes les migrations : si quelqu'un ajoute un jour
     * `crm_assign_property(p_property_id, p_user_id)` en SECURITY DEFINER sans
     * contrôle de rôle, ce test doit tomber.
     *
     * `crm_buyer_assign` et `crm_buyer_unassign` affectent un ACQUÉREUR à un
     * collaborateur — pas un bien à quelqu'un — et passent par leurs propres
     * gardes : elles ne touchent pas `property_assignments`.
     */
    for (const nom of ["crm_buyer_assign", "crm_buyer_unassign"]) {
      const fn = sansCommentaires(definitionEffective(nom));
      if (fn === "") continue;
      expect(fn, nom).not.toMatch(/insert\s+into\s+(public\.)?property_assignments/i);
    }
  });
});
