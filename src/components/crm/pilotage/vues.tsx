import Link from "next/link";
import type { PilotageConditionsRow, PilotageCoutFixeRow } from "@/lib/supabase/types";
import type { CalculCommission, Montant, PartApplicable } from "@/modules/pilotage/commission";
import type { Alerte, SyntheseBien } from "@/modules/pilotage/synthese";
import type { EtatVersion } from "@/modules/pilotage/versions";
import {
  formatCentimes,
  formatMontant,
  formatPourcentage,
  formatTotal,
} from "@/modules/pilotage/affichage";
import {
  baseHonorairesLabels,
  naturePrixLabels,
  statutCommercialLabels,
  typeCoutLabels,
} from "@/modules/pilotage/labels";
import { MESSAGE_NON_INSTALLE } from "@/modules/pilotage/erreurs";
import { formatDate, formatDateTime } from "@/modules/crm/format";
import { memberDisplayName, type MemberInfo } from "@/modules/crm/data/noms";
import { Chip } from "@/components/crm/ui";
import { AnnulerCoutFixe } from "./couts-fixes";

/**
 * Les vues du pilotage, rendues côté serveur. Aucune logique de calcul ici :
 * tout vient de `syntheseDuBien`. Les montants s'affichent arrondis à l'euro ;
 * ce qui manque s'affiche « manquant », avec sa raison — jamais 0.
 */

export function AccesReserve() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="crm-panel p-6">
        <h1 className="text-lg font-semibold text-[var(--crm-text)]">Accès réservé</h1>
        <p className="mt-2 text-sm text-[var(--crm-text-dim)]">
          Le pilotage pub — commissions, parts et coûts — est réservé aux administrateurs.
        </p>
        <Link href="/crm" className="mt-4 inline-block text-sm text-[var(--crm-univers)] underline">
          ← Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}

export function NonInstalle() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="crm-panel p-6">
        <p className="crm-eyebrow">Pilotage pub</p>
        <h1 className="mt-1 text-lg font-semibold text-[var(--crm-text)]">Pas encore installé</h1>
        <p className="mt-2 crm-wrap text-sm text-[var(--crm-text-dim)]">{MESSAGE_NON_INSTALLE}</p>
        <p className="mt-2 crm-wrap text-xs text-[var(--crm-text-faint)]">
          Fichier : <code>supabase/migrations/20261112150000_pilotage_conditions_lots_et_couts_fixes.sql</code>.
          Elle ajoute quatre tables et quatre fonctions ; elle ne modifie ni n’efface rien d’existant.
        </p>
      </div>
    </div>
  );
}

export function ErreurLecture() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="crm-panel p-6">
        <h1 className="text-lg font-semibold text-[var(--crm-text)]">Lecture impossible</h1>
        <p className="mt-2 text-sm text-[var(--crm-text-dim)]">
          Les données du pilotage n’ont pas pu être lues. Rien n’a été modifié. Actualisez la page dans un instant ;
          si cela persiste, signalez-le.
        </p>
      </div>
    </div>
  );
}

export function Alertes({ alertes }: { alertes: Alerte[] }) {
  if (alertes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="À savoir">
      {alertes.map((a) => (
        <li
          key={a.texte}
          className={
            a.niveau === "attention"
              ? "crm-avertissement crm-wrap"
              : "crm-wrap rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-[14px] py-[10px] text-[13px] text-[var(--crm-text-dim)]"
          }
        >
          <span className="font-semibold">{a.niveau === "attention" ? "⚠ À vérifier : " : "ℹ "}</span>
          {a.texte}
        </li>
      ))}
    </ul>
  );
}

/** Une ligne du calcul : ce qu'on calcule, comment, et le résultat. */
function Etape({ libelle, formule, valeur, fort = false }: { libelle: string; formule?: string; valeur: string; fort?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-[var(--crm-line-soft)] py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
      <dt className="min-w-0">
        <span className={fort ? "text-sm font-semibold text-[var(--crm-text)]" : "text-sm text-[var(--crm-text)]"}>
          {libelle}
        </span>
        {formule ? <span className="block text-xs text-[var(--crm-text-faint)]">{formule}</span> : null}
      </dt>
      <dd className={fort ? "text-base font-semibold tabular-nums text-[var(--crm-text)] sm:text-right" : "text-sm tabular-nums text-[var(--crm-text-dim)] sm:text-right"}>
        {valeur}
      </dd>
    </div>
  );
}

function libellePart(part: PartApplicable): string {
  if (part.source === "mandat") return `${formatPourcentage(part.pct, 2)} (photographie du mandat)`;
  return formatPourcentage(part.pct, 2);
}

/** Le calcul pas à pas, formules écrites, pour un prix donné. */
export function ControleDuCalcul({
  calcul,
  conditions,
  part,
  titrePrix = "Prix affiché",
}: {
  calcul: CalculCommission;
  conditions: PilotageConditionsRow;
  part: PartApplicable;
  titrePrix?: string;
}) {
  const taux = formatPourcentage(conditions.taux_commission_pct, 4);
  const tva = formatPourcentage(conditions.taux_tva_pct, 2);
  const partTexte = formatPourcentage(part.pct, 2);
  return (
    <dl className="flex flex-col">
      <Etape libelle={titrePrix} valeur={formatMontant(calcul.prixAffiche)} />
      <Etape
        libelle={`Taux de commission (${baseHonorairesLabels[conditions.base_honoraires]})`}
        valeur={taux}
      />
      <Etape libelle="Prix net vendeur" formule={`prix ÷ (1 + ${taux})`} valeur={formatMontant(calcul.netVendeur)} />
      <Etape libelle="Commission totale TTC" formule="prix − prix net vendeur" valeur={formatMontant(calcul.comTotaleTTC)} />
      <Etape libelle="Part de Prodigio" valeur={libellePart(part)} />
      <Etape
        libelle="Commission Prodigio TTC"
        formule={`commission totale TTC × ${partTexte}`}
        valeur={formatMontant(calcul.comProdigioTTC)}
      />
      <Etape
        libelle="Commission Prodigio HT"
        formule={`commission Prodigio TTC ÷ (1 + ${tva} de TVA)`}
        valeur={formatMontant(calcul.comProdigioHT)}
        fort
      />
    </dl>
  );
}

/** Le résumé des conditions en vigueur. */
export function ResumeConditions({ synthese }: { synthese: SyntheseBien }) {
  const c = synthese.enVigueur;
  if (!c) return null;
  const lignes: [string, string][] = [
    ["En vigueur depuis le", formatDate(c.date_effet)],
    ["Vente", c.vente_par_lots ? "par lots" : "en un seul bloc"],
    ["Prix saisi", naturePrixLabels[c.nature_prix]],
  ];
  if (!c.vente_par_lots) {
    lignes.push(["Prix affiché", formatCentimes(c.prix_affiche_cents)]);
    lignes.push(["Statut", c.statut_commercial ? statutCommercialLabels[c.statut_commercial] : "manquant"]);
    if (c.statut_commercial === "vendu") {
      lignes.push(["Prix de vente final", formatCentimes(c.prix_vente_final_cents)]);
      lignes.push(["Vendu le", c.vendu_le ? formatDate(c.vendu_le) : "manquant"]);
    }
  }
  lignes.push(
    ["Taux de commission", `${formatPourcentage(c.taux_commission_pct, 4)} · ${baseHonorairesLabels[c.base_honoraires]}`],
    ["Part de Prodigio", libellePart(synthese.part)],
    ["TVA sur les honoraires", formatPourcentage(c.taux_tva_pct, 2)],
  );
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {lignes.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="crm-label">{k}</dt>
          <dd className="crm-wrap text-sm text-[var(--crm-text)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const etatVersionLabels: Record<EtatVersion, string> = {
  en_vigueur: "En vigueur",
  a_venir: "À venir",
  remplacee: "Remplacée",
};

function auteur(userId: string | null, membres: Map<string, MemberInfo>): string {
  return userId ? memberDisplayName(userId, membres) : "—";
}

/** L'historique des conditions : chaque version, ce qu'elle disait, qui, quand, pourquoi. */
export function HistoriqueConditions({
  historique,
  membres,
}: {
  historique: SyntheseBien["historique"];
  membres: Map<string, MemberInfo>;
}) {
  if (historique.length === 0) {
    return <p className="text-sm text-[var(--crm-text-faint)]">Aucune version enregistrée.</p>;
  }
  return (
    <div className="crm-scroll overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <caption className="crm-sr-only">Versions des conditions de commercialisation</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
            <th scope="col" className="py-2 pr-3">Effet</th>
            <th scope="col" className="py-2 pr-3">État</th>
            <th scope="col" className="py-2 pr-3">Prix</th>
            <th scope="col" className="py-2 pr-3">Taux</th>
            <th scope="col" className="py-2 pr-3">Part</th>
            <th scope="col" className="py-2 pr-3">TVA</th>
            <th scope="col" className="py-2 pr-3">Statut</th>
            <th scope="col" className="py-2 pr-3">Saisie</th>
            <th scope="col" className="py-2 pr-3">Motif</th>
          </tr>
        </thead>
        <tbody>
          {historique.map(({ version: v, etat }) => (
            <tr key={v.id} className="border-t border-[var(--crm-line-soft)] align-top">
              <td className="py-2 pr-3 text-[var(--crm-text)]">{formatDate(v.date_effet)}</td>
              <td className="py-2 pr-3">
                <Chip variant={etat === "en_vigueur" ? "ok" : etat === "a_venir" ? "gold" : "neutral"}>
                  {etatVersionLabels[etat]}
                </Chip>
              </td>
              <td className="py-2 pr-3 tabular-nums text-[var(--crm-text-dim)]">
                {v.vente_par_lots ? "par lots" : formatCentimes(v.prix_affiche_cents)}
              </td>
              <td className="py-2 pr-3 tabular-nums text-[var(--crm-text-dim)]">
                {formatPourcentage(v.taux_commission_pct, 4)} {baseHonorairesLabels[v.base_honoraires]}
              </td>
              <td className="py-2 pr-3 tabular-nums text-[var(--crm-text-dim)]">
                {v.part_prodigio_pct == null ? "mandat" : formatPourcentage(v.part_prodigio_pct, 2)}
              </td>
              <td className="py-2 pr-3 tabular-nums text-[var(--crm-text-dim)]">{formatPourcentage(v.taux_tva_pct, 2)}</td>
              <td className="py-2 pr-3 text-[var(--crm-text-dim)]">
                {v.statut_commercial ? statutCommercialLabels[v.statut_commercial] : "—"}
              </td>
              <td className="py-2 pr-3 text-[var(--crm-text-dim)]">
                {formatDateTime(v.saisi_le)}
                <span className="block text-xs text-[var(--crm-text-faint)]">{auteur(v.saisi_par, membres)}</span>
              </td>
              <td className="crm-wrap py-2 pr-3 text-[var(--crm-text-dim)]">{v.motif}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Un montant de commission pour une cellule : la valeur, ou la raison de son absence. */
export function Cellule({ montant }: { montant: Montant | undefined }) {
  if (!montant) return <span className="text-[var(--crm-text-faint)]">—</span>;
  return montant.ok ? (
    <span className="tabular-nums">{formatMontant(montant)}</span>
  ) : (
    <span className="text-xs text-[var(--crm-warning)]">{formatMontant(montant)}</span>
  );
}

export function TotauxDesLots({ synthese }: { synthese: SyntheseBien }) {
  const t = synthese.totalLots;
  if (!t) return null;
  const lignes: [string, string][] = [
    ["Prix des lots suivis", formatTotal(t.prix)],
    ["Commission totale TTC", formatTotal(t.comTotaleTTC)],
    ["Commission Prodigio TTC", formatTotal(t.comProdigioTTC)],
    ["Commission Prodigio HT", formatTotal(t.comProdigioHT)],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {lignes.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="crm-label">{k}</dt>
          <dd className="text-sm font-semibold tabular-nums text-[var(--crm-text)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Le journal des coûts fixes : les actifs, puis les annulés, barrés. */
export function JournalCouts({
  couts,
  membres,
}: {
  couts: SyntheseBien["couts"];
  membres: Map<string, MemberInfo>;
}) {
  const lignes: PilotageCoutFixeRow[] = [...couts.actifs, ...couts.annules];
  if (lignes.length === 0) {
    return <p className="text-sm text-[var(--crm-text-faint)]">Aucun coût fixe saisi pour ce bien.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {lignes.map((c) => {
        const annule = Boolean(c.annule_le);
        const libelle = `${typeCoutLabels[c.type_cout]}, ${formatCentimes(c.montant_ht_cents)} HT`;
        return (
          <li
            key={c.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
          >
            <div className={annule ? "min-w-0 text-[var(--crm-text-faint)] line-through" : "min-w-0"}>
              <p className="text-sm text-[var(--crm-text)]">
                <span className="font-semibold tabular-nums">{formatCentimes(c.montant_ht_cents)} HT</span>
                {" · "}
                {typeCoutLabels[c.type_cout]}
              </p>
              {c.note ? <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">{c.note}</p> : null}
              <p className="text-[11px] text-[var(--crm-text-faint)]">
                Saisi le {formatDateTime(c.saisi_le)} par {auteur(c.saisi_par, membres)}
              </p>
            </div>
            {annule ? (
              <p className="text-[11px] text-[var(--crm-text-faint)] sm:text-right">
                <Chip variant="danger">Annulé</Chip>
                <span className="mt-1 block">
                  le {formatDateTime(c.annule_le)} par {auteur(c.annule_par, membres)}
                </span>
                {c.motif_annulation ? <span className="crm-wrap block">« {c.motif_annulation} »</span> : null}
              </p>
            ) : (
              <AnnulerCoutFixe coutId={c.id} libelle={libelle} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
