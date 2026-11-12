import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canPiloter } from "@/modules/crm/auth/roles";
import { formatDateTime, nowMs } from "@/modules/crm/format";
import { getMembersMap } from "@/modules/crm/data/queries";
import { lirePilotage, nomDuBien } from "@/modules/pilotage/queries";
import { syntheseDuBien } from "@/modules/pilotage/synthese";
import { jourParis } from "@/modules/pilotage/versions";
import { formatCentimes } from "@/modules/pilotage/affichage";
import { statutCommercialLabels, TYPES_COUT, typeCoutLabels } from "@/modules/pilotage/labels";
import { Chip } from "@/components/crm/ui";
import {
  AccesReserve,
  Alertes,
  Cellule,
  ControleDuCalcul,
  ErreurLecture,
  HistoriqueConditions,
  JournalCouts,
  NonInstalle,
  ResumeConditions,
  TotauxDesLots,
} from "@/components/crm/pilotage/vues";
import { FormulaireConditions } from "@/components/crm/pilotage/formulaire-conditions";
import { AjouterLot, ModifierLot } from "@/components/crm/pilotage/lots";
import { FormulaireCoutFixe } from "@/components/crm/pilotage/couts-fixes";

export const metadata: Metadata = { title: "Données du pilotage — bien" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Section({ id, titre, children }: { id: string; titre: string; children: React.ReactNode }) {
  return (
    <section className="crm-panel flex flex-col gap-4 p-5" aria-labelledby={id}>
      <h2 id={id} className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
        {titre}
      </h2>
      {children}
    </section>
  );
}

export default async function DonneesDuBienPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCrmSession(`/crm/pilotage/donnees/${id}`);
  if (!canPiloter(session.roles)) return <AccesReserve />;
  if (!UUID.test(id)) notFound();

  const [lecture, membres] = await Promise.all([lirePilotage(id), getMembersMap()]);
  if (lecture.etat === "non_installe") return <NonInstalle />;
  if (lecture.etat === "erreur") return <ErreurLecture />;
  const donnees = lecture.donnees[0];
  if (!donnees) notFound();

  const jour = jourParis(new Date(nowMs()));
  const s = syntheseDuBien({
    jour,
    conditions: donnees.conditions,
    lots: donnees.lots,
    etatsDesLots: donnees.etatsDesLots,
    couts: donnees.couts,
    photographieMandat: donnees.photographieMandat,
  });
  const c = s.enVigueur;
  // Le formulaire part de la version en vigueur, sinon de la plus récente
  // (une version à venir, par exemple) : on ne retape jamais tout.
  const depart = c ?? s.historique[0]?.version ?? null;
  const parLots = c?.vente_par_lots ?? depart?.vente_par_lots ?? false;
  const sousMandat = donnees.bien.commercialization_origin === "mandat_prodigio";
  const nom = nomDuBien(donnees.bien);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/crm/pilotage/donnees" prefetch={false} className="text-xs text-[var(--crm-text-dim)] hover:text-[var(--crm-text)]">
          ← Données du pilotage
        </Link>
        <p className="crm-eyebrow">Pilotage pub · données</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="crm-wrap text-2xl font-semibold text-[var(--crm-text)]">{nom}</h1>
          <Chip variant="neutral">{sousMandat ? "Sous mandat Prodigio" : "Bien partenaire"}</Chip>
        </div>
        <Link
          href={`/crm/biens/${donnees.bien.id}`}
          prefetch={false}
          className="text-sm font-medium text-[var(--crm-univers)] hover:underline"
        >
          Cockpit du bien →
        </Link>
      </header>

      <Alertes alertes={s.alertes} />

      {c ? (
        <Section id="en-vigueur" titre="Conditions en vigueur">
          <ResumeConditions synthese={s} />
        </Section>
      ) : null}

      {c && !c.vente_par_lots && s.potentiel ? (
        <Section id="controle" titre="Contrôle du calcul — commission potentielle">
          <ControleDuCalcul calcul={s.potentiel} conditions={c} part={s.part} />
          {s.encaisse ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-[var(--crm-text)]">Commission encaissée (prix de vente final)</h3>
              <ControleDuCalcul calcul={s.encaisse} conditions={c} part={s.part} titrePrix="Prix de vente final" />
            </>
          ) : null}
        </Section>
      ) : null}

      <Section id="nouvelle-version" titre={c ? "Nouvelle version des conditions" : "Conditions de commercialisation"}>
        <FormulaireConditions propertyId={donnees.bien.id} jour={jour} initiale={depart} sousMandat={sousMandat} />
      </Section>

      <Section id="historique" titre="Historique des conditions">
        <HistoriqueConditions historique={s.historique} membres={membres} />
      </Section>

      {parLots || s.lots.length > 0 || s.lotsRetires.length > 0 ? (
        <Section id="lots" titre={`Lots du programme (${s.lots.length})`}>
          {!parLots && s.lots.length > 0 ? (
            <p className="crm-avertissement crm-wrap">
              Le bien se vend en un seul bloc : ces lots sont ignorés par le calcul.
            </p>
          ) : null}
          {s.lots.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {s.lots.map((l) => (
                <li
                  key={l.lot.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--crm-text)]">
                      Lot {l.lot.numero}
                      {l.etat?.description ? (
                        <span className="font-normal text-[var(--crm-text-dim)]"> · {l.etat.description}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--crm-text-dim)]">
                      <span className="tabular-nums">{formatCentimes(l.etat?.prix_cents)}</span>
                      {" · "}
                      {l.etat ? statutCommercialLabels[l.etat.statut_commercial] : "—"}
                      {l.etat?.statut_commercial === "vendu"
                        ? ` · vendu ${formatCentimes(l.etat.prix_vente_final_cents)}`
                        : ""}
                    </p>
                    <p className="text-xs text-[var(--crm-text-faint)]">
                      Com. Prodigio HT potentielle : <Cellule montant={l.potentiel?.comProdigioHT} />
                      {l.encaisse ? (
                        <>
                          {" · encaissée : "}
                          <Cellule montant={l.encaisse.comProdigioHT} />
                        </>
                      ) : null}
                    </p>
                    {l.etats.length > 1 ? (
                      <details className="mt-1 text-xs text-[var(--crm-text-faint)]">
                        <summary className="cursor-pointer">Historique du lot ({l.etats.length} états)</summary>
                        <ul className="mt-1 flex flex-col gap-1">
                          {l.etats.map((e) => (
                            <li key={e.id} className="crm-wrap">
                              {formatDateTime(e.saisi_le)}
                              {" — "}
                              {formatCentimes(e.prix_cents)} · {statutCommercialLabels[e.statut_commercial]}
                              {e.retire ? " · retiré" : ""} — {e.motif}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                  <ModifierLot propertyId={donnees.bien.id} lotId={l.lot.id} numero={l.lot.numero} etat={l.etat} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--crm-text-faint)]">Aucun lot saisi.</p>
          )}

          {s.totalLots && c ? (
            <div className="crm-panel-2 flex flex-col gap-3 p-4">
              <h3 className="text-sm font-semibold text-[var(--crm-text)]">Totaux du programme</h3>
              <TotauxDesLots synthese={s} />
              <p className="text-[11px] text-[var(--crm-text-faint)]">
                Chaque lot : prix ÷ (1 + taux) = net vendeur ; prix − net = commission totale TTC ; × part de Prodigio
                ; ÷ (1 + TVA) = HT. Les totaux additionnent les valeurs exactes, arrondies une seule fois.
              </p>
            </div>
          ) : null}

          {parLots ? <AjouterLot propertyId={donnees.bien.id} /> : null}

          {s.lotsRetires.length > 0 ? (
            <details className="text-sm text-[var(--crm-text-dim)]">
              <summary className="cursor-pointer">Lots retirés du pilotage ({s.lotsRetires.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {s.lotsRetires.map((l) => (
                  <li
                    key={l.lot.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-2"
                  >
                    <span className="crm-wrap">
                      Lot {l.lot.numero} — {l.etat?.motif ?? "retiré"}
                    </span>
                    <ModifierLot propertyId={donnees.bien.id} lotId={l.lot.id} numero={l.lot.numero} etat={l.etat} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Section>
      ) : null}

      <Section id="couts" titre="Coûts fixes">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="crm-panel-2 p-3 sm:col-span-1">
            <p className="crm-label">Total HT</p>
            <p className="text-base font-semibold tabular-nums text-[var(--crm-text)]">
              {formatCentimes(s.couts.totalHtCentimes)}
            </p>
          </div>
          {TYPES_COUT.map((t) => (
            <div key={t} className="crm-panel-2 p-3">
              <p className="crm-label">{typeCoutLabels[t]}</p>
              <p className="text-sm tabular-nums text-[var(--crm-text-dim)]">{formatCentimes(s.couts.parType[t])}</p>
            </div>
          ))}
        </div>
        <FormulaireCoutFixe propertyId={donnees.bien.id} />
        <JournalCouts couts={s.couts} membres={membres} />
        {parLots ? (
          <p className="text-[11px] text-[var(--crm-text-faint)]">
            Programme : un coût est commun aux lots ; il se répartit entre eux au prorata du prix sur la page Pilotage.
          </p>
        ) : null}
      </Section>
    </div>
  );
}
