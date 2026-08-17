/**
 * Surface **EXECUTE** du CRM Acquéreurs : classification explicite et
 * intentionnelle de chaque fonction SQL du module.
 *
 * Ce fichier n'est pas de la documentation décorative : il est **vérifié par un
 * test** (`execute-surface.test.ts`) qui relit les migrations SQL et refuse
 * toute divergence. Un helper interne ne peut donc pas acquérir silencieusement
 * `EXECUTE` pour `authenticated` au détour d'une future migration.
 *
 * Convention appliquée (voir docs/20 § surface EXECUTE) :
 *   1. `REVOKE ALL` sur chaque nouvelle fonction (`public`, `anon`,
 *      `authenticated`) — ne jamais se reposer sur les privilèges par défaut,
 *      car Supabase accorde `EXECUTE` par défaut aux rôles du schéma `public` ;
 *   2. `GRANT EXECUTE` explicite aux seuls rôles réellement nécessaires.
 */

/** Catégories de la surface d'exécution. */
export type ExecuteCategory =
  /** 1. Point d'entrée public anonyme (funnel). */
  | "point_entree_public"
  /** 2. Action CRM destinée aux utilisateurs authentifiés. */
  | "action_crm_authentifiee"
  /** 3. Helper interne, appelé uniquement par une autre fonction SECURITY DEFINER. */
  | "helper_interne"
  /** 4. Helper requis DIRECTEMENT par une politique RLS. */
  | "helper_rls";

export interface ExecuteSurfaceEntry {
  /** Signature d'identité exacte, telle que renvoyée par `pg_proc`. */
  signature: string;
  category: ExecuteCategory;
  /** Rôles devant disposer de `EXECUTE` (hors `postgres` / `service_role`). */
  grants: readonly ("anon" | "authenticated")[];
  /** Appelants connus — sert de justification à la catégorie. */
  callers: string;
}

/**
 * Les 18 fonctions SQL du module CRM Acquéreurs, classées : les 17 créées par
 * `buyers_crm_v1`, plus `crm_buyer_interest_set_status` héritée de la migration
 * de l'expérience publique du bien.
 *
 * ⚠️ `crm_buyer_profile_access` est le SEUL helper appelé directement par les
 * politiques RLS. L'expression d'une politique est évaluée avec les privilèges
 * du rôle appelant : lui retirer `EXECUTE` casse la lecture autorisée (vérifié
 * par un test contrefactuel en base). Il conserve donc `authenticated`.
 */
export const BUYER_EXECUTE_SURFACE: readonly ExecuteSurfaceEntry[] = [
  // --- 1. Point d'entrée public ---------------------------------------------
  {
    signature: "submit_buyer_interest(jsonb)",
    category: "point_entree_public",
    grants: ["anon", "authenticated"],
    callers: "Funnel Acquéreur public (action serveur Next).",
  },

  // --- 2. Actions CRM authentifiées -----------------------------------------
  ...([
    ["crm_buyer_set_stage(uuid, text)", "Kanban et fiche acquéreur"],
    ["crm_buyer_qualify(uuid, text, text)", "Fiche acquéreur — qualification humaine"],
    ["crm_buyer_assign(uuid, uuid, text)", "Fiche acquéreur — affectation"],
    ["crm_buyer_unassign(uuid, uuid)", "Fiche acquéreur — retrait d'affectation"],
    [
      "crm_buyer_upsert_criteria(uuid, text[], text[], bigint, bigint, text, text, text, text, text)",
      "Fiche acquéreur — critères de recherche",
    ],
    ["crm_buyer_record_offer(uuid, uuid, bigint, text)", "Fiche acquéreur — action offre"],
    ["crm_buyer_record_outcome(uuid, text, text)", "Fiche acquéreur — résultat commercial"],
    ["crm_buyer_reopen(uuid, text)", "Fiche acquéreur — réouverture"],
    ["crm_buyer_log_activity(uuid, text, text, text, timestamp with time zone)", "Fiche acquéreur — activités"],
    ["crm_buyer_create_task(uuid, text, text, timestamp with time zone, uuid)", "Fiche acquéreur — tâches"],
    ["crm_buyer_set_task_status(uuid, text)", "Fiche acquéreur et écran Tâches"],
    ["crm_buyer_property_matches(uuid, integer)", "Fiche acquéreur — biens suggérés"],
    ["crm_buyer_interest_set_status(uuid, text)", "Fabrique de biens — réception des intérêts"],
  ] as const).map(
    ([signature, callers]): ExecuteSurfaceEntry => ({
      signature,
      category: "action_crm_authentifiee",
      grants: ["authenticated"],
      callers,
    }),
  ),

  // --- 3. Helpers internes (aucun droit public/anon/authenticated) ----------
  {
    signature: "buyer_attach_interest(uuid)",
    category: "helper_interne",
    grants: [],
    callers: "submit_buyer_interest (SECURITY DEFINER) uniquement.",
  },
  {
    signature: "buyer_band_bounds(text)",
    category: "helper_interne",
    grants: [],
    callers: "buyer_attach_interest (SECURITY DEFINER) uniquement.",
  },
  {
    signature: "crm_buyer_can_operate(uuid)",
    category: "helper_interne",
    grants: [],
    callers:
      "crm_buyer_create_task, crm_buyer_log_activity, crm_buyer_qualify, crm_buyer_record_offer, crm_buyer_set_stage, crm_buyer_set_task_status, crm_buyer_upsert_criteria (toutes SECURITY DEFINER).",
  },

  // --- 4. Helper requis par les politiques RLS ------------------------------
  {
    signature: "crm_buyer_profile_access(uuid)",
    category: "helper_rls",
    grants: ["authenticated"],
    callers:
      "Politiques RLS buyer_profiles_read, buyer_search_criteria_read, buyer_assignments_read, buyer_interests_profile_read, tasks_crm_read, activities_crm_read — évaluées avec les privilèges du rôle appelant.",
  },
] as const;

/** Nom de fonction extrait d'une signature d'identité. */
export function functionName(signature: string): string {
  const i = signature.indexOf("(");
  return i === -1 ? signature : signature.slice(0, i);
}

/** Fonctions ne devant JAMAIS être exécutables par `authenticated`. */
export const INTERNAL_HELPERS: readonly string[] = BUYER_EXECUTE_SURFACE.filter(
  (e) => e.category === "helper_interne",
).map((e) => functionName(e.signature));

/** Fonctions devant rester exécutables par `anon` (points d'entrée publics). */
export const PUBLIC_ENTRY_POINTS: readonly string[] = BUYER_EXECUTE_SURFACE.filter((e) =>
  e.grants.includes("anon"),
).map((e) => functionName(e.signature));
