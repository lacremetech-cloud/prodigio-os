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
    // Trois traces pour la visite : déjà partie, sans correspondance, envoi.
    expect(conversions.match(/tracer\(supabase, "Schedule"/g)?.length).toBe(3);
    expect(conversions.match(/tracer\(supabase, "CompleteRegistration"/g)?.length).toBe(3);
  });

  it("le journal ne peut JAMAIS faire échouer ce qu'il observe", () => {
    // Une visite planifiée reste planifiée, même si sa trace ne s'écrit pas.
    expect(conversions).toContain("} catch {");
    expect(sql).toContain("exception when others then");
  });

  it("la conversion « Lead » est tracée, bien qu'émise SANS session — et c'est tout ce qu'un appel sans session peut écrire", () => {
    /* Elle part d'un dépôt de formulaire public : la trace doit s'écrire
       sans session. Mais le journal était ouvert à `anon` sans limite ; depuis
       le 28/11/2026 (étape 4, « réparer »), un appel sans session n'écrit que
       le `Lead` d'une demande réelle de moins de quinze minutes, pas encore
       tracée. */
    const reparee = readFileSync(join(DOSSIER, "20261128190000_conversions_meta_reparees.sql"), "utf8");
    expect(reparee).toContain("if auth.uid() is null then");
    expect(reparee).toContain("if p_event_name is distinct from 'Lead'");
    expect(reparee).toContain("i.created_at > now() - interval '15 minutes'");
    expect(reparee).toContain("grant execute on function public.crm_meta_conversion_log(text, text, uuid, text, text) to anon, authenticated");
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
    const motifs = ["envoyee", "non_configure", "sans_correspondance", "refus", "erreur", "hors_production", "deja_envoyee"];
    for (const m of motifs) expect(sql, m).toContain(`'${m}'`);
    /* `capi.ts` est la source : si un motif y apparaît un jour sans être
       ajouté à la contrainte, la base refuserait la ligne — et la trace
       redeviendrait muette, sans bruit. */
    const capi = readFileSync("src/modules/analytics/meta/capi.ts", "utf8");
    const declares = [...capi.matchAll(/reason:\s*"([a-z_]+)"/g)].map((m) => m[1]!);
    for (const d of new Set(declares)) expect(motifs, `motif « ${d} » inconnu de la base`).toContain(d);
  });

  it("« déjà partie ? » : un client connecté seulement, un booléen seulement", () => {
    const reparee = readFileSync(join(DOSSIER, "20261128190000_conversions_meta_reparees.sql"), "utf8");
    expect(reparee).toContain("revoke all on function public.crm_meta_conversion_deja_envoyee(text) from public, anon");
    expect(reparee).toContain("grant execute on function public.crm_meta_conversion_deja_envoyee(text) to authenticated");
    expect(reparee).toMatch(/crm_meta_conversion_deja_envoyee\(p_event_id text\)\s+returns boolean/);
  });

  it("la requête de contrôle ne fait que lire, et ne sort que des nombres", () => {
    const controle = readFileSync("scripts/conversions-meta-controles.sql", "utf8")
      .split("\n")
      .map((l) => l.replace(/--.*$/, ""))
      .join("\n")
      .toLowerCase();
    expect(controle).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create|grant|revoke)\b/);
    expect(controle).not.toMatch(/contact_|email|phone|first_name|last_name|fbclid/);
  });
});
