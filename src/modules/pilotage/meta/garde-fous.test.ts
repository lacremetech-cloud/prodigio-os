import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GARDE-FOUS DE LA LECTURE META (pilotage pub, étape 2), relus dans le SQL et
 * dans le code versionnés.
 *
 * Ce qu'ils refusent, sans qu'on ait à y penser :
 *  - une table Meta lisible par un autre rôle qu'administrateur ;
 *  - une fonction d'écriture des chiffres Meta exécutable par un navigateur ;
 *  - un déclencheur sur les demandes acquéreur qui pourrait faire échouer un
 *    dépôt (la leçon des 65 leads perdus le 14 octobre) ;
 *  - un remplissage qui écraserait un identifiant, ou dater les demandes
 *    d'aujourd'hui ;
 *  - une écriture chez Meta, ou le jeton qui ÉCRIT (CAPI) utilisé pour lire.
 */

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261112170000_pilotage_lecture_meta.sql"),
  "utf8",
);

function sansCommentairesSql(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

const CODE = sansCommentairesSql(MIGRATION).replace(/\s+/g, " ").toLowerCase();

const TABLES = [
  "pilotage_meta_synchros",
  "pilotage_meta_controles",
  "pilotage_meta_insights",
  "pilotage_meta_pubs",
  "pilotage_meta_couverture",
  "pilotage_meta_regles",
] as const;

const ECRITURES_DU_ROLE_DE_SERVICE = [
  "crm_pilotage_meta_synchro_demarrer",
  "crm_pilotage_meta_remplacer_tranche",
  "crm_pilotage_meta_enregistrer_pubs",
  "crm_pilotage_meta_remplacer_couverture",
  "crm_pilotage_meta_synchro_terminer",
] as const;

function corps(fonction: string): string {
  const code = sansCommentairesSql(MIGRATION);
  const debut = code.indexOf(`create or replace function public.${fonction}(`);
  expect(debut, `${fonction} introuvable`).toBeGreaterThan(-1);
  const ouverture = code.indexOf("as $$", debut);
  return code.slice(debut, code.indexOf("$$;", ouverture + 5) + 3);
}

describe("tables Meta : lecture administrateur seule", () => {
  for (const table of TABLES) {
    it(`${table} : RLS, droits par défaut retirés, lecture filtrée, aucune écriture accordée`, () => {
      expect(CODE).toContain(`alter table public.${table} enable row level security`);
      expect(CODE).toContain(`revoke all on table public.${table} from anon, authenticated`);
      expect(CODE).toContain(`grant select on table public.${table} to authenticated`);
      expect(CODE).toMatch(
        new RegExp(`create policy \\w+ on public\\.${table} for select to authenticated using \\(public\\.crm_has_role\\('administrateur'\\)\\)`),
      );
      expect(CODE).not.toMatch(new RegExp(`grant (insert|update|delete|all)[^;]* on (table )?public\\.${table}\\b`));
    });
  }
});

describe("les chiffres Meta ne s'écrivent que par le rôle de service", () => {
  for (const f of ECRITURES_DU_ROLE_DE_SERVICE) {
    it(`${f} : SECURITY DEFINER, retirée à public/anon/authenticated, accordée au seul rôle de service`, () => {
      expect(corps(f)).toMatch(/security definer/);
      expect(corps(f)).toMatch(/set search_path = public, pg_temp/);
      expect(CODE).toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated`));
      expect(CODE).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role`));
      expect(CODE).not.toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to [^;]*\\b(anon|authenticated)\\b`));
    });
  }

  it("une période remplacée est d'abord effacée, puis réécrite, dans la même fonction", () => {
    const c = corps("crm_pilotage_meta_remplacer_tranche").toLowerCase();
    const efface = c.indexOf("delete from public.pilotage_meta_insights where jour between p_debut and p_fin");
    const ecrit = c.indexOf("insert into public.pilotage_meta_insights");
    expect(efface).toBeGreaterThan(-1);
    expect(ecrit).toBeGreaterThan(efface);
    // Le contrôle se calcule EN BASE, à partir de ce qui vient d'être écrit.
    expect(c).toMatch(/select sum\(i\.depense_cents\) from public\.pilotage_meta_insights i/);
  });

  it("les règles sont réservées à l'administrateur et auditées sans contenu", () => {
    for (const f of ["crm_pilotage_meta_ajouter_regle", "crm_pilotage_meta_retirer_regle"]) {
      const c = corps(f).toLowerCase();
      expect(c).toContain("perform public.crm_require_role('administrateur')");
      expect(c).toMatch(/jsonb_build_object\('type_regle', [a-z_.]+\)\)/);
    }
  });

  it("les totaux se lisent sous la RLS de l'appelant (SECURITY INVOKER)", () => {
    expect(corps("crm_pilotage_meta_totaux").toLowerCase()).toMatch(/security invoker/);
  });
});

describe("l'identifiant de pub des demandes : sans risque pour le dépôt", () => {
  it("le déclencheur avale toute erreur : un identifiant manquant ne fait jamais perdre une demande", () => {
    const c = corps("pilotage_buyer_interest_meta_ad_id").toLowerCase();
    expect(c).toMatch(/exception when others then\s+new\.meta_ad_id := null;/);
    expect(c).toContain("return new;");
    expect(c).not.toMatch(/raise exception/);
    // Il ne remplace jamais un identifiant déjà posé.
    expect(c).toContain("if new.meta_ad_id is null then");
  });

  it("le remplissage ne touche que les lignes vides, et ne date pas les demandes d'aujourd'hui", () => {
    const desactive = CODE.indexOf("alter table public.buyer_interests disable trigger buyer_interests_set_updated_at");
    const remplit = CODE.indexOf("update public.buyer_interests set meta_ad_id");
    const reactive = CODE.indexOf("alter table public.buyer_interests enable trigger buyer_interests_set_updated_at");
    expect(desactive).toBeGreaterThan(-1);
    expect(remplit).toBeGreaterThan(desactive);
    expect(reactive).toBeGreaterThan(remplit);
    expect(CODE.slice(remplit, reactive)).toContain("where meta_ad_id is null");
  });

  it("la migration n'attend pas un verrou plus de deux secondes : un dépôt ne patiente jamais derrière elle", () => {
    const borne = CODE.indexOf("set local lock_timeout = '2s'");
    expect(borne).toBeGreaterThan(-1);
    expect(borne).toBeGreaterThan(CODE.indexOf("begin;"));
    expect(borne).toBeLessThan(CODE.indexOf("alter table public.audit_events"));
    expect(borne).toBeLessThan(CODE.indexOf("alter table public.buyer_interests"));
  });

  it("le remplissage s'arrête net si un autre déclencheur de mise à jour existe (un webhook posé à la main)", () => {
    const garde = CODE.indexOf("(t.tgtype & 16) <> 0");
    expect(garde).toBeGreaterThan(-1);
    expect(garde).toBeLessThan(CODE.indexOf("alter table public.buyer_interests add column"));
    expect(CODE.slice(garde, CODE.indexOf("alter table public.buyer_interests add column"))).toMatch(
      /t\.tgname not in \('buyer_interests_set_updated_at'\);\s*if v_inattendus is not null then\s*raise exception/,
    );
  });

  it("utm_id d'abord (formulaire, puis première visite), puis un utm_content NUMÉRIQUE seulement", () => {
    const c = corps("pilotage_extraire_meta_ad_id");
    expect(c.indexOf("p_origin_url from")).toBeLessThan(c.indexOf("p_first_touch_url from"));
    expect(c).toContain("~ '^[0-9]{5,30}$'");
  });
});

/** Tous les fichiers TypeScript (hors tests) d'un dossier, commentaires retirés. */
function codeTypeScript(dossier: string): { fichier: string; code: string }[] {
  const out: { fichier: string; code: string }[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) out.push(...codeTypeScript(chemin));
    else if (/\.tsx?$/.test(entree) && !/\.test\.tsx?$/.test(entree)) {
      const code = readFileSync(chemin, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      out.push({ fichier: chemin, code });
    }
  }
  return out;
}

describe("dans le code : lire Meta, jamais y écrire", () => {
  const meta = codeTypeScript(join(process.cwd(), "src", "modules", "pilotage", "meta"));

  it("on lit bien le module (sinon le test ne garderait rien)", () => {
    expect(meta.length).toBeGreaterThan(5);
  });

  it("le jeton qui ÉCRIT dans le pixel (CAPI) n'est jamais utilisé pour lire", () => {
    for (const { fichier, code } of meta) {
      expect(code, fichier).not.toContain("META_CAPI_ACCESS_TOKEN");
      expect(code, fichier).not.toContain("META_CAPI_PIXEL_ID");
    }
  });

  it("aucune requête autre que GET vers Meta", () => {
    for (const { fichier, code } of meta) {
      for (const m of code.matchAll(/method:\s*["'`](\w+)["'`]/g)) expect(m[1], fichier).toBe("GET");
      expect(code, fichier).not.toMatch(/["'`](POST|PUT|PATCH|DELETE)["'`]/);
    }
  });

  it("le module de lecture n'importe rien de la remontée de conversions", () => {
    for (const { fichier, code } of meta) {
      expect(code, fichier).not.toMatch(/analytics\/meta/);
    }
  });
});
