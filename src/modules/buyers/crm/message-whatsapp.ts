/**
 * LE MESSAGE PREREMPLI DES BOUTONS WHATSAPP DU CRM.
 *
 * Le bouton n'envoie rien : il ouvre la conversation du prospect avec ce texte
 * deja ecrit. C'est le commercial qui relit et appuie sur envoyer, dans
 * WhatsApp. Rien n'est consigne dans le CRM a ce moment-la — ouvrir WhatsApp
 * n'est pas un fait, c'est une intention, et `vocabulaire.ts` le dit deja pour
 * les activites : « ouvrir WhatsApp ne prouve pas qu'un message est parti ».
 * Le commercial enregistre « Message WhatsApp envoye » lui-meme, apres coup.
 *
 * CE MODELE SUPPOSE QUE LE MAIL AVEC LES BROCHURES EST DEJA PARTI : il y fait
 * reference au passe (« je me suis permis de vous envoyer un email »). L'
 * envoyer avant le mail ferait mentir le message.
 *
 * IL N'EST PLUS IDENTIQUE POUR TOUS LES BIENS, et il ne pouvait plus l'etre.
 * Le texte ci-dessous parle d'une « maison a Cassis » et d'« une seconde
 * maison situee a 3 min » : envoye a un prospect des 2 Alpes, il est faux a
 * chaque ligne. Chaque bien porte donc le sien, en base
 * (`property_public_config.whatsapp_message`), modifiable depuis sa fiche sans
 * redeploiement — ces textes ont deja change deux fois en trois semaines.
 *
 * Le texte de Cassis reste ici comme REPLI : un bien sans message configure
 * doit ouvrir WhatsApp avec quelque chose de lisible, pas avec du vide.
 *
 * La prudence d'origine sur les variables tient toujours. `[Prenom]` est la
 * SEULE admise, et le cas « prenom inconnu » est traite : sans lui, on
 * ecrirait « Bonjour , moi c'est Edouard » a un prospect.
 *
 * Module separe du composant pour qu'il soit lisible et testable sans React :
 * ce texte part a des acquereurs, une faute s'y voit.
 */

/**
 * Les apostrophes sont TYPOGRAPHIQUES (’) et non droites ('), les accents sont
 * ecrits tels quels, et les sauts de ligne sont reels. `encodeURIComponent` les
 * transporte sans dommage jusqu'a WhatsApp.
 */
export const MESSAGE_WHATSAPP = `Bonjour,
Je suis le propriétaire de la maison à Cassis pour laquelle vous avez fait une demande d’information. Je me suis permis de vous envoyer un email intégrant la brochure de la maison qui vous intéresse ainsi qu’une seconde maison située à 3 min seulement.

N’hésitez pas à me rappeler quand vous le pourrez pour échanger et organiser une visite. Je me permettrai également de vous rappeler très prochainement.

Bien cordialement,
Jean-Charles Castellano
06 68 68 04 07`;

/**
 * Le message reellement envoye : le modele du bien, le prenom du prospect
 * dedans.
 *
 * LE CAS QUI COMPTE EST CELUI DU PRENOM MANQUANT. Un depot peut n'en porter
 * aucun, et « Bonjour [Prenom], » rendrait alors « Bonjour , » — ou pire, le
 * crochet tel quel. On referme donc la salutation proprement, comme le fait
 * deja l'accuse par SMS.
 *
 * La substitution ne touche qu'a `[Prenom]`. Tout le reste du modele part tel
 * qu'il a ete ecrit : c'est du texte relu par un humain, pas un gabarit.
 */
export function composerWhatsApp(
  modele: string | null | undefined,
  prenom: string | null | undefined,
): string {
  const texte = (modele ?? "").trim() || MESSAGE_WHATSAPP;
  const p = (prenom ?? "").trim();
  if (!texte.includes(JETON_PRENOM)) return texte;
  return p
    ? texte.replaceAll(JETON_PRENOM, p)
    : /* « Bonjour [Prenom], moi c'est... » doit devenir « Bonjour, moi
         c'est... » : on retire le jeton ET l'espace qui le precede, mais on
         GARDE la ponctuation qui suit. L'avaler donnerait « Bonjour moi
         c'est », qui se lit comme une faute de frappe. */
      texte.replaceAll(new RegExp(`[ \\t]*${ECHAPPE_PRENOM}`, "g"), "");
}

/** Le seul champ admis dans un modele, et sa forme echappee pour les regex. */
export const JETON_PRENOM = "[Prénom]";
const ECHAPPE_PRENOM = "\\[Prénom\\]";

/**
 * L'adresse qui ouvre la conversation du prospect, message pret a envoyer.
 *
 * WhatsApp veut le numero en chiffres seulement : ni « + », ni espaces, ni
 * points. Un numero qui ne laisse aucun chiffre ne donne PAS de lien — mieux
 * vaut pas de bouton qu'un bouton qui ouvre une conversation avec personne.
 */
export function lienWhatsApp(
  numero: string | null | undefined,
  modele?: string | null,
  prenom?: string | null,
): string | null {
  const chiffres = (numero ?? "").replace(/\D/g, "");
  if (!chiffres) return null;
  const texte = composerWhatsApp(modele, prenom);
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(texte)}`;
}
