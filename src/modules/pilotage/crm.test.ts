import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculerCrm,
  demandesParPoint,
  joursComparables,
  MESURES_VIDES,
  mesuresCrmSchema,
  provenance,
  type MesuresCrm,
  type MetaEnFace,
} from "./crm";
import { divise, entier } from "./exact";

/** Les chiffres du CRM du pilotage, sur des comptes fictifs. */

const MESURES: MesuresCrm = {
  demandes: 12,
  demandes_sans_personne: 1,
  demandes_archivees: 2,
  personnes: 10,
  etapes: { a_contacter: 5, en_discussion: 2, visite_planifiee: 1, vivier: 2 },
  atteintes: { a_contacter: 10, a_rappeler: 6, en_discussion: 4, visite_planifiee: 2, vivier: 2 },
  qualification: { a_qualifier: 6, qualifie: 3, gros_potentiel: 1 },
  visites: { planifiees: 1, a_venir: 1, faites: 2, annulees: 1 },
  offres: { personnes: 0, montants: 0, somme_cents: 0 },
  provenance: { fb: 5, facebook: 1, ig: 3, instagram: 1, "": 2 },
  responsables: { "": 8, "c0000000-0000-0000-0000-00000000000c": 2 },
  pub: { pub: 9, campagne: 1, aucun: 2 },
  passages: { "en_discussion>visite_planifiee": 2, "visite_planifiee>offre_en_cours": 0 },
};

/** La dépense (en centimes) et les leads Meta des jours comparables. */
function enFace(depense: number, leads: number, depuis = "2026-11-01", decale = false): MetaEnFace {
  return { etat: "ok", depuis, decale, depense: entier(depense), leads: entier(leads) };
}

describe("les comptes du CRM, lus et validés", () => {
  it("le schéma accepte les comptes de la base et refuse l'inattendu", () => {
    expect(mesuresCrmSchema.parse(MESURES)).toEqual(MESURES);
    expect(() => mesuresCrmSchema.parse({ ...MESURES, demandes: -1 })).toThrow();
    expect(() => mesuresCrmSchema.parse({ ...MESURES, personnes: "10" })).toThrow();
  });
});

describe("les coûts par étape : la dépense Meta des mêmes jours ÷ un nombre du CRM", () => {
  it("par demande, par personne qualifiée, par visite (à faire et faites) ; aucune offre : « — », jamais 0 €", () => {
    const c = calculerCrm(MESURES, enFace(120_000, 9));
    expect(c.couts.parDemande).toEqual({ etat: "ok", valeur: divise(entier(120_000), entier(12)) });
    expect(c.qualifies).toBe(4);
    expect(c.couts.parQualifie).toEqual({ etat: "ok", valeur: divise(entier(120_000), entier(4)) });
    expect(c.visites).toBe(3);
    expect(c.couts.parVisite).toEqual({ etat: "ok", valeur: entier(40_000) });
    expect(c.couts.parOffre).toEqual({ etat: "sans_objet", raison: "aucune offre saisie" });
  });

  it("Meta pas encore lu : les coûts sont « en attente », les comptes du CRM restent", () => {
    const c = calculerCrm(MESURES, { etat: "en_attente" });
    expect(c.couts.parDemande).toEqual({ etat: "en_attente" });
    expect(c.meta.leads).toEqual({ etat: "en_attente" });
    expect(c.mesures.demandes).toBe(12);
  });

  it("aucune demande reçue dans le CRM : ni coût ni comparaison avec Meta, jamais 0 €", () => {
    const c = calculerCrm(MESURES_VIDES, { etat: "sans_demande" });
    const raison = { etat: "sans_objet", raison: "aucune demande reçue dans le CRM" };
    expect(c.couts).toEqual({ parDemande: raison, parQualifie: raison, parVisite: raison, parOffre: raison });
    expect(c.meta.leads).toEqual(raison);
  });

  it("l'écart Meta ↔ CRM : leads de Meta, demandes reliées à une pub, demandes en tout", () => {
    const c = calculerCrm(MESURES, enFace(120_000, 9));
    expect(c.meta).toEqual({ leads: { etat: "ok", valeur: entier(9) }, demandesPub: 9, demandes: 12, decaleAu: null });
  });
});

describe("les mêmes jours : Meta compte à partir de la première demande reçue dans le CRM", () => {
  it("une période qui commence avant le CRM : Meta compte à partir de sa première demande, et l'écran le dit", () => {
    expect(joursComparables("2026-05-27", "2026-11-23", "2026-10-14")).toEqual({ depuis: "2026-10-14", decale: true });
    expect(joursComparables(null, "2026-11-23", "2026-10-14")).toEqual({ depuis: "2026-10-14", decale: true });
    expect(calculerCrm(MESURES, enFace(120_000, 9, "2026-10-14", true)).meta.decaleAu).toBe("2026-10-14");
  });

  it("une période qui commence le jour de la première demande ou après : rien à décaler", () => {
    expect(joursComparables("2026-10-14", "2026-11-23", "2026-10-14")).toEqual({ depuis: "2026-10-14", decale: false });
    expect(joursComparables("2026-11-01", "2026-11-23", "2026-10-14")).toEqual({ depuis: "2026-11-01", decale: false });
  });

  it("le CRM n'avait encore rien reçu à la fin de la période : pas de jours comparables", () => {
    expect(joursComparables("2026-09-01", "2026-09-30", "2026-10-14")).toBeNull();
    expect(joursComparables("2026-11-01", "2026-11-23", null)).toBeNull();
  });
});

describe("les étapes : aujourd'hui, atteintes, et les taux de passage", () => {
  it("la part des personnes arrivées qui ont atteint chaque étape", () => {
    const c = calculerCrm(MESURES, { etat: "en_attente" });
    const dossier = c.etapes.find((e) => e.valeur === "en_discussion")!;
    expect(dossier).toMatchObject({ aujourdHui: 2, atteinte: 4, part: { etat: "ok", valeur: divise(entier(4), entier(10)) } });
    expect(c.etapes.map((e) => e.valeur)).toEqual([
      "a_contacter", "a_rappeler", "r1_planifie", "en_discussion", "visite_planifiee", "offre_en_cours", "pas_interesse", "vivier", "mauvais_numero",
    ]);
  });

  it("d'une étape à l'autre : « dossier envoyé » → « visite planifiée » → « offre en cours »", () => {
    const [versVisite, versOffre] = calculerCrm(MESURES, { etat: "en_attente" }).passages;
    expect(versVisite).toMatchObject({ depart: 4, ensemble: 2, taux: { etat: "ok", valeur: divise(entier(2), entier(4)) } });
    expect(versOffre).toMatchObject({ depart: 2, ensemble: 0, taux: { etat: "ok", valeur: entier(0) } });
    // Personne n'a atteint l'étape de départ : pas de taux, pas de 0 %.
    expect(calculerCrm(MESURES_VIDES, { etat: "en_attente" }).passages[0]!.taux.etat).toBe("sans_objet");
  });

  it("sur les MÊMES personnes : jamais au-delà de 100 %, même quand l'arrivée compte plus de monde que le départ", () => {
    // 1 personne passée par « dossier envoyé » ; 2 par « visite planifiée », dont 1 sans « dossier envoyé ».
    const m: MesuresCrm = {
      ...MESURES,
      atteintes: { a_contacter: 3, en_discussion: 1, visite_planifiee: 2 },
      passages: { "en_discussion>visite_planifiee": 1, "visite_planifiee>offre_en_cours": 0 },
    };
    const [versVisite] = calculerCrm(m, { etat: "en_attente" }).passages;
    expect(versVisite!.taux).toEqual({ etat: "ok", valeur: entier(1) }); // 100 %, et non 200 %
  });

  it("tant que la base ne donne pas les passages (migration du 28/11/2026), le taux est « manquant », jamais deviné", () => {
    const ancienne: MesuresCrm = { ...MESURES };
    delete ancienne.passages;
    const [versVisite] = calculerCrm(ancienne, { etat: "en_attente" }).passages;
    expect(versVisite).toMatchObject({ ensemble: null, taux: { etat: "manquant" } });
    expect(mesuresCrmSchema.parse(ancienne)).toEqual(ancienne);
  });
});

describe("provenance et graphique", () => {
  it("la provenance se regroupe : fb et facebook, ig et instagram ; une source vide est « non renseignée »", () => {
    expect(provenance("fb")).toBe("Facebook");
    expect(provenance("prodigio-site")).toBe("Site Prodigio");
    expect(provenance("newsletter")).toBe("newsletter");
    expect(calculerCrm(MESURES, { etat: "en_attente" }).provenance).toEqual([
      { libelle: "Facebook", n: 6 },
      { libelle: "Instagram", n: 4 },
      { libelle: "Non renseignée", n: 2 },
    ]);
  });

  it("les demandes par point du graphique : un jour, ou une semaine entière", () => {
    const lignes = [
      { property_id: "a", jour: "2026-11-03", demandes: 2 },
      { property_id: "a", jour: "2026-11-05", demandes: 1 },
      { property_id: "b", jour: "2026-11-04", demandes: 4 },
    ];
    expect(demandesParPoint([{ debut: "2026-11-02", fin: "2026-11-08" }], lignes)).toEqual([
      { debut: "2026-11-02", fin: "2026-11-08", valeurs: { a: 3, b: 4 } },
    ]);
  });
});

/** Tous les fichiers TypeScript (hors tests) d'un dossier, commentaires retirés. */
function code(dossier: string): { fichier: string; texte: string }[] {
  const out: { fichier: string; texte: string }[] = [];
  for (const e of readdirSync(dossier)) {
    const chemin = join(dossier, e);
    if (statSync(chemin).isDirectory()) out.push(...code(chemin));
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) {
      out.push({
        fichier: chemin,
        texte: readFileSync(chemin, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"),
      });
    }
  }
  return out;
}

const PERSONNELLES = /\b(contact_first_name|contact_last_name|contact_email\w*|contact_phone\w*|first_name|last_name|raw_answers|normalized_answers|residence_\w+|user_agent|last_note)\b/;

describe("aucune donnée personnelle d'acquéreur dans le pilotage", () => {
  it("les fonctions de lecture du CRM ne touchent à aucune colonne personnelle", () => {
    for (const fichier of ["20261123170000_pilotage_crm_agregats.sql", "20261128110000_pilotage_crm_passages.sql"]) {
      const sql = readFileSync(join(process.cwd(), "supabase", "migrations", fichier), "utf8")
        .split("\n")
        .map((l) => l.replace(/--.*$/, ""))
        .join("\n");
      expect(sql, fichier).not.toMatch(PERSONNELLES);
      expect(sql, fichier).not.toMatch(/\b(email|phone|telephone)\b/i);
    }
  });

  it("la cohorte remplacée le 28/11/2026 garde son contrôle du rôle, ses droits, et n'écrit rien", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "20261128110000_pilotage_crm_passages.sql"), "utf8");
    const declarees = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
    expect(declarees).toEqual(["crm_pilotage_crm_cohorte"]);
    expect(sql).toMatch(/security invoker/);
    expect(sql).toContain("if not public.crm_has_role('administrateur') then");
    expect(sql).toContain("revoke all on function public.crm_pilotage_crm_cohorte(date, date) from public, anon;");
    expect(sql).not.toMatch(/grant execute[^;]*\banon\b/);
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/\b(insert|update|delete|truncate|alter|drop)\b/i);
  });

  it("chaque fonction de lecture vérifie le rôle administrateur, et n'est jamais ouverte à anon", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "20261123170000_pilotage_crm_agregats.sql"), "utf8");
    const fonctions: [string, string][] = [
      ["crm_pilotage_crm_demandes_resolues", "date, date"],
      ["crm_pilotage_crm_par_jour", "date, date"],
      ["crm_pilotage_crm_cohorte", "date, date"],
      ["crm_pilotage_crm_par_pub", "date, date"],
      ["crm_pilotage_crm_debuts", ""],
    ];
    for (const [f, signature] of fonctions) {
      const debut = sql.indexOf(`create or replace function public.${f}(`);
      expect(debut, f).toBeGreaterThan(-1);
      const corps = sql.slice(debut, sql.indexOf("$$;", sql.indexOf("as $$", debut) + 5));
      expect(corps).toMatch(/security invoker/);
      expect(corps).toContain("if not public.crm_has_role('administrateur') then");
      expect(sql).toContain(`revoke all on function public.${f}(${signature}) from public, anon;`);
      expect(sql).not.toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to [^;]*\\banon\\b`));
    }
    // Aucune autre fonction ne s'est glissée dans la migration sans passer par ces contrôles.
    const declarees = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
    expect(declarees.sort()).toEqual(fonctions.map(([f]) => f).sort());
  });

  it("la requête de contrôle de la recette ne fait que lire et compter, sans colonne personnelle", () => {
    const sql = readFileSync(join(process.cwd(), "scripts", "pilotage-crm-controles.sql"), "utf8")
      .split("\n")
      .map((l) => l.replace(/--.*$/, ""))
      .join("\n");
    expect(sql).not.toMatch(PERSONNELLES);
    expect(sql).not.toMatch(/\b(email|phone|telephone)\b/i);
    expect(sql).not.toMatch(/\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|copy|call|do)\b/i);
    expect(sql.trim()).toMatch(/^with\b/i);
    expect(sql.match(/;/g)).toHaveLength(1); // une seule requête
  });

  it("le code du pilotage ne lit aucune colonne personnelle d'acquéreur", () => {
    const fichiers = [
      ...code(join(process.cwd(), "src", "modules", "pilotage")),
      ...code(join(process.cwd(), "src", "components", "crm", "pilotage")),
    ];
    expect(fichiers.length).toBeGreaterThan(20);
    for (const { fichier, texte } of fichiers) expect(texte, fichier).not.toMatch(PERSONNELLES);
  });
});
