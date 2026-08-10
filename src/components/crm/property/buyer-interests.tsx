"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { setBuyerInterestStatusAction } from "@/modules/buyers/public/actions";
import type { BuyerInterestsSummary, BuyerInterestView } from "@/modules/buyers/public/queries";
import {
  buyerPriorityLabels,
  buyerPriorityVisual,
  buyerReviewStatusLabels,
  buyerReviewStatusVisual,
  type BuyerReviewStatus,
} from "@/modules/buyers/public/labels";
import {
  availabilityLabels,
  budgetBandLabels,
  contactPreferenceLabels,
  decisionModeLabels,
  financingLabels,
  projectNatureLabels,
  purchaseHorizonLabels,
  recallPreferenceLabels,
} from "@/modules/buyers/funnel/content";
import { formatDateTime } from "@/modules/crm/format";
import { maskContactValue } from "@/modules/crm/auth/roles";
import { cssVarRef } from "@/modules/crm/status-visuals";
import type { BuyerInterestRow } from "@/lib/supabase/types";
import { FieldError, useAction } from "./shared";

function label(map: Record<string, string>, v: string | null | undefined): string | null {
  if (!v) return null;
  return map[v] ?? v;
}

export function BuyerInterestsPanel({
  propertyId,
  summary,
  canOperate,
  canViewContacts,
  highlightId,
}: {
  propertyId: string;
  summary: BuyerInterestsSummary;
  canOperate: boolean;
  canViewContacts: boolean;
  highlightId?: string | null;
}) {
  if (summary.total === 0) {
    return (
      <div className="flex flex-col gap-3">
        <SummaryRow summary={summary} />
        <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-8 text-center text-xs text-[var(--crm-text-faint)]">
          Aucune demande acquéreur pour le moment. Les intérêts qualifiés apparaîtront ici dès la
          première soumission sur la page publique.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SummaryRow summary={summary} />
      <ul className="flex flex-col gap-2">
        {summary.items.map((item) => (
          <InterestRow
            key={item.interest.id}
            item={item}
            propertyId={propertyId}
            canOperate={canOperate}
            canViewContacts={canViewContacts}
            defaultOpen={highlightId === item.interest.id}
          />
        ))}
      </ul>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        Réception opérationnelle minimale (préparation du futur CRM Acquéreurs). Le score exact est
        interne : il n’est jamais communiqué au visiteur.
      </p>
    </div>
  );
}

function SummaryRow({ summary }: { summary: BuyerInterestsSummary }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Total" value={summary.total} />
      <Stat label="Nouveaux" value={summary.nouveaux} accent="--crm-st-nouveau" />
      <Stat label="Prioritaires" value={summary.prioritaires} accent="--crm-st-signe" />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
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

function InterestRow({
  item,
  propertyId,
  canOperate,
  canViewContacts,
  defaultOpen,
}: {
  item: BuyerInterestView;
  propertyId: string;
  canOperate: boolean;
  canViewContacts: boolean;
  defaultOpen: boolean;
}) {
  const { interest: i, contactName, reviewerName } = item;
  const [open, setOpen] = useState(defaultOpen);
  const { pending, error, run } = useAction();

  const status = i.review_status as BuyerReviewStatus;
  const statusVisual = buyerReviewStatusVisual[status];
  const priorityVisual = i.priority ? buyerPriorityVisual[i.priority] : null;

  const phone = maskContactValue(i.contact_phone ?? i.contact_phone_raw, canViewContacts);
  const email = maskContactValue(i.contact_email ?? i.contact_email_raw, canViewContacts);

  return (
    <li
      className={`flex flex-col gap-2 rounded-[10px] border bg-[var(--crm-panel-2)] p-3 ${
        defaultOpen ? "border-[var(--crm-gold)]" : "border-[var(--crm-line-soft)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">{contactName}</p>
          <p className="text-[11px] text-[var(--crm-text-faint)]">
            {formatDateTime(i.created_at)}
            {label(projectNatureLabels, i.project_nature)
              ? ` · ${label(projectNatureLabels, i.project_nature)}`
              : ""}
            {label(budgetBandLabels, i.budget_band)
              ? ` · ${label(budgetBandLabels, i.budget_band)}`
              : ""}
          </p>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {priorityVisual && i.priority ? (
            <span
              className="crm-chip crm-chip--accent"
              style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(priorityVisual.cssVar) } as CSSProperties}
            >
              <span aria-hidden>{priorityVisual.icon}</span>
              {buyerPriorityLabels[i.priority] ?? i.priority}
            </span>
          ) : null}
          <span
            className="crm-chip crm-chip--accent"
            style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(statusVisual.cssVar) } as CSSProperties}
          >
            <span aria-hidden>{statusVisual.icon}</span>
            {buyerReviewStatusLabels[status]}
          </span>
        </div>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 border-t border-[var(--crm-line-soft)] pt-3">
          <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            <Detail label="Téléphone" value={phone} />
            <Detail label="E-mail" value={email} />
            <Detail label="Projet" value={label(projectNatureLabels, i.project_nature)} />
            <Detail label="Budget" value={label(budgetBandLabels, i.budget_band)} />
            <Detail label="Financement" value={label(financingLabels, i.financing)} />
            <Detail label="Horizon" value={label(purchaseHorizonLabels, i.purchase_horizon)} />
            <Detail label="Disponibilité" value={label(availabilityLabels, i.availability)} />
            <Detail label="Décision" value={label(decisionModeLabels, i.decision_mode)} />
            <Detail
              label="Résidence"
              value={[i.residence_area, i.residence_country].filter(Boolean).join(", ") || null}
            />
            <Detail
              label="Préférence"
              value={[
                label(contactPreferenceLabels, i.contact_preference),
                label(recallPreferenceLabels, i.contact_recall_preference),
              ]
                .filter(Boolean)
                .join(" · ") || null}
            />
          </div>

          <ScoreRow interest={i} />
          <AttributionRow interest={i} />

          {reviewerName ? (
            <p className="text-[11px] text-[var(--crm-text-faint)]">
              Dernier statut par {reviewerName}
              {i.reviewed_at ? ` · ${formatDateTime(i.reviewed_at)}` : ""}
            </p>
          ) : null}

          {canOperate ? (
            <div className="flex flex-wrap items-center gap-2">
              {(["nouveau", "consulte", "traite"] as BuyerReviewStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`crm-btn crm-btn--sm ${s === status ? "crm-btn--gold" : "crm-btn--ghost"}`}
                  disabled={pending || s === status}
                  onClick={() =>
                    run(() => setBuyerInterestStatusAction({ propertyId, interestId: i.id, status: s }))
                  }
                >
                  {buyerReviewStatusLabels[s]}
                </button>
              ))}
              <FieldError error={error} />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="crm-wrap">
      <span className="crm-label">{label}</span>
      <br />
      <span className="text-[var(--crm-text)]">{value}</span>
    </p>
  );
}

function ScoreRow({ interest: i }: { interest: BuyerInterestRow }) {
  const cells: [string, number | null][] = [
    ["Global", i.overall_score],
    ["Budget", i.budget_score],
    ["Maturité", i.maturity_score],
    ["Financement", i.financing_score],
    ["Disponibilité", i.availability_score],
  ];
  if (cells.every(([, v]) => v == null)) return null;
  return (
    <div className="flex flex-wrap gap-3 rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] px-3 py-2">
      {cells.map(([k, v]) =>
        v == null ? null : (
          <span key={k} className="text-xs text-[var(--crm-text-dim)]">
            <span className="crm-label">{k}</span>{" "}
            <span className="font-semibold tabular-nums text-[var(--crm-text)]">{v}/100</span>
          </span>
        ),
      )}
    </div>
  );
}

function AttributionRow({ interest: i }: { interest: BuyerInterestRow }) {
  const attr = [
    ["Source", i.utm_source],
    ["Campagne", i.utm_campaign],
    ["Ensemble", i.utm_term],
    ["Publicité", i.utm_content],
  ].filter(([, v]) => v) as [string, string][];
  if (attr.length === 0) return null;
  return (
    <p className="text-[11px] text-[var(--crm-text-faint)]">
      Acquisition — {attr.map(([k, v]) => `${k} : ${v}`).join(" · ")}
    </p>
  );
}
