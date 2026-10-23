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
 * Il est IDENTIQUE pour tous les budgets et tous les biens, a la demande :
 * aucune variable, donc aucun risque qu'un champ vide laisse un trou au milieu
 * d'une phrase, et aucune fiche a verifier avant d'appuyer.
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
 * L'adresse qui ouvre la conversation du prospect, message pret a envoyer.
 *
 * WhatsApp veut le numero en chiffres seulement : ni « + », ni espaces, ni
 * points. Un numero qui ne laisse aucun chiffre ne donne PAS de lien — mieux
 * vaut pas de bouton qu'un bouton qui ouvre une conversation avec personne.
 */
export function lienWhatsApp(numero: string | null | undefined): string | null {
  const chiffres = (numero ?? "").replace(/\D/g, "");
  if (!chiffres) return null;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(MESSAGE_WHATSAPP)}`;
}
