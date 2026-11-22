import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canPiloter } from "@/modules/crm/auth/roles";
import { nowMs } from "@/modules/crm/format";
import { lirePilotage, nomDuBien } from "@/modules/pilotage/queries";
import { syntheseDuBien } from "@/modules/pilotage/synthese";
import { jourParis } from "@/modules/pilotage/versions";
import { formatCentimes, formatMontant, formatTotal } from "@/modules/pilotage/affichage";
import { statutCommercialLabels } from "@/modules/pilotage/labels";
import { Chip } from "@/components/crm/ui";
import { AccesReserve, ErreurLecture, NonInstalle } from "@/components/crm/pilotage/vues";
import { OngletsPilotage } from "@/components/crm/pilotage/onglets";

export const metadata: Metadata = { title: "Données du pilotage" };

/**
 * Les données du pilotage pub, bien par bien : ce qui est saisi, ce qui
 * manque. La page Pilotage elle-même (dépenses Meta, rentabilité, CRM par
 * bien) viendra aux étapes suivantes ; celle-ci sert à SAISIR et à VÉRIFIER.
 */
export default async function DonneesDuPilotagePage() {
  const session = await requireCrmSession("/crm/pilotage/donnees");
  if (!canPiloter(session.roles)) return <AccesReserve />;

  const lecture = await lirePilotage();
  if (lecture.etat === "non_installe") return <NonInstalle />;
  if (lecture.etat === "erreur") return <ErreurLecture />;

  const jour = jourParis(new Date(nowMs()));
  const biens = lecture.donnees.map((d) => ({
    d,
    s: syntheseDuBien({
      jour,
      conditions: d.conditions,
      lots: d.lots,
      etatsDesLots: d.etatsDesLots,
      couts: d.couts,
      photographieMandat: d.photographieMandat,
    }),
  }));
  // Les biens suivis d'abord : ce sont eux que l'on vient vérifier.
  const suivis = biens.filter((b) => b.s.enVigueur);
  const autres = biens.filter((b) => !b.s.enVigueur);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="crm-eyebrow">Pilotage pub</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Données du pilotage</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--crm-text-dim)]">
            Conditions de commercialisation, lots et coûts fixes de chaque bien. Réservé aux administrateurs. Rien ne
            s’efface : chaque modification ajoute une ligne datée, avec son auteur et son motif.
          </p>
        </div>
        <OngletsPilotage actif="donnees" />
      </header>

      <p className="crm-avertissement crm-wrap">
        Ce qui est saisi ici est enregistré pour de vrai, y compris depuis un aperçu : aucune donnée d’essai. Une
        erreur se corrige par une nouvelle version, ou en annulant un coût.
      </p>

      <section className="crm-panel p-5" aria-labelledby="biens-suivis">
        <h2 id="biens-suivis" className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Biens suivis ({suivis.length})
        </h2>
        {suivis.length === 0 ? (
          <p className="text-sm text-[var(--crm-text-faint)]">
            Aucun bien n’a encore de conditions en vigueur. Ouvrez un bien ci-dessous pour les saisir.
          </p>
        ) : (
          <div className="crm-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <caption className="crm-sr-only">Biens suivis par le pilotage</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
                  <th scope="col" className="py-2 pr-3">Bien</th>
                  <th scope="col" className="py-2 pr-3">Vente</th>
                  <th scope="col" className="py-2 pr-3">Prix</th>
                  <th scope="col" className="py-2 pr-3">Com. Prodigio HT potentielle</th>
                  <th scope="col" className="py-2 pr-3">Coûts fixes HT</th>
                  <th scope="col" className="py-2 pr-3">À vérifier</th>
                  <th scope="col" className="py-2"><span className="crm-sr-only">Ouvrir</span></th>
                </tr>
              </thead>
              <tbody>
                {suivis.map(({ d, s }) => {
                  const c = s.enVigueur!;
                  const aVerifier = s.alertes.filter((a) => a.niveau === "attention").length;
                  return (
                    <tr key={d.bien.id} className="border-t border-[var(--crm-line-soft)] align-top">
                      <td className="py-2.5 pr-3 font-medium text-[var(--crm-text)]">{nomDuBien(d.bien)}</td>
                      <td className="py-2.5 pr-3 text-[var(--crm-text-dim)]">
                        {c.vente_par_lots
                          ? `${s.lots.length} lot${s.lots.length > 1 ? "s" : ""}`
                          : c.statut_commercial
                            ? statutCommercialLabels[c.statut_commercial]
                            : "—"}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--crm-text-dim)]">
                        {s.totalLots ? formatTotal(s.totalLots.prix) : formatCentimes(c.prix_affiche_cents)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--crm-text)]">
                        {s.totalLots
                          ? formatTotal(s.totalLots.comProdigioHT)
                          : s.potentiel
                            ? formatMontant(s.potentiel.comProdigioHT)
                            : "—"}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--crm-text-dim)]">
                        {formatCentimes(s.couts.totalHtCentimes)}
                      </td>
                      <td className="py-2.5 pr-3">
                        {aVerifier > 0 ? <Chip variant="danger">{aVerifier}</Chip> : <Chip variant="ok">RAS</Chip>}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          href={`/crm/pilotage/donnees/${d.bien.id}`}
                          prefetch={false}
                          className="crm-btn crm-btn--secondaire crm-btn--sm"
                          aria-label={`Ouvrir les données de ${nomDuBien(d.bien)}`}
                        >
                          Ouvrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-[var(--crm-text-faint)]">
          Calcul de contrôle, sur les conditions en vigueur aujourd’hui. La page Pilotage complète (dépenses Meta,
          rentabilité, demandes du CRM) viendra aux étapes suivantes.
        </p>
      </section>

      <section className="crm-panel p-5" aria-labelledby="biens-non-suivis">
        <h2 id="biens-non-suivis" className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Autres biens ({autres.length})
        </h2>
        {autres.length === 0 ? (
          <p className="text-sm text-[var(--crm-text-faint)]">Tous les biens ont des conditions en vigueur.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {autres.map(({ d, s }) => (
              <li
                key={d.bien.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">{nomDuBien(d.bien)}</p>
                  <p className="text-xs text-[var(--crm-text-faint)]">
                    {s.aVenir.length > 0 ? "Conditions à venir" : "Aucune condition saisie : hors pilotage"}
                  </p>
                </div>
                <Link href={`/crm/pilotage/donnees/${d.bien.id}`} prefetch={false} className="crm-btn crm-btn--secondaire crm-btn--sm">
                  Saisir les conditions
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
