"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Chip, EmptyState } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { ContactRapide } from "./contact-rapide";
import { numeroAppelable } from "@/modules/buyers/crm/telephone";
import { formatDateTime, timeSince } from "@/modules/crm/format";
import {
  buyerStageLabels,
  buyerStageVisual,
  BUYER_PIPELINE_STAGES,
} from "@/modules/buyers/crm/labels";
import { budgetBandBounds } from "@/modules/buyers/crm/criteria";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";

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
  properties,
  members,
}: {
  rows: BuyerInboxRow[];
  properties: { id: string; label: string }[];
  members: { userId: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("tous");
  const [budget, setBudget] = useState<string>("tous");
  const [owner, setOwner] = useState<string>("tous");
  const [property, setProperty] = useState<string>("tous");
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
      if (property !== "tous" && r.lastPropertyId !== property) return false;
      if (bounds && !budgetOverlaps(r, bounds)) return false;
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
  }, [rows, search, stage, budget, owner, property, sort]);

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
      {/* Compteurs réels */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Counter label="Dossiers" value={counters.total} />
        <Counter label="Nouveaux" value={counters.nouveaux} accent="--crm-st-nouveau" />
        <Counter label="En retard" value={counters.enRetard} accent="--crm-st-perdu" />
        <Counter label="Fort potentiel" value={counters.fortPotentiel} accent="--crm-st-signe" />
        <Counter label="Sans action" value={counters.sansAction} accent="--crm-st-a_contacter" />
        <Counter label="Non affectés" value={counters.nonAffectes} accent="--crm-st-perdu" />
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
          {/* Le bien d'abord : c'est la premiere question qu'on se pose en
              arrivant ici, et le seul filtre qui delimite un perimetre de
              travail plutot qu'il ne trie. Un commercial n'en change jamais. */}
          <Select label="Bien" value={property} onChange={setProperty} options={[
            { value: "tous", label: "Tous les biens" },
            ...properties.map((p) => ({ value: p.id, label: p.label })),
          ]} />
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
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="Aucun dossier acquéreur ne correspond."
          hint="Ajustez la recherche ou les filtres. Les nouveaux acquéreurs apparaissent ici dès leur première manifestation d’intérêt sur une page publique."
          icon="◉"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((row) => (
            <BuyerRow key={row.buyerProfileId} row={row} />
          ))}
        </ul>
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
 * Un compteur a zero n'est jamais mis en couleur : zero « en retard » est une
 * bonne nouvelle, pas une alerte.
 */
function Counter({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const vif = Boolean(accent) && value > 0;
  return (
    <div
      className="crm-panel flex flex-col gap-0.5 px-3.5 py-3"
      style={
        accent
          ? ({ borderInlineStartWidth: "3px", borderInlineStartColor: cssVarRef(accent) } as CSSProperties)
          : undefined
      }
    >
      <span
        className="text-[1.5rem] font-bold leading-tight tabular-nums text-[var(--crm-text)]"
        style={vif ? ({ color: cssVarRef(accent as string) } as CSSProperties) : undefined}
      >
        {value}
      </span>
      <span className="crm-kpi__label crm-wrap">{label}</span>
    </div>
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
function BuyerRow({ row }: { row: BuyerInboxRow }) {
  const stageV = buyerStageVisual(row.stage);
  const appelable = numeroAppelable(row.phoneMasked);
  return (
    /* La carte entiere ouvre la fiche. Seul le nom etait un lien : on cliquait
       sur la carte et rien ne se passait. Le lien s'etire en couche invisible
       sur toute la carte, et les actions de contact repassent au-dessus. */
    <li className="relative rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-3.5 transition-colors hover:border-[var(--crm-line-hover)] focus-within:border-[var(--crm-univers)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/crm/acquereurs/${row.buyerProfileId}`}
            className="crm-wrap text-[16px] font-bold text-[var(--crm-text)] outline-none after:absolute after:inset-0 after:content-[''] hover:text-[var(--crm-univers)]"
          >
            {row.name}
          </Link>
          <p className="crm-ellipsis mt-1 text-xs text-[var(--crm-text-faint)]">
            {row.lastPropertyLabel ?? "Aucun bien rattaché"}
            {row.city ? ` · ${row.city}` : ""}
            {row.interestCount > 1 ? ` · ${row.interestCount} intérêts` : ""}
          </p>
          <p className="crm-ellipsis mt-0.5 text-xs text-[var(--crm-text-faint)]">
            {[row.phoneMasked, row.emailMasked].filter(Boolean).join(" · ") ||
              "Coordonnées non renseignées"}
          </p>
          {appelable ? <ContactRapide numero={appelable} className="mt-2" /> : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className="crm-chip crm-chip--accent"
            style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(stageV.cssVar) } as CSSProperties}
          >
            <span aria-hidden>{stageV.icon}</span>
            {stageV.label}
          </span>
        </div>
      </div>

      {/* Signaux opérationnels — icône + libellé, jamais la couleur seule. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {row.stage === "nouveau" ? <Chip variant="gold">✦ Nouveau non traité</Chip> : null}
        {row.newInterest ? <Chip variant="gold">✧ Nouvel intérêt</Chip> : null}
        {row.overdue ? <Chip variant="danger">⚠ Rappel en retard</Chip> : null}
        {row.noNextAction ? <Chip variant="danger">○ Sans prochaine action</Chip> : null}
        {row.unassigned ? <Chip variant="danger">☰ Non affecté</Chip> : null}
        {row.highPotential ? <Chip variant="ok">★ Fort potentiel</Chip> : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--crm-text-faint)]">
        <span>
          {row.assigneeNames.length > 0
            ? `Responsable : ${row.assigneeNames.join(", ")}`
            : "Aucun responsable"}
        </span>
        <span>
          {row.nextActionTitle
            ? `Prochaine action : ${row.nextActionTitle}${
                row.nextActionAt ? ` (${formatDateTime(row.nextActionAt)})` : ""
              }`
            : "Aucune prochaine action programmée"}
        </span>
        {row.lastInterestAt ? <span>Dernier intérêt {timeSince(row.lastInterestAt)}</span> : null}
      </div>
    </li>
  );
}
