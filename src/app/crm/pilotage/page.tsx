import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canPiloter } from "@/modules/crm/auth/roles";
import { nowMs } from "@/modules/crm/format";
import { jourParis } from "@/modules/pilotage/versions";
import { lirePeriode, adressePeriode } from "@/modules/pilotage/periode-choisie";
import { lireTableauPilotage } from "@/modules/pilotage/tableau-lecture";
import { AccesReserve, ErreurLecture, NonInstalle } from "@/components/crm/pilotage/vues";
import { OngletsPilotage } from "@/components/crm/pilotage/onglets";
import { GraphiqueParJour } from "@/components/crm/pilotage/tableau/graphique";
import {
  ASavoir,
  BlocPerformance,
  BlocRentabilite,
  CommissionEnGrand,
  CoutsParType,
  DetailDesCommissions,
  donneesGraphique,
  LectureMeta,
  PubsGagnantes,
  TableauParBien,
} from "@/components/crm/pilotage/tableau/blocs";
import { Section, SelecteurPeriode } from "@/components/crm/pilotage/tableau/valeurs";

export const metadata: Metadata = { title: "Pilotage pub" };

/**
 * PILOTAGE PUB — la vue générale. Réservée aux administrateurs (ici, et par la
 * RLS de chaque table lue). Commission et rentabilité restent « depuis le
 * début » ; tout ce qui vient de Meta suit la période choisie.
 */
export default async function PilotagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCrmSession("/crm/pilotage");
  if (!canPiloter(session.roles)) return <AccesReserve />;

  const maintenant = new Date(nowMs());
  const jour = jourParis(maintenant);
  const { choix, corrigee } = lirePeriode(await searchParams, jour);
  const lecture = await lireTableauPilotage(choix, maintenant);
  if (lecture.etat === "non_installe") return <NonInstalle />;
  if (lecture.etat === "erreur") return <ErreurLecture />;
  const t = lecture.tableau;
  const suffixe = adressePeriode("", choix);
  const depense = donneesGraphique(t, "depense");
  const leads = donneesGraphique(t, "leads");
  const attendre = t.lecture.lu ? "Aucune dépense sur la période." : "En attente de la première lecture Meta.";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="crm-eyebrow">Pilotage pub</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Vue générale</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--crm-text-dim)]">
            Ce que les biens peuvent rapporter à Prodigio, ce qu’on a investi pour les vendre, et si cela vaut le coup.
            Réservé aux administrateurs.
          </p>
        </div>
        <OngletsPilotage actif="general" biens={t.biens} suffixe={suffixe} />
        <SelecteurPeriode chemin="/crm/pilotage" choix={choix} aujourdHui={jour} />
        {corrigee ? (
          <p className="text-xs text-[var(--crm-warning)]">La période demandée était illisible : la période par défaut est affichée.</p>
        ) : null}
      </header>

      {t.biens.length === 0 ? (
        <Section id="vide" titre="Aucun bien au pilotage">
          <p className="text-sm text-[var(--crm-text-faint)]">
            Aucun bien n’a encore de conditions, de lots, de coûts ou de dépense Meta rattachée. Les conditions se saisissent
            dans l’onglet « Biens : conditions, lots, coûts ».
          </p>
        </Section>
      ) : (
        <>
          <Section id="commission" titre="Commission" sousTitre="Depuis le début, avec les conditions en vigueur aujourd’hui.">
            <CommissionEnGrand ht={t.global.potentielHT} ttc={t.global.potentielTTC} legende="Somme des biens au pilotage, au prix affiché." />
            <DetailDesCommissions biens={t.biens} suffixe={suffixe} />
          </Section>

          <Section id="rentabilite" titre="Rentabilité · depuis le début">
            <BlocRentabilite r={t.global.rentabilite} encaisseHT={t.global.encaisseHT} global />
          </Section>

          <Section id="performance" titre={`Performance Meta · ${t.periode.libelle}`} sousTitre={<LectureMeta lecture={t.lecture} />}>
            <BlocPerformance ind={t.global.surLaPeriode} frequence={t.global.frequence} />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <GraphiqueParJour titre="Dépense" unite="euros" pas={t.serie.pas} points={depense.points} series={depense.series} vide={attendre} />
              <GraphiqueParJour titre="Leads" unite="leads" pas={t.serie.pas} points={leads.points} series={leads.series} vide={attendre} />
            </div>
          </Section>

          <Section id="par-bien" titre="Bien par bien">
            <TableauParBien t={t} suffixe={suffixe} />
          </Section>

          <Section id="gagnantes" titre={`Pubs gagnantes, tous biens · ${t.periode.libelle}`} sousTitre="Le plus de leads ; à égalité, le moins cher par lead.">
            <PubsGagnantes
              pubs={t.global.pubsGagnantes}
              biens={t.biens}
              vide={t.lecture.lu ? "Aucune pub n’a amené de lead sur la période." : "En attente de la première lecture Meta."}
            />
          </Section>

          <Section id="couts" titre="Coûts fixes" sousTitre="Saisis à la main, bien par bien ; le journal des saisies est dans l’onglet de chaque bien.">
            <CoutsParType biens={t.biens} suffixe={suffixe} />
          </Section>

          <Section id="a-savoir" titre="À savoir">
            <ASavoir alertes={t.alertes} />
          </Section>
        </>
      )}
    </div>
  );
}
