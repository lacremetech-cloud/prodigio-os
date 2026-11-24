import "server-only";

/**
 * La lecture de la page Pilotage : tout ce que `calculerTableau` attend, lu au
 * jeton de l'utilisateur — la RLS ne rend ces tables qu'à un administrateur,
 * que la page a vérifié avant. Tout se lit page après page, trié sur une clé
 * unique : aucun total sur une liste tronquée.
 *
 * Volumes : quelques milliers de lignes au plus (une ligne par pub et par
 * jour). Les totaux par pub sont agrégés EN BASE (`crm_pilotage_meta_totaux`) ;
 * chaque requête reste loin des 8 secondes que la production accorde à l'API.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PilotageMetaControleRow,
  PilotageMetaCouvertureRow,
  PilotageMetaPubRow,
  PilotageMetaSynchroRow,
  PilotageMetaTotalPubRow,
} from "@/lib/supabase/types";
import { estNonInstalle, LectureImpossible } from "./erreurs";
import { toutLire } from "./lecture-complete";
import { ajouterJours, bornes } from "./meta/periodes";
import type { RegleRattachement } from "./meta/rattachement";
import { lirePilotage, nomDuBien } from "./queries";
import { calculerTableau, type ChoixPeriode, type LigneDuJour, type TableauPilotage } from "./tableau";
import { jourParis } from "./versions";

export type LectureTableau = { etat: "ok"; tableau: TableauPilotage } | { etat: "non_installe" } | { etat: "erreur" };

export async function lireTableauPilotage(choix: ChoixPeriode, maintenant: Date): Promise<LectureTableau> {
  const supabase = await createSupabaseServerClient();
  const jour = jourParis(maintenant);
  const b = choix.type === "dates" ? { debut: choix.debut, fin: choix.fin } : bornes(choix.periode, jour);

  try {
    const pilotage = await lirePilotage();
    if (pilotage.etat !== "ok") return { etat: pilotage.etat };

    const totaux = (debut: string | null, fin: string | null, etape: string) =>
      toutLire<PilotageMetaTotalPubRow>(
        (a, z) => supabase.rpc("crm_pilotage_meta_totaux", { p_debut: debut, p_fin: fin }).order("ad_id").range(a, z),
        etape,
      );

    const [lectures, depuisLeDebut, surLaPeriode, parJour, couverture, pubs, regles, controles] = await Promise.all([
      supabase
        .from("pilotage_meta_synchros")
        .select("*")
        .order("demarree_le", { ascending: false })
        .limit(20)
        .then(({ data, error }) => {
          if (error) throw new LectureImpossible(error.code, "journal des lectures");
          return (data ?? []) as PilotageMetaSynchroRow[];
        }),
      totaux(null, null, "totaux depuis le début"),
      b.debut === null ? Promise.resolve(null) : totaux(b.debut, b.fin, "totaux de la période"),
      toutLire<LigneDuJour>((a, z) => {
        let q = supabase.from("pilotage_meta_insights").select("jour, ad_id, depense_cents, leads").lte("jour", b.fin);
        if (b.debut !== null) q = q.gte("jour", b.debut);
        return q.order("jour").order("ad_id").range(a, z);
      }, "statistiques par jour"),
      choix.type === "proposee"
        ? toutLire<PilotageMetaCouvertureRow>(
            (a, z) =>
              supabase.from("pilotage_meta_couverture").select("*").eq("periode", choix.periode).order("lu_le").order("property_id").range(a, z),
            "couverture",
          )
        : Promise.resolve([] as PilotageMetaCouvertureRow[]),
      toutLire<PilotageMetaPubRow>((a, z) => supabase.from("pilotage_meta_pubs").select("*").order("ad_id").range(a, z), "pubs"),
      toutLire<RegleRattachement>(
        (a, z) =>
          supabase
            .from("pilotage_meta_regles")
            .select("id, type_regle, valeur, cible, biens, retiree_le")
            .is("retiree_le", null)
            .order("id")
            .range(a, z),
        "règles",
      ),
      toutLire<PilotageMetaControleRow>(
        (a, z) =>
          supabase
            .from("pilotage_meta_controles")
            .select("*")
            .gte("jour", ajouterJours(jour, -90))
            .order("jour")
            .range(a, z),
        "contrôles",
      ),
    ]);

    return {
      etat: "ok",
      tableau: calculerTableau({
        jour,
        choix,
        biens: pilotage.donnees.map((d) => ({
          id: d.bien.id,
          nom: nomDuBien(d.bien),
          conditions: d.conditions,
          lots: d.lots,
          etatsDesLots: d.etatsDesLots,
          couts: d.couts,
          photographieMandat: d.photographieMandat,
        })),
        meta: {
          lectures,
          depuisLeDebut,
          surLaPeriode: surLaPeriode ?? depuisLeDebut,
          parJour,
          couverture,
          pubs,
          regles,
          joursEnEcart: controles.filter((c) => Math.abs(c.depense_pubs_cents - c.depense_compte_cents) > c.pubs).length,
        },
      }),
    };
  } catch (cause) {
    const code = cause instanceof LectureImpossible ? cause.code : undefined;
    if (estNonInstalle(code)) return { etat: "non_installe" };
    console.error("pilotage : page Pilotage illisible", {
      erreur: cause instanceof Error ? cause.name : "inconnue",
      etape: cause instanceof LectureImpossible ? (cause.etape ?? null) : null,
      code: code ?? null,
    });
    return { etat: "erreur" };
  }
}
