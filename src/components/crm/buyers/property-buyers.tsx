import Link from "next/link";
import type { CSSProperties } from "react";
import { Chip } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { formatDateTime } from "@/modules/crm/format";
import {
  buyerQualificationLabels,
  buyerRecommendedPriorityLabels,
  buyerRecommendedPriorityVisual,
  buyerStageVisual,
} from "@/modules/buyers/crm/labels";
import type { PropertyBuyerRow } from "@/modules/buyers/crm/queries";
import type {
  BuyerQualificationStatus,
  BuyerRecommendedPriority,
} from "@/lib/supabase/types";

/**
 * Vue « acquéreurs intéressés » depuis la Fabrique de biens.
 *
 * Ce n'est PAS une copie des dossiers : c'est une **autre vue des mêmes
 * dossiers acquéreurs**, filtrée sur un bien. Chaque ligne ouvre la fiche
 * consolidée, où vit l'ensemble du suivi.
 */
export function PropertyBuyersPanel({ rows }: { rows: PropertyBuyerRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-6 text-center text-xs text-[var(--crm-text-faint)]">
        Aucun dossier acquéreur rattaché à ce bien pour le moment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {rows.map(({ profile, name, phoneMasked, emailMasked, interest, assigneeNames }) => {
          const stageV = buyerStageVisual(profile.pipeline_stage);
          const prioV = profile.recommended_priority
            ? buyerRecommendedPriorityVisual[profile.recommended_priority]
            : null;
          return (
            <li
              key={profile.id}
              className="rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/crm/acquereurs/${profile.id}`}
                    className="crm-wrap text-sm font-medium text-[var(--crm-text)] hover:text-[var(--crm-gold)]"
                  >
                    {name}
                  </Link>
                  <p className="crm-ellipsis text-[11px] text-[var(--crm-text-faint)]">
                    {[phoneMasked, emailMasked].filter(Boolean).join(" · ") ||
                      "Coordonnées non renseignées"}
                  </p>
                  <p className="text-[11px] text-[var(--crm-text-faint)]">
                    Intérêt du {formatDateTime(interest.created_at)}
                    {profile.interest_count > 1
                      ? ` · ${profile.interest_count} intérêts au total`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="crm-chip crm-chip--accent"
                    style={
                      { ["--chip-accent" as keyof CSSProperties]: cssVarRef(stageV.cssVar) } as CSSProperties
                    }
                  >
                    <span aria-hidden>{stageV.icon}</span>
                    {stageV.label}
                  </span>
                  {prioV && profile.recommended_priority ? (
                    <span
                      className="crm-chip crm-chip--accent"
                      style={
                        { ["--chip-accent" as keyof CSSProperties]: cssVarRef(prioV.cssVar) } as CSSProperties
                      }
                    >
                      <span aria-hidden>{prioV.icon}</span>
                      {
                        buyerRecommendedPriorityLabels[
                          profile.recommended_priority as BuyerRecommendedPriority
                        ]
                      }
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Compatibilité (score budget de l'intérêt) et maturité (score projet). */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--crm-text-dim)]">
                <span className="tabular-nums" title="Compatibilité budgétaire calculée à la soumission">
                  Compatibilité {interest.budget_score ?? "—"}/100
                </span>
                <span className="tabular-nums" title="Maturité du projet calculée à la soumission">
                  Maturité {interest.maturity_score ?? "—"}/100
                </span>
                <span>
                  Qualification :{" "}
                  {
                    buyerQualificationLabels[
                      profile.qualification_status as BuyerQualificationStatus
                    ]
                  }
                </span>
                <Chip variant={interest.review_status === "nouveau" ? "gold" : "neutral"}>
                  {interest.review_status === "nouveau"
                    ? "Non traité"
                    : interest.review_status === "consulte"
                      ? "Consulté"
                      : "Traité"}
                </Chip>
                <span>
                  {assigneeNames.length > 0
                    ? `Responsable : ${assigneeNames.join(", ")}`
                    : "Non affecté"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        Ces dossiers sont les mêmes que ceux de l’espace Acquéreurs : cette vue les filtre
        simplement sur ce bien. Le suivi complet se fait depuis la fiche acquéreur.
      </p>
    </div>
  );
}
