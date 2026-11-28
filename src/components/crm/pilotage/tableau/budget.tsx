import Link from "next/link";
import type { PilotageBudgetFormulaireRow } from "@/lib/supabase/types";
import { calculerBudget, libelleCible, reglageEnVigueur, type BudgetDuBien, type PubBudget } from "@/modules/pilotage/budget";
import { metaEnFace } from "@/modules/pilotage/crm";
import type { Lecture } from "@/modules/pilotage/queries";
import type { BienCalcule, TableauPilotage } from "@/modules/pilotage/tableau";
import type { LectureCrm } from "@/modules/pilotage/tableau-lecture";
import { formatDate } from "@/modules/crm/format";
import { DetailPub } from "./crm";
import { formatExact, Section, Tuile, Valeur } from "./valeurs";
import { divise, entier } from "@/modules/pilotage/exact";

/**
 * « Le budget déclaré » dans l'onglet d'un bien : ce que les demandes ont
 * répondu à la question du budget, la part dans la cible et son coût, pub par
 * pub. Des nombres seulement ; rien n'en part chez Meta (docs/33 § 10).
 */

const nombre = new Intl.NumberFormat("fr-FR");

function pluriel(n: number, mot: string): string {
  return `${nombre.format(n)} ${mot}${n > 1 ? "s" : ""}`;
}

export function SectionBudgetBien({
  t,
  b,
  crm,
  budgets,
}: {
  t: TableauPilotage;
  b: BienCalcule;
  crm: LectureCrm;
  budgets: Lecture<PilotageBudgetFormulaireRow[]>;
}) {
  const titre = `Le budget déclaré · ${t.periode.libelle}`;
  const nonInstalle = crm.etat === "non_installe" || (crm.etat === "ok" && crm.budget.etat === "non_installe") || budgets.etat === "non_installe";
  if (nonInstalle) {
    return (
      <Section id="budget" titre={titre}>
        <p className="text-sm text-[var(--crm-text-faint)]">
          Le budget déclaré attend l’installation de la migration du 28/11/2026 dans la base (docs/07 § 20).
        </p>
      </Section>
    );
  }
  if (crm.etat !== "ok" || crm.budget.etat !== "ok" || budgets.etat !== "ok") {
    return (
      <Section id="budget" titre={titre}>
        <p className="text-sm text-[var(--crm-text-faint)]">Le budget déclaré n’a pas pu être lu. Réessayez dans un instant.</p>
      </Section>
    );
  }

  const premiereDemande = crm.debuts.get(b.id) ?? null;
  const calcule = calculerBudget({
    t,
    bien: b.id,
    lignes: crm.budget.lignes,
    reglage: reglageEnVigueur(
      budgets.donnees.filter((v) => v.property_id === b.id),
      t.jour,
    ),
    meta: metaEnFace(t, b.id, premiereDemande),
    premiereDemande,
  });

  return (
    <Section id="budget" titre={titre} sousTitre={<Cible calcule={calcule} bien={b.id} />}>
      <TuilesBudget calcule={calcule} />
      <ParReponse calcule={calcule} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[var(--crm-text)]">Pub par pub</p>
        <ParPubBudget pubs={calcule.parPub} t={t} />
      </div>
      <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
        La réponse d’une demande est le budget <strong>corrigé par l’équipe</strong> sur la fiche, sinon celui que la
        personne a déclaré. Une demande est dans la cible si le bas de sa réponse atteint la cible ; « pas de projet » ne
        l’est jamais, une demande sans réponse n’est ni dedans ni dehors (la part se calcule sur celles qui ont répondu).
        La cible est celle en vigueur aujourd’hui, pour toute période. Le coût compte la dépense Meta des mêmes jours que
        le CRM. Une personne compte une fois, avec sa correction, sinon la réponse de sa demande la plus récente.
      </p>
    </Section>
  );
}

function Cible({ calcule, bien }: { calcule: BudgetDuBien; bien: string }) {
  const r = calcule.reglage;
  if (!r) {
    return (
      <>
        Cible non réglée : la part et le coût des demandes dans la cible ne se calculent pas.{" "}
        <Link href={`/crm/pilotage/donnees/${bien}#budget`} prefetch={false} className="underline underline-offset-2">
          Régler le budget du formulaire
        </Link>
      </>
    );
  }
  return (
    <>
      Cible en vigueur : <strong>{libelleCible(r.cibleMinCentimes)}</strong>, réglée pour le{" "}
      {formatDate(r.version.date_effet)}.{" "}
      <Link href={`/crm/pilotage/donnees/${bien}#budget`} prefetch={false} className="underline underline-offset-2">
        Modifier
      </Link>
    </>
  );
}

function TuilesBudget({ calcule }: { calcule: BudgetDuBien }) {
  const sansReponse = calcule.demandes - calcule.avecReponse;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tuile
        libelle="Ont répondu"
        aide={`sur ${pluriel(calcule.demandes, "demande")}${sansReponse > 0 ? ` · ${nombre.format(sansReponse)} sans réponse` : ""}`}
      >
        <span className="tabular-nums">{nombre.format(calcule.avecReponse)}</span>
      </Tuile>
      <Tuile libelle="Dans la cible" aide="part des demandes qui ont répondu">
        {calcule.dansLaCible === null ? (
          <Valeur calcule={calcule.part} format="pourcent" />
        ) : (
          <span className="tabular-nums">
            {nombre.format(calcule.dansLaCible)} · <Valeur calcule={calcule.part} format="pourcent" />
          </span>
        )}
      </Tuile>
      <Tuile libelle="Coût par demande dans la cible" aide="dépense Meta des mêmes jours ÷ ces demandes">
        <Valeur calcule={calcule.cout} format="euros_centimes" />
      </Tuile>
      <Tuile
        libelle="Qualifiées dans la cible"
        aide={`sur ${nombre.format(calcule.qualifies)} ${calcule.qualifies > 1 ? "personnes qualifiées" : "personne qualifiée"}`}
      >
        {calcule.qualifiesDansLaCible === null ? (
          <span className="text-xs text-[var(--crm-warning)]">cible non réglée</span>
        ) : (
          <span className="tabular-nums">{nombre.format(calcule.qualifiesDansLaCible)}</span>
        )}
      </Tuile>
    </dl>
  );
}

function marque(dedans: boolean | null): string {
  return dedans === true ? "oui" : dedans === false ? "non" : "—";
}

function ParReponse({ calcule }: { calcule: BudgetDuBien }) {
  // Même écriture que les autres parts de la page : fraction exacte, arrondie à l'affichage.
  const partDe = (n: number, sur: number) => (sur > 0 ? formatExact(divise(entier(n), entier(sur)), "pourcent") : "—");
  return (
    <div className="flex flex-col gap-2">
      <div className="crm-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="crm-sr-only">Les demandes de la période, par réponse de budget</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
              <th scope="col" className="py-2 pr-3">Réponse</th>
              <th scope="col" className="py-2 pr-3 text-right">Demandes</th>
              <th scope="col" className="py-2 pr-3 text-right">Part des réponses</th>
              <th scope="col" className="py-2 pr-3 text-right">Personnes</th>
              <th scope="col" className="py-2 pr-3 text-right">Qualifiées</th>
              <th scope="col" className="py-2 text-right">Dans la cible</th>
            </tr>
          </thead>
          <tbody>
            {calcule.lignes.map((l) => (
              <tr key={l.reponse ?? "sans"} className="border-t border-[var(--crm-line-soft)]">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--crm-text)]">
                  {l.libelle}
                  {!l.proposee && l.reponse !== null ? (
                    <span className="block text-[11px] font-normal text-[var(--crm-text-faint)]">plus proposée par le formulaire</span>
                  ) : null}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">{nombre.format(l.demandes)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">
                  {l.reponse === null ? "—" : partDe(l.demandes, calcule.avecReponse)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(l.personnes)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(l.qualifies)}</td>
                <td className="py-2 text-right text-[var(--crm-text-dim)]">{marque(l.dansLaCible)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
        « Qualifiées » : les personnes « qualifié » ou « gros potentiel » aujourd’hui, rangées sous leur réponse. C’est
        ce qui dit d’où viennent les bons dossiers, pour ajuster la cible.
      </p>
    </div>
  );
}

function ParPubBudget({ pubs, t }: { pubs: PubBudget[]; t: TableauPilotage }) {
  if (pubs.length === 0) return <p className="text-sm text-[var(--crm-text-faint)]">Aucune demande sur la période.</p>;
  const libelle = (p: PubBudget) =>
    p.niveau === "pub"
      ? (t.noms.pubs.get(p.ad_id ?? "") ?? `Pub ${p.ad_id}`)
      : p.niveau === "campagne"
        ? `Campagne : ${t.noms.campagnes.get(p.campaign_id ?? "") ?? p.campaign_id} (pub inconnue)`
        : "Non rattachée à une pub";
  return (
    <div className="crm-scroll overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="crm-sr-only">Le budget déclaré, pub par pub</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
            <th scope="col" className="py-2 pr-3">Pub</th>
            <th scope="col" className="py-2 pr-3 text-right">Demandes</th>
            <th scope="col" className="py-2 pr-3 text-right">Ont répondu</th>
            <th scope="col" className="py-2 pr-3 text-right">Dans la cible</th>
            <th scope="col" className="py-2 pr-3 text-right">Part</th>
            <th scope="col" className="py-2 text-right">Coût / demande dans la cible</th>
          </tr>
        </thead>
        <tbody>
          {pubs.map((p) => (
            <tr key={`${p.niveau}-${p.ad_id ?? ""}-${p.campaign_id ?? ""}`} className="border-t border-[var(--crm-line-soft)]">
              <th scope="row" className="crm-wrap py-2 pr-3 text-left font-medium text-[var(--crm-text)]">
                {libelle(p)}
                {p.niveau === "pub" ? <DetailPub fiche={t.fichesPubs.get(p.ad_id ?? "")} /> : null}
              </th>
              <td className="py-2 pr-3 text-right tabular-nums">{nombre.format(p.demandes)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{nombre.format(p.avecReponse)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">
                {p.dansLaCible === null ? "—" : nombre.format(p.dansLaCible)}
              </td>
              <td className="py-2 pr-3 text-right"><Valeur calcule={p.part} format="pourcent" /></td>
              <td className="py-2 text-right"><Valeur calcule={p.cout} format="euros_centimes" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
