"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { arriveesParJour, variationArrivees } from "@/modules/buyers/crm/arrivees";

/**
 * Les arrivées sur la période, en barres.
 *
 * Le tableau de bord ne disait que l'instant présent. Cette courbe répond à la
 * seule question qu'on se pose devant un funnel payant : est-ce que ça monte.
 *
 * Elle ne reçoit que des DATES, jamais les dossiers : c'est un composant
 * client, et envoyer les dossiers enverrait au navigateur la ligne contact
 * brute — coordonnées non masquées comprises.
 *
 * L'instant de référence vient du serveur (`chargeA`). Lire l'horloge pendant
 * le rendu ferait diverger le rendu serveur du rendu navigateur dès qu'un
 * passage de minuit les sépare, et l'hydratation casserait.
 *
 * Pas de bibliothèque de graphiques : des barres en CSS suivent les variables
 * de thème et ne coûtent rien au chargement.
 */
const ETIQUETTE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });

/** Présélections de période. Une plage libre n'a pas sa place ici : on
    surveille une tendance, on ne fait pas de l'analyse historique. */
const PERIODES = [
  { jours: 7, libelle: "7 jours" },
  { jours: 30, libelle: "30 jours" },
  { jours: 90, libelle: "90 jours" },
] as const;

export function CourbeArrivees({
  dates,
  chargeA,
  parDefaut = 30,
}: {
  dates: string[];
  /** Instant de chargement (ISO), fourni par la requête. */
  chargeA: string;
  parDefaut?: number;
}) {
  const [jours, setJours] = useState<number>(parDefaut);
  const maintenant = useMemo(() => {
    const t = new Date(chargeA).getTime();
    return Number.isNaN(t) ? 0 : t;
  }, [chargeA]);

  const serie = useMemo(
    () => arriveesParJour(dates, jours, maintenant),
    [dates, jours, maintenant],
  );
  const variation = useMemo(
    () => variationArrivees(dates, jours, maintenant),
    [dates, jours, maintenant],
  );

  const total = serie.reduce((t, j) => t + j.nombre, 0);
  // Le maximum sert d'échelle. Un plancher à 1 évite une division par zéro
  // quand la période est vide, et garde l'axe lisible.
  const max = Math.max(1, ...serie.map((j) => j.nombre));

  return (
    <div className="crm-panel flex flex-col gap-3 p-4">
      {/* Le sélecteur gouverne CE bloc, et il est posé dessus pour le dire.
          Il ne descend pas sur les compteurs : « en retard » ou « dossiers en
          cours » sont des états du moment, pas des mesures de période — les
          cadrer sur sept jours ne voudrait rien dire. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-bold text-[var(--crm-text)]">Arrivées</h2>
          <span className="text-[2rem] font-bold leading-none tabular-nums text-[var(--crm-text)]">
            {total}
          </span>
          {variation === null ? (
            <span className="text-xs text-[var(--crm-text-faint)]">
              Première période : rien à comparer
            </span>
          ) : (
            <span
              className="text-xs font-bold tabular-nums"
              style={{
                color:
                  variation > 0
                    ? "var(--crm-vif-signe)"
                    : variation < 0
                      ? "var(--crm-vif-perdu)"
                      : "var(--crm-text-dim)",
              }}
            >
              {variation > 0 ? "▲" : variation < 0 ? "▼" : "="} {Math.abs(variation)} %
              <span className="font-medium text-[var(--crm-text-faint)]">
                {" "}
                vs. période précédente
              </span>
            </span>
          )}
        </div>

        <div className="crm-periodes" role="group" aria-label="Période affichée">
          {PERIODES.map((p) => (
            <button
              key={p.jours}
              type="button"
              aria-pressed={jours === p.jours}
              onClick={() => setJours(p.jours)}
              className="crm-periodes__choix"
            >
              {p.libelle}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-6 text-center text-xs text-[var(--crm-text-faint)]">
          Aucune arrivée sur la période.
        </p>
      ) : (
        <>
          <div
            className="flex h-28 items-end gap-[3px]"
            role="img"
            aria-label={`Arrivées par jour sur ${jours} jours, ${total} au total.`}
          >
            {serie.map((j) => (
              <div
                key={j.jour}
                title={`${ETIQUETTE.format(new Date(`${j.jour}T12:00:00`))} : ${j.nombre}`}
                /* Un jour vide garde un trait, mais un trait GRIS : peint de la
                   couleur des arrivées, il se lisait comme une arrivée, et
                   trente jours vides donnaient « une par jour ». */
                data-vide={j.nombre === 0 ? "oui" : undefined}
                className="crm-barre min-w-0 flex-1"
                style={
                  {
                    // Une arrivée isolée doit rester visible : plancher à 6 %.
                    ["--h" as keyof CSSProperties]:
                      j.nombre === 0 ? "0%" : `${Math.max(6, (j.nombre / max) * 100)}%`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className="flex justify-between text-[10.5px] tabular-nums text-[var(--crm-text-faint)]">
            <span>{ETIQUETTE.format(new Date(`${serie[0]?.jour}T12:00:00`))}</span>
            <span>
              {ETIQUETTE.format(new Date(`${serie[serie.length - 1]?.jour}T12:00:00`))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
