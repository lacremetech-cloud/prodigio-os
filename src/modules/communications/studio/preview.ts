/**
 * **Prévisualisation d'un modèle** — desktop et mobile, sur données FICTIVES.
 *
 * Contraintes :
 *   • aucune donnée réelle : les valeurs proviennent d'un jeu synthétique ;
 *   • une variable non déclarée ou non renseignée produit une **erreur claire**,
 *     jamais un rendu approximatif ;
 *   • le HTML éventuel est rendu tel quel dans un cadre isolé côté interface :
 *     ce module ne fait que produire du texte, il n'injecte rien.
 */

import { extractVariables, renderTemplate, type BodyFormat } from "../templates/render";

export type PreviewViewport = "desktop" | "mobile";

/** Largeurs de rendu, en pixels — cohérentes avec les points de rupture du CRM. */
export const PREVIEW_WIDTHS: Record<PreviewViewport, number> = {
  desktop: 640,
  mobile: 360,
};

export const previewViewportLabels: Record<PreviewViewport, string> = {
  desktop: "Ordinateur",
  mobile: "Mobile",
};

export interface TemplateDraft {
  subject: string | null;
  body: string;
  bodyFormat: BodyFormat;
  allowedVariables: readonly string[];
}

export interface VariableCheck {
  /** Variables réellement utilisées dans le sujet ou le corps. */
  used: string[];
  /** Utilisées mais non déclarées par le modèle : refus au rendu. */
  undeclared: string[];
  /** Déclarées mais absentes du jeu de valeurs fourni : refus au rendu. */
  missing: string[];
  /** Déclarées mais jamais employées : simple signalement, non bloquant. */
  unused: string[];
  ok: boolean;
}

/**
 * Contrôle **exhaustif** des variables d'un modèle. Renvoie les trois écarts
 * possibles séparément : ils n'ont ni la même gravité ni la même correction.
 */
export function checkVariables(
  draft: TemplateDraft,
  values: Readonly<Record<string, string | null | undefined>>,
): VariableCheck {
  const allowed = new Set(draft.allowedVariables.map((v) => v.toLowerCase()));
  const used = [
    ...new Set([...extractVariables(draft.subject ?? ""), ...extractVariables(draft.body)]),
  ].sort();

  const undeclared = used.filter((v) => !allowed.has(v));
  const missing = used
    .filter((v) => allowed.has(v))
    .filter((v) => {
      const value = values[v];
      return value == null || value === "";
    });
  const unused = [...allowed].filter((v) => !used.includes(v)).sort();

  return {
    used,
    undeclared,
    missing,
    unused,
    ok: undeclared.length === 0 && missing.length === 0,
  };
}

export type PreviewResult =
  | { ok: true; subject: string | null; body: string; check: VariableCheck }
  | { ok: false; error: string; check: VariableCheck };

/**
 * Rend un modèle pour prévisualisation. Le rendu réutilise le moteur RÉEL :
 * ce qui s'affiche ici est exactement ce qui serait préparé.
 */
export function previewTemplate(
  draft: TemplateDraft,
  values: Readonly<Record<string, string | null | undefined>>,
): PreviewResult {
  const check = checkVariables(draft, values);

  if (check.undeclared.length > 0) {
    return {
      ok: false,
      check,
      error: `Variable non déclarée par le modèle : ${check.undeclared
        .map((v) => `{{${v}}}`)
        .join(", ")}. Déclarez-la ou retirez-la du contenu.`,
    };
  }
  if (check.missing.length > 0) {
    return {
      ok: false,
      check,
      error: `Valeur manquante pour : ${check.missing
        .map((v) => `{{${v}}}`)
        .join(", ")}. Aucun rendu partiel n'est produit.`,
    };
  }

  const rendered = renderTemplate({
    subject: draft.subject,
    body: draft.body,
    bodyFormat: draft.bodyFormat,
    allowedVariables: draft.allowedVariables,
    values,
  });

  if (!rendered.ok) {
    return { ok: false, check, error: "Rendu impossible avec ces variables." };
  }
  return { ok: true, subject: rendered.subject, body: rendered.body, check };
}
