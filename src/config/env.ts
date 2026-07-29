import { z } from "zod";

/**
 * Validation de configuration d'environnement.
 *
 * Principe : l'application doit fonctionner **sans aucune variable
 * d'environnement** à ce stade. Le schéma est donc volontairement permissif et
 * **extensible** — aucune variable n'est rendue obligatoire tant que le service
 * correspondant n'est pas connecté.
 *
 * Les variables Supabase (et autres services) seront ajoutées ici à l'étape
 * suivante, en les déclarant `optional()` puis, le moment venu, requises dans
 * les seuls environnements concernés. Voir `.env.example`.
 */
const envSchema = z.object({
  // Fourni par Next.js / Node ; borné aux valeurs connues, avec valeur par défaut.
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // --- Supabase (base + dépôt de demande publique) ---
  // Toutes optionnelles : l'application démarre sans elles. La capture des
  // demandes est simplement désactivée tant que l'URL et la clé publiable ne
  // sont pas fournies (voir `isSupabaseConfigured`). On n'utilise QUE la clé
  // publiable (anon) : aucune clé `service_role`, aucun secret de base ici.
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  // Référence du projet Supabase (identifiant public, non secret). Sert la
  // documentation et les outils ; jamais requise à l'exécution de l'app.
  SUPABASE_PROJECT_REF: z.string().min(1).optional(),

  // URL canonique publique du site (métadonnées / SEO). Optionnelle.
  NEXT_PUBLIC_SITE_URL: z.url().optional(),

  // URL de la présentation vidéo (VSL), hébergée sur Vimeo/Wistia. Optionnelle :
  // tant qu'elle est absente, la landing affiche un visuel éditorial (aucun faux
  // lecteur, aucun faux bouton de lecture). Permet de brancher la VSL sans
  // reconstruire la page.
  NEXT_PUBLIC_MANDATE_VSL_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Analyse et valide un ensemble de variables d'environnement.
 * Fonction pure (testable) : ne lit pas `process.env` directement.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

/**
 * Configuration validée du processus courant. Sûre à importer partout :
 * avec un environnement vide, renvoie les valeurs par défaut.
 */
export const env: Env = parseEnv(process.env);

/**
 * Indique si Supabase est suffisamment configuré pour déposer une demande.
 * Ne lit qu'une URL publique et une clé publiable — jamais de secret serveur.
 */
export function isSupabaseConfigured(
  source: Pick<
    Env,
    "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  > = env,
): boolean {
  return (
    typeof source.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    source.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === "string" &&
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 0
  );
}
