/**
 * Mesure du parcours propriétaire — visite → lecture de la VSL → clic → analyse.
 *
 * Volontairement **sans dépendance** : les événements sont poussés dans
 * `window.dataLayer` (Google Tag Manager et la plupart des collecteurs le lisent).
 * Si aucun collecteur n'est présent, la file reste en mémoire et rien ne casse.
 *
 * ⚠️ **Aucune donnée personnelle ne transite ici.** Les charges utiles sont
 * typées ci-dessous et ne contiennent que des identifiants d'emplacement, des
 * numéros d'étape et des paliers de lecture — jamais une réponse au
 * questionnaire, jamais un nom, un téléphone, un e-mail ou une adresse. Le
 * contrat de données du CRM n'est pas concerné : cette couche est en lecture
 * seule vis-à-vis du funnel.
 */

/** Emplacement d'un appel à l'action, pour comparer les zones de la page. */
export type CtaLocation =
  | "hero"
  | "nav"
  | "case_study"
  | "investment"
  | "selection"
  | "footer"
  | "sticky";

/** Paliers de lecture de la VSL. */
export type VslMilestone = 25 | 50 | 75;

type AnalyticsEvent =
  | { event: "hero_vsl_play" }
  | { event: "hero_vsl_25" | "hero_vsl_50" | "hero_vsl_75" | "hero_vsl_complete" }
  | { event: "cta_click"; location: CtaLocation; label_variant: string }
  | { event: "eligibility_started" }
  | { event: "eligibility_step_completed"; step: number }
  | { event: "eligibility_submitted" };

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Pousse un événement. Sans effet si le navigateur n'est pas disponible. */
export function track(payload: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push(payload);
  } catch {
    // La mesure ne doit jamais interrompre un parcours.
  }
}

/** Clic sur un appel à l'action, avec son emplacement et la variante testée. */
export function trackCtaClick(location: CtaLocation, labelVariant: string): void {
  track({ event: "cta_click", location, label_variant: labelVariant });
}

/**
 * Émetteur de paliers de lecture, à usage unique par palier.
 *
 * Le lecteur YouTube n'émet pas d'événement de progression : on l'interroge
 * périodiquement. Cette fabrique garde la trace des paliers déjà franchis pour
 * qu'un retour en arrière ne les rejoue pas.
 */
export function createVslMilestoneTracker() {
  const sent = new Set<string>();

  function once(event: AnalyticsEvent & { event: string }) {
    if (sent.has(event.event)) return;
    sent.add(event.event);
    track(event);
  }

  return {
    play: () => once({ event: "hero_vsl_play" }),
    /** `ratio` entre 0 et 1 ; franchit les paliers 25 / 50 / 75 %. */
    progress: (ratio: number) => {
      if (ratio >= 0.25) once({ event: "hero_vsl_25" });
      if (ratio >= 0.5) once({ event: "hero_vsl_50" });
      if (ratio >= 0.75) once({ event: "hero_vsl_75" });
    },
    complete: () => once({ event: "hero_vsl_complete" }),
  };
}
