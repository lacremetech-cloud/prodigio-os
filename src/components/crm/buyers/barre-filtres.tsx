"use client";

import {
  ECHEANCE_LABELS,
  ECHEANCES_PROPOSEES,
  FILTRES_AVANCES_VIDES,
  FILTRES_RAPIDES,
  nombreDeFiltresAvances,
  porteLeSignal,
  TRANCHES_BUDGET,
  type DossierFiltrable,
  type Echeance,
  type FiltresAvances,
  type Signal,
} from "@/modules/buyers/crm/filtres";
import {
  BUYER_QUALIFICATIONS,
  QUALIFICATION_LABELS,
} from "@/modules/buyers/crm/qualification";
import { BUYER_PIPELINE_STAGES, buyerStageLabels } from "@/modules/buyers/crm/labels";
import { useMemo, type ReactNode } from "react";

/**
 * LA barre de filtres du CRM acquéreurs — la même dans la liste et dans le
 * Kanban.
 *
 * Elle existe parce que les deux vues avaient chacune la leur : quatorze
 * « signaux » d'un côté, cinq onglets aux noms voisins de l'autre, sur des
 * champs différents. Passer de l'une à l'autre changeait le nombre de dossiers
 * sans que rien ne l'explique, et personne ne savait laquelle disait vrai.
 *
 * Deux étages, et c'est tout ce qu'il y a :
 *
 *   • trois pastilles toujours visibles — Tous / À contacter / À rappeler,
 *     les trois questions d'une session d'appels, qui tiennent sur une ligne
 *     même en 360 px ;
 *   • quatre filtres repliés derrière « Filtres » — qualification, budget,
 *     responsable, étape. Repliés, pas cachés : un filtre qu'on ne peut
 *     atteindre que par l'URL n'est pas un filtre.
 *
 * Et, en dessous, les filtres RÉELLEMENT appliqués, chacun retirable d'un
 * geste. Montrer les filtres possibles coûte l'écran entier ; montrer les
 * filtres actifs coûte une ligne, et répond à la seule question qui se pose
 * devant une liste courte : pourquoi n'y a-t-il que trois dossiers ?
 */
export function BarreFiltres<T extends DossierFiltrable>({
  dossiers,
  members,
  maintenant,
  signal,
  setSignal,
  echeance,
  setEcheance,
  recherche,
  setRecherche,
  avances,
  setAvances,
  feuilleOuverte,
  setFeuilleOuverte,
  tri,
}: {
  /** Tous les dossiers de l'écran, AVANT filtrage : c'est sur eux que portent
      les compteurs des pastilles. Les calculer sur la liste déjà filtrée
      afficherait « À rappeler 0 » dès qu'on a cliqué sur « À contacter ». */
  dossiers: T[];
  members: { userId: string; name: string }[];
  maintenant: number;
  signal: Signal;
  setSignal: (s: Signal) => void;
  echeance: Echeance;
  setEcheance: (e: Echeance) => void;
  recherche: string;
  setRecherche: (v: string) => void;
  avances: FiltresAvances;
  setAvances: (f: FiltresAvances | ((p: FiltresAvances) => FiltresAvances)) => void;
  feuilleOuverte: boolean;
  setFeuilleOuverte: (v: boolean) => void;
  /** Le tri, propre à chaque vue : la liste en a un, le Kanban non. */
  tri?: ReactNode;
}) {
  const nbAvances = nombreDeFiltresAvances(avances);

  const filtresActifs = useMemo(() => {
    const a: { cle: string; libelle: string; retirer: () => void }[] = [];
    if (signal !== "tous") {
      a.push({
        cle: "signal",
        libelle: FILTRES_RAPIDES.find((f) => f.signal === signal)?.label ?? signal,
        retirer: () => {
          setSignal("tous");
          setEcheance("toutes");
        },
      });
    }
    if (signal === "a_rappeler" && echeance !== "toutes") {
      a.push({
        cle: "echeance",
        libelle: ECHEANCE_LABELS[echeance],
        retirer: () => setEcheance("toutes"),
      });
    }
    if (avances.qualification !== "tous") {
      a.push({
        cle: "qualification",
        libelle: QUALIFICATION_LABELS[avances.qualification],
        retirer: () => setAvances((f) => ({ ...f, qualification: "tous" })),
      });
    }
    if (avances.etape !== "tous") {
      a.push({
        cle: "etape",
        libelle: buyerStageLabels[avances.etape] ?? avances.etape,
        retirer: () => setAvances((f) => ({ ...f, etape: "tous" })),
      });
    }
    if (avances.budget !== "tous") {
      a.push({
        cle: "budget",
        libelle: TRANCHES_BUDGET.find((b) => b.valeur === avances.budget)?.label ?? avances.budget,
        retirer: () => setAvances((f) => ({ ...f, budget: "tous" })),
      });
    }
    if (avances.responsable !== "tous") {
      a.push({
        cle: "responsable",
        libelle:
          avances.responsable === "aucun"
            ? "Non affectés"
            : members.find((m) => m.userId === avances.responsable)?.name ?? avances.responsable,
        retirer: () => setAvances((f) => ({ ...f, responsable: "tous" })),
      });
    }
    return a;
  }, [signal, echeance, avances, members, setSignal, setEcheance, setAvances]);

  function toutEffacer() {
    setSignal("tous");
    setEcheance("toutes");
    setAvances(FILTRES_AVANCES_VIDES);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Rechercher un acquéreur</span>
          <input
            className="crm-input"
            type="search"
            placeholder="Rechercher (nom, téléphone, ville…)"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </label>
        {tri}
        <button
          type="button"
          className="crm-commande"
          onClick={() => setFeuilleOuverte(!feuilleOuverte)}
          aria-haspopup="dialog"
          aria-expanded={feuilleOuverte}
        >
          Filtres
          {nbAvances > 0 ? <span className="crm-commande__n">{nbAvances}</span> : null}
        </button>
      </div>

      <div className="crm-rapides" role="group" aria-label="Filtres rapides">
        {FILTRES_RAPIDES.map((f) => {
          const n = dossiers.filter((d) => porteLeSignal(d, f.signal, "toutes", maintenant)).length;
          return (
            <button
              key={f.signal}
              type="button"
              className="crm-rapide"
              aria-pressed={signal === f.signal}
              onClick={() => {
                setSignal(f.signal);
                if (f.signal !== "a_rappeler") setEcheance("toutes");
              }}
            >
              {f.label}
              <span className="crm-rapide__n">{n}</span>
            </button>
          );
        })}
      </div>

      {/* L'échéance n'apparaît QUE sous « À rappeler » : elle n'affine que lui,
          et l'afficher en permanence remettrait une rangée de plus au-dessus du
          premier dossier. */}
      {signal === "a_rappeler" ? (
        <div className="crm-rapides crm-rapides--fines" role="group" aria-label="Échéance des rappels">
          {ECHEANCES_PROPOSEES.map((e) => {
            const n = dossiers.filter((d) => porteLeSignal(d, "a_rappeler", e, maintenant)).length;
            return (
              <button
                key={e}
                type="button"
                className="crm-rapide"
                aria-pressed={echeance === e}
                onClick={() => setEcheance(e)}
              >
                {ECHEANCE_LABELS[e]}
                <span className="crm-rapide__n">{n}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {filtresActifs.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {filtresActifs.map((f) => (
            <button key={f.cle} type="button" className="crm-pastille" onClick={f.retirer}>
              {f.libelle}
              <span aria-hidden>✕</span>
              <span className="sr-only">Retirer ce filtre</span>
            </button>
          ))}
          <button type="button" className="crm-pastille crm-pastille--raz" onClick={toutEffacer}>
            Tout effacer
          </button>
        </div>
      ) : null}

      {feuilleOuverte ? (
        <div className="crm-feuille" role="dialog" aria-modal="true" aria-label="Filtres">
          <button
            type="button"
            className="crm-feuille__fond"
            aria-label="Fermer"
            onClick={() => setFeuilleOuverte(false)}
          />
          <div className="crm-feuille__corps">
            <div className="crm-feuille__tete">
              <h2 className="crm-feuille__titre">Filtres</h2>
              <button
                type="button"
                className="crm-panneau__fermer"
                aria-label="Fermer"
                onClick={() => setFeuilleOuverte(false)}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <Choix
                label="Qualification"
                value={avances.qualification}
                onChange={(v) =>
                  setAvances((f) => ({ ...f, qualification: v as FiltresAvances["qualification"] }))
                }
                options={[
                  { value: "tous", label: "Toutes les qualifications" },
                  ...BUYER_QUALIFICATIONS.map((q) => ({
                    value: q as string,
                    label: QUALIFICATION_LABELS[q],
                  })),
                ]}
              />
              <Choix
                label="Étape"
                value={avances.etape}
                onChange={(v) => setAvances((f) => ({ ...f, etape: v }))}
                options={[
                  { value: "tous", label: "Toutes les étapes" },
                  ...BUYER_PIPELINE_STAGES.map((st) => ({
                    value: st as string,
                    label: buyerStageLabels[st] ?? st,
                  })),
                ]}
              />
              <Choix
                label="Budget"
                value={avances.budget}
                onChange={(v) => setAvances((f) => ({ ...f, budget: v }))}
                options={TRANCHES_BUDGET.map((b) => ({ value: b.valeur, label: b.label }))}
              />
              <Choix
                label="Responsable"
                value={avances.responsable}
                onChange={(v) => setAvances((f) => ({ ...f, responsable: v }))}
                options={[
                  { value: "tous", label: "Tous" },
                  { value: "aucun", label: "Non affectés" },
                  ...members.map((m) => ({ value: m.userId, label: m.name })),
                ]}
              />
            </div>

            <div className="crm-feuille__pied">
              <button
                type="button"
                className="crm-btn crm-btn--secondaire flex-1"
                onClick={() => setAvances(FILTRES_AVANCES_VIDES)}
              >
                Réinitialiser
              </button>
              <button
                type="button"
                className="crm-btn crm-btn--primaire flex-1"
                onClick={() => setFeuilleOuverte(false)}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Choix({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="crm-label">{label}</span>
      <select className="crm-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
