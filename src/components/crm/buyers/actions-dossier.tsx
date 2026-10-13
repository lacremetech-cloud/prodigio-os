"use client";

import { useState, type ReactNode } from "react";

/**
 * « Actions du dossier » — un menu, trois actions qui servent une fois chacune.
 *
 * Enregistrer une offre, clôturer, rouvrir : trois panneaux dépliés en
 * permanence dans la colonne latérale, chacun avec son titre et son
 * formulaire. Ensemble ils prenaient plus de place que l'identité de la
 * personne, pour des gestes qu'on fait une fois par dossier — et parfois
 * jamais.
 *
 * Ils sont repliés derrière un bouton, pas supprimés. Ce qui change :
 *
 *   • seules les actions POSSIBLES dans l'état courant sont proposées. Un
 *     dossier clos n'offre pas « Clôturer », un dossier ouvert n'offre pas
 *     « Rouvrir ». Montrer une action qui sera refusée, c'est promettre une
 *     porte fermée ;
 *   • les confirmations et les motifs de chaque formulaire sont inchangés :
 *     ce menu ne fait que les regrouper, il ne retire aucun garde-fou ;
 *   • si aucune action n'est possible, le bouton lui-même disparaît.
 */
export function ActionsDossier({
  actions,
}: {
  actions: { cle: string; label: string; contenu: ReactNode }[];
}) {
  const [ouverte, setOuverte] = useState<string | null>(null);

  if (actions.length === 0) return null;

  return (
    <section className="crm-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="crm-eyebrow">Actions du dossier</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.cle}
            type="button"
            className="crm-btn crm-btn--sm crm-btn--secondaire"
            aria-expanded={ouverte === a.cle}
            onClick={() => setOuverte(ouverte === a.cle ? null : a.cle)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Une seule action ouverte à la fois : deux formulaires côte à côte, et
          l'on ne sait plus lequel on est en train de remplir. */}
      {ouverte ? (
        <div className="mt-3 border-t border-[var(--crm-line-soft)] pt-3">
          {actions.find((a) => a.cle === ouverte)?.contenu}
        </div>
      ) : null}
    </section>
  );
}
