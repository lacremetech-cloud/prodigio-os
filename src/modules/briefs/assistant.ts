import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { env as envGlobal, estResumeIaConfigure } from "@/config";
import type { Env } from "@/config";

/**
 * « UNE QUESTION SUR LE BIEN ? »
 *
 * Un vidéaste sur place, un monteur à 22 h, un setter au téléphone : chacun a
 * une question précise — « la salle de sport fait combien ? », « on peut dire
 * huit mois de ski ? », « le prix est négociable ? » — et la réponse est dans
 * un dossier de quatre-vingts pages qu'ils ne vont pas relire.
 *
 * L'assistant répond depuis CE dossier, et depuis lui seul.
 *
 * TROIS RÈGLES QUI NE BOUGENT PAS.
 *
 * 1. N'INVENTER RIEN. Un brief sert à tourner et à écrire des publicités : une
 *    surface inventée part dans une annonce, un chiffre inventé part dans un
 *    script. « Ce n'est pas dans le dossier » est une bonne réponse ; une
 *    phrase plausible et fausse n'en est pas une.
 * 2. SIGNALER LES INTERDITS. Le dossier porte des choses qu'on ne dit jamais
 *    en publicité — jamais de récupération de TVA, jamais « huit mois de
 *    ski », jamais le prix au mètre carré, et le prix négociable est un
 *    argument de closing. Quand la question les approche, l'assistant le dit.
 * 3. CITER SA SOURCE. Le dossier distingue ce qui est documenté de ce que le
 *    mandataire a dit de mémoire, et les deux divergent sur plusieurs points.
 *    L'assistant doit dire d'où vient ce qu'il avance.
 */

/* Haiku : retrouver et restituer un passage n'est pas une tâche de
   raisonnement. Un seul endroit à changer pour monter en gamme. */
const MODELE = "claude-haiku-5-5";
const MAX_JETONS = 1_000;

/** Une question tient en une phrase ou deux. Au-delà, c'est un collage. */
export const LONGUEUR_MAX_QUESTION = 600;

export const CONSIGNE = `Tu réponds aux questions de l'équipe de production d'une agence immobilière, sur UN bien précis, à partir du dossier qui suit.

Qui te lit : des vidéastes, des monteurs, des commerciaux, des setters. Ils préparent un tournage ou écrivent des publicités. Ils ont le droit de tout savoir du dossier — il leur a été confié.

N'INVENTE RIEN. Si la réponse n'est pas dans le dossier, dis-le en une phrase : « Ce n'est pas dans le dossier. » N'extrapole pas une surface, un prix, une distance ni une date. Un chiffre inventé finit dans une annonce.

DIS D'OÙ VIENT CE QUE TU AVANCES quand la source compte. Le dossier distingue ce qui est documenté — brochures, plans, relevés de gestion — de ce que le mandataire a dit de mémoire, et les deux divergent sur plusieurs points. Quand ils divergent, donne la valeur documentée et signale l'écart.

SIGNALE LES INTERDITS DE COMMUNICATION dès que la question les approche, même sans qu'on te le demande. Ils sont nommés dans le dossier.

Réponds en français, brièvement : deux à six phrases. Pas d'introduction, pas de formule de politesse, pas de résumé final. On te lit entre deux prises.`;

export type ReponseAssistant =
  | { ok: true; reponse: string }
  | { ok: false; motif: "non_configure" | "vide" | "indisponible" | "refus" };

let client: Anthropic | null = null;
function clientAnthropic(cle: string): Anthropic {
  if (!client) client = new Anthropic({ apiKey: cle });
  return client;
}

/**
 * Rend la réponse, ou dit pourquoi il n'y en a pas. Ne lève JAMAIS : l'appelant
 * est une route servie à un externe, qui doit toujours recevoir quelque chose
 * de lisible plutôt qu'une page d'erreur.
 */
export async function repondreSurLeBien(
  question: string,
  matiere: string,
  source: Pick<Env, "ANTHROPIC_API_KEY"> = envGlobal,
): Promise<ReponseAssistant> {
  if (!estResumeIaConfigure(source)) return { ok: false, motif: "non_configure" };

  const propre = question.trim().slice(0, LONGUEUR_MAX_QUESTION);
  if (propre.length === 0) return { ok: false, motif: "vide" };

  try {
    const reponse = await clientAnthropic(source.ANTHROPIC_API_KEY!.trim()).messages.create({
      model: MODELE,
      max_tokens: MAX_JETONS,
      output_config: { effort: "low" },
      /* La matière est volumineuse et IDENTIQUE à chaque question : mise en
         cache, elle est facturée une fois puis relue à prix réduit. Sans cela,
         chaque question repaierait les vingt mille jetons du dossier. */
      system: [
        { type: "text", text: CONSIGNE },
        {
          type: "text",
          text: `DOSSIER DU BIEN\n\n${matiere}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: propre }],
    });

    if (reponse.stop_reason === "refusal") return { ok: false, motif: "refus" };

    const texte = reponse.content
      .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === "text")
      .map((bloc) => bloc.text)
      .join("\n")
      .trim();

    if (!texte) return { ok: false, motif: "indisponible" };
    return { ok: true, reponse: texte };
  } catch (erreur) {
    /* Du plus précis au plus général : `APIConnectionError` descend de
       `APIError`, l'ordre inverse l'avalerait.

       NI LA QUESTION NI LA RÉPONSE NE SONT JOURNALISÉES. Elles portent le prix
       négociable, le nom du propriétaire et l'état réel du bien. On consigne
       la cause, jamais le contenu. */
    if (erreur instanceof Anthropic.AuthenticationError) {
      console.error("[brief-assistant] cle refusee par l'API");
    } else if (erreur instanceof Anthropic.RateLimitError) {
      console.error("[brief-assistant] quota atteint");
    } else if (erreur instanceof Anthropic.APIConnectionError) {
      console.error("[brief-assistant] API injoignable");
    } else if (erreur instanceof Anthropic.APIError) {
      console.error(`[brief-assistant] erreur API (${erreur.status ?? "?"})`);
    } else {
      console.error("[brief-assistant] erreur inattendue");
    }
    return { ok: false, motif: "indisponible" };
  }
}
