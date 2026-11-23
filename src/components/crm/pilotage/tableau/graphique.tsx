"use client";

import { useId, useState } from "react";

/**
 * Colonnes empilées par jour (ou par semaine), une couleur par bien, dans un
 * ordre fixe qui ne dépend pas de la période. Le survol (ou le clavier) montre
 * le détail d'une colonne ; le tableau des chiffres, juste dessous, porte les
 * mêmes valeurs pour qui ne lit pas les couleurs.
 */

export interface PointGraphique {
  debut: string;
  fin: string;
  /** Par clé de série : des centimes (dépense) ou des leads. */
  valeurs: Record<string, number>;
}

export interface SerieGraphique {
  cle: string;
  nom: string;
  /** Une couleur du thème, par exemple `var(--crm-serie-1)`. */
  couleur: string;
}

const L = 720;
const H = 236;
const MARGE = { gauche: 56, droite: 8, haut: 10, bas: 26 };
const LARGEUR = L - MARGE.gauche - MARGE.droite;
const HAUTEUR = H - MARGE.haut - MARGE.bas;
const ECART = 2;

const eurosFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nombreFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const jourFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function valeur(unite: "euros" | "leads", v: number): string {
  return unite === "euros" ? eurosFmt.format(Math.round(v / 100)) : nombreFmt.format(v);
}

function jour(iso: string): string {
  return jourFmt.format(new Date(`${iso}T00:00:00Z`));
}

function libellePoint(p: PointGraphique, pas: "jour" | "semaine"): string {
  return pas === "jour" ? jour(p.debut) : `Semaine du ${jour(p.debut)}${p.fin !== p.debut ? ` au ${jour(p.fin)}` : ""}`;
}

/** Un maximum « rond » et ses graduations : 0, 1 000, 2 000… ; des leads se comptent par unités entières. */
function graduations(max: number, entier: boolean): number[] {
  if (max <= 0) return [0];
  const brut = max / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const rond = [1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut;
  const pas = entier ? Math.max(1, Math.ceil(rond)) : rond;
  const out: number[] = [];
  for (let v = 0; v <= max + pas * 0.999; v += pas) out.push(v);
  return out;
}

/** Un rectangle aux coins du haut arrondis, carré sur la ligne de base. */
function colonne(x: number, y: number, l: number, h: number, arrondi: number): string {
  const r = Math.max(0, Math.min(arrondi, l / 2, h));
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + l - r}Q${x + l},${y} ${x + l},${y + r}V${y + h}Z`;
}

export function GraphiqueParJour({
  titre,
  unite,
  pas,
  points,
  series,
  vide,
}: {
  titre: string;
  unite: "euros" | "leads";
  pas: "jour" | "semaine";
  points: PointGraphique[];
  series: SerieGraphique[];
  vide: string;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const idTitre = useId();
  const totaux = points.map((p) => series.reduce((s, x) => s + (p.valeurs[x.cle] ?? 0), 0));
  const max = Math.max(0, ...totaux);
  if (points.length === 0 || max <= 0) {
    return (
      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-semibold text-[var(--crm-text)]">{titre}</figcaption>
        <p className="text-sm text-[var(--crm-text-faint)]">{vide}</p>
      </figure>
    );
  }

  const ticks = graduations(max, unite === "leads");
  const haut = ticks[ticks.length - 1]!;
  const bande = LARGEUR / points.length;
  const largeurBarre = Math.max(1, Math.min(24, bande - ECART));
  const y = (v: number) => MARGE.haut + HAUTEUR - (v / haut) * HAUTEUR;
  const etiquettes = new Set<number>();
  const nEtiquettes = Math.min(6, points.length);
  for (let k = 0; k < nEtiquettes; k += 1) {
    etiquettes.add(Math.round((k * (points.length - 1)) / Math.max(1, nEtiquettes - 1)));
  }
  const point = actif !== null ? points[actif] : null;

  return (
    <figure className="flex min-w-0 flex-col gap-2" aria-labelledby={idTitre}>
      <figcaption id={idTitre} className="text-sm font-semibold text-[var(--crm-text)]">
        {titre} <span className="font-normal text-[var(--crm-text-faint)]">· {pas === "jour" ? "par jour" : "par semaine"}</span>
      </figcaption>

      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--crm-text-dim)]" aria-label="Légende">
          {series.map((s) => (
            <li key={s.cle} className="flex items-center gap-1.5">
              <svg width="10" height="10" aria-hidden="true">
                <rect width="10" height="10" rx="2" style={{ fill: s.couleur }} />
              </svg>
              {s.nom}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <svg
          viewBox={`0 0 ${L} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${titre} : colonnes ${pas === "jour" ? "par jour" : "par semaine"}, le détail est dans le tableau des chiffres.`}
          onPointerLeave={() => setActif(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(t)} y2={y(t)} strokeWidth={1} style={{ stroke: "var(--crm-line-soft)" }} />
              <text x={MARGE.gauche - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} style={{ fill: "var(--crm-text-faint)" }}>
                {valeur(unite, t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = MARGE.gauche + i * bande + (bande - largeurBarre) / 2;
            let base = 0;
            const presentes = series.filter((s) => (p.valeurs[s.cle] ?? 0) > 0);
            return (
              <g key={p.debut} style={{ opacity: actif === null || actif === i ? 1 : 0.55 }}>
                {presentes.map((s, k) => {
                  const v = p.valeurs[s.cle] ?? 0;
                  const bas = y(base);
                  base += v;
                  const sommet = y(base);
                  // L'écart de surface sépare deux segments empilés ; la colonne
                  // ne s'arrondit qu'en haut, carrée sur la ligne de base.
                  const h = Math.max(0, bas - sommet - (k > 0 ? ECART : 0));
                  if (h <= 0) return null;
                  const dessus = k === presentes.length - 1;
                  return (
                    <path
                      key={s.cle}
                      d={colonne(x, bas - (k > 0 ? ECART : 0) - h, largeurBarre, h, dessus ? 4 : 0)}
                      style={{ fill: s.couleur }}
                    />
                  );
                })}
                {etiquettes.has(i) ? (
                  <text
                    x={MARGE.gauche + i * bande + bande / 2}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize={11}
                    style={{ fill: "var(--crm-text-faint)" }}
                  >
                    {jour(p.debut)}
                  </text>
                ) : null}
                <rect
                  x={MARGE.gauche + i * bande}
                  y={MARGE.haut}
                  width={bande}
                  height={HAUTEUR}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${libellePoint(p, pas)} : ${valeur(unite, totaux[i]!)}`}
                  onPointerEnter={() => setActif(i)}
                  onFocus={() => setActif(i)}
                  onBlur={() => setActif(null)}
                  className="outline-none focus-visible:[stroke:var(--crm-text)]"
                />
              </g>
            );
          })}
          <line
            x1={MARGE.gauche}
            x2={L - MARGE.droite}
            y1={y(0)}
            y2={y(0)}
            strokeWidth={1}
            style={{ stroke: "var(--crm-line)" }}
          />
        </svg>

        {point && actif !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-[160px] -translate-x-1/2 rounded-[8px] border border-[var(--crm-line)] bg-[var(--crm-panel)] px-3 py-2 text-xs shadow-sm"
            style={{ left: `${Math.min(85, Math.max(15, ((MARGE.gauche + (actif + 0.5) * bande) / L) * 100))}%` }}
          >
            <p className="mb-1 text-[var(--crm-text-faint)]">{libellePoint(point, pas)}</p>
            <ul className="flex flex-col gap-0.5">
              {series
                .filter((s) => (point.valeurs[s.cle] ?? 0) > 0)
                .map((s) => (
                  <li key={s.cle} className="flex items-center gap-2">
                    <svg width="12" height="4" aria-hidden="true">
                      <line x1="0" x2="12" y1="2" y2="2" strokeWidth={2} strokeLinecap="round" style={{ stroke: s.couleur }} />
                    </svg>
                    <span className="font-semibold tabular-nums text-[var(--crm-text)]">{valeur(unite, point.valeurs[s.cle]!)}</span>
                    <span className="text-[var(--crm-text-dim)]">{s.nom}</span>
                  </li>
                ))}
            </ul>
            {series.length > 1 ? (
              <p className="mt-1 border-t border-[var(--crm-line-soft)] pt-1 font-semibold tabular-nums text-[var(--crm-text)]">
                Total {valeur(unite, totaux[actif]!)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <details className="text-xs text-[var(--crm-text-dim)]">
        <summary className="cursor-pointer">Voir les chiffres</summary>
        <div className="crm-scroll mt-2 max-h-72 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <caption className="crm-sr-only">{titre}</caption>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
                <th scope="col" className="py-1 pr-3">{pas === "jour" ? "Jour" : "Semaine"}</th>
                {series.map((s) => (
                  <th key={s.cle} scope="col" className="py-1 pr-3 text-right">
                    {s.nom}
                  </th>
                ))}
                {series.length > 1 ? <th scope="col" className="py-1 text-right">Total</th> : null}
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={p.debut} className="border-t border-[var(--crm-line-soft)]">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {libellePoint(p, pas)}
                  </th>
                  {series.map((s) => (
                    <td key={s.cle} className="py-1 pr-3 text-right tabular-nums">
                      {valeur(unite, p.valeurs[s.cle] ?? 0)}
                    </td>
                  ))}
                  {series.length > 1 ? <td className="py-1 text-right tabular-nums">{valeur(unite, totaux[i]!)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
