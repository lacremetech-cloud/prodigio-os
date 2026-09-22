/**
 * Pont iframe — **une seule chose sort du cadre : la hauteur du formulaire.**
 *
 * Embarqué chez un tiers, le formulaire n'a aucun moyen de se redimensionner
 * seul : sans ce message il est tronqué à chaque changement d'écran. On publie
 * donc sa hauteur, et rien d'autre. Aucune réponse, aucune coordonnée, aucun
 * identifiant ne transite par `postMessage` : ce canal est lisible par la page
 * hôte, qui n'a pas à connaître ce que la personne saisit.
 *
 * La cible reste `"*"` : la hauteur n'est pas une donnée sensible, et le parent
 * légitime est déjà filtré en amont par `frame-ancestors` (Content-Security-
 * Policy), qui décide seul qui a le droit d'embarquer la page.
 */

export const EMBED_MESSAGE_TYPE = "prodigio:buyer-form:height" as const;

export interface EmbedHeightMessage {
  type: typeof EMBED_MESSAGE_TYPE;
  height: number;
}

/** Vrai si la page est rendue dans une iframe. */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Un accès refusé signifie justement qu'on est dans un cadre d'une autre origine.
    return true;
  }
}

/** Publie la hauteur courante au parent. Sans effet hors iframe. */
export function notifyParentHeight(node: HTMLElement | null): void {
  if (typeof window === "undefined" || !node || !isEmbedded()) return;
  const height = Math.ceil(node.getBoundingClientRect().height);
  if (!Number.isFinite(height) || height <= 0) return;
  const message: EmbedHeightMessage = { type: EMBED_MESSAGE_TYPE, height };
  try {
    window.parent.postMessage(message, "*");
  } catch {
    // Un parent injoignable ne doit jamais casser le formulaire.
  }
}

/** Extrait du code d'intégration remis dans le cockpit. */
export function buildEmbedSnippet(formUrl: string): string {
  return `<iframe src="${formUrl}" title="Demander la brochure" loading="lazy" style="width:100%;border:0;min-height:520px" ></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "${EMBED_MESSAGE_TYPE}") return;
    var f = document.querySelector('iframe[src="${formUrl}"]');
    if (f && typeof e.data.height === "number") f.style.height = e.data.height + "px";
  });
</script>`;
}
