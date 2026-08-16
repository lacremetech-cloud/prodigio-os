import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadBuyerList, toInboxRow } from "@/modules/buyers/crm/queries";
import { BuyerInbox } from "@/components/crm/buyers/buyer-inbox";

export const metadata: Metadata = { title: "Acquéreurs" };

/**
 * Boîte de réception opérationnelle des acquéreurs.
 *
 * L'autorisation est vérifiée côté serveur (session + RLS) : la liste ne
 * contient que les dossiers réellement visibles par l'utilisateur. Les
 * coordonnées sont masquées **avant** d'être envoyées au navigateur, selon le
 * rôle — jamais côté client.
 */
export default async function BuyersInboxPage() {
  const session = await requireCrmSession("/crm/acquereurs");
  const canViewContacts = canViewContactDetails(session.roles);

  const { items, members } = await loadBuyerList(canViewContacts);
  const rows = items.map(toInboxRow);

  // Options de filtre dérivées des seuls dossiers visibles.
  const properties = [
    ...new Map(
      items
        .filter((i) => i.lastPropertyId)
        .map((i) => [i.lastPropertyId as string, i.lastPropertyLabel ?? "Bien sans nom"]),
    ),
  ].map(([id, label]) => ({ id, label }));

  const memberOptions = [...members.entries()].map(([userId, info]) => ({
    userId,
    name: info.email ? info.email.split("@")[0] || info.email : `Membre ${userId.slice(0, 6)}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow">CRM Acquéreurs</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
            Boîte de réception acquéreurs
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--crm-text-dim)]">
            Tous les acquéreurs générés par les expériences publiques des biens. Un dossier par
            personne : un même acquéreur peut manifester plusieurs intérêts sur plusieurs biens
            sans jamais être dupliqué.
          </p>
        </div>
        <Link href="/crm/acquereurs/pipeline" className="crm-btn crm-btn--sm">
          ▤ Pipeline Acquéreurs
        </Link>
      </header>

      <BuyerInbox rows={rows} properties={properties} members={memberOptions} />
    </div>
  );
}
