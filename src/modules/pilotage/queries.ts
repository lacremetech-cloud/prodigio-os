import "server-only";

/**
 * Couche de LECTURE du pilotage. Tout passe par le client serveur (jeton de
 * l'utilisateur) : la RLS ne rend ces tables qu'à un administrateur. Les pages
 * vérifient le rôle AVANT de lire ; un autre rôle recevrait de toute façon
 * zéro ligne, jamais une erreur.
 *
 * DEUX PIÈGES ÉVITÉS ICI :
 *  - PostgREST plafonne une réponse (1 000 lignes par défaut). Un total de
 *    coûts calculé sur une liste tronquée serait faux SANS LE DIRE : on lit
 *    donc page après page, jusqu'au bout.
 *  - Sur un aperçu Vercel, la base est celle de la production : tant que la
 *    migration du pilotage n'y est pas appliquée, les tables n'existent pas.
 *    On le reconnaît (`non_installe`) pour l'écrire à l'écran, au lieu de
 *    laisser la page tomber.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Json,
  PilotageConditionsRow,
  PilotageCoutFixeRow,
  PilotageLotRow,
  PilotageLotVersionRow,
  PropertyRow,
} from "@/lib/supabase/types";
import { estNonInstalle } from "./erreurs";

export type Lecture<T> = { etat: "ok"; donnees: T } | { etat: "non_installe" } | { etat: "erreur" };

export type BienResume = Pick<
  PropertyRow,
  | "id"
  | "project_name"
  | "commercial_title"
  | "property_type"
  | "location_city"
  | "commercialization_origin"
  | "mandate_id"
  | "status"
>;

export interface DonneesPilotage {
  bien: BienResume;
  conditions: PilotageConditionsRow[];
  lots: PilotageLotRow[];
  etatsDesLots: PilotageLotVersionRow[];
  couts: PilotageCoutFixeRow[];
  /** Photographie économique du mandat du bien, s'il en a un. */
  photographieMandat: Json | null;
}

type Echec = { code?: string; message?: string } | null;

class LectureImpossible extends Error {
  constructor(readonly code: string | undefined) {
    super("lecture du pilotage impossible");
  }
}

const PAGE = 1000;

/** Toutes les lignes d'une requête, page après page. */
async function toutLire<T>(
  requete: (debut: number, fin: number) => PromiseLike<{ data: unknown; error: Echec }>,
): Promise<T[]> {
  const lignes: T[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await requete(debut, debut + PAGE - 1);
    if (error) throw new LectureImpossible(error.code);
    const page = Array.isArray(data) ? (data as T[]) : [];
    lignes.push(...page);
    if (page.length < PAGE) return lignes;
  }
}

const COLONNES_BIEN =
  "id, project_name, commercial_title, property_type, location_city, commercialization_origin, mandate_id, status";

/**
 * Les données du pilotage : de tous les biens, ou d'un seul.
 * `donnees` vide pour un bien inconnu.
 */
export async function lirePilotage(propertyId?: string): Promise<Lecture<DonneesPilotage[]>> {
  const supabase = await createSupabaseServerClient();
  const seulement = <Q extends { eq: (c: string, v: string) => Q }>(q: Q, colonne: string): Q =>
    propertyId ? q.eq(colonne, propertyId) : q;

  try {
    const biens = await toutLire<BienResume>((a, b) =>
      seulement(supabase.from("properties").select(COLONNES_BIEN), "id")
        .order("created_at", { ascending: true })
        .range(a, b),
    );
    if (biens.length === 0) return { etat: "ok", donnees: [] };

    const [conditions, lots, couts] = await Promise.all([
      toutLire<PilotageConditionsRow>((a, b) =>
        seulement(supabase.from("pilotage_conditions").select("*"), "property_id")
          .order("saisi_le", { ascending: true })
          .range(a, b),
      ),
      toutLire<PilotageLotRow>((a, b) =>
        seulement(supabase.from("pilotage_lots").select("*"), "property_id")
          .order("cree_le", { ascending: true })
          .range(a, b),
      ),
      toutLire<PilotageCoutFixeRow>((a, b) =>
        seulement(supabase.from("pilotage_couts_fixes").select("*"), "property_id")
          .order("saisi_le", { ascending: true })
          .range(a, b),
      ),
    ]);

    const lotIds = lots.map((l) => l.id);
    const etats =
      lotIds.length === 0
        ? []
        : await toutLire<PilotageLotVersionRow>((a, b) =>
            supabase
              .from("pilotage_lot_versions")
              .select("*")
              .in("lot_id", lotIds)
              .order("saisi_le", { ascending: true })
              .range(a, b),
          );

    const mandatIds = biens.map((p) => p.mandate_id).filter((id): id is string => Boolean(id));
    const photographies = new Map<string, Json | null>();
    if (mandatIds.length > 0) {
      const { data, error } = await supabase
        .from("mandates")
        .select("id, economic_snapshot")
        .in("id", mandatIds);
      if (error) throw new LectureImpossible(error.code);
      for (const m of (data ?? []) as { id: string; economic_snapshot: Json | null }[]) {
        photographies.set(m.id, m.economic_snapshot);
      }
    }

    const lotsDuBien = new Map<string, PilotageLotRow[]>();
    for (const l of lots) lotsDuBien.set(l.property_id, [...(lotsDuBien.get(l.property_id) ?? []), l]);
    const bienDuLot = new Map(lots.map((l) => [l.id, l.property_id]));

    return {
      etat: "ok",
      donnees: biens.map((bien) => ({
        bien,
        conditions: conditions.filter((c) => c.property_id === bien.id),
        lots: lotsDuBien.get(bien.id) ?? [],
        etatsDesLots: etats.filter((e) => bienDuLot.get(e.lot_id) === bien.id),
        couts: couts.filter((c) => c.property_id === bien.id),
        photographieMandat: bien.mandate_id ? photographies.get(bien.mandate_id) ?? null : null,
      })),
    };
  } catch (cause) {
    const code = cause instanceof LectureImpossible ? cause.code : undefined;
    if (estNonInstalle(code)) return { etat: "non_installe" };
    console.error("pilotage : lecture impossible", { code: code ?? "sans code" });
    return { etat: "erreur" };
  }
}

/** Nom d'affichage d'un bien : nom de projet, sinon type et ville. */
export function nomDuBien(bien: BienResume): string {
  const nom = bien.project_name?.trim() || bien.commercial_title?.trim();
  if (nom) return nom;
  const repli = [bien.property_type?.trim(), bien.location_city?.trim()].filter(Boolean).join(" · ");
  return repli || "Bien sans nom";
}
