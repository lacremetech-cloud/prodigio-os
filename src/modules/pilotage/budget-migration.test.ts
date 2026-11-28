import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GARDE-FOUS DU BUDGET DU FORMULAIRE, RELUS DANS LE SQL VERSIONNÉ
 * (`20261128150000_budget_du_formulaire_par_bien`).
 *
 * Le réglage est réservé aux administrateurs, en base comme à l'écran ; le
 * visiteur ne lit que les tranches en vigueur, jamais la cible ; les chiffres
 * de Pilotage pub ne sont que des comptes ; le journal d'audit, lisible des
 * managers, ne reçoit aucun montant. La recette `scripts/budget-par-bien.sql`
 * vérifie la base elle-même.
 */

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261128150000_budget_du_formulaire_par_bien.sql"),
  "utf8",
);

const sansCommentaires = (sql: string) =>
  sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");

const CODE = sansCommentaires(SQL).replace(/\s+/g, " ").toLowerCase();

/** Le corps d'une fonction, de son en-tête à la fin de son `$$`. */
function corps(fonction: string): string {
  const debut = CODE.indexOf(`create or replace function public.${fonction}(`);
  expect(debut, `${fonction} introuvable`).toBeGreaterThan(-1);
  const ouverture = CODE.indexOf("as $$", debut);
  const fin = CODE.indexOf("$$;", ouverture + 5);
  return CODE.slice(debut, fin + 3);
}

describe("la table des réglages : lecture administrateur seule, rien ne se réécrit", () => {
  const table = "pilotage_budget_formulaire";

  it("RLS active, droits par défaut retirés, lecture filtrée sur l'administrateur", () => {
    expect(CODE).toContain(`alter table public.${table} enable row level security`);
    expect(CODE).toContain(`revoke all on table public.${table} from anon, authenticated`);
    expect(CODE).toContain(`grant select on table public.${table} to authenticated`);
    expect(CODE).toMatch(
      new RegExp(`create policy \\w+ on public\\.${table} for select to authenticated using \\(public\\.crm_has_role\\('administrateur'\\)\\)`),
    );
  });

  it("aucun droit d'écriture accordé, aucune politique d'écriture", () => {
    expect(CODE).not.toMatch(new RegExp(`grant (insert|update|delete|all)[^;]* on (table )?public\\.${table}\\b`));
    expect(CODE).not.toMatch(new RegExp(`create policy \\w+ on public\\.${table} for (insert|update|delete|all)`));
  });

  it("ni réécriture ni effacement (déclencheur), et la règle tenue par une contrainte", () => {
    expect(CODE).toContain(
      `before update or delete on public.${table} for each row execute function public.pilotage_ligne_immuable()`,
    );
    expect(CODE).toContain("check ( public.pilotage_budget_erreur(tranches, cible_min_cents) is null )");
  });

  it("aucune valeur insérée par la migration : les réglages se saisissent dans l'application", () => {
    const horsFonctions = sansCommentaires(SQL).replace(/as \$(\w*)\$[\s\S]*?\$\1\$/gi, "");
    expect(horsFonctions).not.toMatch(/insert\s+into\s+public\.pilotage_/i);
  });
});

describe("les fonctions", () => {
  it("la saisie : SECURITY DEFINER, search_path figé, administrateur revérifié, jamais anon", () => {
    const c = corps("crm_pilotage_enregistrer_budget");
    expect(c).toContain("security definer");
    expect(c).toContain("set search_path = public, pg_temp");
    expect(c).toContain("perform public.crm_require_role('administrateur')");
    expect(c).toContain("public.pilotage_budget_erreur(p_tranches, p_cible_min_cents)");
    expect(CODE).toMatch(/revoke all on function public\.crm_pilotage_enregistrer_budget\([^)]*\) from public, anon/);
    expect(CODE).toMatch(/grant execute on function public\.crm_pilotage_enregistrer_budget\([^)]*\) to authenticated;/);
  });

  it("la saisie : le journal ne reçoit que le bien et la date d'effet, jamais un montant ni le motif", () => {
    const c = corps("crm_pilotage_enregistrer_budget");
    const ecritures = [...c.matchAll(/insert into public\.audit_events[\s\S]*?\);/g)].map((m) => m[0]);
    expect(ecritures).toHaveLength(1);
    const e = ecritures[0]!;
    expect(e).toContain("jsonb_build_object('property_id', p_property_id, 'date_effet', p_date_effet)");
    expect(e).not.toMatch(/cents|cible|tranche|motif|old_value|metadata/);
  });

  it("le formulaire public : les seules tranches en vigueur, jamais la cible ; ouvert au visiteur", () => {
    const c = corps("buyer_form_budget");
    expect(c).toContain("security definer");
    expect(c).toContain("select v.tranches");
    expect(c).not.toContain("cible");
    expect(c).toContain("b.date_effet <= (now() at time zone 'europe/paris')::date");
    // Les mêmes conditions que le contexte du formulaire.
    expect(c).toContain("coalesce(c.buyer_form_status, 'inactif') = 'actif' or c.publication_status = 'publie'");
    expect(CODE).toContain("grant execute on function public.buyer_form_budget(text) to anon, authenticated");
  });

  it("les chiffres de Pilotage pub : des comptes, avec les droits de l'appelant, administrateur seul", () => {
    const c = corps("crm_pilotage_crm_budget");
    expect(c).toContain("security invoker");
    expect(c).toContain("if not public.crm_has_role('administrateur') then");
    expect(c).not.toMatch(/first_name|last_name|email|phone|telephone|origin_url/);
    expect(CODE).toMatch(/revoke all on function public\.crm_pilotage_crm_budget\(date, date\) from public, anon/);
    expect(CODE).not.toMatch(/grant execute on function public\.crm_pilotage_crm_budget\([^)]*\) to [^;]*\banon\b/);
  });

  it("la règle n'est exécutable par aucun client", () => {
    expect(CODE).toContain("revoke all on function public.pilotage_budget_erreur(text[], bigint) from public, anon, authenticated");
    expect(CODE).not.toMatch(/grant execute on function public\.pilotage_budget_erreur/);
  });
});

describe("la requête de contrôle", () => {
  const CONTROLE = sansCommentaires(
    readFileSync(join(process.cwd(), "scripts", "budget-par-bien-controles.sql"), "utf8"),
  ).toLowerCase();

  it("ne fait que lire : aucune écriture, aucune fonction de la page", () => {
    expect(CONTROLE).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create|grant|revoke)\b/);
    expect(CONTROLE).not.toContain("crm_pilotage_crm_budget");
  });

  it("ne sort aucune donnée personnelle", () => {
    expect(CONTROLE).not.toMatch(/first_name|last_name|email|phone|telephone/);
  });

  it("résout la pub d'une demande exactement comme la requête de contrôle du CRM", () => {
    const CRM = sansCommentaires(readFileSync(join(process.cwd(), "scripts", "pilotage-crm-controles.sql"), "utf8")).toLowerCase();
    const bloc = (sql: string) => sql.slice(sql.indexOf("pubs_connues as ("), sql.indexOf("from actives a\n),") + "from actives a".length);
    expect(bloc(CONTROLE).length).toBeGreaterThan(500);
    expect(bloc(CONTROLE)).toBe(bloc(CRM));
  });
});
