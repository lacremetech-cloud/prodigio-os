import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canTreatBuyers, canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadBuyerList, toInboxRow, toKanbanCard } from "@/modules/buyers/crm/queries";
import { memberDisplayName } from "@/modules/crm/data/queries";
import { BuyerKanbanBoard } from "@/components/crm/buyers/buyer-kanban";
import { BarreProjets } from "@/components/crm/buyers/barre-projets";
import { BandeauFile } from "@/components/crm/buyers/bandeau-file";
import {
  dansLaSelection,
  ecrireNavigation,
  lireProjets,
  lireVue,
} from "@/modules/buyers/crm/navigation";
import { FILTRES_RAPIDES, lireSignal, porteLeSignal } from "@/modules/buyers/crm/signaux";
import { qualification as definitionQualification } from "@/modules/buyers/crm/vocabulaire";
import { comptesParProjet } from "@/modules/buyers/crm/comptes";
import { BUDGET_FILTERS, budgetCorrespond } from "@/modules/buyers/crm/budget";

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

  const { items, members, projets } = await loadBuyerList(canViewContacts);

  const selection = lireProjets(params.projets, projets);
  const vue = lireVue(params.vue);
  const signal = lireSignal(params.signal);
  /* La tranche de budget est un AXE A PART : on croise « en retard » et
     « plus d'1 M€ » au lieu de choisir entre les deux. Une valeur inconnue ne
     filtre rien. */
  const budget =
    typeof params.budget === "string" && BUDGET_FILTERS.some((b) => b.value === params.budget)
      ? params.budget
      : "tous";
  /* LES COMPTEURS DISENT CE QUE LA VUE MONTRE.
     Ils comptaient TOUS les dossiers, y compris les non qualifies que le
     pipeline ecarte : la barre annonçait 75 quand le tableau en posait 72, et
     cliquer « Villa Verdun 52 » en affichait moins. Un filtre dont le nombre
     ne survit pas au clic est un filtre qui ment.
     On compte donc sur le meme predicat que le tableau — sans la selection de
     projet, sinon choisir Verdun mettrait Jean Jaures a zero. */
  /** Le pipeline, SANS la tranche de budget : chaque tranche doit pouvoir
      annoncer son propre nombre, et non zero des qu'une autre est choisie. */
  function dansLeSignal(i: (typeof items)[number]): boolean {
    const ligne = toInboxRow(i);
    if (!porteLeSignal(ligne, signal)) return false;
    if (signal === "non_qualifies") return true;
    return ligne.qualification !== "non_qualifie";
  }

  /** Ce que le pipeline montre : le signal courant, la tranche, moins les non
      qualifies. */
  function dansLePipeline(i: (typeof items)[number]): boolean {
    const ligne = toInboxRow(i);
    if (!budgetCorrespond(ligne, budget)) return false;
    if (!porteLeSignal(ligne, signal)) return false;
    if (signal === "non_qualifies") return true;
    return ligne.qualification !== "non_qualifie";
  }

  const comptes = comptesParProjet(items.filter(dansLePipeline));

  /* Le filtre par projet regarde TOUS les biens de la personne : Éric apparaît
     qu'on choisisse Jean Jaurès ou Verdun, et une seule fois si l'on prend les
     deux. */
  const visibles = items.filter((i) =>
    i.interestPropertyIds.some((id) => dansLaSelection(id, selection)),
  );

  /* Le MÊME prédicat que la liste, PLUS une règle propre au pipeline : il
     montre le travail ACTIF. Une personne non qualifiée n'y figure pas, même
     sous « Tous » — sinon la colonne « À contacter » annonçait dix cartes
     quand la liste en comptait huit, et c'est la colonne qu'on croit.
     Elle reste retrouvable dans la liste, sous « Tous » et sous le filtre
     « Non qualifiés », avec ses notes. */
  const retenues = visibles.filter(dansLePipeline);

  const cards = retenues.map((item) =>
    toKanbanCard(item, definitionQualification(item.qualification).label),
  );

  /* Les MEMES dossiers, en entier, pour le panneau de traitement : la carte ne
     porte pas l'e-mail, la qualification, la derniere note ni la prochaine
     tache. Ils sont deja charges — le bandeau les utilise juste au-dessus. */
  const lignes = retenues.map(toInboxRow);

  const memberOptions = [...members.entries()].map(([userId]) => ({
    userId,
    name: memberDisplayName(userId, members),
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="crm-eyebrow">CRM Acquéreurs</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Pipeline Acquéreurs
        </h1>
      </header>

      <BarreProjets
        projets={projets}
        selection={selection}
        vue={vue}
        signal={signal}
        comptes={comptes}
        base={{ liste: "/crm/acquereurs", pipeline: "/crm/acquereurs/pipeline" }}
      />

      {/* Le MÊME bandeau et les MÊMES nombres que la liste, calculés par la
          même fonction : c'est ce qui empêche « 10 dans le pipeline » en face
          de « 8 dans la liste » de revenir. Il porte sur la sélection de
          projet, sans le filtre rapide — sinon le total changerait à chaque
          pastille et ne dirait plus où est le travail. */}
      <BandeauFile
        rows={visibles.map(toInboxRow)}
        base="/crm/acquereurs"
        /* `vue: "liste"` et non la vue courante : les personnes écartées
           n'apparaissent PAS dans le pipeline, donc le lien doit ouvrir la
           liste, sinon il renvoie sur un écran où elles sont invisibles. */
        contexte={ecrireNavigation({ projets: selection, vue: "liste" })}
      />

      {/* LES MEMES PASTILLES QUE LA LISTE, avec leurs nombres.
          Le tableau en affichait d'autres — un vocabulaire different, sans
          compteur, et un filtrage LOCAL qui s'empilait sur celui-ci. Ce sont
          des LIENS : le filtre vit dans l'adresse, donc il survit a un
          rechargement, se partage, et reste le meme en passant de la liste au
          pipeline.
          Les nombres portent sur la selection de projet courante : une
          pastille annonce exactement ce qu'elle ouvrira. */}
      <div className="crm-rapides">
        {FILTRES_RAPIDES.map((f) => {
          /* Chaque pastille annonce ce QU'ELLE ouvrira : son propre signal,
             croise avec la tranche de budget courante — pas avec le signal
             courant, sinon toutes les autres afficheraient zero. */
          const n = visibles.filter((i) => {
            const ligne = toInboxRow(i);
            if (!budgetCorrespond(ligne, budget)) return false;
            if (!porteLeSignal(ligne, f.signal)) return false;
            if (f.signal === "non_qualifies") return true;
            return ligne.qualification !== "non_qualifie";
          }).length;
          return (
            <Link
              key={f.signal}
              href={`/crm/acquereurs/pipeline${ecrireNavigation({
                projets: selection,
                vue,
                signal: f.signal,
                budget,
              })}`}
              /* Les MEMES classes que la liste : deux vues, une seule
                 apparence. Elles portaient deux habillages differents pour la
                 meme fonction. */
              className="crm-rapide"
              aria-pressed={signal === f.signal}
            >
              {f.label}
              <span className="crm-rapide__n">{n}</span>
            </Link>
          );
        })}
      </div>

      {/* LE BUDGET, SUR SA PROPRE RANGEE. « Ils ont besoin de trier les
          500 k – 1 M€ et les plus d'1 M€ assez rapidement » : c'etait un menu
          deroulant replie dans la liste, et rien du tout sur le pipeline.
          Deux axes separes, donc deux rangees : on croise une tranche avec
          « en retard » au lieu de choisir entre les deux. */}
      <div className="crm-rapides">
        {BUDGET_FILTERS.map((b) => {
          const n = visibles.filter(
            (i) =>
              dansLeSignal(i) && budgetCorrespond(toInboxRow(i), b.value),
          ).length;
          return (
            <Link
              key={b.value}
              href={`/crm/acquereurs/pipeline${ecrireNavigation({
                projets: selection,
                vue,
                signal,
                budget: b.value,
              })}`}
              className="crm-rapide"
              aria-pressed={budget === b.value}
            >
              {b.label}
              <span className="crm-rapide__n">{n}</span>
            </Link>
          );
        })}
      </div>

      <BuyerKanbanBoard
        cards={cards}
        canMove={canMove}
        /* Sous un onglet de projet, repeter son nom sur chaque carte
           n'apprend rien ; en vue « tous les projets », c'est indispensable. */
        montrerProjet={selection.length !== 1}
        contexte={ecrireNavigation({ projets: selection, vue, signal })}
        rows={lignes}
        membres={memberOptions}
        /* Qui peut TRAITER un dossier peut le confier : les commerciaux
           travaillent ensemble et se repassent les leads. La base applique la
           meme regle (`crm_buyer_assign` passe par `crm_buyer_can_operate`). */
        moiUserId={session.userId}
        peutAffecterAutrui={canTreatBuyers(session.roles)}
      />
    </div>
  );
}
