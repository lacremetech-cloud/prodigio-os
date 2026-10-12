import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canTreatBuyers, canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadBuyerList, toKanbanCard } from "@/modules/buyers/crm/queries";
import { buyerQualificationLabels } from "@/modules/buyers/crm/labels";
import { BuyerKanbanBoard } from "@/components/crm/buyers/buyer-kanban";
import { BarreProjets } from "@/components/crm/buyers/barre-projets";
import {
  dansLaSelection,
  ecrireNavigation,
  lireProjets,
  lireVue,
} from "@/modules/buyers/crm/navigation";
import { lireSignal } from "@/modules/buyers/crm/signaux";
import { comptesParProjet } from "@/modules/buyers/crm/comptes";
import type { BuyerQualificationStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Pipeline Acquéreurs" };

/**
 * Pipeline Acquéreurs — distinct du pipeline Mandats.
 *
 * Une carte est une personne SUR UN PROJET : son déplacement ne touche que ce
 * projet-là. Le déplacement passe par `crm_buyer_set_interest_stage`, qui
 * re-vérifie le rôle et écrit l'audit. Les étapes « offre », « gagné » et
 * « perdu » restent protégées : elles exigent une action métier dédiée depuis
 * la fiche (confirmation, motif).
 */
export default async function BuyersPipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCrmSession("/crm/acquereurs/pipeline");
  const params = await searchParams;
  const canViewContacts = canViewContactDetails(session.roles);
  const canMove = canTreatBuyers(session.roles);

  const { items, projets } = await loadBuyerList(canViewContacts);

  const selection = lireProjets(params.projets, projets);
  const vue = lireVue(params.vue);
  const signal = lireSignal(params.signal);
  const comptes = comptesParProjet(items);

  const visibles = items.filter((i) => dansLaSelection(i.propertyId, selection));
  const cards = visibles.map((item) =>
    toKanbanCard(
      item,
      buyerQualificationLabels[item.profile.qualification_status as BuyerQualificationStatus] ??
        item.profile.qualification_status,
    ),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="crm-eyebrow">CRM Acquéreurs</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Pipeline Acquéreurs
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--crm-text-dim)]">
          {cards.length} carte{cards.length > 1 ? "s" : ""} — une par personne et par projet.
          Les colonnes « Offre en cours », « Acquéreur gagné » et « Perdu » sont pilotées par une
          action métier dédiée (confirmation, motif, audit) — jamais par un simple déplacement.
        </p>
      </header>

      <BarreProjets
        projets={projets}
        selection={selection}
        vue={vue}
        signal={signal}
        comptes={comptes}
        base={{ liste: "/crm/acquereurs", pipeline: "/crm/acquereurs/pipeline" }}
      />

      <BuyerKanbanBoard
        cards={cards}
        canMove={canMove}
        /* Sous un onglet de projet, repeter son nom sur chaque carte
           n'apprend rien ; en vue « tous les projets », c'est indispensable. */
        montrerProjet={selection.length !== 1}
        contexte={ecrireNavigation({ projets: selection, vue, signal })}
      />
    </div>
  );
}
