import { notFound } from "next/navigation";
import { BuyerInbox } from "@/components/crm/buyers/buyer-inbox";
import { BuyerKanbanBoard } from "@/components/crm/buyers/buyer-kanban";
import { PropertyBuyersPanel } from "@/components/crm/buyers/property-buyers";
import {
  DOSSIERS_FICTIFS,
  INSTANT_ESSAI,
  MEMBRES_FICTIFS,
  TACHES_FICTIVES,
} from "@/modules/buyers/crm/dossiers-fictifs";
import { prochaineAction } from "@/modules/buyers/crm/prochaine-action";
import { QUALIFICATION_LABELS } from "@/modules/buyers/crm/qualification";
import { buyerStageLabels } from "@/modules/buyers/crm/labels";
import type { PropertyBuyerRow } from "@/modules/buyers/crm/queries";
import type { BuyerKanbanCard } from "@/modules/buyers/crm/pipeline";
import { formatDateTime } from "@/modules/crm/format";

/**
 * Banc d'essai du CRM acquéreurs — **jamais servi en production**.
 *
 * Il rend les écrans RÉELS (liste, panneau, Kanban, cockpit du bien) à partir
 * d'un seul jeu de dossiers fictifs, à un instant fixe. C'est ce qui permet de
 * vérifier « la même information partout » en la regardant, et de prendre les
 * captures en 360, 390 et 430 px, sans créer une seule ligne en base.
 *
 * Le garde-fou est volontairement le premier geste du fichier : une page
 * d'essai qui répondrait en production exposerait des noms inventés sur un
 * outil que des gens utilisent pour de vrai.
 */
export const dynamic = "force-dynamic";

export default function BancEssaiCrm() {
  /* Le banc d'essai ne répond que si on l'autorise explicitement. La variable
     n'est posée nulle part en production : la page y est introuvable, même si
     ce fichier venait à y être déployé. */
  if (process.env.CRM_BANC_ESSAI !== "1") notFound();

  const chargeA = new Date(INSTANT_ESSAI).toISOString();

  const cartes: BuyerKanbanCard[] = DOSSIERS_FICTIFS.map((d) => ({
    interestId: d.interestId,
    propertyId: d.propertyId,
    buyerProfileId: d.buyerProfileId,
    stage: d.stage,
    name: d.name,
    propertyLabel: d.propertyLabel,
    city: d.city,
    emailMasked: d.emailMasked,
    phoneMasked: d.phoneMasked,
    qualification: d.qualification,
    callAttempts: d.callAttempts,
    nextActionAt: d.nextActionAt,
    assigneeIds: d.assigneeIds,
    budgetMinCents: d.budgetMinCents,
    budgetMaxCents: d.budgetMaxCents,
    interestCount: d.interestCount,
    unassigned: d.unassigned,
    overdue: d.overdue,
    noNextAction: d.noNextAction,
    newInterest: d.newInterest,
  }));

  const lignesCockpit: PropertyBuyerRow[] = DOSSIERS_FICTIFS.filter(
    (d) => d.propertyId === "prop-verdun",
  ).map((d) => ({
    profile: {
      id: d.buyerProfileId,
      pipeline_stage: d.stage,
      interest_count: d.interestCount,
      contact_id: `c-${d.buyerProfileId}`,
    } as PropertyBuyerRow["profile"],
    name: d.name,
    phoneMasked: d.phoneMasked,
    emailMasked: d.emailMasked,
    interest: {
      id: d.interestId as string,
      created_at: d.createdAt,
      qualification: d.qualification,
    } as PropertyBuyerRow["interest"],
    assigneeNames: d.assigneeNames,
    lastCallOutcome: d.lastCallOutcome,
    nextActionAt: d.nextActionAt,
  }));

  return (
    <div className="flex flex-col gap-8 p-4">
      <header>
        <p className="crm-eyebrow">Banc d’essai — données fictives</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          La même information partout
        </h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Instant de référence figé au {formatDateTime(chargeA)}. Aucune ligne n’existe en base.
        </p>
      </header>

      {/* Le tableau de contrôle : ce que CHAQUE chemin calcule, côte à côte.
          Une divergence se voit ici avant de se voir à l'écran. */}
      <section className="crm-panel overflow-x-auto p-4">
        <h2 className="mb-2 text-sm font-bold text-[var(--crm-text)]">
          Ce que chaque chemin calcule
        </h2>
        <table className="w-full text-xs" id="controle">
          <thead>
            <tr className="text-left text-[var(--crm-text-dim)]">
              <th className="py-1 pr-3">Dossier</th>
              <th className="py-1 pr-3">Projet</th>
              <th className="py-1 pr-3">Qualification</th>
              <th className="py-1 pr-3">Étape</th>
              <th className="py-1 pr-3">Prochaine action (liste)</th>
              <th className="py-1 pr-3">Prochaine action (fiche)</th>
            </tr>
          </thead>
          <tbody>
            {DOSSIERS_FICTIFS.map((d) => {
              const fiche = prochaineAction(
                TACHES_FICTIVES.filter((t) => t.buyer_profile_id === d.buyerProfileId),
                d.interestId,
                INSTANT_ESSAI,
              );
              const liste = d.nextActionAt ? formatDateTime(d.nextActionAt) : "Aucune";
              const parFiche = fiche ? formatDateTime(fiche.dueAt) : "Aucune";
              return (
                <tr key={d.interestId} data-dossier={d.interestId}>
                  <td className="py-1 pr-3 text-[var(--crm-text)]">{d.name}</td>
                  <td className="py-1 pr-3">{d.propertyLabel}</td>
                  <td className="py-1 pr-3" data-qualification={d.qualification}>
                    {QUALIFICATION_LABELS[d.qualification]}
                  </td>
                  <td className="py-1 pr-3">{buyerStageLabels[d.stage] ?? d.stage}</td>
                  <td className="py-1 pr-3" data-liste={d.nextActionAt ?? ""}>{liste}</td>
                  <td
                    className={`py-1 pr-3 ${liste === parFiche ? "" : "font-bold text-[var(--crm-danger)]"}`}
                    data-fiche={fiche?.dueAt ?? ""}
                  >
                    {parFiche}
                    {liste === parFiche ? "" : " ← DIVERGENCE"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-[var(--crm-text)]">Liste de travail</h2>
        <BuyerInbox
          rows={DOSSIERS_FICTIFS}
          members={MEMBRES_FICTIFS}
          chargeA={chargeA}
          contexte=""
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-[var(--crm-text)]">Pipeline</h2>
        <BuyerKanbanBoard
          cards={cartes}
          canMove={false}
          members={MEMBRES_FICTIFS}
          chargeA={chargeA}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-[var(--crm-text)]">
          Cockpit du bien — Villa Verdun
        </h2>
        <PropertyBuyersPanel rows={lignesCockpit} />
      </section>
    </div>
  );
}
