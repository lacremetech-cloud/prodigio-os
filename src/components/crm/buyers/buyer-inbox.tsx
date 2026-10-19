"use client";

import { useMemo, useRef, useState } from "react";
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
import { numeroAppelable } from "@/modules/buyers/crm/telephone";
import { formatDateTime, formatJour } from "@/modules/crm/format";
import {
  buyerStageLabels,
  buyerStageVisual,
  BUYER_PIPELINE_STAGES,
} from "@/modules/buyers/crm/labels";
import {
  BUDGET_CHOICE_COURT,
  type BuyerBudgetChoice,
} from "@/modules/buyers/funnel/universal";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import { FILTRES_RAPIDES, porteLeSignal, type Signal } from "@/modules/buyers/crm/signaux";
/* Re-exportes pour les appelants historiques (dont les tests) : le vocabulaire
   lui-meme vit desormais dans un module, pour que la page pipeline — un
   composant SERVEUR — puisse filtrer avec exactement les memes tranches. */
export { BUDGET_FILTERS, budgetCorrespond } from "@/modules/buyers/crm/budget";
import { BUDGET_FILTERS, budgetCorrespond } from "@/modules/buyers/crm/budget";

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

/**
 * `arrivee` va du plus RECENT au plus ancien, `arrivee_ancienne` l'inverse.
 *
 * Les deux servent, et pas aux memes moments : le plus recent d'abord pour
 * traiter ce qui vient de tomber, le plus ancien d'abord pour retrouver ceux
 * qui attendent depuis trois semaines. Un seul sens obligeait a lire la liste
 * a l'envers de tete.
 */
type SortKey = "urgence" | "arrivee" | "arrivee_ancienne" | "activite";


function urgency(row: BuyerInboxRow): number {
  let w = 0;
  if (row.overdue) w += 8;
  if (row.newInterest) w += 5;
  if (row.unassigned) w += 4;
  if (row.noNextAction) w += 3;
  if (row.recommendedPriority === "prioritaire") w += 2;
  else if (row.recommendedPriority === "a_qualifier") w += 1;
  return w;
}

export function BuyerInbox({
  rows,
  members,
  signalInitial = "tous",
  montrerProjet = true,
  contexte = "",
  budgetInitial,
  moiUserId = null,
  peutAffecterAutrui = false,
  chargeA,
}: {
  rows: BuyerInboxRow[];
  members: { userId: string; name: string }[];
  /** Signal pre-selectionne, lu dans l'URL par la page serveur. */
  signalInitial?: Signal;
  /** Afficher le badge de projet sur chaque ligne. */
  montrerProjet?: boolean;
  /**
   * Selection courante, recopiee dans chaque lien de fiche : c'est ainsi que
   * le retour depuis une fiche retrouve le projet et la vue. Un etat garde en
   * memoire aurait ete efface par l'aller-retour.
   */
  contexte?: string;
  /**
   * Tranche de budget preselectionnee, telle qu'elle arrive dans l'URL.
   *
   * C'est ce qui permet au commercial d'atterrir directement sur les dossiers
   * au-dessus d'un million : la destination apres connexion porte
   * `?budget=plus_1m`. Une valeur inconnue ne filtre rien — la liste des
   * tranches reste ici, et une seule fois, pour qu'elle ne puisse pas deriver.
   */
  budgetInitial?: string;
  /** Mon identifiant, et mon droit de confier un dossier a autrui. */
  moiUserId?: string | null;
  peutAffecterAutrui?: boolean;
  /** Instant de chargement, fourni par le serveur : voir `maintenant`. */
  chargeA: string;
}) {
  const [signal, setSignal] = useState<Signal>(signalInitial);
  const [search, setSearch] = useState("");
  /* Replies sur telephone, deployes au-dela : voir le bloc de filtres. */
  const [filtresDeplies, setFiltresDeplies] = useState(false);

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

  /** Vrai si l'on peut quitter le dossier ouvert : sinon on demande. */
  function peutQuitter(): boolean {
    if (!saleRef.current) return true;
    return window.confirm(
      "Vous avez une saisie non enregistrée sur ce dossier. La perdre ?",
    );
  }
  const [stage, setStage] = useState<string>("tous");
  const [budget, setBudget] = useState<string>(() =>
    BUDGET_FILTERS.some((b) => b.value === budgetInitial) ? budgetInitial! : "tous",
  );
  const [owner, setOwner] = useState<string>("tous");

  const [sort, setSort] = useState<SortKey>("urgence");

  /* Un filtre replie qui filtre encore est un piege : on cherche un nom, il
     n'apparait pas, et rien a l'ecran ne dit pourquoi. La pastille porte donc
     le nombre de filtres actifs meme quand le bloc est ferme. */
  const filtresActifs =
    (stage !== "tous" ? 1 : 0) + (budget !== "tous" ? 1 : 0) + (owner !== "tous" ? 1 : 0);


  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const filtered = rows.filter((r) => {
      if (needle) {
        // La recherche porte sur ce qui est AFFICHÉ : une coordonnée masquée
        // n'est pas interrogeable (elle n'a jamais quitté le serveur).
        const hay = [
          r.name,
          r.emailMasked,
          r.phoneMasked,
          r.city,
          ...r.properties.map((p) => p.label),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (stage !== "tous" && r.stage !== stage) return false;
      if (owner !== "tous") {
        if (owner === "aucun" ? !r.unassigned : !r.assigneeIds.includes(owner)) return false;
      }
      if (budget !== "tous" && !budgetCorrespond(r, budget)) return false;
      if (!porteLeSignal(r, signal)) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sort === "urgence") {
      sorted.sort((a, b) => urgency(b) - urgency(a) || (b.bestScore ?? 0) - (a.bestScore ?? 0));
    } else if (sort === "arrivee") {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (sort === "arrivee_ancienne") {
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else {
      sorted.sort((a, b) => (b.lastInterestAt ?? "").localeCompare(a.lastInterestAt ?? ""));
    }
    return sorted;
  }, [rows, search, stage, budget, owner, sort, signal]);

  /**
   * La file d'appels porte sur ce qui est À L'ÉCRAN : filtrer par projet ou par
   * qualification doit restreindre la session, sinon « commencer les appels »
   * ramène les dossiers qu'on venait justement d'écarter.
   */
  /* L'instant de référence vient du SERVEUR (`chargeA`). Lire l'horloge
     pendant le rendu donnerait une file différente au serveur et au navigateur
     — et un rendu non reproductible, que React refuse à juste titre. */
  const maintenant = Date.parse(chargeA);
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

  /* Chaque compteur est calcule par `porteLeSignal`, EXACTEMENT la fonction
     qui filtrera la liste quand on cliquera dessus. Les deux etaient ecrits
     separement, et « Nouveaux » comptait une valeur d'etape qui n'existe plus
     depuis la reprise : il affichait zero avec treize dossiers a contacter,
     sans rien signaler. */
  const counters = useMemo(
    () => ({
      total: rows.length,
      nouveaux: rows.filter((r) => porteLeSignal(r, "a_contacter")).length,
      enRetard: rows.filter((r) => porteLeSignal(r, "en_retard")).length,
      sansAction: rows.filter((r) => porteLeSignal(r, "sans_action")).length,
      nonAffectes: rows.filter((r) => porteLeSignal(r, "non_affectes")).length,
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Compteurs reels, et cliquables : le compteur EST le filtre.

          Sur telephone ils defilent sur UNE rangee au lieu d'occuper trois
          lignes de grille. Les trois lignes coutaient 180 px avant le premier
          dossier : on arrivait sur l'ecran et on ne voyait aucun nom. */}
      <div className="crm-compteurs-file">
        <Counter label="Dossiers" value={counters.total}
                 signal="tous" actif={signal} onChoisir={setSignal} />
        <Counter label="À contacter" value={counters.nouveaux} accent="--crm-acq-a_contacter"
                 signal="a_contacter" actif={signal} onChoisir={setSignal} />
        <Counter label="En retard" value={counters.enRetard} accent="--crm-acq-pas_interesse"
                 signal="en_retard" actif={signal} onChoisir={setSignal} />
        <Counter label="Sans action" value={counters.sansAction} accent="--crm-st-a_contacter"
                 signal="sans_action" actif={signal} onChoisir={setSignal} />
      </div>

      {/* Recherche + filtres

          La recherche reste TOUJOURS visible : c'est le geste le plus fréquent.
          Le tri et les trois menus, eux, se replient sur téléphone. Dépliés,
          ils poussaient le premier dossier à plus de 700 px du haut : on
          traversait tout l'appareil de filtrage pour atteindre le premier nom,
          et le seul écran où l'on travaille vraiment en mobilité était le seul
          où l'on ne voyait personne. */}
      <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="min-w-0 sm:flex-1">
            <span className="sr-only">Rechercher un acquéreur</span>
            <input
              className="crm-input"
              type="search"
              placeholder="Rechercher (nom, e-mail, téléphone, ville…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="crm-replier sm:hidden"
            aria-expanded={filtresDeplies}
            onClick={() => setFiltresDeplies((v) => !v)}
          >
            {filtresDeplies ? "Masquer les filtres" : "Filtrer et trier"}
            {filtresActifs > 0 ? <span className="crm-replier__pastille">{filtresActifs}</span> : null}
          </button>
          <label
            className={`${filtresDeplies ? "flex" : "hidden sm:flex"} w-full min-w-0 items-center gap-1.5 sm:w-auto`}
          >
            <span className="crm-label shrink-0">Trier par</span>
            <select
              className="crm-select text-xs"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="urgence">Urgence</option>
              {/* Le SENS est ecrit. « Date d'arrivee » seul n'indiquait pas
                  lequel des deux bouts arrivait en premier. */}
              <option value="arrivee">Arrivée — plus récente d’abord</option>
              <option value="arrivee_ancienne">Arrivée — plus ancienne d’abord</option>
              <option value="activite">Dernière activité</option>
            </select>
          </label>
        </div>

        <div
          className={`${filtresDeplies ? "grid" : "hidden sm:grid"} grid-cols-1 gap-2 sm:flex sm:flex-wrap`}
        >
          <Select label="Étape" value={stage} onChange={setStage} options={[
            { value: "tous", label: "Toutes les étapes" },
            ...BUYER_PIPELINE_STAGES.map((s) => ({
              value: s as string,
              label: buyerStageLabels[s] ?? s,
            })),
          ]} />
          <Select label="Responsable" value={owner} onChange={setOwner} options={[
            { value: "tous", label: "Tous" },
            { value: "aucun", label: "Non affectés" },
            ...members.map((m) => ({ value: m.userId, label: m.name })),
          ]} />
        </div>
      </div>

      {/* Filtres rapides : une pastille, un clic, et la liste dit exactement ce
          que la pastille annonce. Ils se combinent avec les filtres detailles
          en dessous, et « Tous » les reinitialise. */}
      <div className="crm-rapides" role="group" aria-label="Filtres rapides">
        {FILTRES_RAPIDES.map((f) => {
          const n =
            f.signal === "tous" ? rows.length : rows.filter((r) => porteLeSignal(r, f.signal)).length;
          return (
            <button
              key={f.signal}
              type="button"
              className="crm-rapide"
              aria-pressed={signal === f.signal}
              onClick={() => setSignal(f.signal)}
            >
              {f.label}
              <span className="crm-rapide__n">{n}</span>
            </button>
          );
        })}
      </div>

      {/* LE BUDGET, SUR SA PROPRE RANGEE. C'etait un menu deroulant replie
          sous « Filtrer et trier » : trois clics pour une question qu'on se
          pose a chaque session. Deux axes separes, donc deux rangees — on
          croise une tranche avec « en retard » au lieu de choisir entre les
          deux. */}
      <div className="crm-rapides">
        {BUDGET_FILTERS.map((b) => {
          /* Le nombre que CETTE tranche ouvrira : croise avec le signal
             courant, mais pas avec la tranche courante — sinon toutes les
             autres afficheraient zero. */
          const n = rows.filter(
            (r) => porteLeSignal(r, signal) && budgetCorrespond(r, b.value),
          ).length;
          return (
            <button
              key={b.value}
              type="button"
              className="crm-rapide"
              aria-pressed={budget === b.value}
              onClick={() => setBudget(b.value)}
            >
              {b.label}
              <span className="crm-rapide__n">{n}</span>
            </button>
          );
        })}
      </div>

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
              onOuvrir={ouvrir}
              actif={ouvert === (row.interestId ?? row.buyerProfileId)}
            />
          ))}
        </ul>
        </>
      )}

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
          membres={members}
          moiUserId={moiUserId}
          peutAffecterAutrui={peutAffecterAutrui}
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
 * Tuile de compteur. Elle etait posee sur la surface douce, a meme la toile :
 * deux gris a un pour cent l'un de l'autre, le chiffre flottait dans le vide.
 * C'est une CARTE blanche, avec un filet de la couleur du compteur — on voit
 * la tuile, puis le chiffre, puis ce qu'il compte.
 *
 * Elle est surtout CLIQUABLE : lire « 4 en retard » sans pouvoir ouvrir les
 * quatre dossiers obligeait a aller rechercher soi-meme ce que le compteur
 * venait d'annoncer. Un second clic revient a la liste complete.
 *
 * Un compteur a zero n'est jamais mis en couleur, ni cliquable : zero « en
 * retard » est une bonne nouvelle, et un filtre qui ouvre le vide n'aide pas.
 */
function Counter({
  label,
  value,
  accent,
  signal,
  actif,
  onChoisir,
}: {
  label: string;
  value: number;
  accent?: string;
  signal: Signal;
  actif: Signal;
  onChoisir: (s: Signal) => void;
}) {
  const vif = Boolean(accent) && value > 0;
  const estActif = actif === signal && signal !== "tous";
  // « Dossiers » remet toujours la liste a plat ; les autres se decrochent.
  const cliquable = signal === "tous" ? actif !== "tous" : value > 0;
  const couleur = accent ? cssVarRef(accent) : "var(--crm-univers)";

  return (
    <button
      type="button"
      disabled={!cliquable && !estActif}
      aria-pressed={estActif}
      onClick={() => onChoisir(estActif ? "tous" : signal)}
      className="crm-panel crm-compteur flex flex-col gap-0.5 px-3.5 py-3 text-left"
      style={
        {
          /* Le liseré ne se colore QUE si le compteur compte quelque chose.
             Un « 0 en retard » borde de rouge se lit comme une alerte, alors
             que c'est exactement la bonne nouvelle. */
          ...(accent && value > 0
            ? { borderInlineStartWidth: "3px", borderInlineStartColor: couleur }
            : {}),
          ["--compteur" as keyof CSSProperties]: couleur,
        } as CSSProperties
      }
    >
      <span
        className="text-[1.5rem] font-bold leading-tight tabular-nums text-[var(--crm-text)]"
        style={vif ? ({ color: couleur } as CSSProperties) : undefined}
      >
        {value}
      </span>
      <span className="crm-kpi__label crm-wrap">{label}</span>
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
      <span className="crm-label shrink-0">{label}</span>
      <select
        className="crm-select text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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
  onOuvrir,
  actif,
}: {
  row: BuyerInboxRow;
  montrerProjet: boolean;
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
        {/* UN GESTE, UNE DESTINATION. Le nom menait a la fiche complete et le
            reste de la ligne au panneau : deux ecrans differents sur la meme
            ligne, et rien pour le dire. On tombait sur l'un ou sur l'autre
            selon le pixel touche — « pas tres fluide de savoir s'il faut aller
            sur la fiche complete ou sur la fiche resumee ».
            Toute la ligne ouvre maintenant le panneau ; la fiche s'atteint
            depuis son bouton « Ouvrir la fiche complete », qui sait en plus
            proteger une saisie en cours. */}
        <span className="crm-wrap text-[15px] font-bold text-[var(--crm-text)]">
          {row.name}
        </span>

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

        {/* UN REPÈRE PAR BIEN. La personne n'a plus qu'une carte : c'est elle
            qui doit dire sur quoi. Sans ces badges, Éric ressemblerait à un
            acquéreur de Jean Jaurès alors qu'il regarde aussi Verdun, et on
            l'appellerait avec la moitié du dossier. Le nom est ÉCRIT — la
            couleur ne fait qu'aider. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {montrerProjet
            ? (row.properties.length > 0
                ? row.properties
                : row.lastPropertyId && row.lastPropertyLabel
                  ? [{ id: row.lastPropertyId, label: row.lastPropertyLabel }]
                  : []
              ).map((p) => <BadgeProjet key={p.id} propertyId={p.id} label={p.label} />)
            : null}
          {!montrerProjet && row.city ? (
            <span className="text-[12.5px] text-[var(--crm-text-dim)]">{row.city}</span>
          ) : null}
          {!row.lastPropertyLabel ? (
            <span className="text-[12.5px] text-[var(--crm-text-faint)]">
              Aucun projet rattaché
            </span>
          ) : null}
          {row.overdue ? <Chip variant="danger">En retard</Chip> : null}
          {/* QUAND LE LEAD EST ARRIVE. Posee sur la ligne des reperes de
              projet, qui a de la place libre, plutot que dans une huitieme
              colonne : la grille en compte deja sept a partir de 1024 px, et
              « Prochaine action » y affiche « 24 oct. 2026, 10:00 » — la plus
              serree des sept. Ici, aucune colonne ne retrecit, la hauteur de
              ligne ne bouge pas, et la date reste visible en pile sur
              telephone, ou la grille n'existe plus. */}
          <span className="text-[12.5px] text-[var(--crm-text-faint)]">
            Arrivé le {formatJour(row.createdAt)}
          </span>
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
