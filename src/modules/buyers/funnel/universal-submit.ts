"use server";

import { after } from "next/server";
import {
  composerMessage,
  configDuDepot,
  construireCharge,
  envoyerAccuseDepot,
} from "../notifications/accuse-depot";
import { envoyerSms } from "../notifications/smsfactor";
import { alerterNouvelleDemande } from "../notifications/universal-notify";
import {
  bienDeLaManifestation,
  conversionProspect,
} from "@/modules/analytics/meta/conversions";
import { normalizePhone } from "@/modules/mandates/funnel/normalize";

import {
  env,
  isSmsFactorConfigured,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
  isTurnstileConfigured,
  isTurnstileProductionSafe,
} from "@/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { buyerFunnel } from "./content";
import {
  buildUniversalPayload,
  universalSubmitActionInputSchema,
  type UniversalSubmitResult,
} from "./universal-payload";
import { BUYER_TURNSTILE_ACTION, verifyTurnstileToken } from "./turnstile";

/**
 * Action serveur du formulaire acquéreur **universel**.
 *
 * Elle dépose via la fonction SQL contrôlée `submit_buyer_interest` (qui
 * recontrôle tout et fait autorité), n'utilise que la clé publiable, vérifie
 * Turnstile avant tout dépôt, et ne renvoie jamais d'état interne — à une
 * exception près, assumée : l'adresse de la **brochure**, qui est la
 * contrepartie promise à la personne et n'est délivrée que contre un intérêt
 * réellement enregistré.
 *
 * Cette mission ne déclenche **aucun e-mail ni SMS** : rien n'est envoyé à la
 * personne, la brochure est remise à l'écran.
 */

interface SubmitResult {
  accepted: boolean;
  created?: boolean;
  interest_id?: string | null;
}

const turnstileFailure: UniversalSubmitResult = {
  ok: false,
  reason: "turnstile",
  message: buyerFunnel.errors.turnstile,
  resetChallenge: true,
};

export async function submitUniversalInterestAction(
  input: unknown,
): Promise<UniversalSubmitResult> {
  const parsed = universalSubmitActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "validation", message: buyerFunnel.errors.validation };
  }

  const { turnstileToken, ...request } = parsed.data;

  /*
   * Le pot de miel ne fait PLUS disparaitre la demande.
   *
   * Le champ est libelle « Societe » et porte autocomplete="off" — que Chrome
   * ignore pour les champs d'adresse. Un navigateur equipe du profil de son
   * utilisateur le remplit donc tout seul, et la demande d'un acquereur bien
   * reel etait jetee en silence : ecran de confirmation affiche, aucune
   * brochure remise, aucune ligne en base. Observe en production.
   *
   * Turnstile reste la vraie garde, comme le notait deja le commentaire
   * d'origine. Perdre un acquereur coute infiniment plus cher que de stocker
   * la ligne d'un robot qui aurait, de surcroit, du passer Turnstile. La
   * valeur saisie est conservee dans la charge utile : elle reste consultable
   * pour qui veut mesurer le bruit, sans rien jeter.
   */

  if (!isSupabaseConfigured() || !isTurnstileConfigured()) {
    return { ok: false, reason: "unavailable", message: buyerFunnel.errors.unavailable };
  }
  if (!isTurnstileProductionSafe()) {
    console.error("Turnstile mal configuré en production — dépôt acquéreur refusé.");
    return turnstileFailure;
  }

  const isProduction = env.NODE_ENV === "production";
  const verification = await verifyTurnstileToken({
    secret: env.TURNSTILE_SECRET_KEY as string,
    token: turnstileToken,
    expectedAction: BUYER_TURNSTILE_ACTION,
    expectedHostname: env.TURNSTILE_EXPECTED_HOSTNAME ?? null,
    // Le formulaire est embarqué sur des domaines tiers : le nom d'hôte vu par
    // Turnstile est celui de l'iframe, pas celui du parent. On ne l'impose donc
    // pas ici — la liste des domaines autorisés est gardée par `frame-ancestors`.
    enforceHostname: false,
    allowEmptyAction: !isProduction,
  });
  if (!verification.ok) {
    console.error("Vérification Turnstile universelle refusée", { reason: verification.reason });
    return turnstileFailure;
  }

  try {
    const payload = buildUniversalPayload(request) as Json;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("submit_buyer_interest", { payload });

    if (error) {
      console.error("submit_buyer_interest (universel) a échoué", { code: error.code });
      return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
    }

    const result = data as unknown as SubmitResult | null;
    if (!result || result.accepted !== true) {
      return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
    }

    // Brochure : délivrée UNIQUEMENT contre l'identifiant d'un dépôt réel. Un
    // accusé neutre (bien inconnu, formulaire inactif) n'en porte aucune.
    let brochureUrl: string | null = null;
    if (result.created === true && typeof result.interest_id === "string") {
      /* Alerte Slack dans #alertes-acquereurs. Programmee APRES la reponse :
         le visiteur n'attend jamais Slack, et sa demande est deja enregistree.
         Les scores sont relus en base plutot que recalcules ici, pour que
         l'alerte dise exactement ce que le CRM affichera. */
      const interetId = result.interest_id;

      /* Le depot est ANONYME : le client qui vient d'ecrire n'a aucun droit de
         RELECTURE. `properties` et `buyer_interests` n'ouvrent leur lecture
         qu'au role `authenticated` — verifie en base. Toute relecture faite
         avec ce client-la rendait donc vide, en silence :

           — l'alerte Slack annoncait « Bien non nomme » pour chaque demande,
             alors que le bien etait parfaitement rattache ;
           — elle n'affichait aucun score, pour la meme raison ;
           — et la conversion Meta partait sans nom de bien, donc sans moyen de
             ventiler les conversions par bien dans le Gestionnaire.

         Ces trois lectures sont internes : elles ont lieu APRES la reponse, et
         rien de ce qu'elles ramenent ne retourne au visiteur. Elles passent
         donc par le client serveur, qui n'est jamais expose au navigateur. */
      const lecteur = isSupabaseAdminConfigured() ? getSupabaseAdminClient() : supabase;
      /* Conversion « prospect » vers Meta. Emise ici et non par le pixel du
         navigateur : bloqueurs, cookies tiers refuses et iOS en font disparaitre
         une part importante. Les coordonnees sont hachees avant de partir. */
      const conversion = async () => {
        try {
          const touche = request.context.lastTouch ?? request.context.firstTouch;
          // Le bien est relu en base : il permet de ventiler les conversions
          // par bien dans le Gestionnaire de publicites, sans dependre du nom
          // donne aux campagnes.
          const bien = await bienDeLaManifestation(lecteur, interetId);
          await conversionProspect({
            interestId: interetId,
            propertyName: bien?.nom ?? null,
            propertyId: bien?.id ?? null,
            sourceUrl: request.context.originUrl ?? touche?.url ?? null,
            identity: {
              email: request.answers.emailRaw,
              phone: normalizePhone(request.answers.phoneRaw, request.answers.phoneCountry),
              firstName: request.answers.firstName,
              lastName: request.answers.lastName,
              country: request.answers.phoneCountry,
              fbclid: touche?.fbclid ?? null,
              clickedAt: touche?.at ?? null,
              // Le navigateur du prospect : c'est le seul moment ou il est le
              // sien. Les conversions suivantes partent du CRM, ou il serait
              // celui du commercial.
              clientUserAgent: request.context.userAgent ?? null,
            },
          });
        } catch (cause) {
          console.warn("conversion Meta non emise", {
            name: cause instanceof Error ? cause.name : "unknown",
          });
        }
      };

      /* Accusé de réception : l'automatisation envoie un SMS avec le lien du
         dossier, dans la seconde. C'est le délai de rappel qui distingue un
         lead traité d'un lead perdu — une demande déposée à 2 h du matin
         attendrait sinon le premier commercial disponible.

         Comme l'alerte et la conversion : après la réponse, jamais bloquant,
         et ses erreurs restent chez elle. */
      const accuse = async () => {
        try {
          const config = await configDuDepot(lecteur, interetId);
          if (!config) return;
          const telephone = normalizePhone(
            request.answers.phoneRaw,
            request.answers.phoneCountry,
          );
          const bien = await bienDeLaManifestation(lecteur, interetId);

          /* Deux chemins, jamais les deux : sinon la personne recevrait deux
             fois le meme SMS. L'envoi direct prime des que le jeton existe ;
             l'automatisation externe reste le chemin de repli tant qu'il
             n'est pas pose, et pour un bien qui garderait son propre
             scenario. */
          if (isSmsFactorConfigured()) {
            const texte = composerMessage({
              firstName: request.answers.firstName,
              propertyName: config.publicName ?? bien?.nom ?? null,
              brochureUrl: config.brochureUrl,
            });
            if (!texte) return;
            const envoi = await envoyerSms(telephone, texte);
            if (!envoi.envoye) {
              console.warn("accuse par SMS non envoye", {
                raison: envoi.raison,
                code: envoi.code ?? null,
              });
            }
            return;
          }

          if (!config.webhookUrl) return;
          const resultat = await envoyerAccuseDepot(
            construireCharge({
              interestId: interetId,
              config,
              propertyName: bien?.nom ?? null,
              firstName: request.answers.firstName,
              lastName: request.answers.lastName,
              phone: telephone,
              email: request.answers.emailRaw,
              budgetChoice: request.answers.budgetChoice,
            }),
            config.webhookUrl,
          );
          /* Ni l'adresse appelée ni les coordonnées ne sont journalisées :
             seulement de quoi comprendre un silence. */
          if (!resultat.envoye) {
            console.warn("accuse de depot non envoye", {
              raison: resultat.raison,
              status: resultat.status ?? null,
            });
          }
        } catch (cause) {
          console.warn("accuse de depot en echec", {
            name: cause instanceof Error ? cause.name : "unknown",
          });
        }
      };

      const alerte = async () => {
        /* Une notification ne compromet jamais un depot : l'alerte avale ses
           propres erreurs. Sans cela, un Slack injoignable ou une lecture
           refusee remonterait en rejet non capture — hors du try/catch de
           l'action, puisque `after` s'execute apres la reponse. */
        try {
          const { data: ligne } = await lecteur
            .from("buyer_interests")
            .select("overall_score, priority, budget_score, property_id, buyer_profile_id")
            .eq("id", interetId)
            .maybeSingle();
          /* Le nom du bien valait `null` EN DUR : l'alerte Slack annoncait donc
             « Bien non nomme » pour toute demande, y compris quand le bien
             etait parfaitement rattache — ce qui etait le cas de toutes. On
             reutilise la lecture deja ecrite pour les conversions. */
          const bienAlerte = await bienDeLaManifestation(lecteur, interetId);
          await alerterNouvelleDemande({
            request,
            interestId: interetId,
            propertyId: ligne?.property_id ?? "",
            propertyName: bienAlerte?.nom ?? null,
            buyerProfileId: ligne?.buyer_profile_id ?? null,
            score: ligne
              ? {
                  overall: ligne.overall_score ?? null,
                  priority: ligne.priority ?? null,
                  budget: ligne.budget_score ?? null,
                }
              : null,
          });
        } catch (cause) {
          console.warn("alerte acquereur non envoyee", {
            name: cause instanceof Error ? cause.name : "unknown",
          });
        }
      };
      const suites = async () => {
        // Independantes : une alerte Slack muette ne doit pas priver Meta de sa
        // conversion, ni le prospect de son accuse de reception.
        await Promise.allSettled([accuse(), alerte(), conversion()]);
      };
      try {
        after(() => suites());
      } catch {
        void suites();
      }

      const { data: url } = await supabase.rpc("buyer_form_brochure", {
        p_slug: request.slug,
        p_interest_id: result.interest_id,
      });
      if (typeof url === "string" && url.length > 0) brochureUrl = url;
    }

    return { ok: true, brochureUrl };
  } catch (cause) {
    console.error("submit_buyer_interest (universel) exception", {
      name: cause instanceof Error ? cause.name : "unknown",
    });
    return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
  }
}
