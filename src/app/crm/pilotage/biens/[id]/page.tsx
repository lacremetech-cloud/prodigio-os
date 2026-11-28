import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canPiloter } from "@/modules/crm/auth/roles";
import { nowMs } from "@/modules/crm/format";
import { getMembersMap } from "@/modules/crm/data/queries";
import { jourParis } from "@/modules/pilotage/versions";
import { cookies } from "next/headers";
import { lirePeriode, adressePeriode, COOKIE_PERIODE } from "@/modules/pilotage/periode-choisie";
import { lireCrmPilotage, lireTableauPilotage } from "@/modules/pilotage/tableau-lecture";
import { SectionCrmBien } from "@/components/crm/pilotage/tableau/crm-sections";
import { formatCentimes } from "@/modules/pilotage/affichage";
import { statutCommercialLabels, typeCoutLabels, TYPES_COUT } from "@/modules/pilotage/labels";
import { AccesReserve, Alertes, Cellule, ControleDuCalcul, ErreurLecture, JournalCouts, NonInstalle, TotauxDesLots } from "@/components/crm/pilotage/vues";
import { OngletsPilotage } from "@/components/crm/pilotage/onglets";
import { GraphiqueParJour } from "@/components/crm/pilotage/tableau/graphique";
import { MemoriserPeriode } from "@/components/crm/pilotage/tableau/memoire";
import {
  BlocPerformance,
  BlocRentabilite,
  CommissionEnGrand,
  donneesGraphique,
  LectureMeta,
  PubsGagnantes,
} from "@/components/crm/pilotage/tableau/blocs";
import { formatExact, Section, SelecteurPeriode, Tuile, Valeur } from "@/components/crm/pilotage/tableau/valeurs";

/** Le cookie se relit tel quel s'il n'est pas encodé ; jamais d'exception sur une valeur abîmée. */
function decodeURIComponentSur(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export const metadata: Metadata = { title: "Pilotage pub — un bien" };

/**
 * L'ONGLET D'UN BIEN. En tête, la commission potentielle — pas le ROAS — puis
 * son calcul pas à pas ; pour un programme, lot par lot, la pub et les coûts
 * communs répartis au prorata du prix. La rentabilité porte le ROAS potentiel.
 */
export default async function PilotageBienPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const chemin = `/crm/pilotage/biens/${id}`;
  const session = await requireCrmSession(chemin);
  if (!canPiloter(session.roles)) return <AccesReserve />;

  const maintenant = new Date(nowMs());
  const jour = jourParis(maintenant);
  const memorisee = (await cookies()).get(COOKIE_PERIODE)?.value;
  const { choix, corrigee } = lirePeriode(await searchParams, jour, memorisee ? decodeURIComponentSur(memorisee) : undefined);
  const [lecture, crm, membres] = await Promise.all([
    lireTableauPilotage(choix, maintenant),
    lireCrmPilotage(choix, maintenant),
    getMembersMap(),
  ]);
  if (lecture.etat === "non_installe") return <NonInstalle />;
  if (lecture.etat === "erreur") return <ErreurLecture />;
  const t = lecture.tableau;
  const b = t.biens.find((x) => x.id === id);
  if (!b) notFound();

  const s = b.synthese;
  const c = s.enVigueur;
  const suffixe = adressePeriode("", choix);
  const depense = donneesGraphique(t, "depense", b.id);
  const leads = donneesGraphique(t, "leads", b.id);
  const attendre = t.lecture.lu ? "Aucune dépense sur la période." : "En attente de la première lecture Meta.";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="crm-eyebrow">Pilotage pub</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">{b.nom}</h1>
        </div>
        <OngletsPilotage actif={b.id} biens={t.biens} suffixe={suffixe} />
        <SelecteurPeriode chemin={chemin} choix={choix} aujourdHui={jour} />
        <MemoriserPeriode requete={choix.type === "proposee" ? suffixe.slice(1) : null} />
        {corrigee ? (
          <p className="text-xs text-[var(--crm-warning)]">La période demandée était illisible : la période par défaut est affichée.</p>
        ) : null}
      </header>

      <Section id="commission" titre="Commission" sousTitre="Depuis le début, avec les conditions en vigueur aujourd’hui.">
        <CommissionEnGrand
          ht={b.potentielHT}
          ttc={b.potentielTTC}
          legende={c?.vente_par_lots ? "Somme des lots suivis, au prix de la grille." : "Au prix affiché."}
        />
        {!c ? (
          <p className="text-sm text-[var(--crm-text-dim)]">
            Aucune condition en vigueur pour ce bien.{" "}
            <Link href={`/crm/pilotage/donnees/${b.id}`} prefetch={false} className="underline underline-offset-2">
              Saisir les conditions
            </Link>
          </p>
        ) : c.vente_par_lots ? (
          <div className="flex flex-col gap-3">
            <div className="crm-scroll overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <caption className="crm-sr-only">Le calcul, lot par lot</caption>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
                    <th scope="col" className="py-2 pr-3">Lot</th>
                    <th scope="col" className="py-2 pr-3">Statut</th>
                    <th scope="col" className="py-2 pr-3 text-right">Prix</th>
                    <th scope="col" className="py-2 pr-3 text-right">Prix net vendeur</th>
                    <th scope="col" className="py-2 pr-3 text-right">Com. totale TTC</th>
                    <th scope="col" className="py-2 pr-3 text-right">Com. Prodigio TTC</th>
                    <th scope="col" className="py-2 text-right">Com. Prodigio HT</th>
                  </tr>
                </thead>
                <tbody>
                  {s.lots.map((l) => (
                    <tr key={l.lot.id} className="border-t border-[var(--crm-line-soft)]">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--crm-text)]">n° {l.lot.numero}</th>
                      <td className="py-2 pr-3 text-[var(--crm-text-dim)]">{l.etat ? statutCommercialLabels[l.etat.statut_commercial] : "—"}</td>
                      <td className="py-2 pr-3 text-right"><Cellule montant={l.potentiel?.prixAffiche} /></td>
                      <td className="py-2 pr-3 text-right"><Cellule montant={l.potentiel?.netVendeur} /></td>
                      <td className="py-2 pr-3 text-right"><Cellule montant={l.potentiel?.comTotaleTTC} /></td>
                      <td className="py-2 pr-3 text-right"><Cellule montant={l.potentiel?.comProdigioTTC} /></td>
                      <td className="py-2 text-right font-semibold"><Cellule montant={l.potentiel?.comProdigioHT} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TotauxDesLots synthese={s} />
            <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
              Pour chaque lot : prix net vendeur = prix ÷ (1 + taux) ; commission totale TTC = prix − prix net vendeur ;
              commission Prodigio TTC = commission totale × part ; HT = TTC ÷ (1 + TVA). Les totaux additionnent les montants
              exacts, arrondis à l’affichage seulement.
            </p>
          </div>
        ) : s.potentiel ? (
          <ControleDuCalcul calcul={s.potentiel} conditions={c} part={s.part} />
        ) : null}
      </Section>

      <Section id="rentabilite" titre="Rentabilité · depuis le début">
        <BlocRentabilite r={b.rentabilite} encaisseHT={b.encaisseHT} />
        {b.lots ? (
          <div className="flex flex-col gap-2">
            <div className="crm-scroll overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <caption className="crm-sr-only">La rentabilité, lot par lot</caption>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
                    <th scope="col" className="py-2 pr-3">Lot</th>
                    <th scope="col" className="py-2 pr-3 text-right">Part du prix</th>
                    <th scope="col" className="py-2 pr-3 text-right">Com. Prodigio HT</th>
                    <th scope="col" className="py-2 pr-3 text-right">Pub HT</th>
                    <th scope="col" className="py-2 pr-3 text-right">Coûts fixes HT</th>
                    <th scope="col" className="py-2 pr-3 text-right">Marge nette HT</th>
                    <th scope="col" className="py-2 text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {b.lots.map((l) => (
                    <tr key={l.numero} className="border-t border-[var(--crm-line-soft)]">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--crm-text)]">n° {l.numero}</th>
                      <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">
                        {l.part ? formatExact(l.part, "pourcent") : <span className="text-xs text-[var(--crm-warning)]">manquant</span>}
                      </td>
                      <td className="py-2 pr-3 text-right"><Cellule montant={l.potentiel?.comProdigioHT} /></td>
                      <td className="py-2 pr-3 text-right"><Valeur calcule={l.pubHT} format="euros" /></td>
                      <td className="py-2 pr-3 text-right"><Valeur calcule={l.coutsFixesHT} format="euros" /></td>
                      <td className="py-2 pr-3 text-right"><Valeur calcule={l.margeNetteHT} format="euros" /></td>
                      <td className="py-2 text-right"><Valeur calcule={l.roas} format="ratio" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--crm-text-faint)]">
              La pub et les coûts fixes du programme sont communs aux lots : ils se répartissent au prorata du prix des lots.
            </p>
          </div>
        ) : null}
      </Section>

      <Section id="couts" titre="Coûts fixes">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TYPES_COUT.map((type) => (
            <Tuile key={type} libelle={typeCoutLabels[type]}>
              <span className="tabular-nums">{formatCentimes(s.couts.parType[type])}</span>
            </Tuile>
          ))}
          <Tuile libelle="Total HT">
            <span className="tabular-nums">{formatCentimes(s.couts.totalHtCentimes)}</span>
          </Tuile>
        </dl>
        <JournalCouts couts={s.couts} membres={membres} />
        <p className="text-xs text-[var(--crm-text-faint)]">
          Un coût se saisit dans{" "}
          <Link href={`/crm/pilotage/donnees/${b.id}`} prefetch={false} className="underline underline-offset-2">
            l’onglet des saisies du bien
          </Link>
          .
        </p>
      </Section>

      <Section id="performance" titre={`Performance Meta · ${t.periode.libelle}`} sousTitre={<LectureMeta lecture={t.lecture} />}>
        <BlocPerformance ind={b.surLaPeriode} frequence={b.frequence} />
        {b.depensesCommunes ? (
          <p className="text-xs text-[var(--crm-text-faint)]">
            Ce bien reçoit une part de pubs communes à plusieurs biens, au prorata du prix affiché.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <GraphiqueParJour titre="Dépense" unite="euros" pas={t.serie.pas} points={depense.points} series={depense.series} vide={attendre} />
          <GraphiqueParJour titre="Leads" unite="leads" pas={t.serie.pas} points={leads.points} series={leads.series} vide={attendre} />
        </div>
      </Section>

      <Section id="gagnantes" titre={`Les 3 pubs gagnantes · ${t.periode.libelle}`} sousTitre="Le plus de leads ; à égalité, le moins cher par lead.">
        <PubsGagnantes
          pubs={b.pubsGagnantes}
          biens={t.biens}
          vide={t.lecture.lu ? "Aucune pub de ce bien n’a amené de lead sur la période." : "En attente de la première lecture Meta."}
        />
      </Section>

      <SectionCrmBien t={t} b={b} crm={crm} membres={membres} />

      {s.alertes.length > 0 ? (
        <Section id="a-savoir" titre="À savoir">
          <Alertes alertes={s.alertes} />
        </Section>
      ) : null}
    </div>
  );
}
