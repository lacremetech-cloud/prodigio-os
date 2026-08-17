/**
 * `TemplateRenderer` — rendu d'un modèle **versionné** avec des variables
 * **déclarées**.
 *
 * Règles non négociables :
 *   1. Une variable présente dans le contenu mais **non déclarée** est REFUSÉE
 *      (jamais rendue « en silence », jamais laissée telle quelle).
 *   2. Une variable déclarée mais **non fournie** est REFUSÉE : mieux vaut ne
 *      pas envoyer qu'envoyer « Bonjour {{prenom}} ».
 *   3. Aucune interprétation de code : la substitution est purement textuelle.
 *   4. Le rendu n'échappe rien pour le format `markdown` / `texte` ; pour
 *      `html`, les valeurs sont échappées afin qu'une donnée saisie par un tiers
 *      ne puisse pas injecter de balise.
 */

export type BodyFormat = "markdown" | "html" | "texte";

export interface RenderInput {
  subject?: string | null;
  body: string;
  bodyFormat: BodyFormat;
  /** Variables AUTORISÉES par le modèle. */
  allowedVariables: readonly string[];
  /** Valeurs fournies au rendu. */
  values: Readonly<Record<string, string | null | undefined>>;
}

export type RenderResult =
  | { ok: true; subject: string | null; body: string }
  | { ok: false; code: RenderErrorCode; variables: string[] };

export type RenderErrorCode =
  /** Le contenu utilise une variable que le modèle ne déclare pas. */
  | "variable_non_declaree"
  /** Une variable déclarée et utilisée n'a pas de valeur. */
  | "variable_manquante";

/** Motif d'un jeton `{{variable}}`. Volontairement strict : pas d'expression. */
const TOKEN = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi;

/** Noms de variables réellement utilisés dans un texte, sans doublon. */
export function extractVariables(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(TOKEN)) {
    const name = match[1];
    if (name) found.add(name.toLowerCase());
  }
  return [...found];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Rend un modèle. Renvoie une **erreur explicite** plutôt qu'un contenu
 * approximatif : un message partiellement rendu ne doit jamais partir.
 */
export function renderTemplate(input: RenderInput): RenderResult {
  const allowed = new Set(input.allowedVariables.map((v) => v.toLowerCase()));
  const used = new Set<string>([
    ...extractVariables(input.subject ?? ""),
    ...extractVariables(input.body),
  ]);

  const undeclared = [...used].filter((v) => !allowed.has(v)).sort();
  if (undeclared.length > 0) {
    return { ok: false, code: "variable_non_declaree", variables: undeclared };
  }

  const missing = [...used]
    .filter((v) => {
      const value = input.values[v];
      return value == null || value === "";
    })
    .sort();
  if (missing.length > 0) {
    return { ok: false, code: "variable_manquante", variables: missing };
  }

  const substitute = (text: string): string =>
    text.replace(TOKEN, (_whole, rawName: string) => {
      const value = input.values[rawName.toLowerCase()] ?? "";
      return input.bodyFormat === "html" ? escapeHtml(value) : value;
    });

  return {
    ok: true,
    subject: input.subject ? substitute(input.subject) : null,
    body: substitute(input.body),
  };
}

/** Message lisible expliquant un refus de rendu (affiché dans le CRM). */
export function renderErrorLabel(result: Extract<RenderResult, { ok: false }>): string {
  const list = result.variables.map((v) => `{{${v}}}`).join(", ");
  return result.code === "variable_non_declaree"
    ? `Variable non déclarée par le modèle : ${list}`
    : `Valeur manquante pour : ${list}`;
}
