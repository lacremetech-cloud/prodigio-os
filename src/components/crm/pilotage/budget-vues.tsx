import type { PilotageBudgetFormulaireRow } from "@/lib/supabase/types";
import { libelleCible, type PropositionBudget, type ReglageBudget } from "@/modules/pilotage/budget";
import { etatDeLaVersion, historique, versionEnVigueur, type EtatVersion } from "@/modules/pilotage/versions";
import { lireTranchesDuFormulaire, reponsesDuFormulaire } from "@/modules/buyers/funnel/tranches";
import { BUDGET_CHOICE_COURT, type BuyerBudgetChoice } from "@/modules/buyers/funnel/universal";
import { formatCentimes } from "@/modules/pilotage/affichage";
import { formatDate, formatDateTime } from "@/modules/crm/format";
import { memberDisplayName, type MemberInfo } from "@/modules/crm/data/noms";
import { Chip } from "@/components/crm/ui";

/**
 * Le budget du formulaire d'un bien, dans les données du pilotage : ce qui est
 * en vigueur, et l'historique. Vues serveur, sans calcul : tout vient de
 * `reglageEnVigueur` et des helpers de version.
 */

const etatLabels: Record<EtatVersion, string> = {
  en_vigueur: "En vigueur",
  a_venir: "À venir",
  remplacee: "Remplacée",
};

function reponses(tranches: readonly string[] | null): string {
  const lues = tranches ? lireTranchesDuFormulaire(tranches) : null;
  return reponsesDuFormulaire(lues)
    .map((r) => BUDGET_CHOICE_COURT[r as BuyerBudgetChoice] ?? r)
    .join(" · ");
}

export function ResumeBudget({
  reglage,
  proposition,
}: {
  reglage: ReglageBudget | null;
  proposition: PropositionBudget | null;
}) {
  if (!reglage) {
    return (
      <div className="flex flex-col gap-2 text-sm text-[var(--crm-text-dim)]">
        <p className="crm-wrap">
          Aucun réglage : le formulaire propose les réponses d’aujourd’hui ({reponses(null)}), et Pilotage pub ne calcule
          ni la part ni le coût des demandes dans la cible.
        </p>
        {proposition ? (
          <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
            Proposition d’après {proposition.depuis === "prix_affiche" ? "le prix affiché" : "le lot le moins cher"} (
            {formatCentimes(proposition.prixCentimes)}) : {reponses(proposition.tranches)} ; cible{" "}
            {libelleCible(proposition.cibleMinCentimes)}. Préremplie ci-dessous, à valider ou modifier.
          </p>
        ) : (
          <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
            Sans prix saisi, aucune proposition : choisissez les tranches et la cible ci-dessous.
          </p>
        )}
      </div>
    );
  }
  const lignes: [string, string][] = [
    ["En vigueur depuis le", formatDate(reglage.version.date_effet)],
    ["Réponses proposées", reponses(reglage.tranches)],
    ["Dans la cible", libelleCible(reglage.cibleMinCentimes)],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
      {lignes.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="crm-label">{k}</dt>
          <dd className="crm-wrap text-sm text-[var(--crm-text)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HistoriqueBudget({
  versions,
  jour,
  membres,
}: {
  versions: readonly PilotageBudgetFormulaireRow[];
  jour: string;
  membres: Map<string, MemberInfo>;
}) {
  if (versions.length === 0) {
    return <p className="text-sm text-[var(--crm-text-faint)]">Aucune version enregistrée.</p>;
  }
  const enVigueur = versionEnVigueur(versions, jour);
  return (
    <div className="crm-scroll overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="crm-sr-only">Versions du budget du formulaire</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
            <th scope="col" className="py-2 pr-3">Effet</th>
            <th scope="col" className="py-2 pr-3">État</th>
            <th scope="col" className="py-2 pr-3">Réponses</th>
            <th scope="col" className="py-2 pr-3">Cible</th>
            <th scope="col" className="py-2 pr-3">Saisie</th>
            <th scope="col" className="py-2 pr-3">Motif</th>
          </tr>
        </thead>
        <tbody>
          {historique(versions).map((v) => {
            const etat = etatDeLaVersion(v, enVigueur, jour);
            return (
              <tr key={v.id} className="border-t border-[var(--crm-line-soft)] align-top">
                <td className="py-2 pr-3 text-[var(--crm-text)]">{formatDate(v.date_effet)}</td>
                <td className="py-2 pr-3">
                  <Chip variant={etat === "en_vigueur" ? "ok" : etat === "a_venir" ? "gold" : "neutral"}>{etatLabels[etat]}</Chip>
                </td>
                <td className="crm-wrap py-2 pr-3 text-[var(--crm-text-dim)]">{reponses(v.tranches)}</td>
                <td className="py-2 pr-3 text-[var(--crm-text-dim)]">{libelleCible(v.cible_min_cents)}</td>
                <td className="py-2 pr-3 text-[var(--crm-text-dim)]">
                  {formatDateTime(v.saisi_le)}
                  <span className="block text-xs text-[var(--crm-text-faint)]">
                    {v.saisi_par ? memberDisplayName(v.saisi_par, membres) : "—"}
                  </span>
                </td>
                <td className="crm-wrap py-2 pr-3 text-[var(--crm-text-dim)]">{v.motif}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
