"use client";

import { ETAPES, QUALIFICATIONS } from "@/modules/buyers/crm/vocabulaire";

/**
 * Les deux sélecteurs du vocabulaire, écrits UNE fois.
 *
 * Le panneau et la fiche avaient chacun les leurs. Ils ont divergé exactement
 * comme les listes de valeurs avant eux : le panneau proposait cinq
 * qualifications — dont « En réflexion », qui n'existait plus nulle part
 * ailleurs — pendant que le pipeline en connaissait quatre. Deux écrans, deux
 * vérités, et un commercial qui ne sait plus laquelle compte.
 *
 * Partager le composant, et pas seulement la liste des valeurs, est ce qui
 * empêche la divergence de revenir : un bouton ajouté ici apparaît des deux
 * côtés, avec la même couleur et le même libellé.
 */

function Choix({
  valeur,
  label,
  couleur,
  actif,
  onChoisir,
  disabled,
}: {
  valeur: string;
  label: string;
  couleur: string;
  actif: boolean;
  onChoisir: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={actif}
      onClick={() => onChoisir(valeur)}
      className="crm-gros-choix"
      style={
        actif
          ? {
              /* La couleur ne porte jamais seule : le libellé est écrit à
                 côté, et c'est l'état pressé qui fait foi pour un lecteur
                 d'écran. */
              background: `var(${couleur})`,
              borderColor: `var(${couleur})`,
              color: "var(--crm-acq-sur-etape)",
            }
          : { borderColor: `var(${couleur})` }
      }
    >
      {label}
    </button>
  );
}

/** Les sept étapes de traitement, dans l'ordre du pipeline. */
export function ChoixEtape({
  valeur,
  onChoisir,
  disabled,
}: {
  valeur: string | null;
  onChoisir: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="crm-grille crm-grille--3">
      {ETAPES.map((e) => (
        <Choix
          key={e.valeur}
          valeur={e.valeur}
          label={e.label}
          couleur={
            e.valeur === "mauvais_numero" ? "--crm-acq-mauvais_numero" : e.couleur
          }
          actif={valeur === e.valeur}
          disabled={disabled}
          /* Recliquer sur l'étape courante l'annule : c'est la seule façon de
             revenir sur un choix sans sauvegarder une valeur qu'on ne voulait
             pas. */
          onChoisir={(v) => onChoisir(valeur === v ? null : v)}
        />
      ))}
    </div>
  );
}

/** Les quatre qualifications. */
export function ChoixQualification({
  valeur,
  onChoisir,
  disabled,
}: {
  valeur: string | null;
  onChoisir: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="crm-grille crm-grille--3">
      {QUALIFICATIONS.map((q) => (
        <Choix
          key={q.valeur}
          valeur={q.valeur}
          label={q.label}
          couleur={q.couleur}
          actif={valeur === q.valeur}
          disabled={disabled}
          onChoisir={(v) => onChoisir(valeur === v ? null : v)}
        />
      ))}
    </div>
  );
}
