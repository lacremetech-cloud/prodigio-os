import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canTreatBuyers, canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadBuyerList, toInboxRow, toKanbanCard } from "@/modules/buyers/crm/queries";
import { BuyerKanbanBoard } from "@/components/crm/buyers/buyer-kanban";
import { BarreProjets } from "@/components/crm/buyers/barre-projets";
import {
  dansLaSelection,
  ecrireNavigation,
  lireProjets,
  lireVue,
} from "@/modules/buyers/crm/navigation";
import { lireSignal, porteLeSignal } from "@/modules/buyers/crm/signaux";
import { qualification as definitionQualification } from "@/modules/buyers/crm/vocabulaire";
import { comptesParProjet } from "@/modules/buyers/crm/comptes";

export const metadata: Metadata = { title: "Pipeline Acquéreurs" };

/**
 * Pipeline Acquéreurs — distinct du pipeline Mandats.
 *
 * Une carte est une PERSONNE. La déplacer déplace son traitement, pas une de
 * ses manifestations : on appelle quelqu'un une fois, même s'il regarde deux
 * villas. Ce qui tient au bien — visites, offres, issue commerciale — vit sur
 * sa fiche et n'est pas touché par un déplacement.
 *
 * Le pipeline et la liste montrent EXACTEMENT les mêmes personnes et les mêmes
 * compteurs à filtres égaux. Ils divergeaient parce que chacun décidait dans
 * son coin qui était « à contacter » : le pipeline ignorait la qualification,
 * et laissait donc une personne non qualifiée dans la file.
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

  /* Le filtre par projet regarde TOUS les biens de la personne : Éric apparaît
     qu'on choisisse Jean Jaurès ou Verdun, et une seule fois si l'on prend les
     deux. */
  const visibles = items.filter((i) =>
    i.interestPropertyIds.some((id) => dansLaSelection(id, selection)),
  );

  /* Le MÊME prédicat que la liste. Il décide notamment qu'une personne non
     qualifiée sort de la file active — c'est ce qui manquait ici. */
  const retenues = visibles.filter((i) => porteLeSignal(toInboxRow(i), signal));

  const cards = retenues.map((item) =>
    toKanbanCard(item, definitionQualification(item.qualification).label),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="crm-eyebrow">CRM Acquéreurs</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Pipeline Acquéreurs
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--crm-text-dim)]">
          {cards.length} carte{cards.length > 1 ? "s" : ""} — une par personne. Déplacer une
          carte déplace son traitement, pas un de ses projets : l&rsquo;étape et la qualification
          sont communes. Ce qui tient au bien — visites, offres, issue — reste sur sa fiche.
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
