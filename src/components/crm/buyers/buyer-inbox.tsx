"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Chip, EmptyState } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { ContactRapide } from "./contact-rapide";
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
  BUDGET_CHOICE_LABELS,
  type BuyerBudgetChoice,
} from "@/modules/buyers/funnel/universal";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import { porteLeSignal, type Signal } from "@/modules/buyers/crm/signaux";

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
}) {
  const [signal, setSignal] = useState<Signal>(signalInitial);
  const [search, setSearch] = useState("");
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

  const counters = useMemo(
    () => ({
      total: rows.length,
      nouveaux: rows.filter((r) => r.stage === "nouveau").length,
      enRetard: rows.filter((r) => r.overdue).length,
      fortPotentiel: rows.filter((r) => r.highPotential).length,
      sansAction: rows.filter((r) => r.noNextAction).length,
      nonAffectes: rows.filter((r) => r.unassigned).length,
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Compteurs reels, et cliquables : le compteur EST le filtre. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Counter label="Dossiers" value={counters.total}
                 signal="tous" actif={signal} onChoisir={setSignal} />
        <Counter label="Nouveaux" value={counters.nouveaux} accent="--crm-st-nouveau"
                 signal="nouveaux" actif={signal} onChoisir={setSignal} />
        <Counter label="En retard" value={counters.enRetard} accent="--crm-st-perdu"
                 signal="en_retard" actif={signal} onChoisir={setSignal} />
        <Counter label="Fort potentiel" value={counters.fortPotentiel} accent="--crm-st-signe"
                 signal="fort_potentiel" actif={signal} onChoisir={setSignal} />
        <Counter label="Sans action" value={counters.sansAction} accent="--crm-st-a_contacter"
                 signal="sans_action" actif={signal} onChoisir={setSignal} />
        <Counter label="Non affectés" value={counters.nonAffectes} accent="--crm-st-perdu"
                 signal="non_affectes" actif={signal} onChoisir={setSignal} />
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Rechercher un acquéreur</span>
            <input
              className="crm-input"
              type="search"
              placeholder="Rechercher (nom, e-mail, téléphone, ville…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1.5">
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

        <div className="flex flex-wrap gap-2">
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
          title="Aucun dossier acquéreur ne correspond."
          hint="Ajustez la recherche ou les filtres. Les nouveaux acquéreurs apparaissent ici dès leur première manifestation d’intérêt sur une page publique."
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
            />
          ))}
        </ul>
        </>
      )}
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
          ...(accent
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
    <label className="flex min-w-0 items-center gap-1.5">
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
}: {
  row: BuyerInboxRow;
  montrerProjet: boolean;
  contexte: string;
}) {
  const stageV = buyerStageVisual(row.stage);
  const appelable = numeroAppelable(row.phoneMasked);
  const budget = row.budgetChoice
    ? BUDGET_CHOICE_LABELS[row.budgetChoice as BuyerBudgetChoice] ?? row.budgetChoice
    : null;

  return (
    <li className="crm-ligne">
      {/* Identite + bien demande */}
      <div className="min-w-0">
        <Link
          href={`/crm/acquereurs/${row.buyerProfileId}${contexte}`}
          className="crm-wrap text-[15px] font-bold text-[var(--crm-text)] outline-none after:absolute after:inset-0 after:content-[''] hover:text-[var(--crm-univers)]"
        >
          {row.name}
        </Link>
        {/* Le projet, en badge lisible, quand plusieurs sont a l'ecran : sans
            lui, deux lignes de la meme personne sur deux projets seraient
            indiscernables. Le nom est ECRIT — la couleur ne fait qu'aider. */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {row.stage === "nouveau" ? <Chip variant="gold">Non traité</Chip> : null}
          {row.overdue ? <Chip variant="danger">En retard</Chip> : null}
          {row.unassigned ? <Chip variant="neutral">Non affecté</Chip> : null}
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
          <Manque>Personne</Manque>
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
          <Manque>Aucune</Manque>
        )}
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
        {appelable ? (
          <ContactRapide numero={appelable} compact />
        ) : (
          <Manque>Pas de numéro</Manque>
        )}
      </div>
    </li>
  );
}
