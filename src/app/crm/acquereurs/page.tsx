import type { Metadata } from "next";
import { memberDisplayName } from "@/modules/crm/data/queries";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canTreatBuyers, canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadBuyerList, toInboxRow } from "@/modules/buyers/crm/queries";
import { BuyerInbox } from "@/components/crm/buyers/buyer-inbox";
import { BarreProjets } from "@/components/crm/buyers/barre-projets";
import { BandeauFile } from "@/components/crm/buyers/bandeau-file";
import { lireSignal } from "@/modules/buyers/crm/signaux";
import {
  dansLaSelection,
  ecrireNavigation,
  lireProjets,
  lireVue,
} from "@/modules/buyers/crm/navigation";
import { comptesParProjet } from "@/modules/buyers/crm/comptes";

export const metadata: Metadata = { title: "Acquéreurs" };

/**
 * Boîte de réception opérationnelle des acquéreurs.
 *
 * L'autorisation est vérifiée côté serveur (session + RLS) : la liste ne
 * contient que les dossiers réellement visibles par l'utilisateur. Les
 * coordonnées sont masquées **avant** d'être envoyées au navigateur, selon le
 * rôle — jamais côté client.
 *
 * Une ligne est une personne SUR UN PROJET. La sélection de projet se fait en
 * haut de page et gouverne TOUT ce qui suit : liste, compteurs et recherche.
 * Aucun chiffre global ne subsiste sous un onglet de projet — il se lirait
 * comme celui du projet.
 */
export default async function BuyersInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCrmSession("/crm/acquereurs");
  const params = await searchParams;
  const canViewContacts = canViewContactDetails(session.roles);

  const { items, members, projets, chargeA, tronquee } = await loadBuyerList(canViewContacts);

  // `?signal=en_retard` : les tuiles du tableau de bord ouvrent directement la
  // liste qu'elles annoncent. Une valeur inconnue ne filtre rien.
  const signal = lireSignal(params.signal);
  const selection = lireProjets(params.projets, projets);
  const vue = lireVue(params.vue);

  // Les compteurs de la barre portent sur les dossiers ACTIFS, tous projets
  // confondus : ils doivent rester lisibles quelle que soit la sélection, c'est
  // ce qui permet de voir où est le travail avant de choisir.
  const comptes = comptesParProjet(items);

  const visibles = items.filter((i) => dansLaSelection(i.propertyId, selection));
  const rows = visibles.map(toInboxRow);

  const memberOptions = [...members.entries()].map(([userId, info]) => ({
    userId,
    name: memberDisplayName(userId, members),
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="crm-eyebrow">CRM Acquéreurs</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Boîte de réception acquéreurs
        </h1>
        {/* Masquée sur téléphone : ces trois lignes expliquent une règle qu'on
            apprend le premier jour, et elles coûtaient 90 px avant le premier
            nom — sur le seul écran où l'on travaille debout. */}
        <p className="mt-1 hidden max-w-2xl text-sm text-[var(--crm-text-dim)] sm:block">
          Une ligne par personne. Quelqu&rsquo;un qui s&rsquo;intéresse à deux projets apparaît
          une seule fois, avec les deux biens en repère : une qualification, une étape, un
          historique. Ce qui tient au bien — visites, offres, issue — reste sur sa fiche.
        </p>
      </header>

      {/* Tronquer une liste de leads sans le dire serait pire que lent : le
          commercial travaillerait sur un sous-ensemble sans le savoir. */}
      {tronquee ? (
        <p className="crm-avertissement" role="status">
          Seuls les {items.length} dossiers les plus récents sont chargés. Affinez par projet ou
          par filtre pour atteindre les autres.
        </p>
      ) : null}

      <BarreProjets
        projets={projets}
        selection={selection}
        vue={vue}
        signal={signal}
        comptes={comptes}
        base={{ liste: "/crm/acquereurs", pipeline: "/crm/acquereurs/pipeline" }}
      />

      {/* Ce qu'il y a à travailler, avant les filtres : « 16 dossiers » laisse
          croire à 16 appels à passer alors que deux sont écartés. */}
      <BandeauFile
        rows={rows}
        base="/crm/acquereurs"
        contexte={ecrireNavigation({ projets: selection, vue })}
      />

      <BuyerInbox
        rows={rows}
        members={memberOptions}
        /* Qui peut TRAITER un dossier peut le confier : les commerciaux
           travaillent ensemble et se repassent les leads. La base applique la
           meme regle (`crm_buyer_assign` passe par `crm_buyer_can_operate`). */
        moiUserId={session.userId}
        peutAffecterAutrui={canTreatBuyers(session.roles)}
        /* `?budget=plus_1m` : la destination du commercial apres connexion. La
           valeur est validee par la liste des tranches, dans le composant. */
        budgetInitial={typeof params.budget === "string" ? params.budget : undefined}
        signalInitial={signal}
        /* Le badge de projet n'a de sens que si plusieurs projets sont à
           l'écran : sous un onglet de projet, le répéter sur chaque ligne
           n'apprend rien et prend la place du reste. */
        chargeA={chargeA}
        montrerProjet={selection.length !== 1}
        contexte={ecrireNavigation({ projets: selection, vue, signal })}
      />
    </div>
  );
}
