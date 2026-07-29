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

  // --- Emplacement réservé aux futures variables (aucune requise pour l'instant) ---
  // Exemple (étape suivante) :
  // NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  // SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
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
