import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { env as envGlobal, estResumeIaConfigure } from "@/config";
import type { Env } from "@/config";
import {
  CONSIGNE_NOTE,
  LONGUEUR_MAX_MATIERE,
  RAPPEL_FIDELITE,
  prepareMatiere,
} from "./gabarit-note";

/**
 * METTRE EN FORME UNE NOTE D'APPEL.
 *
 * Le commercial raccroche, dicte trois phrases ou colle son transcript, et
 * récupère la note au format attendu — voir `gabarit-note`.
 *
 * CE QUE CE MODULE NE FAIT PAS, et c'est délibéré : il n'enregistre rien. Il
 * rend un texte. C'est le commercial qui relit, corrige et enregistre depuis
 * le panneau. Une note d'appel est une trace commerciale, relue des semaines
 * plus tard par quelqu'un qui n'était pas là ; elle ne s'écrit pas toute
 * seule, et surtout pas sans que personne l'ait lue.
 *
 * LE MODÈLE. Haiku, le plus petit : structurer une note déjà écrite n'est pas
 * une tâche de raisonnement, et au volume de l'équipe — quelques dizaines de
 * notes par mois — la facture se compte en centimes. Un seul endroit à changer
 * si l'on veut monter en gamme.
 *
 * L'EFFORT est au minimum, pour la même raison : on reformate, on ne réfléchit
 * pas. Un effort plus élevé rendrait la même note, plus lentement et plus cher.
 */
const MODELE = "claude-haiku-5-5";

/**
 * De quoi écrire une note longue sans jamais la tronquer au milieu d'une
 * phrase. Une note dépasse rarement 400 mots ; la marge coûte zéro tant
 * qu'elle n'est pas consommée — on ne paie que ce qui est réellement écrit.
 */
const MAX_JETONS = 2_000;

export type ResumeIaResultat =
  | { ok: true; note: string; tronquee: boolean }
  | { ok: false; motif: "non_configure" | "vide" | "indisponible" | "refus" };

/**
 * Un client par processus. Le reconstruire à chaque appel rouvrirait une
 * connexion TLS pour rien.
 */
let client: Anthropic | null = null;
function clientAnthropic(cle: string): Anthropic {
  if (!client) client = new Anthropic({ apiKey: cle });
  return client;
}

/**
 * Rend la note mise en forme, ou dit pourquoi elle ne l'est pas.
 *
 * Ne lève JAMAIS : l'appelant est une action de formulaire derrière un
 * commercial qui vient de dicter. Une exception non rattrapée lui afficherait
 * une page d'erreur avec, au milieu, le texte qu'il venait de dicter — la
 * pire façon de perdre une note.
 */
export async function mettreEnFormeLaNote(
  brut: string,
  source: Pick<Env, "ANTHROPIC_API_KEY"> = envGlobal,
): Promise<ResumeIaResultat> {
  if (!estResumeIaConfigure(source)) return { ok: false, motif: "non_configure" };

  const matiere = prepareMatiere(brut);
  if (!matiere) return { ok: false, motif: "vide" };

  try {
    const reponse = await clientAnthropic(source.ANTHROPIC_API_KEY!.trim()).messages.create({
      model: MODELE,
      max_tokens: MAX_JETONS,
      output_config: { effort: "low" },
      system: CONSIGNE_NOTE,
      messages: [
        {
          role: "user",
          content: `${matiere.texte}\n\n---\n${RAPPEL_FIDELITE}`,
        },
      ],
    });

    /* Un refus est une réponse valide (HTTP 200), pas une panne : on le
       distingue d'une indisponibilité pour ne pas dire « réessayez » à
       quelqu'un pour qui réessayer ne changera rien. */
    if (reponse.stop_reason === "refusal") return { ok: false, motif: "refus" };

    const note = reponse.content
      .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === "text")
      .map((bloc) => bloc.text)
      .join("\n")
      .trim();

    if (!note) return { ok: false, motif: "indisponible" };
    return { ok: true, note, tronquee: matiere.tronquee };
  } catch (erreur) {
    /* Du plus précis au plus général. `APIConnectionError` descend de
       `APIError` dans ce SDK : l'ordre inverse l'avalerait.

       AUCUNE NOTE N'EST JOURNALISÉE : elle porte le nom, le budget et parfois
       la situation familiale d'un acquéreur réel. On consigne la cause, jamais
       la matière. */
    if (erreur instanceof Anthropic.AuthenticationError) {
      console.error("[resume-ia] cle refusee par l'API");
    } else if (erreur instanceof Anthropic.RateLimitError) {
      console.error("[resume-ia] quota atteint");
    } else if (erreur instanceof Anthropic.APIConnectionError) {
      console.error("[resume-ia] API injoignable");
    } else if (erreur instanceof Anthropic.APIError) {
      console.error(`[resume-ia] erreur API (${erreur.status ?? "?"})`);
    } else {
      console.error("[resume-ia] erreur inattendue");
    }
    return { ok: false, motif: "indisponible" };
  }
}

export { LONGUEUR_MAX_MATIERE };
