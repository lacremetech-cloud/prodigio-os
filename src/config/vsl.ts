/**
 * Configuration de la **VSL** (vidéo de présentation) de la landing propriétaire.
 *
 * 👉 Pour remplacer la vidéo provisoire par la VSL définitive (Cyril / Victor),
 *    il suffit de changer `VSL_YOUTUBE_ID` ci-dessous (ou de définir
 *    `NEXT_PUBLIC_VSL_YOUTUBE_ID`). Aucun autre fichier à toucher.
 *
 * La vidéo est **intégrée**, jamais téléchargée ni réhébergée. On privilégie le
 * domaine d'intégration respectueux de la vie privée (`youtube-nocookie.com`) et
 * on retire l'habillage YouTube (pas de contrôles natifs, pas de suggestions).
 */

/** Identifiant YouTube de la VSL (provisoire — à remplacer par la VSL finale). */
export const VSL_YOUTUBE_ID =
  process.env.NEXT_PUBLIC_VSL_YOUTUBE_ID?.trim() || "rgH1uqNdvHs";

/** Domaine d'intégration « sans cookie ». */
export const VSL_EMBED_HOST = "https://www.youtube-nocookie.com";

export interface VslEmbedOptions {
  autoplay?: boolean;
  mute?: boolean;
  controls?: boolean;
  loop?: boolean;
  /** Bouton plein écran de YouTube — le seul disponible sur iOS. */
  fullscreen?: boolean;
  /** Reprise en secondes (le visiteur ne revoit pas ce qu'il a déjà vu). */
  start?: number;
  /** Origine pour l'API IFrame (sécurité). */
  origin?: string;
}

/**
 * Construit l'URL d'intégration nocookie avec des paramètres **premium** :
 * lecture auto, silencieux, `playsinline` (mobile), **sans habillage** YouTube
 * (pas de contrôles, pas de suggestions, pas de branding, clavier désactivé) et
 * `enablejsapi` pour piloter le son et le redémarrage via l'API IFrame.
 */
export function buildVslEmbedUrl(
  id: string = VSL_YOUTUBE_ID,
  opts: VslEmbedOptions = {},
): string {
  const {
    autoplay = true,
    mute = true,
    controls = false,
    loop = true,
    fullscreen = false,
    start,
    origin,
  } = opts;

  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: mute ? "1" : "0",
    controls: controls ? "1" : "0",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    disablekb: "1",
    fs: fullscreen ? "1" : "0",
    enablejsapi: "1",
    loop: loop ? "1" : "0",
    // `loop` sur une vidéo unique nécessite `playlist` = même identifiant.
    playlist: id,
  });
  if (start && start > 0) params.set("start", String(Math.floor(start)));
  if (origin) params.set("origin", origin);

  return `${VSL_EMBED_HOST}/embed/${id}?${params.toString()}`;
}
