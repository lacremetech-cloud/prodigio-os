import type { MemberInfo } from "@/modules/crm/data/noms";
import { memberDisplayName } from "@/modules/crm/data/noms";
import { formatCentimes } from "@/modules/pilotage/affichage";
import type { CrmCalcule, LigneCrmPub } from "@/modules/pilotage/crm";
import { libelleJour, type TableauPilotage } from "@/modules/pilotage/tableau";
import { Tuile, Valeur } from "./valeurs";

/**
 * Les blocs « CRM » de la page Pilotage (étape 3b). Des nombres seulement :
 * aucune ligne d'acquéreur n'arrive jusqu'ici. Chaque nombre dit ce qu'il
 * compte — des demandes, ou des personnes.
 */

const nombre = new Intl.NumberFormat("fr-FR");

/** Les définitions, dites à l'écran une fois par section. */
export function DefinitionsCrm({ archivees }: { archivees: number }) {
  return (
    <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
      Période mesurée sur la <strong>date d’arrivée de la demande</strong>. « Demandes » compte des demandes ; le reste
      compte des <strong>personnes</strong> (l’étape et la qualification sont celles de la personne, qui compte dans
      chaque bien demandé, une fois au total). Personnes archivées exclues
      {archivees > 0 ? ` (${nombre.format(archivees)} demande${archivees > 1 ? "s" : ""} écartée${archivees > 1 ? "s" : ""})` : ""}.
    </p>
  );
}

/** Les tuiles d'une portée (un bien, ou le total). */
export function BlocCrm({ crm, total = false }: { crm: CrmCalcule; total?: boolean }) {
  const m = crm.mesures;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tuile libelle="Demandes reçues" aide={`${nombre.format(m.personnes)} personne${m.personnes > 1 ? "s" : ""}`}>
          <span className="tabular-nums">{nombre.format(m.demandes)}</span>
        </Tuile>
        <Tuile libelle="Personnes qualifiées" aide="qualifié ou gros potentiel, aujourd’hui">
          <span className="tabular-nums">{nombre.format(crm.qualifies)}</span>
        </Tuile>
        <Tuile
          libelle="Visites"
          aide={`${nombre.format(m.visites.faites)} faite${m.visites.faites > 1 ? "s" : ""} · ${nombre.format(m.visites.planifiees)} à faire${m.visites.annulees > 0 ? ` · ${nombre.format(m.visites.annulees)} annulée${m.visites.annulees > 1 ? "s" : ""}` : ""}`}
        >
          <span className="tabular-nums">{nombre.format(crm.visites)}</span>
        </Tuile>
        <Tuile libelle="Offres" aide="personnes passées par « offre en cours »">
          {m.offres.personnes > 0 ? (
            <span className="tabular-nums">{nombre.format(m.offres.personnes)}</span>
          ) : (
            <span className="text-sm font-normal text-[var(--crm-text-faint)]">aucune offre saisie</span>
          )}
        </Tuile>
      </dl>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tuile libelle="Coût par demande" aide={`pub HT ÷ ${nombre.format(m.demandes)} demande${m.demandes > 1 ? "s" : ""}`}>
          <Valeur calcule={crm.couts.parDemande} format="euros_centimes" />
        </Tuile>
        <Tuile libelle="Coût par personne qualifiée" aide={`pub HT ÷ ${nombre.format(crm.qualifies)}`}>
          <Valeur calcule={crm.couts.parQualifie} format="euros_centimes" />
        </Tuile>
        <Tuile libelle="Coût par visite" aide={`pub HT ÷ ${nombre.format(crm.visites)} visite${crm.visites > 1 ? "s" : ""}`}>
          <Valeur calcule={crm.couts.parVisite} format="euros_centimes" />
        </Tuile>
        <Tuile libelle="Coût par offre" aide={m.offres.personnes > 0 ? `pub HT ÷ ${nombre.format(m.offres.personnes)}` : "aucune offre saisie"}>
          <Valeur calcule={crm.couts.parOffre} format="euros_centimes" />
        </Tuile>
      </dl>
      {crm.meta.decaleAu ? (
        <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
          <strong>Mêmes jours</strong> — la dépense et les leads Meta comptent à partir du {libelleJour(crm.meta.decaleAu)},
          jour de la première demande reçue dans le CRM{total ? ", tous biens confondus" : " pour ce bien"} : avant, les
          demandes n’y arrivaient pas.
        </p>
      ) : null}
      {m.offres.montants > 0 ? (
        <p className="text-xs text-[var(--crm-text-dim)]">
          Montants d’offre saisis : {nombre.format(m.offres.montants)}, pour {formatCentimes(m.offres.somme_cents)} en tout.
        </p>
      ) : null}
      <EcartMetaCrm crm={crm} />
    </div>
  );
}

/** Leads comptés par Meta, demandes reçues : deux mesures, qu'on ne confond pas. */
export function EcartMetaCrm({ crm }: { crm: CrmCalcule }) {
  return (
    <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
      <strong>Meta et CRM</strong>, les mêmes jours — leads comptés par Meta : <Valeur calcule={crm.meta.leads} format="nombre" /> ;
      demandes reçues reliées à une pub : {nombre.format(crm.meta.demandesPub)} ; demandes en tout :{" "}
      {nombre.format(crm.meta.demandes)}. Meta compte les leads qu’il attribue à ses pubs, selon ses règles ; le CRM compte
      chaque demande reçue, avec ou sans pub (site, partage, lien direct) : les deux ne se recoupent pas exactement.
    </p>
  );
}

/** Les étapes : où en sont les personnes aujourd'hui, et par où elles sont passées. */
export function EtapesCrm({ crm }: { crm: CrmCalcule }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="crm-scroll overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="crm-sr-only">Les étapes des personnes arrivées sur la période</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
              <th scope="col" className="py-2 pr-3">Étape</th>
              <th scope="col" className="py-2 pr-3 text-right">Aujourd’hui</th>
              <th scope="col" className="py-2 pr-3 text-right">Atteinte au moins une fois</th>
              <th scope="col" className="py-2 text-right">Part des personnes arrivées</th>
            </tr>
          </thead>
          <tbody>
            {crm.etapes.map((e) => (
              <tr key={e.valeur} className="border-t border-[var(--crm-line-soft)]">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--crm-text)]" title={e.sens}>
                  {e.label}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(e.aujourdHui)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text)]">{nombre.format(e.atteinte)}</td>
                <td className="py-2 text-right">
                  <Valeur calcule={e.part} format="pourcent" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-1 text-xs text-[var(--crm-text-dim)]">
        {crm.passages.map((p) => (
          <li key={`${p.de}-${p.vers}`}>
            Taux de passage « {p.de} » → « {p.vers} » : <Valeur calcule={p.taux} format="pourcent" />
          </li>
        ))}
      </ul>
      <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
        « Atteinte » : l’étape actuelle, ou une étape passée selon le journal du CRM ; une personne passée par une
        étape compte même si elle en est sortie. « R1 planifié » et « Offre en cours » n’existent que depuis le
        09/11/2026 (« Offre en cours » avait quitté le pipeline le 14/10/2026) : avant, personne ne pouvait les atteindre.
      </p>
    </div>
  );
}

/** Qualification, provenance, responsables : trois petites listes. */
export function ListesCrm({ crm, membres }: { crm: CrmCalcule; membres: Map<string, MemberInfo> }) {
  const responsables = Object.entries(crm.mesures.responsables)
    .map(([id, n]) => ({ libelle: id === "" ? "Sans responsable" : memberDisplayName(id, membres), n }))
    .sort((a, b) => b.n - a.n || a.libelle.localeCompare(b.libelle));
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Liste titre="Qualification (personnes, aujourd’hui)" lignes={crm.qualification.map((q) => ({ libelle: q.label, n: q.n }))} />
      <Liste titre="Provenance (demandes)" lignes={crm.provenance} />
      <Liste titre="Responsable du dossier (personnes)" lignes={responsables} note="L’affectation de la personne ; l’équipe du bien est une autre liste." />
    </div>
  );
}

function Liste({ titre, lignes, note }: { titre: string; lignes: { libelle: string; n: number }[]; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="crm-kpi__label">{titre}</p>
      {lignes.length === 0 ? (
        <p className="text-sm text-[var(--crm-text-faint)]">—</p>
      ) : (
        <ul className="flex flex-col gap-0.5 text-sm">
          {lignes.map((l) => (
            <li key={l.libelle} className="flex justify-between gap-3">
              <span className="crm-wrap text-[var(--crm-text-dim)]">{l.libelle}</span>
              <span className="tabular-nums text-[var(--crm-text)]">{nombre.format(l.n)}</span>
            </li>
          ))}
        </ul>
      )}
      {note ? <p className="text-[11px] text-[var(--crm-text-faint)]">{note}</p> : null}
    </div>
  );
}

/** Par pub : demandes, personnes, qualifiés, visites, offres ; la part non rattachée dite. */
export function ParPubCrm({ lignes, noms }: { lignes: LigneCrmPub[]; noms: TableauPilotage["noms"] }) {
  if (lignes.length === 0) return <p className="text-sm text-[var(--crm-text-faint)]">Aucune demande sur la période.</p>;
  const ordre = { pub: 0, campagne: 1, aucun: 2 } as const;
  const triees = [...lignes].sort((a, b) => ordre[a.niveau] - ordre[b.niveau] || b.demandes - a.demandes);
  const total = lignes.reduce((n, l) => n + l.demandes, 0);
  const libelle = (l: LigneCrmPub) =>
    l.niveau === "pub"
      ? (noms.pubs.get(l.ad_id ?? "") ?? `Pub ${l.ad_id}`)
      : l.niveau === "campagne"
        ? `Campagne : ${noms.campagnes.get(l.campaign_id ?? "") ?? l.campaign_id} (pub inconnue)`
        : "Non rattachée à une pub";
  return (
    <div className="flex flex-col gap-2">
      <div className="crm-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="crm-sr-only">Les demandes, pub par pub</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
              <th scope="col" className="py-2 pr-3">Pub</th>
              <th scope="col" className="py-2 pr-3 text-right">Demandes</th>
              <th scope="col" className="py-2 pr-3 text-right">Personnes</th>
              <th scope="col" className="py-2 pr-3 text-right">Qualifiées</th>
              <th scope="col" className="py-2 pr-3 text-right">Visites</th>
              <th scope="col" className="py-2 pr-3 text-right">dont faites</th>
              <th scope="col" className="py-2 text-right">Offres</th>
            </tr>
          </thead>
          <tbody>
            {triees.map((l) => (
              <tr key={`${l.niveau}-${l.ad_id ?? ""}-${l.campaign_id ?? ""}`} className="border-t border-[var(--crm-line-soft)]">
                <th scope="row" className="crm-wrap py-2 pr-3 text-left font-medium text-[var(--crm-text)]">
                  {libelle(l)}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">{nombre.format(l.demandes)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(l.personnes)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(l.qualifies)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(l.visites)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(l.visites_faites)}</td>
                <td className="py-2 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(l.offres)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
        La pub d’une demande se lit dans son adresse : un identifiant reconnu par la lecture Meta, sinon le nom exact
        d’une pub, sinon sa campagne. Non rattachées :{" "}
        {nombre.format(lignes.filter((l) => l.niveau === "aucun").reduce((n, l) => n + l.demandes, 0))} demande(s) sur{" "}
        {nombre.format(total)}.
      </p>
    </div>
  );
}

/** La vue générale : une ligne par bien, et le total en personnes distinctes. */
export function TableauCrmParBien({
  lignes,
}: {
  lignes: { id: string; nom: string; crm: CrmCalcule; total?: boolean }[];
}) {
  const decales = lignes.filter((l) => l.crm.meta.decaleAu);
  return (
    <div className="flex flex-col gap-2">
      <div className="crm-scroll overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <caption className="crm-sr-only">Le CRM, bien par bien, sur la période</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
              <th scope="col" className="py-2 pr-3">Bien</th>
              <th scope="col" className="py-2 pr-3 text-right">Demandes</th>
              <th scope="col" className="py-2 pr-3 text-right">Personnes</th>
              <th scope="col" className="py-2 pr-3 text-right">Qualifiées</th>
              <th scope="col" className="py-2 pr-3 text-right">Visites</th>
              <th scope="col" className="py-2 pr-3 text-right">Offres</th>
              <th scope="col" className="py-2 pr-3 text-right">Leads Meta</th>
              <th scope="col" className="py-2 pr-3 text-right">Demandes d’une pub</th>
              <th scope="col" className="py-2 text-right">Coût / demande</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ id, nom, crm, total }) => (
              <tr
                key={id}
                className={total ? "border-t-2 border-[var(--crm-line)] font-semibold text-[var(--crm-text)]" : "border-t border-[var(--crm-line-soft)]"}
              >
                <th scope="row" className="py-2.5 pr-3 text-left font-medium text-[var(--crm-text)]">{nom}</th>
                <td className="py-2.5 pr-3 text-right tabular-nums">{nombre.format(crm.mesures.demandes)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{nombre.format(crm.mesures.personnes)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{nombre.format(crm.qualifies)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{nombre.format(crm.visites)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {crm.mesures.offres.personnes > 0 ? nombre.format(crm.mesures.offres.personnes) : "—"}
                </td>
                <td className="py-2.5 pr-3 text-right"><Valeur calcule={crm.meta.leads} format="nombre" /></td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{nombre.format(crm.meta.demandesPub)}</td>
                <td className="py-2.5 text-right"><Valeur calcule={crm.couts.parDemande} format="euros_centimes" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {decales.length > 0 ? (
        <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
          Leads Meta et coût par demande comptés à partir de la première demande reçue dans le CRM :{" "}
          {decales.map((l) => `${l.total ? "total" : l.nom}, ${libelleJour(l.crm.meta.decaleAu!)}`).join(" ; ")}.
        </p>
      ) : null}
    </div>
  );
}

/** La commission en jeu, à côté des dossiers les plus avancés du bien. */
export function CommissionEnJeu({ commissionHT, crm }: { commissionHT: string; crm: CrmCalcule }) {
  const visite = crm.mesures.etapes.visite_planifiee ?? 0;
  const offre = crm.mesures.etapes.offre_en_cours ?? 0;
  return (
    <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
      <strong>Commission en jeu</strong> : {commissionHT} HT — personnes aujourd’hui en « visite planifiée » :{" "}
      {nombre.format(visite)} ; en « offre en cours » : {nombre.format(offre)}.
    </p>
  );
}
