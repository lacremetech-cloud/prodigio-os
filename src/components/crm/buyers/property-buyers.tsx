import Link from "next/link";
import type { CSSProperties } from "react";

import { cssVarRef } from "@/modules/crm/status-visuals";
import { formatDateTime } from "@/modules/crm/format";
import { buyerStageVisual } from "@/modules/buyers/crm/labels";
import {
  lireQualification,
  QUALIFICATION_BADGE,
  QUALIFICATION_LABELS,
  RESULTAT_APPEL_LABELS,
} from "@/modules/buyers/crm/qualification";
import type { PropertyBuyerRow } from "@/modules/buyers/crm/queries";

/**
 * Vue « acquéreurs intéressés » depuis la Fabrique de biens.
 *
 * Ce n'est PAS une copie des dossiers : c'est une **autre vue des mêmes
 * dossiers acquéreurs**, filtrée sur un bien. Chaque ligne ouvre la fiche
 * consolidée, où vit l'ensemble du suivi.
 *
 * Elle portait quatre notions d'état sur une seule ligne — étape, ancienne
 * qualification par personne, recommandation calculée, et un « Non traité /
 * Consulté / Traité » qui n'existait qu'ici — plus deux scores en centièmes.
 * Six façons de dire où en est un dossier, dont aucune n'était celle de la
 * liste. Il en reste QUATRE, les mêmes que partout : l'étape, la
 * qualification, le dernier résultat de contact et la prochaine action.
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
        {rows.map(({ profile, name, phoneMasked, emailMasked, interest, assigneeNames, lastCallOutcome, nextActionAt }) => {
          const stageV = buyerStageVisual(profile.pipeline_stage);
          const qualif = lireQualification(interest.qualification);
          return (
            <li
              key={profile.id}
              className="rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/crm/acquereurs/${profile.id}`}
                    className="crm-wrap text-sm font-medium text-[var(--crm-text)] hover:text-[var(--crm-azur)]"
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
                  <span className={`crm-badge crm-badge--${QUALIFICATION_BADGE[qualif]}`}>
                    {QUALIFICATION_LABELS[qualif]}
                  </span>
                </div>
              </div>

              {/* Le dernier CONTACT et la prochaine ACTION : les deux seules
                  choses qui disent quoi faire de ce dossier aujourd'hui. Les
                  scores calculés à l'inscription n'y répondaient pas. */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--crm-text-dim)]">
                <span>
                  {lastCallOutcome
                    ? `Dernier contact : ${RESULTAT_APPEL_LABELS[lastCallOutcome] ?? lastCallOutcome}`
                    : "Jamais contacté"}
                </span>
                <span>
                  {nextActionAt
                    ? `Prochaine action : ${formatDateTime(nextActionAt)}`
                    : "Aucune action prévue"}
                </span>
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
