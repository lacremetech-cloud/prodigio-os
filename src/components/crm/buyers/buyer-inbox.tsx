"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Chip, EmptyState } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { useRouter } from "next/navigation";
import { ContactRapide } from "./contact-rapide";
import { fileDAppels, positionDansLaFile, suivantDansLaFile } from "@/modules/buyers/crm/file-appels";
import { PanneauTraitement } from "./panneau-traitement";
import {
  QUALIFICATION_BADGE,
  QUALIFICATION_LABELS,
  QUALIFICATION_TEINTE,
} from "@/modules/buyers/crm/qualification";
import { BadgeProjet } from "./barre-projets";
import { BarreFiltres } from "./barre-filtres";
import { numeroAppelable } from "@/modules/buyers/crm/telephone";
import { formatDateTime } from "@/modules/crm/format";
import { buyerStageVisual } from "@/modules/buyers/crm/labels";
import {
  BUDGET_CHOICE_COURT,
  type BuyerBudgetChoice,
} from "@/modules/buyers/funnel/universal";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import {
  FILTRES_AVANCES_VIDES,
  filtrer,
  type Echeance,
  type FiltresAvances,
  type Signal,
} from "@/modules/buyers/crm/filtres";

/**
 * Boîte de réception opérationnelle des acquéreurs.
 *
 * Recherche, filtres, compteurs réels et tri sont appliqués **en mémoire** sur
 * les dossiers déjà autorisés par la RLS : aucun filtre ne peut élargir la
 * visibilité, il ne fait que restreindre ce que l'utilisateur voit déjà.
 *
 * Les signaux visuels ne reposent jamais sur la seule couleur : chaque signal
 * porte une icône et un libellé.
 */

type SortKey = "urgence" | "arrivee" | "activite";

/**
 * Poids d'urgence : ce qui remonte un dossier quand on trie « par urgence ».
 *
 * Le score du formulaire et la recommandation qui en dérivait pesaient ici.
 * Ils ont été retirés : un chiffre calculé à l'inscription ne dit rien de
 * l'urgence d'un rappel promis pour hier, et il mettait devant des dossiers
 * que personne n'avait jugés. Le jugement du commercial, lui, compte.
 */
function urgency(row: BuyerInboxRow): number {
  let w = 0;
  if (row.overdue) w += 8;
  if (row.newInterest) w += 5;
  if (row.unassigned) w += 4;
  if (row.noNextAction) w += 3;
  if (row.qualification === "gros_potentiel") w += 2;
  return w;
}

export function BuyerInbox({
  rows,
  members,
  signalInitial = "tous",
  echeanceInitiale = "toutes",
  montrerProjet = true,
  contexte = "",
  chargeA,
}: {
  rows: BuyerInboxRow[];
  members: { userId: string; name: string }[];
  /** Signal pre-selectionne, lu dans l'URL par la page serveur. */
  signalInitial?: Signal;
  /** Affinage de « A rappeler », lu dans l'URL (tuiles du tableau de bord). */
  echeanceInitiale?: Echeance;
  /** Afficher le badge de projet sur chaque ligne. */
  montrerProjet?: boolean;
  /**
   * Selection courante, recopiee dans chaque lien de fiche : c'est ainsi que
   * le retour depuis une fiche retrouve le projet et la vue. Un etat garde en
   * memoire aurait ete efface par l'aller-retour.
   */
  contexte?: string;
  /** Instant de chargement, fourni par le serveur : voir `maintenant`. */
  chargeA: string;
}) {
  const [signal, setSignal] = useState<Signal>(signalInitial);
  const [echeance, setEcheance] = useState<Echeance>(echeanceInitiale);
  const [search, setSearch] = useState("");

  /*
   * Le dossier ouvert dans le panneau, et l'ORDRE DE LA FILE figé au moment où
   * la session d'appels démarre.
   *
   * Figer l'ordre n'est pas un détail : le dossier qu'on vient d'enregistrer
   * sort de la file (il a désormais un rappel futur), toutes les positions
   * glissent d'un cran, et « suivant » sauterait un dossier sans que personne
   * ne le remarque.
   */
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [ordreFile, setOrdreFile] = useState<string[]>([]);
  const router = useRouter();

  /* Le panneau y tient a jour « il y a une saisie non enregistree ». C'est ICI
     qu'on change de dossier, donc c'est ici qu'il faut prevenir — une note
     dictee au telephone et perdue en changeant de ligne, et l'outil est
     abandonne le jour meme. */
  const saleRef = useRef(false);

  /* Sur telephone, « Trier » et « Filtres » ouvrent une feuille. Les laisser
     deplies poussait le premier lead a 1211 px du haut d'un ecran de 740 :
     une page entiere et demie de reglages avant le moindre dossier. */
  const [feuille, setFeuille] = useState<"aucune" | "trier" | "filtres">("aucune");

  /** Vrai si l'on peut quitter le dossier ouvert : sinon on demande. */
  function peutQuitter(): boolean {
    if (!saleRef.current) return true;
    return window.confirm(
      "Vous avez une saisie non enregistrée sur ce dossier. La perdre ?",
    );
  }
  /* Les quatre filtres replies tiennent dans UN etat : ils s'appliquent et se
     remettent a zero ensemble, et la feuille mobile n'a qu'une chose a
     recopier pour proposer « Annuler ». */
  const [avances, setAvances] = useState<FiltresAvances>(FILTRES_AVANCES_VIDES);

  const [sort, setSort] = useState<SortKey>("urgence");

  /* L'instant de reference vient du SERVEUR (`chargeA`). Lire l'horloge
     pendant le rendu donnerait un « aujourd'hui » different au serveur et au
     navigateur — et un rendu non reproductible, que React refuse a juste
     titre. La recherche porte sur ce qui est AFFICHE : une coordonnee masquee
     n'est pas interrogeable, elle n'a jamais quitte le serveur. */
  const maintenant = Date.parse(chargeA);

  const visible = useMemo(() => {
    const retenus = filtrer(rows, { signal, echeance, recherche: search, avances }, maintenant);
    const sorted = [...retenus];
    if (sort === "urgence") {
      sorted.sort((a, b) => urgency(b) - urgency(a) || a.createdAt.localeCompare(b.createdAt));
    } else if (sort === "arrivee") {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      sorted.sort((a, b) => (b.lastInterestAt ?? "").localeCompare(a.lastInterestAt ?? ""));
    }
    return sorted;
  }, [rows, search, avances, sort, signal, echeance, maintenant]);

  /**
   * La file d'appels porte sur ce qui est À L'ÉCRAN : filtrer par projet ou par
   * qualification doit restreindre la session, sinon « commencer les appels »
   * ramène les dossiers qu'on venait justement d'écarter.
   */
  const file = useMemo(() => fileDAppels(visible, maintenant), [visible, maintenant]);

  const rowOuverte = useMemo(
    () => visible.find((r) => (r.interestId ?? r.buyerProfileId) === ouvert) ?? null,
    [visible, ouvert],
  );
  const { position, total: totalFile } = positionDansLaFile(ordreFile, ouvert);

  /** Ouvrir un dossier à la main démarre une file : celle de l'écran. */
  function ouvrir(row: BuyerInboxRow) {
    const cle = row.interestId ?? row.buyerProfileId;
    if (cle === ouvert) return;
    if (!peutQuitter()) return;
    if (ordreFile.length === 0) {
      setOrdreFile(file.map((r) => r.interestId ?? r.buyerProfileId));
    }
    setOuvert(cle);
  }

  /** « Commencer les appels » : on repart du haut d'une file fraîche. */
  function commencerLesAppels() {
    if (!peutQuitter()) return;
    const ordre = file.map((r) => r.interestId ?? r.buyerProfileId);
    setOrdreFile(ordre);
    setOuvert(ordre[0] ?? null);
  }


  return (
    <div className="flex flex-col gap-3">
      <BarreFiltres
        dossiers={rows}
        members={members}
        maintenant={maintenant}
        signal={signal}
        setSignal={setSignal}
        echeance={echeance}
        setEcheance={setEcheance}
        recherche={search}
        setRecherche={setSearch}
        avances={avances}
        setAvances={setAvances}
        feuilleOuverte={feuille === "filtres"}
        setFeuilleOuverte={(v) => setFeuille(v ? "filtres" : "aucune")}
        tri={
          <>
            <label className="hidden items-center gap-1.5 sm:flex">
              <span className="crm-label shrink-0">Trier par</span>
              <select
                className="crm-select text-xs"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="urgence">Urgence</option>
                <option value="arrivee">Date d’arrivée</option>
                <option value="activite">Dernière activité</option>
              </select>
            </label>
            <button
              type="button"
              className="crm-commande sm:hidden"
              onClick={() => setFeuille("trier")}
              aria-haspopup="dialog"
            >
              Trier
            </button>
          </>
        }
      />

      {/* La session d'appels : combien de dossiers attendent, et par où
          commencer. Sans ce point d'entrée, « qui j'appelle maintenant » se
          rejoue à chaque fois dans la tête du commercial. */}
      {file.length > 0 ? (
        <div className="crm-session">
          <p className="crm-session__texte">
            <strong>{file.length}</strong> dossier{file.length > 1 ? "s" : ""} à appeler
            maintenant
            <span className="crm-session__detail">
              {" "}
              · retards et rappels du jour en premier, puis les nouveaux
            </span>
          </p>
          <button type="button" className="crm-btn crm-btn--primaire" onClick={commencerLesAppels}>
            Commencer les appels
          </button>
        </div>
      ) : null}

      <p className="text-xs text-[var(--crm-text-dim)]" role="status" aria-live="polite">
        {visible.length} dossier{visible.length > 1 ? "s" : ""} affiché
        {visible.length > 1 ? "s" : ""} sur {rows.length}.
        {signal !== "tous" ? (
          <>
            {" "}
            <button
              type="button"
              onClick={() => setSignal("tous")}
              className="font-semibold text-[var(--crm-univers)] underline underline-offset-2"
            >
              Retirer le filtre
            </button>
          </>
        ) : null}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          /* Rien du tout n’est different de « vos filtres cachent tout » : le
             premier ne se corrige pas en touchant aux filtres. */
          title={
            rows.length === 0
              ? "Aucun acquéreur pour l’instant."
              : "Aucun dossier acquéreur ne correspond."
          }
          hint={
            rows.length === 0
              ? "Les acquéreurs apparaissent ici dès leur première manifestation d’intérêt sur une page publique."
              : "Ajustez la recherche ou les filtres."
          }
          icon="◉"
        />
      ) : (
        <>
          {/* Dit une fois ce que chaque colonne contient, plutot que de le
              repeter sur chaque ligne. Masque en pile, ou les en-tetes
              reviennent devant chaque valeur. */}
          <div className="crm-liste__entetes" aria-hidden>
            <span>Acquéreur et bien</span>
            <span>Budget déclaré</span>
            <span>Responsable</span>
            <span>Prochaine action</span>
            <span>Qualification</span>
            <span>Étape</span>
            <span>Contact</span>
          </div>
        <ul className="crm-liste">
          {visible.map((row) => (
            <BuyerRow
              key={row.interestId ?? row.buyerProfileId}
              row={row}
              montrerProjet={montrerProjet}
              contexte={contexte}
              onOuvrir={ouvrir}
              actif={ouvert === (row.interestId ?? row.buyerProfileId)}
            />
          ))}
        </ul>
        </>
      )}

      {/* --- Feuille « Trier » (telephone) ---------------------------------
          Les filtres ont la leur, dans la barre partagee. Celle-ci ne porte
          que le tri, que le Kanban n'a pas. */}
      {feuille === "trier" ? (
        <div className="crm-feuille" role="dialog" aria-modal="true" aria-label="Trier">
          <button
            type="button"
            className="crm-feuille__fond"
            aria-label="Fermer"
            onClick={() => setFeuille("aucune")}
          />
          <div className="crm-feuille__corps">
            <div className="crm-feuille__tete">
              <h2 className="crm-feuille__titre">Trier</h2>
              <button type="button" className="crm-panneau__fermer" aria-label="Fermer"
                      onClick={() => setFeuille("aucune")}>
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {([
                ["urgence", "Urgence"],
                ["arrivee", "Date d’arrivée"],
                ["activite", "Dernière activité"],
              ] as [SortKey, string][]).map(([v, libelle]) => (
                <button
                  key={v}
                  type="button"
                  className="crm-feuille__option"
                  aria-pressed={sort === v}
                  onClick={() => {
                    setSort(v);
                    setFeuille("aucune");
                  }}
                >
                  {libelle}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {rowOuverte ? (
        <PanneauTraitement
          /* La CLÉ porte la remise à zéro : changer de dossier remonte le
             panneau, donc aucune saisie du précédent ne peut survivre. */
          key={ouvert}
          row={rowOuverte}
          position={position}
          total={totalFile}
          resteUnSuivant={suivantDansLaFile(ordreFile, ouvert) !== null}
          saleRef={saleRef}
          contexte={contexte}
          onFermer={() => {
            if (peutQuitter()) setOuvert(null);
          }}
          /* `router.refresh()` recharge les DONNÉES de la page sans rien
             démonter : la liste reste à l'écran, les filtres et la position de
             défilement sont conservés. */
          onEnregistre={() => router.refresh()}
          onSuivant={() => setOuvert(suivantDansLaFile(ordreFile, ouvert))}
        />
      ) : null}
    </div>
  );
}



/**
 * `phoneMasked` porte le vrai numero quand le role a le droit de le voir, et
 * « •••• masque » sinon. Les boutons d'appel n'ont donc de sens que sur une
 * valeur reellement lisible.
 */
/** Valeur absente : on le DIT, plutot que de laisser une case vide. */
function Manque({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--crm-text-faint)]">{children}</span>;
}

/**
 * Une ligne de dossier.
 *
 * C'etait une grande carte empilee : trois dossiers remplissaient l'ecran, et
 * les informations qu'on compare — budget, responsable, prochaine action — se
 * lisaient a des hauteurs differentes d'une carte a l'autre. Ce sont desormais
 * des COLONNES alignees : l'oeil descend une colonne au lieu de fouiller
 * chaque carte.
 *
 * Sous `lg`, la grille se replie en pile : sur telephone, une ligne de tableau
 * ne se lit pas.
 */
function BuyerRow({
  row,
  montrerProjet,
  contexte,
  onOuvrir,
  actif,
}: {
  row: BuyerInboxRow;
  montrerProjet: boolean;
  contexte: string;
  /** Ouvre le panneau de traitement, SANS quitter la liste. */
  onOuvrir: (row: BuyerInboxRow) => void;
  actif: boolean;
}) {
  const stageV = buyerStageVisual(row.stage);
  const appelable = numeroAppelable(row.phoneMasked);
  // Forme COURTE en liste : le libelle long est la question telle qu'elle a ete
  // posee, il passait sur deux lignes et poussait tout le reste.
  const budget = row.budgetChoice
    ? BUDGET_CHOICE_COURT[row.budgetChoice as BuyerBudgetChoice] ?? row.budgetChoice
    : null;

  /* La TEINTE de la ligne dit la qualification, et rien d'autre. Elle disait
     auparavant « en retard » : un gros potentiel qui n'avait pas decroche
     virait au rouge, et le commercial rappelait les mauvaises personnes. */
  const teinte = QUALIFICATION_TEINTE[row.qualification];

  return (
    <li
      className={`crm-ligne${teinte ? ` crm-ligne--${teinte}` : ""}${actif ? " crm-ligne--actif" : ""}`}
      onClick={() => onOuvrir(row)}
    >
      {/* Identite, coordonnees et projet. Les coordonnees se lisent ICI :
          avoir a ouvrir une fiche pour retrouver un numero, c'est un clic et
          un retour a chaque appel. */}
      <div className="min-w-0">
        {/* Le NOM mene a la fiche complete ; le reste de la ligne ouvre le
            panneau. Sans ce `stopPropagation`, un clic sur le nom ferait les
            deux a la fois. */}
        <Link
          href={`/crm/acquereurs/${row.buyerProfileId}${contexte}`}
          prefetch={false}
          onClick={(e) => e.stopPropagation()}
          className="crm-wrap relative z-10 text-[15px] font-bold text-[var(--crm-text)] outline-none hover:text-[var(--crm-azur)]"
        >
          {row.name}
        </Link>

        <div className="crm-coord mt-1">
          {row.phoneMasked ? (
            appelable ? (
              <a
                href={`tel:${appelable}`}
                onClick={(e) => e.stopPropagation()}
                className="crm-coord__lien"
                title={`Appeler le ${row.phoneMasked}`}
              >
                {row.phoneMasked}
              </a>
            ) : (
              <span>{row.phoneMasked}</span>
            )
          ) : null}
          {row.emailMasked ? (
            row.emailMasked.includes("@") && !row.emailMasked.includes("•") ? (
              <a
                href={`mailto:${row.emailMasked}`}
                onClick={(e) => e.stopPropagation()}
                className="crm-coord__lien crm-ellipsis"
                title={`Écrire à ${row.emailMasked}`}
              >
                {row.emailMasked}
              </a>
            ) : (
              <span className="crm-ellipsis">{row.emailMasked}</span>
            )
          ) : null}
        </div>

        {/* Le projet, en badge lisible, quand plusieurs sont a l'ecran : sans
            lui, deux lignes de la meme personne sur deux projets seraient
            indiscernables. Le nom est ECRIT — la couleur ne fait qu'aider. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {montrerProjet ? (
            <BadgeProjet propertyId={row.propertyId} label={row.propertyLabel} />
          ) : null}
          {!montrerProjet && row.city ? (
            <span className="text-[12.5px] text-[var(--crm-text-dim)]">{row.city}</span>
          ) : null}
          {!row.propertyLabel ? (
            <span className="text-[12.5px] text-[var(--crm-text-faint)]">
              Aucun projet rattaché
            </span>
          ) : null}
          {row.overdue ? <Chip variant="danger">En retard</Chip> : null}
        </div>
      </div>

      {/* Budget declare */}
      <div className="crm-ligne__col min-w-0">
        <span className="crm-ligne__ent">Budget</span>
        {budget ? (
          <span className="crm-wrap text-[13px] font-semibold text-[var(--crm-text)]">{budget}</span>
        ) : (
          <Manque>Non renseigné</Manque>
        )}
      </div>

      {/* Responsable */}
      <div className="crm-ligne__col min-w-0">
        <span className="crm-ligne__ent">Responsable</span>
        {row.assigneeNames.length > 0 ? (
          <span className="crm-ellipsis text-[13px] text-[var(--crm-text)]">
            {row.assigneeNames.join(", ")}
          </span>
        ) : (
          <Manque>Non affecté</Manque>
        )}
      </div>

      {/* Prochaine action */}
      <div className="crm-ligne__col min-w-0">
        <span className="crm-ligne__ent">Prochaine action</span>
        {row.nextActionTitle ? (
          <>
            <span className="crm-ellipsis text-[13px] text-[var(--crm-text)]">
              {row.nextActionTitle}
            </span>
            {row.nextActionAt ? (
              <span
                className={`text-[11.5px] ${
                  row.overdue
                    ? "font-semibold text-[var(--crm-danger)]"
                    : "text-[var(--crm-text-faint)]"
                }`}
              >
                {formatDateTime(row.nextActionAt)}
              </span>
            ) : null}
          </>
        ) : (
          <Manque>À programmer</Manque>
        )}
      </div>

      {/* Qualification : le jugement commercial, toujours ecrit, jamais
          seulement une couleur. */}
      <div className="crm-ligne__col">
        <span className="crm-ligne__ent">Qualification</span>
        <span className={`crm-qualif crm-qualif--${QUALIFICATION_BADGE[row.qualification]} w-fit`}>
          {QUALIFICATION_LABELS[row.qualification]}
        </span>
        {row.callAttempts > 0 ? (
          <span className="text-[11.5px] text-[var(--crm-text-faint)]">
            {row.callAttempts} tentative{row.callAttempts > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {/* Etape */}
      <div className="crm-ligne__col">
        <span className="crm-ligne__ent">Étape</span>
        <span
          className="crm-chip crm-chip--accent w-fit"
          style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(stageV.cssVar) } as CSSProperties}
        >
          <span aria-hidden>{stageV.icon}</span>
          {stageV.label}
        </span>
      </div>

      {/* Contact */}
      <div className="crm-ligne__col">
        <span className="crm-ligne__ent">Contact</span>
        {appelable || row.emailMasked ? (
          <ContactRapide
            numero={appelable}
            email={
              row.emailMasked && row.emailMasked.includes("@") && !row.emailMasked.includes("•")
                ? row.emailMasked
                : null
            }
            compact
          />
        ) : (
          <Manque>Aucune coordonnée</Manque>
        )}
      </div>
    </li>
  );
}
