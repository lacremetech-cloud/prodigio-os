import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canTreatBuyers, canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadBuyerList, toKanbanCard } from "@/modules/buyers/crm/queries";
import { BuyerKanbanBoard } from "@/components/crm/buyers/buyer-kanban";
import { BarreProjets } from "@/components/crm/buyers/barre-projets";
import {
  dansLaSelection,
  ecrireNavigation,
  lireProjets,
  lireVue,
} from "@/modules/buyers/crm/navigation";
import { lireEcheance, lireSignal } from "@/modules/buyers/crm/filtres";
import { comptesParProjet } from "@/modules/buyers/crm/comptes";

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

  const { items, projets, chargeA, members } = await loadBuyerList(canViewContacts);

  /* La meme liste d'equipe que la liste : le filtre « Responsable » doit
     proposer les memes noms dans les deux vues. */
  const memberOptions = [...members.entries()].map(([userId, info]) => ({
    userId,
    name: info.email ? info.email.split("@")[0] || info.email : `Membre ${userId.slice(0, 6)}`,
  }));

  const selection = lireProjets(params.projets, projets);
  const vue = lireVue(params.vue);
  const signal = lireSignal(params.signal);
  const echeance = lireEcheance(params.echeance);
  const comptes = comptesParProjet(items);

  const visibles = items.filter((i) => dansLaSelection(i.propertyId, selection));
  /* La carte porte la MÊME qualification que la ligne de liste. Elle portait
     l'ancienne échelle, par personne : un dossier pouvait s'afficher
     « Qualifié » ici et « À qualifier » dans la liste, pour la même personne,
     le même jour. */
  const cards = visibles.map((item) => toKanbanCard(item));

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
        members={memberOptions}
        signalInitial={signal}
        echeanceInitiale={echeance}
        chargeA={chargeA}
        /* Sous un onglet de projet, repeter son nom sur chaque carte
           n'apprend rien ; en vue « tous les projets », c'est indispensable. */
        montrerProjet={selection.length !== 1}
        contexte={ecrireNavigation({ projets: selection, vue, signal, echeance })}
      />
    </div>
  );
}
