import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASES_HONORAIRES,
  baseHonorairesLabels,
  NATURES_PRIX,
  naturePrixLabels,
  STATUTS_COMMERCIAUX,
  statutCommercialLabels,
  TYPES_COUT,
  typeCoutLabels,
} from "./labels";

/**
 * GARDE-FOUS DU PILOTAGE, RELUS DANS LE SQL VERSIONNÉ.
 *
 * Le pilotage porte des commissions, des parts et des coûts : il est réservé
 * aux administrateurs, en base comme à l'écran. Ces tests refusent toute
 * régression qui l'ouvrirait sans qu'on le voie :
 *  - une table sans RLS, ou lisible par un autre rôle ;
 *  - une fonction d'écriture sans garde de rôle, ou exécutable par `anon` ;
 *  - un montant écrit au journal d'audit, que les managers lisent ;
 *  - une valeur du portefeuille posée par une migration : le dépôt est
 *    public, et les aperçus Vercel écrivent dans la base de production.
 */

const DOSSIER = join(process.cwd(), "supabase", "migrations");
const FICHIER = "20261112150000_pilotage_conditions_lots_et_couts_fixes.sql";
const SQL = readFileSync(join(DOSSIER, FICHIER), "utf8");

function sansCommentaires(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

const CODE = sansCommentaires(SQL).replace(/\s+/g, " ").toLowerCase();

const TABLES = [
  "pilotage_conditions",
  "pilotage_lots",
  "pilotage_lot_versions",
  "pilotage_couts_fixes",
] as const;

const FONCTIONS = [
  "crm_pilotage_enregistrer_conditions",
  "crm_pilotage_enregistrer_lot",
  "crm_pilotage_saisir_cout_fixe",
  "crm_pilotage_annuler_cout_fixe",
] as const;

/**
 * Les clés d'un `jsonb_build_object(clé, valeur, …)` : les arguments de rang
 * pair, lus à parenthèses équilibrées.
 */
function clesJson(ecriture: string): string[] {
  const debut = ecriture.indexOf("jsonb_build_object(");
  if (debut < 0) return [];
  let profondeur = 0;
  let courant = "";
  const args: string[] = [];
  for (const c of ecriture.slice(debut + "jsonb_build_object(".length)) {
    if (c === "(") profondeur += 1;
    if (c === ")") {
      if (profondeur === 0) break;
      profondeur -= 1;
    }
    if (c === "," && profondeur === 0) {
      args.push(courant.trim());
      courant = "";
    } else courant += c;
  }
  args.push(courant.trim());
  return args.filter((_, i) => i % 2 === 0).map((a) => a.replace(/^'|'$/g, ""));
}

/** Le corps d'une fonction, entre son en-tête et la fin de son `$$`. */
function corps(fonction: string): string {
  const code = sansCommentaires(SQL);
  const debut = code.indexOf(`create or replace function public.${fonction}(`);
  expect(debut, `${fonction} introuvable`).toBeGreaterThan(-1);
  const ouverture = code.indexOf("as $$", debut);
  const fin = code.indexOf("$$;", ouverture + 5);
  return code.slice(debut, fin + 3);
}

describe("tables du pilotage : lecture administrateur seule", () => {
  for (const table of TABLES) {
    it(`${table} : RLS active, droits par défaut retirés, lecture filtrée`, () => {
      expect(CODE).toContain(`alter table public.${table} enable row level security`);
      expect(CODE).toContain(`revoke all on table public.${table} from anon, authenticated`);
      expect(CODE).toContain(`grant select on table public.${table} to authenticated`);
      const politique = new RegExp(
        `create policy \\w+ on public\\.${table} for select to authenticated using \\(public\\.crm_has_role\\('administrateur'\\)\\)`,
      );
      expect(CODE).toMatch(politique);
    });

    it(`${table} : aucun droit d'écriture accordé, aucune politique d'écriture`, () => {
      expect(CODE).not.toMatch(new RegExp(`grant (insert|update|delete|all)[^;]* on (table )?public\\.${table}\\b`));
      expect(CODE).not.toMatch(new RegExp(`create policy \\w+ on public\\.${table} for (insert|update|delete|all)`));
    });

    it(`${table} : ne se réécrit pas, ne s'efface pas (déclencheur)`, () => {
      expect(CODE).toMatch(new RegExp(`before update or delete on public\\.${table} for each row execute function public\\.pilotage_`));
    });
  }
});

describe("fonctions d'écriture : administrateur seul, auditées", () => {
  for (const fonction of FONCTIONS) {
    it(`${fonction} : SECURITY DEFINER, search_path figé, rôle revérifié`, () => {
      const c = corps(fonction).toLowerCase();
      expect(c).toMatch(/security definer/);
      expect(c).toMatch(/set search_path = public, pg_temp/);
      expect(c).toContain("perform public.crm_require_role('administrateur')");
      expect(c).toContain("insert into public.audit_events");
    });

    it(`${fonction} : ni public ni anon ; authenticated seulement`, () => {
      expect(CODE).toMatch(new RegExp(`revoke all on function public\\.${fonction}\\([^)]*\\) from public, anon`));
      expect(CODE).toMatch(new RegExp(`grant execute on function public\\.${fonction}\\([^)]*\\) to authenticated`));
      expect(CODE).not.toMatch(new RegExp(`grant execute on function public\\.${fonction}\\([^)]*\\) to [^;]*\\banon\\b`));
    });

    it(`${fonction} : le journal ne reçoit que des identifiants, jamais un montant`, () => {
      const c = corps(fonction);
      const ecritures = [...c.matchAll(/insert into public\.audit_events[\s\S]*?\);/gi)].map((m) => m[0]);
      expect(ecritures.length).toBeGreaterThan(0);
      for (const e of ecritures) {
        expect(e, "pas d'ancienne valeur ni de métadonnées").not.toMatch(/old_value|metadata/);
        const cles = clesJson(e);
        expect(cles.length).toBeGreaterThan(0);
        for (const cle of cles) expect(["property_id", "date_effet", "numero", "version_id"]).toContain(cle);
        expect(e).not.toMatch(/cents|pct|motif|note|prix|montant|taux|part_/);
      }
    });
  }

  it("le lecteur de clés attrape vraiment un montant glissé au journal", () => {
    // Sans ce contrôle, un extracteur qui ne trouve rien ferait passer le
    // test précédent pour toujours.
    const fautif = "values (v_uid, 'pilotage_cout_fixe', v_id, 'pilotage_cout_saisi', jsonb_build_object('property_id', p_property_id, 'montant', round(p_montant_ht_cents, 0)));";
    expect(clesJson(fautif)).toEqual(["property_id", "montant"]);
  });

  it("les déclencheurs internes ne sont exécutables par aucun client", () => {
    expect(CODE).toContain("revoke all on function public.pilotage_ligne_immuable() from public, anon, authenticated");
    expect(CODE).toContain("revoke all on function public.pilotage_cout_fixe_garde() from public, anon, authenticated");
  });
});

describe("aucune valeur du portefeuille dans une migration", () => {
  it("aucune migration n'insère de ligne du pilotage hors d'une fonction", () => {
    const fautes: string[] = [];
    for (const f of readdirSync(DOSSIER).filter((x) => x.endsWith(".sql")).sort()) {
      // On retire les corps de fonction : c'est là, et là seulement, qu'une
      // insertion a le droit d'exister — appelée par un administrateur.
      const horsFonctions = sansCommentaires(readFileSync(join(DOSSIER, f), "utf8")).replace(
        /as \$(\w*)\$[\s\S]*?\$\1\$/gi,
        "",
      );
      if (/insert\s+into\s+public\.pilotage_/i.test(horsFonctions)) fautes.push(f);
      if (/copy\s+public\.pilotage_/i.test(horsFonctions)) fautes.push(f);
    }
    expect(
      fautes,
      "Les valeurs du pilotage se saisissent par les formulaires : le dépôt est public, " +
        "et les aperçus écrivent dans la base de production.",
    ).toEqual([]);
  });
});

describe("chaque jeton de la base a son libellé", () => {
  /** Les valeurs d'un `check (colonne in (...))` de la migration. */
  function jetons(colonne: string): string[] {
    const m = new RegExp(`check \\(${colonne}(?: is null or ${colonne})? in \\(([^)]*)\\)`).exec(CODE);
    expect(m, `contrainte de ${colonne} introuvable`).not.toBeNull();
    return [...m![1]!.matchAll(/'([a-z_]+)'/gi)].map((x) => x[1]!);
  }

  it("statuts commerciaux", () => {
    expect(jetons("statut_commercial").map((x) => x.toLowerCase())).toEqual([...STATUTS_COMMERCIAUX]);
    for (const s of STATUTS_COMMERCIAUX) expect(statutCommercialLabels[s]).toBeTruthy();
  });

  it("types de coût", () => {
    expect(jetons("type_cout")).toEqual([...TYPES_COUT]);
    for (const t of TYPES_COUT) expect(typeCoutLabels[t]).toBeTruthy();
  });

  it("bases des honoraires", () => {
    expect(jetons("base_honoraires")).toEqual(BASES_HONORAIRES.map((b) => b.toLowerCase()));
    for (const b of BASES_HONORAIRES) expect(baseHonorairesLabels[b]).toBeTruthy();
  });

  it("natures du prix", () => {
    expect(jetons("nature_prix")).toEqual([...NATURES_PRIX]);
    for (const n of NATURES_PRIX) expect(naturePrixLabels[n]).toBeTruthy();
  });
});
