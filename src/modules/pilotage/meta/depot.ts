import "server-only";

/**
 * La base, du point de vue de la lecture Meta : les fonctions
 * `crm_pilotage_meta_*` réservées au rôle de service. Appelé UNIQUEMENT côté
 * serveur — la route du matin, ou le bouton « Lire maintenant » après contrôle
 * du rôle administrateur.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { toutLire } from "../lecture-complete";
import type { RegleRattachement } from "./rattachement";
import type { Demarrage, PortBase, PubDeLaPeriode } from "./synchro";

type Client = SupabaseClient<Database>;

class EcritureImpossible extends Error {
  constructor(etape: string, readonly code: string | undefined) {
    super(`écriture impossible (${etape})`);
  }
}

function verifier(etape: string, error: { code?: string } | null): void {
  if (error) throw new EcritureImpossible(etape, error.code);
}

export function creerDepot(admin: Client): PortBase {
  return {
    async demarrer(declencheur, demandeePar): Promise<Demarrage> {
      const { data, error } = await admin.rpc("crm_pilotage_meta_synchro_demarrer", {
        p_declencheur: declencheur,
        p_demandee_par: demandeePar,
      });
      verifier("démarrage", error);
      const r = (data ?? {}) as { ok?: boolean; synchro_id?: string; couvert_jusqu_au?: string | null };
      if (!r.ok || !r.synchro_id) return { ok: false, occupe: true };
      return { ok: true, synchroId: r.synchro_id, couvertJusquAu: r.couvert_jusqu_au ?? null };
    },

    async remplacerTranche(synchroId, debut, fin, lignes, controle) {
      const { error } = await admin.rpc("crm_pilotage_meta_remplacer_tranche", {
        p_synchro_id: synchroId,
        p_debut: debut,
        p_fin: fin,
        p_lignes: lignes as unknown as Json,
        p_controle: controle as unknown as Json,
      });
      verifier("remplacement d'une période", error);
    },

    async enregistrerPubs(synchroId, pubs) {
      const { error } = await admin.rpc("crm_pilotage_meta_enregistrer_pubs", {
        p_synchro_id: synchroId,
        p_pubs: pubs as unknown as Json,
      });
      verifier("pubs", error);
    },

    // Deux lectures, page après page : une liste tronquée à 1 000 lignes
    // fausserait la couverture sans le dire (pubs oubliées d'une portée).
    async regles(): Promise<RegleRattachement[]> {
      return toutLire<RegleRattachement>((a, b) =>
        admin
          .from("pilotage_meta_regles")
          .select("id, type_regle, valeur, cible, biens, retiree_le")
          .is("retiree_le", null)
          .order("id")
          .range(a, b),
      );
    },

    async pubsDeLaPeriode(debut, fin): Promise<PubDeLaPeriode[]> {
      const lignes = await toutLire<{ ad_id: string; campaign_id: string | null; campaign_name: string | null; ad_name: string | null }>(
        (a, b) => admin.rpc("crm_pilotage_meta_totaux", { p_debut: debut, p_fin: fin }).order("ad_id").range(a, b),
      );
      return lignes.map((p) => ({ ad_id: p.ad_id, campaign_id: p.campaign_id, campaign_name: p.campaign_name, ad_name: p.ad_name }));
    },

    async remplacerCouverture(synchroId, lignes) {
      const { error } = await admin.rpc("crm_pilotage_meta_remplacer_couverture", {
        p_synchro_id: synchroId,
        p_lignes: lignes as unknown as Json,
      });
      verifier("couverture", error);
    },

    async terminer(synchroId, fin) {
      const { error } = await admin.rpc("crm_pilotage_meta_synchro_terminer", {
        p_synchro_id: synchroId,
        p_statut: fin.statut,
        p_erreur: fin.erreur,
        p_appels_api: fin.appels,
        p_devise: fin.devise,
        p_details: fin.details as Json,
      });
      verifier("fin de lecture", error);
    },
  };
}
