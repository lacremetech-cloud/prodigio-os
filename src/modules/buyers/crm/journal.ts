import { etape as definitionEtape, qualification as definitionQualification } from "./vocabulaire";

/**
 * Ce qui a changé, en une phrase lisible.
 *
 * POURQUOI. L'historique affichait « Traitement enregistré · 15 oct., 14:29 ·
 * Antoine » et s'arrêtait là. Savoir qu'il s'est passé quelque chose sans
 * savoir QUOI ne vaut guère mieux que ne rien afficher : on rouvre le dossier,
 * on compare de tête, on finit par redemander à la personne.
 *
 * Les anciennes et les nouvelles valeurs sont déjà écrites dans le journal
 * (`old_value` / `new_value`). Elles n'étaient simplement jamais lues.
 *
 * Les libellés passent par le vocabulaire commun, qui traduit aussi les
 * valeurs disparues : un historique de six mois contient « en_reflexion » et
 * « nouveau », et afficher un identifiant technique à un commercial ne lui
 * apprend rien.
 */
/**
 * Les deux vocabulaires d'activité qui cohabitent dans le journal : les sept
 * choix actuels, et les quatre résultats d'appel d'avant la reprise. Un
 * commercial ne doit jamais lire « message_laisse » dans sa fiche.
 */
const ACTIVITE_LISIBLE: Record<string, string> = {
  /* Les sept choix actuels. */
  appel_sans_reponse: "appel sans réponse",
  appel_echange: "échange téléphonique",
  message_vocal: "message vocal",
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "e-mail",
  note: "note",
  /* Les résultats d'appel d'avant la reprise, encore présents dans le journal. */
  contact_etabli: "échange téléphonique",
  sans_reponse: "appel sans réponse",
  message_laisse: "message vocal",
  mauvais_numero: "appel sur un mauvais numéro",
};

export function changementsLisibles(
  avant: unknown,
  apres: unknown,
): string[] {
  const a = (avant ?? {}) as Record<string, unknown>;
  const b = (apres ?? {}) as Record<string, unknown>;
  const sorties: string[] = [];

  const texte = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v : null;

  const etapeAvant = texte(a.stage);
  const etapeApres = texte(b.stage);
  if (etapeApres && etapeApres !== etapeAvant) {
    sorties.push(
      etapeAvant
        ? `étape : ${definitionEtape(etapeAvant).label} → ${definitionEtape(etapeApres).label}`
        : `étape : ${definitionEtape(etapeApres).label}`,
    );
  }

  const qAvant = texte(a.qualification);
  const qApres = texte(b.qualification);
  if (qApres && qApres !== qAvant) {
    sorties.push(
      qAvant
        ? `qualification : ${definitionQualification(qAvant).label} → ${definitionQualification(qApres).label}`
        : `qualification : ${definitionQualification(qApres).label}`,
    );
  }

  /* L'activité est déjà racontée par le fil des activités, juste au-dessus :
     la répéter ici ferait lire deux fois le même fait. On ne la mentionne que
     lorsqu'elle est la SEULE chose qui s'est passée, pour que la ligne ne
     reste pas muette.

     `resultat_appel` est la clé de l'ANCIENNE fonction d'enregistrement. Un
     dossier travaillé avant la reprise n'a que celle-là : ne lire que
     `activite` laissait ces lignes muettes — « Traitement enregistré, 14:29,
     Antoine » et rien d'autre, précisément ce qu'on voulait corriger. */
  if (sorties.length === 0) {
    const act = texte(b.activite) ?? texte(b.resultat_appel);
    if (act) {
      sorties.push(`${ACTIVITE_LISIBLE[act] ?? "activité"} consignée`);
    } else if (etapeApres || qApres) {
      /* Une sauvegarde qui n'a bougé ni l'étape ni la qualification : une note
         seule, le plus souvent. Le dire explicitement évite de chercher un
         changement qui n'existe pas — la note, elle, est dans le fil des
         activités avec son texte. */
      sorties.push("saisie enregistrée, sans changement d'étape ni de qualification");
    }
  }

  return sorties;
}
