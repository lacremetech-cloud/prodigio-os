import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadBuyerList, toInboxRow } from "@/modules/buyers/crm/queries";
import { BuyerInbox } from "@/components/crm/buyers/buyer-inbox";
import { BarreProjets } from "@/components/crm/buyers/barre-projets";
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
    name: info.email ? info.email.split("@")[0] || info.email : `Membre ${userId.slice(0, 6)}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="crm-eyebrow">CRM Acquéreurs</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Boîte de réception acquéreurs
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--crm-text-dim)]">
          Une ligne par personne et par projet. Une même personne intéressée par deux projets
          garde une seule fiche contact, mais un suivi commercial distinct sur chacun.
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

      <BuyerInbox
        rows={rows}
        members={memberOptions}
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
