import Link from "next/link";
import type { Total } from "@/modules/pilotage/commission";
import { formatCentimes, formatPourcentage, formatTotal } from "@/modules/pilotage/affichage";
import { moins, type Exact } from "@/modules/pilotage/exact";
import { typeCoutLabels, TYPES_COUT } from "@/modules/pilotage/labels";
import { formatDateTime } from "@/modules/crm/format";
import {
  CLE_NON_RATTACHEE,
  type BienCalcule,
  type EtatDeLaLecture,
  type Frequence,
  type Indicateurs,
  type PubGagnante,
  type Rentabilite,
  type TableauPilotage,
} from "@/modules/pilotage/tableau";
import { Cellule } from "../vues";
import type { PointGraphique, SerieGraphique } from "./graphique";
import { enNombre, formatExact, Tuile, Valeur, ValeurFrequence, ValeurMeta, ValeurTotal } from "./valeurs";

/** La couleur d'un bien : son rang, fixe ; au-delà de huit, « Autres biens ». */
export function couleurDuBien(b: Pick<BienCalcule, "couleur">): string {
  return b.couleur === null ? "var(--crm-serie-autre)" : `var(--crm-serie-${b.couleur + 1})`;
}

/** La commission en grand : HT, et TTC à côté. */
export function CommissionEnGrand({ ht, ttc, legende }: { ht: Total | null; ttc: Total | null; legende: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="crm-kpi__label">Commission Prodigio potentielle</p>
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-4xl font-semibold tracking-tight text-[var(--crm-text)] sm:text-5xl">
          <ValeurTotal total={ht} /> <span className="text-base font-medium text-[var(--crm-text-dim)]">HT</span>
        </span>
        <span className="text-xl font-medium text-[var(--crm-text-dim)]">
          <ValeurTotal total={ttc} /> TTC
        </span>
      </p>
      <p className="text-xs text-[var(--crm-text-faint)]">{legende}</p>
    </div>
  );
}

/** Le détail du calcul, bien par bien, formule écrite. */
export function DetailDesCommissions({ biens, suffixe }: { biens: BienCalcule[]; suffixe: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="crm-scroll overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <caption className="crm-sr-only">Le calcul de la commission, bien par bien</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
              <th scope="col" className="py-2 pr-3">Bien</th>
              <th scope="col" className="py-2 pr-3 text-right">Prix affiché</th>
              <th scope="col" className="py-2 pr-3 text-right">Taux</th>
              <th scope="col" className="py-2 pr-3 text-right">Prix net vendeur</th>
              <th scope="col" className="py-2 pr-3 text-right">Com. totale TTC</th>
              <th scope="col" className="py-2 pr-3 text-right">Part</th>
              <th scope="col" className="py-2 pr-3 text-right">Com. Prodigio TTC</th>
              <th scope="col" className="py-2 text-right">Com. Prodigio HT</th>
            </tr>
          </thead>
          <tbody>
            {biens.map((b) => {
              const s = b.synthese;
              const c = s.enVigueur;
              const lien = `/crm/pilotage/biens/${b.id}${suffixe}`;
              if (!c) {
                return (
                  <tr key={b.id} className="border-t border-[var(--crm-line-soft)]">
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium text-[var(--crm-text)]">
                      <Link href={lien} prefetch={false} className="underline-offset-2 hover:underline">{b.nom}</Link>
                    </th>
                    <td colSpan={7} className="py-2.5 text-right">
                      <ValeurTotal total={null} />
                    </td>
                  </tr>
                );
              }
              const t = s.totalLots;
              const net = t && t.prix.complet && t.comTotaleTTC.complet ? moins(t.prix.centimes, t.comTotaleTTC.centimes) : null;
              return (
                <tr key={b.id} className="border-t border-[var(--crm-line-soft)] align-top">
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-[var(--crm-text)]">
                    <Link href={lien} prefetch={false} className="underline-offset-2 hover:underline">{b.nom}</Link>
                    {t ? <span className="block text-xs font-normal text-[var(--crm-text-faint)]">{s.lots.length} lots — détail lot par lot dans l’onglet</span> : null}
                  </th>
                  <td className="py-2.5 pr-3 text-right">{t ? formatTotal(t.prix) : <Cellule montant={s.potentiel?.prixAffiche} />}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{formatPourcentage(c.taux_commission_pct, 4)}</td>
                  <td className="py-2.5 pr-3 text-right">{t ? (net ? formatExact(net, "euros") : "—") : <Cellule montant={s.potentiel?.netVendeur} />}</td>
                  <td className="py-2.5 pr-3 text-right">{t ? formatTotal(t.comTotaleTTC) : <Cellule montant={s.potentiel?.comTotaleTTC} />}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">{formatPourcentage(s.part.pct, 2)}</td>
                  <td className="py-2.5 pr-3 text-right">{t ? formatTotal(t.comProdigioTTC) : <Cellule montant={s.potentiel?.comProdigioTTC} />}</td>
                  <td className="py-2.5 text-right font-semibold text-[var(--crm-text)]">
                    <ValeurTotal total={b.potentielHT} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
        Prix net vendeur = prix FAI ÷ (1 + taux) · commission totale TTC = prix − prix net vendeur · commission Prodigio
        TTC = commission totale × part · commission Prodigio HT = TTC ÷ (1 + TVA). Calcul exact, arrondi à l’euro à
        l’affichage seulement.
      </p>
    </div>
  );
}

/** « Rentabilité · depuis le début ». */
export function BlocRentabilite({ r, encaisseHT, global = false }: { r: Rentabilite; encaisseHT: Total; global?: boolean }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <Tuile libelle="Pub Meta investie HT" aide={global ? "hors portefeuille exclu" : undefined}>
        <Valeur calcule={r.pubHT} format="euros" />
      </Tuile>
      <Tuile libelle={global ? "ROAS potentiel global" : "ROAS potentiel"} aide="commission HT ÷ pub HT">
        <Valeur calcule={r.roas} format="ratio" />
      </Tuile>
      <Tuile libelle="Marge nette HT potentielle" aide="commission − pub − coûts fixes">
        <Valeur calcule={r.margeNetteHT} format="euros" />
      </Tuile>
      <Tuile libelle="Commission encaissée HT" aide="biens et lots vendus, au prix final">
        <span className="tabular-nums">{formatTotal(encaisseHT)}</span>
      </Tuile>
      <Tuile libelle="Coûts fixes HT">
        <span className="tabular-nums">{formatCentimes(r.coutsFixesHT)}</span>
      </Tuile>
    </dl>
  );
}

/** « Performance Meta », sur la période choisie. */
export function BlocPerformance({ ind, frequence }: { ind: Indicateurs | null; frequence: Frequence }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Tuile libelle="Pub HT">
        <ValeurMeta indicateurs={ind} champ="depense" format="euros" />
      </Tuile>
      <Tuile libelle="Leads" aide="comptés par Meta">
        <ValeurMeta indicateurs={ind} champ="leads" format="nombre" />
      </Tuile>
      <Tuile libelle="Coût par lead">
        <ValeurMeta indicateurs={ind} champ="coutParLead" format="euros_centimes" />
      </Tuile>
      <Tuile libelle="CTR" aide="tous les clics ÷ impressions">
        <ValeurMeta indicateurs={ind} champ="ctr" format="pourcent" />
      </Tuile>
      <Tuile libelle="CPM" aide="pour mille impressions">
        <ValeurMeta indicateurs={ind} champ="cpm" format="euros_centimes" />
      </Tuile>
      <Tuile libelle="Fréquence" aide="impressions ÷ couverture">
        <ValeurFrequence frequence={frequence} />
      </Tuile>
    </dl>
  );
}

/** D'où viennent les chiffres Meta, et jusqu'à quand. */
export function LectureMeta({ lecture }: { lecture: EtatDeLaLecture }) {
  if (!lecture.lu) {
    return <p className="text-xs text-[var(--crm-text-faint)]">Meta n’a pas encore été lu : les chiffres Meta sont « en attente ».</p>;
  }
  return (
    <p className="text-xs text-[var(--crm-text-faint)]">
      Chiffres Meta lus le {lecture.lueLe ? formatDateTime(lecture.lueLe) : "—"}
      {lecture.couvertJusquAu ? `, jusqu’au ${lecture.couvertJusquAu.split("-").reverse().join("/")} inclus` : ""}. Dépenses
      prises HT ; leads = l’action « lead » de Meta.
    </p>
  );
}

/** Le tableau par bien : « depuis le début » et « sur la période ». */
export function TableauParBien({ t, suffixe }: { t: TableauPilotage; suffixe: string }) {
  const tete = "py-2 pr-3 text-right";
  return (
    <div className="crm-scroll overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <caption className="crm-sr-only">Chaque bien, depuis le début et sur la période</caption>
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
            <th scope="col" rowSpan={2} className="py-2 pr-3 text-left align-bottom">Bien</th>
            <th scope="colgroup" colSpan={6} className="border-b border-[var(--crm-line-soft)] py-2 text-left">Depuis le début</th>
            <th scope="colgroup" colSpan={6} className="border-b border-[var(--crm-line-soft)] py-2 pl-4 text-left">
              Sur la période — {t.periode.libelle}
            </th>
          </tr>
          <tr className="text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
            <th scope="col" className={tete}>Com. HT</th>
            <th scope="col" className={tete}>Pub HT</th>
            <th scope="col" className={tete}>Leads</th>
            <th scope="col" className={tete}>Coût / lead</th>
            <th scope="col" className={tete}>ROAS</th>
            <th scope="col" className={tete}>Marge nette HT</th>
            <th scope="col" className={`${tete} pl-4`}>Pub HT</th>
            <th scope="col" className={tete}>Leads</th>
            <th scope="col" className={tete}>Coût / lead</th>
            <th scope="col" className={tete}>CTR</th>
            <th scope="col" className={tete}>CPM</th>
            <th scope="col" className="py-2 text-right">Fréquence</th>
          </tr>
        </thead>
        <tbody>
          {t.biens.map((b) => (
            <tr key={b.id} className="border-t border-[var(--crm-line-soft)]">
              <th scope="row" className="py-2.5 pr-3 text-left font-medium text-[var(--crm-text)]">
                <span className="flex items-center gap-2">
                  <svg width="10" height="10" aria-hidden="true">
                    <rect width="10" height="10" rx="2" style={{ fill: couleurDuBien(b) }} />
                  </svg>
                  <Link href={`/crm/pilotage/biens/${b.id}${suffixe}`} prefetch={false} className="underline-offset-2 hover:underline">
                    {b.nom}
                  </Link>
                </span>
              </th>
              <td className="py-2.5 pr-3 text-right"><ValeurTotal total={b.potentielHT} /></td>
              <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={b.depuisLeDebut} champ="depense" format="euros" /></td>
              <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={b.depuisLeDebut} champ="leads" format="nombre" /></td>
              <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={b.depuisLeDebut} champ="coutParLead" format="euros_centimes" /></td>
              <td className="py-2.5 pr-3 text-right"><Valeur calcule={b.rentabilite.roas} format="ratio" /></td>
              <td className="py-2.5 pr-3 text-right"><Valeur calcule={b.rentabilite.margeNetteHT} format="euros" /></td>
              <td className="py-2.5 pr-3 pl-4 text-right"><ValeurMeta indicateurs={b.surLaPeriode} champ="depense" format="euros" /></td>
              <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={b.surLaPeriode} champ="leads" format="nombre" /></td>
              <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={b.surLaPeriode} champ="coutParLead" format="euros_centimes" /></td>
              <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={b.surLaPeriode} champ="ctr" format="pourcent" /></td>
              <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={b.surLaPeriode} champ="cpm" format="euros_centimes" /></td>
              <td className="py-2.5 text-right"><ValeurFrequence frequence={b.frequence} /></td>
            </tr>
          ))}
          <tr className="border-t-2 border-[var(--crm-line)] font-semibold text-[var(--crm-text)]">
            <th scope="row" className="py-2.5 pr-3 text-left">Total</th>
            <td className="py-2.5 pr-3 text-right"><ValeurTotal total={t.global.potentielHT} /></td>
            <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={t.global.depuisLeDebut} champ="depense" format="euros" /></td>
            <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={t.global.depuisLeDebut} champ="leads" format="nombre" /></td>
            <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={t.global.depuisLeDebut} champ="coutParLead" format="euros_centimes" /></td>
            <td className="py-2.5 pr-3 text-right"><Valeur calcule={t.global.rentabilite.roas} format="ratio" /></td>
            <td className="py-2.5 pr-3 text-right"><Valeur calcule={t.global.rentabilite.margeNetteHT} format="euros" /></td>
            <td className="py-2.5 pr-3 pl-4 text-right"><ValeurMeta indicateurs={t.global.surLaPeriode} champ="depense" format="euros" /></td>
            <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={t.global.surLaPeriode} champ="leads" format="nombre" /></td>
            <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={t.global.surLaPeriode} champ="coutParLead" format="euros_centimes" /></td>
            <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={t.global.surLaPeriode} champ="ctr" format="pourcent" /></td>
            <td className="py-2.5 pr-3 text-right"><ValeurMeta indicateurs={t.global.surLaPeriode} champ="cpm" format="euros_centimes" /></td>
            <td className="py-2.5 text-right"><ValeurFrequence frequence={t.global.frequence} /></td>
          </tr>
        </tbody>
      </table>
      {t.biens.some((b) => b.depensesCommunes) ? (
        <p className="mt-2 text-xs text-[var(--crm-text-faint)]">
          Une pub commune à plusieurs biens est répartie entre eux au prorata du prix affiché — sa dépense, ses impressions,
          ses clics et ses leads : la somme des biens égale le total.
        </p>
      ) : null}
      {!isZero(t.global.nonRattachee.depuisLeDebut) ? (
        <p className="mt-1 text-xs text-[var(--crm-text-faint)]">
          Le total compte aussi la dépense rattachée à aucun bien ({formatExact(t.global.nonRattachee.depuisLeDebut, "euros")} depuis
          le début) ; il exclut le hors portefeuille.
        </p>
      ) : null}
    </div>
  );
}

function isZero(x: Exact): boolean {
  return x.n === BigInt(0);
}

/** Les pubs gagnantes : le plus de leads ; à égalité, le moins cher par lead. */
export function PubsGagnantes({ pubs, biens, vide }: { pubs: PubGagnante[]; biens: BienCalcule[]; vide: string }) {
  if (pubs.length === 0) return <p className="text-sm text-[var(--crm-text-faint)]">{vide}</p>;
  const nom = (id: string) => biens.find((b) => b.id === id)?.nom ?? "bien";
  return (
    <ol className="flex flex-col gap-2">
      {pubs.map((p, i) => (
        <li
          key={p.adId}
          className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="crm-wrap text-sm font-semibold text-[var(--crm-text)]">
              <span className="text-[var(--crm-text-faint)]">{i + 1}.</span> {p.nom}
            </p>
            <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
              {p.biens.length > 0 ? p.biens.map(nom).join(" + ") : "Non rattachée"}
              {p.campagne ? ` · ${p.campagne}` : ""}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold tabular-nums text-[var(--crm-text)]">
              {p.leads} lead{p.leads > 1 ? "s" : ""}
            </p>
            <p className="text-xs tabular-nums text-[var(--crm-text-dim)]">
              {formatExact(p.depense, "euros")} · {p.coutParLead ? formatExact(p.coutParLead, "euros_centimes") : "—"} / lead
            </p>
            {p.lienApercu ? (
              <a href={p.lienApercu} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--crm-univers)] underline">
                Voir la pub
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Les coûts fixes, bien par bien et par type. */
export function CoutsParType({ biens, suffixe }: { biens: BienCalcule[]; suffixe: string }) {
  const total = (type: (typeof TYPES_COUT)[number]) => biens.reduce((n, b) => n + b.synthese.couts.parType[type], 0);
  return (
    <div className="crm-scroll overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="crm-sr-only">Coûts fixes HT par bien et par type</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
            <th scope="col" className="py-2 pr-3">Bien</th>
            {TYPES_COUT.map((t) => (
              <th key={t} scope="col" className="py-2 pr-3 text-right">{typeCoutLabels[t]}</th>
            ))}
            <th scope="col" className="py-2 text-right">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {biens.map((b) => (
            <tr key={b.id} className="border-t border-[var(--crm-line-soft)]">
              <th scope="row" className="py-2.5 pr-3 text-left font-medium text-[var(--crm-text)]">
                <Link href={`/crm/pilotage/biens/${b.id}${suffixe}`} prefetch={false} className="underline-offset-2 hover:underline">
                  {b.nom}
                </Link>
                <span className="block text-xs font-normal text-[var(--crm-text-faint)]">
                  {b.synthese.couts.actifs.length} saisie{b.synthese.couts.actifs.length > 1 ? "s" : ""}
                  {b.synthese.couts.annules.length > 0 ? ` · ${b.synthese.couts.annules.length} annulée${b.synthese.couts.annules.length > 1 ? "s" : ""}` : ""}
                </span>
              </th>
              {TYPES_COUT.map((t) => (
                <td key={t} className="py-2.5 pr-3 text-right tabular-nums text-[var(--crm-text-dim)]">
                  {formatCentimes(b.synthese.couts.parType[t])}
                </td>
              ))}
              <td className="py-2.5 text-right font-semibold tabular-nums text-[var(--crm-text)]">
                {formatCentimes(b.synthese.couts.totalHtCentimes)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-[var(--crm-line)] font-semibold text-[var(--crm-text)]">
            <th scope="row" className="py-2.5 pr-3 text-left">Prodigio</th>
            {TYPES_COUT.map((t) => (
              <td key={t} className="py-2.5 pr-3 text-right tabular-nums">{formatCentimes(total(t))}</td>
            ))}
            <td className="py-2.5 text-right tabular-nums">
              {formatCentimes(biens.reduce((n, b) => n + b.synthese.couts.totalHtCentimes, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Les données des graphiques : des nombres simples, prêts pour le composant client. */
export function donneesGraphique(
  t: TableauPilotage,
  mesure: "depense" | "leads",
  seulement?: string,
): { points: PointGraphique[]; series: SerieGraphique[] } {
  const biens = seulement ? t.biens.filter((b) => b.id === seulement) : t.biens;
  const series: SerieGraphique[] = biens.map((b) => ({ cle: b.id, nom: b.nom, couleur: couleurDuBien(b) }));
  if (!seulement && t.serie.cles.includes(CLE_NON_RATTACHEE)) {
    series.push({ cle: CLE_NON_RATTACHEE, nom: "Non rattachée", couleur: "var(--crm-serie-autre)" });
  }
  const points = t.serie.points.map((p) => {
    const source = mesure === "depense" ? p.depense : p.leads;
    const valeurs: Record<string, number> = {};
    for (const s of series) {
      const v = source.get(s.cle);
      if (v) valeurs[s.cle] = enNombre(v);
    }
    return { debut: p.debut, fin: p.fin, valeurs };
  });
  return { points, series };
}

/** « À savoir » : chaque alerte, avec le lien où la régler. */
export function ASavoir({ alertes }: { alertes: TableauPilotage["alertes"] }) {
  if (alertes.length === 0) return <p className="text-sm text-[var(--crm-text-faint)]">Rien à signaler.</p>;
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
          {a.lien ? (
            <>
              {" "}
              <Link href={a.lien} prefetch={false} className="underline underline-offset-2">
                Ouvrir
              </Link>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
