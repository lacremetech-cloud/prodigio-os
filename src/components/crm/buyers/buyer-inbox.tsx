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
import { numeroAppelable } from "@/modules/buyers/crm/telephone";
import { formatDateTime } from "@/modules/crm/format";
import {
  buyerStageLabels,
  buyerStageVisual,
  BUYER_PIPELINE_STAGES,
} from "@/modules/buyers/crm/labels";
import { budgetBandBounds } from "@/modules/buyers/crm/criteria";
import {
  BUDGET_CHOICE_COURT,
  type BuyerBudgetChoice,
} from "@/modules/buyers/funnel/universal";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import { FILTRES_RAPIDES, porteLeSignal, type Signal } from "@/modules/buyers/crm/signaux";

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

const BUDGET_FILTERS = [
  { value: "tous", label: "Tous budgets" },
  { value: "moins_800k", label: "< 800 k€" },
  { value: "800k_1_2m", label: "800 k€ – 1,2 M€" },
  { value: "1_2m_2m", label: "1,2 – 2 M€" },
  { value: "2m_3m", label: "2 – 3 M€" },
  { value: "plus_3m", label: "> 3 M€" },
] as const;

/**
 * Un dossier correspond à une tranche de budget si sa fourchette de recherche
 * **recoupe** cette tranche (bornes absentes = non bornées). Un dossier dont le
 * budget n'est pas renseigné du tout est exclu du filtre : on ne lui invente pas
 * une fourchette pour le faire correspondre.
 */
function budgetOverlaps(
  row: BuyerInboxRow,
  bounds: { minCents: number | null; maxCents: number | null },
): boolean {
  if (row.budgetMinCents == null && row.budgetMaxCents == null) return false;
  const rowMin = row.budgetMinCents ?? Number.NEGATIVE_INFINITY;
  const rowMax = row.budgetMaxCents ?? Number.POSITIVE_INFINITY;
  const bandMin = bounds.minCents ?? Number.NEGATIVE_INFINITY;
  const bandMax = bounds.maxCents ?? Number.POSITIVE_INFINITY;
  return rowMin <= bandMax && rowMax >= bandMin;
}

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
  /** Instant de chargement, fourni par le serveur : voir `maintenant`. */
  chargeA: string;
}) {
  const [signal, setSignal] = useState<Signal>(signalInitial);
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

  /** Vrai si l'on peut quitter le dossier ouvert : sinon on demande. */
  function peutQuitter(): boolean {
    if (!saleRef.current) return true;
    return window.confirm(
      "Vous avez une saisie non enregistrée sur ce dossier. La perdre ?",
    );
  }
  const [stage, setStage] = useState<string>("tous");
  const [budget, setBudget] = useState<string>("tous");
  const [owner, setOwner] = useState<string>("tous");

  const [sort, setSort] = useState<SortKey>("urgence");

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const bounds = budget === "tous" ? null : budgetBandBounds(budget);

    const filtered = rows.filter((r) => {
      if (needle) {
        // La recherche porte sur ce qui est AFFICHÉ : une coordonnée masquée
        // n'est pas interrogeable (elle n'a jamais quitté le serveur).
        const hay = [r.name, r.emailMasked, r.phoneMasked, r.city, r.lastPropertyLabel]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (stage !== "tous" && r.stage !== stage) return false;
      if (owner !== "tous") {
        if (owner === "aucun" ? !r.unassigned : !r.assigneeIds.includes(owner)) return false;
      }
      if (bounds && !budgetOverlaps(r, bounds)) return false;
      if (!porteLeSignal(r, signal)) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sort === "urgence") {
      sorted.sort((a, b) => urgency(b) - urgency(a) || (b.bestScore ?? 0) - (a.bestScore ?? 0));
    } else if (sort === "arrivee") {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
      {/* Compteurs reels, et cliquables : le compteur EST le filtre. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Counter label="Dossiers" value={counters.total}
                 signal="tous" actif={signal} onChoisir={setSignal} />
        <Counter label="À contacter" value={counters.nouveaux} accent="--crm-acq-a_contacter"
                 signal="a_contacter" actif={signal} onChoisir={setSignal} />
        <Counter label="En retard" value={counters.enRetard} accent="--crm-acq-pas_interesse"
                 signal="en_retard" actif={signal} onChoisir={setSignal} />
        <Counter label="Sans action" value={counters.sansAction} accent="--crm-st-a_contacter"
                 signal="sans_action" actif={signal} onChoisir={setSignal} />
        <Counter label="Non affectés" value={counters.nonAffectes} accent="--crm-st-perdu"
                 signal="non_affectes" actif={signal} onChoisir={setSignal} />
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-3">
        {/* Sur telephone, la recherche prend toute la largeur : partagee avec
            « Trier par », elle tombait a sept caracteres visibles. */}
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
          <label className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
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
        </div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Select label="Étape" value={stage} onChange={setStage} options={[
            { value: "tous", label: "Toutes les étapes" },
            ...BUYER_PIPELINE_STAGES.map((s) => ({
              value: s as string,
              label: buyerStageLabels[s] ?? s,
            })),
          ]} />
          <Select label="Budget" value={budget} onChange={setBudget}
            options={BUDGET_FILTERS.map((b) => ({ value: b.value, label: b.label }))} />
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
            <BadgeProjet propertyId={row.lastPropertyId} label={row.lastPropertyLabel} />
          ) : null}
          {!montrerProjet && row.city ? (
            <span className="text-[12.5px] text-[var(--crm-text-dim)]">{row.city}</span>
          ) : null}
          {!row.lastPropertyLabel ? (
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
