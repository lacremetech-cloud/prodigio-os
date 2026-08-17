import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canOperate, canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadBuyerList, toKanbanCard } from "@/modules/buyers/crm/queries";
import { buyerQualificationLabels } from "@/modules/buyers/crm/labels";
import { BuyerKanbanBoard } from "@/components/crm/buyers/buyer-kanban";
import type { BuyerQualificationStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Pipeline Acquéreurs" };

/**
 * Pipeline Acquéreurs — distinct du pipeline Mandats.
 *
 * Le déplacement passe par `crm_buyer_set_stage`, qui re-vérifie le rôle et
 * écrit l'audit. Les étapes « offre », « gagné » et « perdu » sont protégées :
 * elles exigent une action métier dédiée depuis la fiche (confirmation, motif).
 */
export default async function BuyersPipelinePage() {
  const session = await requireCrmSession("/crm/acquereurs/pipeline");
  const canViewContacts = canViewContactDetails(session.roles);
  const canMove = canOperate(session.roles);

  const { items } = await loadBuyerList(canViewContacts);
  const cards = items.map((item) =>
    toKanbanCard(
      item,
      buyerQualificationLabels[item.profile.qualification_status as BuyerQualificationStatus] ??
        item.profile.qualification_status,
    ),
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow">CRM Acquéreurs</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
            Pipeline Acquéreurs
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--crm-text-dim)]">
            {cards.length} dossier{cards.length > 1 ? "s" : ""}. Les colonnes « Offre en cours »,
            « Acquéreur gagné » et « Perdu » sont pilotées par une action métier dédiée
            (confirmation, motif, audit) — jamais par un simple déplacement.
          </p>
        </div>
        <Link href="/crm/acquereurs" className="crm-btn crm-btn--sm crm-btn--ghost">
          ☰ Boîte de réception
        </Link>
      </header>

      <BuyerKanbanBoard cards={cards} canMove={canMove} />
    </div>
  );
}
