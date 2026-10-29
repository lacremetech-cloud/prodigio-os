import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmRole } from "@/modules/crm/auth/session";
import { loadArchivedBuyers } from "@/modules/buyers/crm/queries";
import { formatDateTime } from "@/modules/crm/format";
import { SectionTitle } from "@/components/crm/ui";
import { RetablirContact } from "@/components/crm/buyers/archiver-contact";

export const metadata: Metadata = { title: "Contacts archivés" };

/**
 * CONTACTS ARCHIVÉS — écran administrateur.
 *
 * Sans lui, l'archivage serait une suppression : une fiche retirée des listes
 * et introuvable ensuite est perdue, quoi qu'en dise la base. La réversibilité
 * n'existe que si quelqu'un peut voir ce qu'il y a à rétablir.
 *
 * `requireCrmRole(["administrateur"])` renvoie tout autre rôle vers `/crm` :
 * c'est la troisième porte, après celle du bouton et celle des fonctions
 * `crm_buyer_archive` / `crm_buyer_desarchive`. Seule la dernière est une
 * sécurité — les deux premières évitent d'afficher un refus.
 */
export default async function ContactsArchivesPage() {
  await requireCrmRole(["administrateur"], "/crm/acquereurs/archives");
  const archives = await loadArchivedBuyers();

  return (
    <div className="crm-wrap flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle
          eyebrow="Administration"
          title={
            archives.length === 0
              ? "Contacts archivés"
              : `Contacts archivés (${archives.length})`
          }
        />
        <Link href="/crm/acquereurs" className="crm-btn crm-btn--sm crm-btn--ghost">
          ← Retour aux acquéreurs
        </Link>
      </div>

      {archives.length === 0 ? (
        <section className="crm-panel p-4">
          <p className="text-xs text-[var(--crm-text-dim)]">
            Aucun contact archivé. Les fiches archivées depuis une fiche acquéreur
            apparaissent ici, et peuvent être rétablies à tout moment.
          </p>
        </section>
      ) : (
        <section className="crm-panel p-4">
          <p className="text-xs text-[var(--crm-text-dim)]">
            Ces fiches sont sorties de la liste de travail, du pipeline et des récapitulatifs.
            Rien n’a été supprimé : l’historique, les notes et les tâches sont intacts.
          </p>
          <ul className="crm-liste mt-3 flex flex-col gap-2">
            {archives.map((a) => (
              <li key={a.buyerProfileId} className="crm-ligne flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/crm/acquereurs/${a.buyerProfileId}`}
                    className="crm-lien-fiche font-semibold"
                  >
                    {a.nom}
                  </Link>
                  <span className="text-xs text-[var(--crm-text-dim)]">
                    Archivé le {formatDateTime(a.archiveLe)}
                    {a.archivePar ? ` par ${a.archivePar}` : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--crm-text-dim)]">
                  {a.email ? <span>{a.email}</span> : null}
                  {a.telephone ? <span>{a.telephone}</span> : null}
                  <span>
                    {a.nbInterets} {a.nbInterets === 1 ? "demande" : "demandes"}
                  </span>
                </div>

                {/* Le motif est la seule chose qui permet, trois mois plus tard, de
                    savoir si l'archivage était justifié. */}
                {a.motif ? (
                  <p className="crm-wrap text-xs">
                    <span className="crm-label">Motif</span> {a.motif}
                  </p>
                ) : null}

                <RetablirContact buyerProfileId={a.buyerProfileId} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
