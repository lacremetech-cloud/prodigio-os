import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * UNE PANNE DE CONVERSION DOIT SE VOIR.
 *
 * La conversion « rendez-vous programmé » est restée cassée du 14 au 19
 * octobre 2026 sans que personne le remarque : cinq jours pendant lesquels
 * l'optimisation des campagnes travaillait sans ses meilleurs signaux. Rien
 * ne pouvait le dire — les envois partaient sans laisser de trace.
 *
 * Le résultat était pourtant déjà connu et typé (`{sent:true}` ou
 * `{sent:false, reason}`). Il était simplement JETÉ par `enArrierePlan`.
 */

const DOSSIER = "supabase/migrations";
const sql = readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(DOSSIER, f), "utf8"))
  .join("\n");

const conversions = readFileSync("src/modules/analytics/meta/conversions.ts", "utf8");

describe("le journal des conversions", () => {
  it("les TROIS conversions enregistrent leur résultat", () => {
    for (const evenement of ['"Lead"', '"CompleteRegistration"', '"Schedule"']) {
      const appels = conversions.split(`tracer(`).length - 1;
      expect(appels, "au moins un appel par conversion").toBeGreaterThanOrEqual(3);
      expect(conversions).toContain(evenement);
    }
  });

  it("l'échec « sans correspondance » est tracé lui aussi", () => {
    // C'est le motif le plus sournois : l'envoi ne part même pas, et sans
    // trace il ne laisse rien derrière lui.
    expect(conversions).toContain('reason: "sans_correspondance"');
    expect(conversions.match(/tracer\(supabase, "Schedule"/g)?.length).toBe(2);
  });

  it("le journal ne peut JAMAIS faire échouer ce qu'il observe", () => {
    // Une visite planifiée reste planifiée, même si sa trace ne s'écrit pas.
    expect(conversions).toContain("} catch {");
    expect(sql).toContain("exception when others then");
  });

  it("la conversion « Lead » est tracée, bien qu'émise SANS session", () => {
    /* Elle part d'un dépôt de formulaire public. Un garde `auth.uid() is
       null` aurait rendu la trace muette sur la conversion la plus
       fréquente — exactement l'inverse du but. */
    expect(sql).toContain("PAS de garde sur `auth.uid()`");
    expect(readFileSync("src/modules/buyers/funnel/universal-submit.ts", "utf8")).toContain(
      "supabase: lecteur,",
    );
  });

  it("la table est protégée : lecture par l'encadrement, aucune écriture directe", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("for select using (public.crm_is_operator())");
    // Aucune politique d'insertion : on n'ecrit que par la fonction.
    expect(sql).not.toMatch(/on public\.meta_conversion_log\s+for insert/i);
  });

  it("les motifs enregistrés sont exactement ceux que le code peut produire", () => {
    const motifs = ["envoyee", "non_configure", "sans_correspondance", "refus", "erreur"];
    for (const m of motifs) expect(sql, m).toContain(`'${m}'`);
    /* `capi.ts` est la source : si un motif y apparaît un jour sans être
       ajouté à la contrainte, la base refuserait la ligne — et la trace
       redeviendrait muette, sans bruit. */
    const capi = readFileSync("src/modules/analytics/meta/capi.ts", "utf8");
    const declares = [...capi.matchAll(/reason:\s*"([a-z_]+)"/g)].map((m) => m[1]!);
    for (const d of new Set(declares)) expect(motifs, `motif « ${d} » inconnu de la base`).toContain(d);
  });
});
