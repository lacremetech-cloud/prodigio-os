"use client";

import { useEffect, useId, useRef, useState } from "react";

import { ACTIVITES, ETAPES, QUALIFICATIONS } from "@/modules/buyers/crm/vocabulaire";

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

interface OptionVocabulaire {
  valeur: string;
  label: string;
  couleur: string;
  encre?: string;
}

/**
 * UN SÉLECTEUR COMPACT, PAS UNE GRILLE PERMANENTE.
 *
 * Les sept étapes et les quatre qualifications occupaient deux grilles
 * toujours dépliées, soit onze boutons affichés en permanence au-dessus du
 * formulaire. Sur un portable, la dernière note et la prochaine tâche
 * passaient sous la ligne de flottaison : le commercial faisait défiler
 * onze boutons pour atteindre ce qu'il devait LIRE avant d'appeler.
 *
 * Ici, une pastille montre la valeur en cours ; les choix n'apparaissent qu'au
 * clic, avec leurs couleurs. Les deux axes restent SÉPARÉS et toujours
 * visibles : ils ne sont ni fusionnés, ni relégués dans un menu secondaire.
 *
 * DEUX VALEURS, ET C'EST VOULU.
 *   • `actuelle` est ce qui est ENREGISTRÉ. La pastille l'affiche tant que
 *     rien n'est en attente.
 *   • `valeur` est la modification PAS ENCORE SAUVEGARDÉE, ou `null`.
 * Les confondre ferait mentir la pastille : elle annoncerait comme acquis un
 * choix que personne n'a encore enregistré. Quand les deux diffèrent, la
 * pastille le dit — « modifié » — au lieu de laisser croire que c'est fait.
 *
 * Rechoisir la valeur enregistrée annule la modification plutôt que de
 * l'écraser avec elle-même : c'est la seule façon de revenir en arrière sans
 * sauvegarder un choix qu'on ne voulait pas.
 */
export function SelecteurCompact({
  libelle,
  options,
  actuelle,
  valeur,
  onChoisir,
  disabled,
}: {
  libelle: string;
  options: readonly OptionVocabulaire[];
  actuelle: string;
  valeur: string | null;
  onChoisir: (v: string | null) => void;
  disabled?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const idListe = useId();

  const effective = valeur ?? actuelle;
  const modifie = valeur !== null && valeur !== actuelle;
  const choisie = options.find((o) => o.valeur === effective);

  /* Fermer au clic extérieur ET à Échap. Sans la seconde, un sélecteur ouvert
     par erreur piège le clavier : la seule sortie serait la souris. */
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuvert(false);
        bouton.current?.focus();
      }
    };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  return (
    <div className="crm-selecteur" ref={boite}>
      <button
        ref={bouton}
        type="button"
        disabled={disabled}
        className="crm-selecteur__pastille"
        aria-label={`${libelle} : ${choisie?.label ?? effective}`}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idListe : undefined}
        onClick={() => setOuvert((v) => !v)}
        style={
          choisie
            ? {
                background: `var(${choisie.couleur})`,
                borderColor: `var(${choisie.couleur})`,
                color: `var(${choisie.encre ?? "--crm-acq-sur-etape"})`,
              }
            : undefined
        }
      >
        <span className="crm-selecteur__libelle">{libelle}</span>
        <span className="crm-selecteur__valeur">{choisie?.label ?? effective}</span>
        {modifie ? <span className="crm-selecteur__modifie">modifié</span> : null}
        <span aria-hidden className="crm-selecteur__fleche">
          ▾
        </span>
      </button>

      {ouvert ? (
        <ul className="crm-selecteur__liste" id={idListe} role="listbox" aria-label={libelle}>
          {options.map((o) => {
            const retenue = o.valeur === effective;
            return (
              <li key={o.valeur} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={retenue}
                  className="crm-selecteur__option"
                  onClick={() => {
                    /* Rechoisir la valeur enregistrée = annuler la
                       modification, pas la réécrire. */
                    onChoisir(o.valeur === actuelle ? null : o.valeur);
                    setOuvert(false);
                    bouton.current?.focus();
                  }}
                >
                  <span
                    aria-hidden
                    className="crm-selecteur__puce"
                    style={{ background: `var(${o.couleur})` }}
                  />
                  {o.label}
                  {retenue ? (
                    <span aria-hidden className="crm-selecteur__coche">
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Les sept étapes de traitement, dans l'ordre du pipeline. */
export function ChoixEtape({
  valeur,
  actuelle,
  onChoisir,
  disabled,
}: {
  valeur: string | null;
  actuelle: string;
  onChoisir: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <SelecteurCompact
      libelle="Étape"
      options={ETAPES}
      actuelle={actuelle}
      valeur={valeur}
      onChoisir={onChoisir}
      disabled={disabled}
    />
  );
}

/** Les quatre qualifications. */
export function ChoixQualification({
  valeur,
  actuelle,
  onChoisir,
  disabled,
}: {
  valeur: string | null;
  actuelle: string;
  onChoisir: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <SelecteurCompact
      libelle="Qualification"
      options={QUALIFICATIONS}
      actuelle={actuelle}
      valeur={valeur}
      onChoisir={onChoisir}
      disabled={disabled}
    />
  );
}

/**
 * Le bloc « Ajouter une activité », partagé par le panneau et la fiche.
 *
 * Il remplace « Résultat de l'appel » et « Type / Résultat de l'échange », qui
 * décrivaient le même fait avec des mots différents selon l'écran.
 *
 * La DATE est préremplie à maintenant et modifiable, parce qu'on note souvent
 * un appel après coup : dater la note de l'heure de saisie décalerait toute la
 * chronologie du dossier. La date de saisie, elle, est enregistrée à part et
 * ne bouge pas.
 */
export function BlocActivite({
  activite,
  onActivite,
  quand,
  onQuand,
  note,
  onNote,
  disabled,
}: {
  activite: string | null;
  onActivite: (v: string | null) => void;
  quand: string;
  onQuand: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Sept activités en grille de boutons de 42 px, c'étaient quatre
          rangées — et la note, puis la suite à donner, repoussées hors de
          l'écran sur un portable. En pastilles qui s'enroulent, le même choix
          tient en deux rangées, sans rien retirer ni rien cacher. */}
      <div className="crm-puces" role="group" aria-label="Ce qui s'est passé">
        {ACTIVITES.map((a) => (
          <button
            key={a.valeur}
            type="button"
            disabled={disabled}
            aria-pressed={activite === a.valeur}
            onClick={() => onActivite(activite === a.valeur ? null : a.valeur)}
            className="crm-puce-choix"
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* La date n'apparaît qu'une fois l'activité choisie : un champ qui
          attend sans servir fait croire qu'il manque une réponse. */}
      {activite ? (
        <label className="flex flex-col gap-1">
          <span className="crm-label">Date et heure</span>
          <input
            type="datetime-local"
            className="crm-input"
            value={quand}
            max={maintenantLocal()}
            disabled={disabled}
            onChange={(e) => onQuand(e.target.value)}
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="crm-label">Note {activite ? "(facultative)" : ""}</span>
        <textarea
          className="crm-input min-h-[72px]"
          placeholder="Ce qui s'est dit, ce qu'il faut retenir…"
          value={note}
          disabled={disabled}
          onChange={(e) => onNote(e.target.value)}
        />
      </label>
    </div>
  );
}

/** « maintenant » au format d'un champ datetime-local, heure de Paris. */
export function maintenantLocal(): string {
  const d = new Date();
  const p = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}

/** `datetime-local` veut une heure locale sans fuseau ; l'ISO en porte un. */
export function versChampLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** L'inverse : ce que le champ contient, en ISO, pour la base. */
export function depuisChampLocal(valeur: string): string | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Dans N jours, à 10 h — l'heure à laquelle on rappelle vraiment. */
export function dansNJours(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return versChampLocal(d.toISOString());
}

export type TypeProchaineAction = "aucune" | "rappel" | "visite" | "tache";

export const LABELS_PROCHAINE_ACTION: Record<TypeProchaineAction, string> = {
  aucune: "Aucune",
  rappel: "Rappeler",
  visite: "Visite",
  tache: "Tâche",
};

/**
 * « Prochaine action » — échéance et responsable, le même bloc des deux côtés.
 *
 * Il est ici, à côté de l'activité, parce qu'il part dans la MÊME sauvegarde :
 * ce qui vient de se passer et ce qu'on s'engage à faire ensuite sont deux
 * faits d'un seul traitement. Les enregistrer séparément laissait la porte
 * ouverte à l'échec partiel — activité écrite, rappel perdu — c'est-à-dire au
 * dossier qu'on croit suivi et que personne ne rappelle.
 *
 * Le responsable est explicite et non déduit : un commercial qui prend l'appel
 * d'un dossier qui n'est pas le sien doit pouvoir rendre le rappel à son
 * titulaire sans passer par l'attribution du dossier entier.
 */
export function BlocProchaineAction({
  type,
  onType,
  quand,
  onQuand,
  titre,
  onTitre,
  responsable,
  onResponsable,
  membres,
  disabled,
}: {
  type: TypeProchaineAction;
  onType: (t: TypeProchaineAction) => void;
  quand: string;
  onQuand: (v: string) => void;
  /** Intitulé libre, utile pour « Tâche » ; déduit pour rappel et visite. */
  titre?: string;
  onTitre?: (v: string) => void;
  responsable: string | null;
  onResponsable: (v: string | null) => void;
  /** Vide = l'équipe n'est pas connue de cet écran : on n'affiche pas le champ
      plutôt que d'afficher un menu vide qui ressemble à une panne. */
  membres: { userId: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="crm-grille crm-grille--2">
        {(Object.keys(LABELS_PROCHAINE_ACTION) as TypeProchaineAction[]).map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            className="crm-gros-choix"
            aria-pressed={type === t}
            onClick={() => onType(t)}
          >
            {LABELS_PROCHAINE_ACTION[t]}
          </button>
        ))}
      </div>

      {/* La date n'apparaît QUE si une action est choisie. Un champ de date
          toujours visible se remplit par réflexe, et l'agenda se couvre de
          rappels que personne n'a voulus. */}
      {type !== "aucune" ? (
        <div className="flex flex-col gap-2">
          {type === "rappel" ? (
            <div className="crm-grille crm-grille--3">
              <button type="button" className="crm-petit-choix" disabled={disabled} onClick={() => onQuand(dansNJours(1))}>
                Demain
              </button>
              <button type="button" className="crm-petit-choix" disabled={disabled} onClick={() => onQuand(dansNJours(3))}>
                3 jours
              </button>
              <button type="button" className="crm-petit-choix" disabled={disabled} onClick={() => onQuand(dansNJours(7))}>
                1 semaine
              </button>
            </div>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="crm-label">Échéance</span>
            <input
              type="datetime-local"
              className="crm-input"
              value={quand}
              disabled={disabled}
              onChange={(e) => onQuand(e.target.value)}
            />
          </label>

          {type === "tache" && onTitre ? (
            <label className="flex flex-col gap-1">
              <span className="crm-label">Intitulé</span>
              <input
                type="text"
                className="crm-input"
                value={titre ?? ""}
                disabled={disabled}
                placeholder="Envoyer le plan de masse…"
                onChange={(e) => onTitre(e.target.value)}
              />
            </label>
          ) : null}

          {membres.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="crm-label">Responsable</span>
              <select
                className="crm-select"
                value={responsable ?? ""}
                disabled={disabled}
                onChange={(e) => onResponsable(e.target.value || null)}
              >
                {/* Par défaut : la personne qui enregistre. C'est le cas
                    courant, et laisser le choix vide évite d'affecter
                    quelqu'un d'autre par inattention. */}
                <option value="">Moi</option>
                {membres.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {type === "visite" ? (
            <p className="text-[11px] text-[var(--crm-text-faint)]">
              Planifier la visite fait passer ce dossier à l’étape « Visite planifiée ».
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * « Sur quel bien ? » — une PRÉCISION, pas un préalable.
 *
 * Par défaut « Général / Tous les biens ». L'activité appartient d'abord à la
 * personne : on parle à quelqu'un, et seulement parfois d'un bien en
 * particulier. Exiger un bien obligeait à saisir deux activités pour un seul
 * appel qui parlait de deux villas — ou, bien plus souvent, à n'en saisir
 * qu'une et à perdre la moitié de ce qui s'était dit.
 *
 * Le menu ne s'affiche que s'il y a un choix à faire : sur une personne qui ne
 * suit qu'un bien, « Général » et « Villa Verdun » désignent la même
 * conversation, et le champ ne ferait que ralentir.
 */
export function ChoixProjet({
  valeur,
  onChoisir,
  projets,
  requis,
  disabled,
}: {
  /** `null` = général, rattaché à la personne. */
  valeur: string | null;
  onChoisir: (v: string | null) => void;
  projets: { interestId: string; label: string }[];
  /** Vrai quand une visite est en cours de planification : là, il en faut un. */
  requis?: boolean;
  disabled?: boolean;
}) {
  if (projets.length < 2 && !requis) return null;

  return (
    <label className="flex flex-col gap-1">
      <span className="crm-label">Bien concerné</span>
      <select
        className="crm-select"
        value={valeur ?? ""}
        disabled={disabled}
        onChange={(e) => onChoisir(e.target.value || null)}
      >
        {/* Absent quand un bien est exigé : proposer « Général » pour le voir
            refusé à l'enregistrement serait une fausse promesse. */}
        {requis ? (
          <option value="">Choisir le bien…</option>
        ) : (
          <option value="">Général / Tous les biens</option>
        )}
        {projets.map((p) => (
          <option key={p.interestId} value={p.interestId}>
            {p.label}
          </option>
        ))}
      </select>
      {requis && !valeur ? (
        <span className="text-[11px] text-[var(--crm-text-faint)]">
          Une visite se rattache à un bien précis.
        </span>
      ) : null}
    </label>
  );
}
