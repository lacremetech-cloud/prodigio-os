"use client";

import { useState } from "react";
import Link from "next/link";
import { enregistrerTraitementAction } from "@/modules/buyers/crm/actions";
import { safeAction } from "@/modules/crm/safe-action";
import { useRouter } from "next/navigation";
import { MOTIFS_NON_QUALIFIE } from "@/modules/buyers/crm/qualification";
import { etape as definitionEtape, qualification as definitionQualification } from "@/modules/buyers/crm/vocabulaire";
import { ChoixEtape, ChoixQualification } from "./choix-vocabulaire";
import { formatDateTime } from "@/modules/crm/format";

/**
 * « Suivi commercial » — ce que l'agence a décidé, en haut de la fiche.
 *
 * POURQUOI IL EXISTE. Le sélecteur d'étape vivait dans « Ce que la personne a
 * déclaré ». Ce bloc présente les RÉPONSES du prospect ; l'étape et la
 * qualification sont le jugement du commercial. Les mélanger faisait lire un
 * choix d'agence comme une déclaration du client — et obligeait à descendre
 * dans la page pour changer l'état d'un dossier qu'on vient d'avoir au
 * téléphone.
 *
 * LA VALEUR ACTUELLE EST SÉLECTIONNÉE, pas un « Déplacer vers… ». Un menu qui
 * n'affiche jamais où l'on est oblige à chercher l'information ailleurs, et
 * c'est ainsi qu'on requalifie un dossier déjà qualifié.
 *
 * LES MÊMES COMPOSANTS QUE LE PANNEAU. `ChoixEtape` et `ChoixQualification`
 * sont partagés : un libellé ou une couleur ajoutée ici apparaît des deux
 * côtés, et les deux écrans ne peuvent plus diverger.
 *
 * UN CLIC SUFFIT. Pas de second formulaire à valider pour reproduire un
 * changement : choisir enregistre, par la MÊME sauvegarde unique que le
 * panneau. Seul « Non qualifié » demande un motif, parce que la base l'exige
 * et qu'un dossier écarté sans raison ne se relit pas six mois plus tard.
 */
export function SuiviCommercial({
  buyerProfileId,
  etape,
  qualification,
  qualificationReason,
  responsables,
  prochaine,
  modifiable,
}: {
  buyerProfileId: string;
  etape: string;
  qualification: string;
  qualificationReason: string | null;
  responsables: string[];
  prochaine: { titre: string; echeance: string | null; responsable: string | null; enRetard: boolean } | null;
  /** Faux pour un lecteur, ou sur un dossier clos : on montre, on ne touche pas. */
  modifiable: boolean;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /* Ouvert seulement quand « Non qualifié » est choisi : un champ qui attend
     sans servir fait croire qu'il manque une réponse. */
  const [motifDemande, setMotifDemande] = useState(false);
  const [motif, setMotif] = useState("");
  const router = useRouter();

  const defEtape = definitionEtape(etape);
  const defQualif = definitionQualification(qualification);

  async function enregistrer(champs: {
    stage?: string;
    qualification?: string;
    qualificationReason?: string | null;
  }) {
    setEnCours(true);
    setErreur(null);
    const res = await safeAction(() =>
      enregistrerTraitementAction({
        buyerProfileId,
        /* Nul : ce changement appartient à la personne, pas à un bien. */
        interestId: null,
        stage: champs.stage ?? null,
        qualification: champs.qualification ?? null,
        qualificationReason: champs.qualificationReason ?? null,
      }),
    );
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error ?? "L’enregistrement a échoué. Réessayez.");
      return;
    }
    setMotifDemande(false);
    setMotif("");
    /* `refresh` et non un rechargement : la page garde sa position et son
       défilement, et toutes les vues lisent la nouvelle valeur. */
    router.refresh();
  }

  function choisirQualification(v: string | null) {
    if (!v || v === qualification) return;
    if (v === "non_qualifie") {
      setMotifDemande(true);
      return;
    }
    void enregistrer({ qualification: v });
  }

  return (
    <section className="crm-suivi" aria-labelledby="suivi-titre">
      <div className="crm-suivi__tete">
        <h2 id="suivi-titre" className="crm-suivi__titre">
          Suivi commercial
        </h2>
        {enCours ? <span className="crm-suivi__etat">Enregistrement…</span> : null}
      </div>

      {/* Les deux valeurs ACTUELLES, lisibles avant même de toucher à un
          menu : la couleur porte l'étape, le libellé porte le sens. */}
      <div className="crm-suivi__actuel">
        <span
          className="crm-suivi__pastille"
          style={{ background: `var(${defEtape.couleur})`, color: `var(${defEtape.encre})` }}
        >
          {defEtape.label}
        </span>
        <span
          className="crm-suivi__pastille crm-suivi__pastille--contour"
          style={{ borderColor: `var(${defQualif.couleur})`, color: `var(${defQualif.couleur})` }}
        >
          {defQualif.label}
        </span>
      </div>

      {modifiable ? (
        <>
          <div className="crm-suivi__bloc">
            <p className="crm-label">Étape de traitement</p>
            {/* Les sélecteurs partagés annulent au second clic sur la valeur
                courante (`null`). Ici, choisir enregistre : « annuler » revient
                donc à ne rien faire, et surtout pas à effacer l'étape. */}
            <ChoixEtape
              valeur={etape}
              onChoisir={(v) => {
                if (v && v !== etape) void enregistrer({ stage: v });
              }}
              disabled={enCours}
            />
          </div>

          <div className="crm-suivi__bloc">
            <p className="crm-label">Qualification</p>
            <ChoixQualification valeur={qualification} onChoisir={choisirQualification} disabled={enCours} />
            {motifDemande ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="crm-select"
                  value={motif}
                  disabled={enCours}
                  onChange={(e) => setMotif(e.target.value)}
                  aria-label="Motif"
                >
                  <option value="">Motif…</option>
                  {MOTIFS_NON_QUALIFIE.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="crm-btn crm-btn--sm crm-btn--primaire"
                  disabled={enCours || !motif}
                  onClick={() =>
                    void enregistrer({ qualification: "non_qualifie", qualificationReason: motif })
                  }
                >
                  Écarter ce dossier
                </button>
                <button
                  type="button"
                  className="crm-btn crm-btn--sm crm-btn--secondaire"
                  disabled={enCours}
                  onClick={() => setMotifDemande(false)}
                >
                  Annuler
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {qualification === "non_qualifie" && qualificationReason ? (
        <p className="crm-suivi__motif">Motif : {qualificationReason}</p>
      ) : null}

      <dl className="crm-suivi__faits">
        <div>
          <dt>Responsable</dt>
          <dd>
            {responsables.length > 0 ? (
              responsables.join(", ")
            ) : (
              <span className="crm-suivi__vide">Non affecté</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Prochaine action</dt>
          <dd>
            {prochaine ? (
              /* Le rouge est réservé au RETARD et aux refus. Une échéance à
                 venir est une information, pas une alerte. */
              <span className={prochaine.enRetard ? "crm-suivi__retard" : ""}>
                {prochaine.titre}
                {prochaine.echeance ? ` · ${formatDateTime(prochaine.echeance)}` : ""}
                {prochaine.responsable ? ` · ${prochaine.responsable}` : ""}
                {prochaine.enRetard ? " · en retard" : ""}
              </span>
            ) : (
              <span className="crm-suivi__vide">Aucune tâche planifiée</span>
            )}
          </dd>
        </div>
      </dl>

      {erreur ? (
        <p className="crm-suivi__erreur" role="alert">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}

/** Lien de repli quand le bloc n'est pas modifiable (dossier clos). */
export function SuiviClos({ href }: { href: string }) {
  return (
    <Link href={href} className="text-xs text-[var(--crm-text-dim)] hover:text-[var(--crm-text)]">
      Voir l’historique complet
    </Link>
  );
}
