"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Chip, EmptyState } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { formatDateTime, timeSince } from "@/modules/crm/format";
import {
  buyerQualificationLabels,
  buyerRecommendedPriorityLabels,
  buyerRecommendedPriorityVisual,
  buyerStageLabels,
  buyerStageVisual,
  BUYER_PIPELINE_STAGES,
} from "@/modules/buyers/crm/labels";
import { budgetBandBounds } from "@/modules/buyers/crm/criteria";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import type {
  BuyerQualificationStatus,
  BuyerRecommendedPriority,
} from "@/lib/supabase/types";

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

const SIGNAL_FILTERS = [
  { value: "tous", label: "Tous" },
  { value: "nouveau", label: "Nouveaux non traités" },
  { value: "en_retard", label: "Rappel en retard" },
  { value: "fort_potentiel", label: "Fort potentiel" },
  { value: "sans_action", label: "Sans prochaine action" },
  { value: "nouvel_interet", label: "Nouvel intérêt" },
  { value: "non_affecte", label: "Non affectés" },
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
  const [signal, setSignal] = useState<(typeof SIGNAL_FILTERS)[number]["value"]>("tous");
  const [stage, setStage] = useState<string>("tous");
  const [qualification, setQualification] = useState<string>("tous");
  const [priority, setPriority] = useState<string>("tous");
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
      if (qualification !== "tous" && r.qualificationStatus !== qualification) return false;
      if (priority !== "tous" && r.recommendedPriority !== priority) return false;
      if (owner !== "tous") {
        if (owner === "aucun" ? !r.unassigned : !r.assigneeIds.includes(owner)) return false;
      }
      if (property !== "tous" && r.lastPropertyId !== property) return false;
      if (bounds && !budgetOverlaps(r, bounds)) return false;
      switch (signal) {
        case "nouveau":
          return r.stage === "nouveau";
        case "en_retard":
          return r.overdue;
        case "fort_potentiel":
          return r.highPotential;
        case "sans_action":
          return r.noNextAction;
        case "nouvel_interet":
          return r.newInterest;
        case "non_affecte":
          return r.unassigned;
        default:
          return true;
      }
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
  }, [rows, search, signal, stage, qualification, priority, budget, owner, property, sort]);

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

        <div className="crm-tabs flex-wrap">
          {SIGNAL_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`crm-tab ${signal === f.value ? "crm-tab--active" : ""}`}
              aria-pressed={signal === f.value}
              onClick={() => setSignal(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Select label="Étape" value={stage} onChange={setStage} options={[
            { value: "tous", label: "Toutes les étapes" },
            ...BUYER_PIPELINE_STAGES.map((s) => ({
              value: s as string,
              label: buyerStageLabels[s] ?? s,
            })),
          ]} />
          <Select label="Qualification" value={qualification} onChange={setQualification} options={[
            { value: "tous", label: "Toutes" },
            ...(Object.keys(buyerQualificationLabels) as BuyerQualificationStatus[]).map((k) => ({
              value: k,
              label: buyerQualificationLabels[k],
            })),
          ]} />
          <Select label="Priorité" value={priority} onChange={setPriority} options={[
            { value: "tous", label: "Toutes" },
            ...(Object.keys(buyerRecommendedPriorityLabels) as BuyerRecommendedPriority[]).map(
              (k) => ({ value: k, label: buyerRecommendedPriorityLabels[k] }),
            ),
          ]} />
          <Select label="Budget" value={budget} onChange={setBudget}
            options={BUDGET_FILTERS.map((b) => ({ value: b.value, label: b.label }))} />
          <Select label="Responsable" value={owner} onChange={setOwner} options={[
            { value: "tous", label: "Tous" },
            { value: "aucun", label: "Non affectés" },
            ...members.map((m) => ({ value: m.userId, label: m.name })),
          ]} />
          <Select label="Bien" value={property} onChange={setProperty} options={[
            { value: "tous", label: "Tous les biens" },
            ...properties.map((p) => ({ value: p.id, label: p.label })),
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

function Counter({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2">
      <span
        className="text-lg font-semibold tabular-nums text-[var(--crm-text)]"
        style={accent ? ({ color: cssVarRef(accent) } as CSSProperties) : undefined}
      >
        {value}
      </span>
      <span className="text-[11px] text-[var(--crm-text-faint)]">{label}</span>
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

function BuyerRow({ row }: { row: BuyerInboxRow }) {
  const stageV = buyerStageVisual(row.stage);
  const prioV = row.recommendedPriority
    ? buyerRecommendedPriorityVisual[row.recommendedPriority as BuyerRecommendedPriority]
    : null;

  return (
    <li className="rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-3.5 transition-colors hover:border-[var(--crm-line-strong)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/crm/acquereurs/${row.buyerProfileId}`}
            className="crm-wrap text-sm font-medium text-[var(--crm-text)] hover:text-[var(--crm-gold)]"
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
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className="crm-chip crm-chip--accent"
            style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(stageV.cssVar) } as CSSProperties}
          >
            <span aria-hidden>{stageV.icon}</span>
            {stageV.label}
          </span>
          {prioV && row.recommendedPriority ? (
            <span
              className="crm-chip crm-chip--accent"
              style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(prioV.cssVar) } as CSSProperties}
              title="Recommandation opérationnelle dérivée du scoring — ce n’est pas la qualification humaine."
            >
              <span aria-hidden>{prioV.icon}</span>
              {buyerRecommendedPriorityLabels[row.recommendedPriority as BuyerRecommendedPriority]}
            </span>
          ) : null}
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
        <span className="text-[var(--crm-text-faint)]">
          Qualification :{" "}
          {buyerQualificationLabels[row.qualificationStatus as BuyerQualificationStatus] ??
            row.qualificationStatus}
        </span>
        {row.bestScore != null ? (
          <span className="tabular-nums text-[var(--crm-text-faint)]" title="Meilleur score automatique du funnel (≠ qualification humaine)">
            Score {row.bestScore}/100
          </span>
        ) : null}
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
