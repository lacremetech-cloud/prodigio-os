import type { MemberInfo } from "@/modules/crm/data/noms";
import { formatTotal } from "@/modules/pilotage/affichage";
import { calculerCrm, demandesParPoint, MESURES_VIDES, metaEnFace, type LigneCrmJour } from "@/modules/pilotage/crm";
import { decoupage, type BienCalcule, type TableauPilotage } from "@/modules/pilotage/tableau";
import type { LectureCrm } from "@/modules/pilotage/tableau-lecture";
import { couleurDuBien } from "./blocs";
import { BlocCrm, CommissionEnJeu, DefinitionsCrm, EtapesCrm, ListesCrm, ParPubCrm, TableauCrmParBien } from "./crm";
import { GraphiqueParJour, type SerieGraphique } from "./graphique";
import { Section } from "./valeurs";

/**
 * Les sections « Le CRM » de la page Pilotage (étape 3b), vue générale et
 * onglet d'un bien. Si la migration du CRM n'est pas encore appliquée, seule
 * cette section le dit : le reste de la page s'affiche.
 */

const AUTRES = "autres_biens";

function etatNonLu(crm: LectureCrm) {
  return crm.etat === "non_installe" ? (
    <p className="text-sm text-[var(--crm-text-faint)]">
      Les chiffres du CRM attendent l’installation de la migration du 23/11/2026 dans la base (docs/07 § 17).
    </p>
  ) : (
    <p className="text-sm text-[var(--crm-text-faint)]">Les chiffres du CRM n’ont pas pu être lus. Réessayez dans un instant.</p>
  );
}

/** Le graphique des demandes reçues : les mêmes colonnes que celui de la dépense. */
function graphiqueDemandes(t: TableauPilotage, lignes: LigneCrmJour[], seulement?: BienCalcule) {
  const retenues = seulement ? lignes.filter((l) => l.property_id === seulement.id) : lignes;
  const premierCrm = retenues.reduce<string | null>((min, l) => (!min || l.jour < min ? l.jour : min), null);
  const touteLaPeriode = t.periode.choix.type === "proposee" && t.periode.choix.periode === "toute_la_periode";
  const debuts = [t.periode.debut, touteLaPeriode ? premierCrm : null].filter((d): d is string => Boolean(d));
  const debut = debuts.length > 0 ? debuts.sort()[0]! : null;
  if (!debut) return { pas: "jour" as const, points: [], series: [] as SerieGraphique[] };
  const { pas, points } = decoupage(debut, t.periode.fin);
  const connus = new Set(t.biens.map((b) => b.id));
  const series: SerieGraphique[] = (seulement ? [seulement] : t.biens).map((b) => ({ cle: b.id, nom: b.nom, couleur: couleurDuBien(b) }));
  const rangees = retenues.map((l) => (connus.has(l.property_id) ? l : { ...l, property_id: AUTRES }));
  if (rangees.some((l) => l.property_id === AUTRES)) series.push({ cle: AUTRES, nom: "Autres biens", couleur: "var(--crm-serie-autre)" });
  return { pas, points: demandesParPoint(points, rangees), series };
}

export function SectionCrmGenerale({ t, crm, membres }: { t: TableauPilotage; crm: LectureCrm; membres: Map<string, MemberInfo> }) {
  if (crm.etat !== "ok") {
    return (
      <Section id="crm" titre={`Le CRM · ${t.periode.libelle}`}>
        {etatNonLu(crm)}
      </Section>
    );
  }
  const total = calculerCrm(crm.cohorte.get(null) ?? MESURES_VIDES, metaEnFace(t, null, crm.debuts.get(null) ?? null));
  const lignes = [
    ...t.biens.map((b) => ({
      id: b.id,
      nom: b.nom,
      crm: calculerCrm(crm.cohorte.get(b.id) ?? MESURES_VIDES, metaEnFace(t, b.id, crm.debuts.get(b.id) ?? null)),
    })),
    { id: "total", nom: "Total (personnes distinctes)", crm: total, total: true },
  ];
  const g = graphiqueDemandes(t, crm.parJour);
  return (
    <Section id="crm" titre={`Le CRM · ${t.periode.libelle}`} sousTitre={<DefinitionsCrm archivees={total.mesures.demandes_archivees} />}>
      <BlocCrm crm={total} total />
      <GraphiqueParJour titre="Demandes reçues" unite="leads" pas={g.pas} points={g.points} series={g.series} vide="Aucune demande sur la période." />
      <TableauCrmParBien lignes={lignes} />
      <ListesCrm crm={total} membres={membres} />
    </Section>
  );
}

export function SectionCrmBien({
  t,
  b,
  crm,
  membres,
}: {
  t: TableauPilotage;
  b: BienCalcule;
  crm: LectureCrm;
  membres: Map<string, MemberInfo>;
}) {
  if (crm.etat !== "ok") {
    return (
      <Section id="crm" titre={`Le CRM · ${t.periode.libelle}`}>
        {etatNonLu(crm)}
      </Section>
    );
  }
  const calcule = calculerCrm(crm.cohorte.get(b.id) ?? MESURES_VIDES, metaEnFace(t, b.id, crm.debuts.get(b.id) ?? null));
  const g = graphiqueDemandes(t, crm.parJour, b);
  return (
    <Section id="crm" titre={`Le CRM · ${t.periode.libelle}`} sousTitre={<DefinitionsCrm archivees={calcule.mesures.demandes_archivees} />}>
      <BlocCrm crm={calcule} />
      <CommissionEnJeu commissionHT={b.potentielHT ? formatTotal(b.potentielHT) : "manquante"} crm={calcule} />
      <GraphiqueParJour titre="Demandes reçues" unite="leads" pas={g.pas} points={g.points} series={g.series} vide="Aucune demande sur la période." />
      <EtapesCrm crm={calcule} />
      <ListesCrm crm={calcule} membres={membres} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[var(--crm-text)]">Pub par pub</p>
        <ParPubCrm lignes={crm.parPub.filter((l) => l.property_id === b.id)} noms={t.noms} />
      </div>
    </Section>
  );
}
