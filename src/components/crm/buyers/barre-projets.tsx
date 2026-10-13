"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { ProjetAccessible } from "@/modules/buyers/crm/queries";
import {
  ecrireNavigation,
  teinteProjet,
  type VueAcquereurs,
} from "@/modules/buyers/crm/navigation";

/**
 * Par quel projet on travaille, et dans quelle vue.
 *
 * Le projet était un menu déroulant perdu dans une barre de filtres, au même
 * rang que « Budget » ou « Responsable ». Ce n'est pas un filtre : c'est le
 * périmètre de travail, la première question qu'un commercial se pose en
 * arrivant. Il monte donc sous le titre, avant les compteurs — qu'il pilote.
 *
 * Ce sont des LIENS, pas des boutons : l'état vit dans l'URL, donc une vue se
 * partage, survit à une actualisation, et se retrouve au retour d'une fiche.
 * Un clic du milieu ouvre un projet dans un nouvel onglet, comme tout lien.
 */
export function BarreProjets({
  projets,
  selection,
  vue,
  signal,
  comptes,
  base,
}: {
  projets: ProjetAccessible[];
  selection: string[];
  vue: VueAcquereurs;
  signal?: string;
  /** Dossiers ACTIFS par projet. Un dossier clos ne demande plus rien. */
  comptes: Map<string, number>;
  /** Route de la vue liste (le pipeline a la sienne). */
  base: { liste: string; pipeline: string };
}) {
  const total = [...comptes.values()].reduce((t, n) => t + n, 0);
  const route = (v: VueAcquereurs) => (v === "pipeline" ? base.pipeline : base.liste);

  /** Un clic ajoute ou retire le projet : c'est ce qui rend la sélection
      multiple possible sans deuxième commande à expliquer. */
  const bascule = (id: string) =>
    selection.includes(id) ? selection.filter((p) => p !== id) : [...selection, id];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Projet">
        <Link
          href={`${route(vue)}${ecrireNavigation({ projets: [], vue, signal })}`}
          /* Pas de préchargement : chaque variante de cette barre est un rendu
             serveur COMPLET de la liste. Les précharger toutes coûtait, mesuré,
             quinze allers-retours par changement de projet — pour un lien sur
             lequel on ne cliquera pas. */
          prefetch={false}
          aria-current={selection.length === 0 ? "true" : undefined}
          className="crm-projet crm-projet--tous"
        >
          <span className="crm-projet__nom">Tous les projets</span>
          <span className="crm-projet__compte">{total}</span>
        </Link>

        {projets.map((p) => {
          const actif = selection.includes(p.id);
          return (
            <Link
              key={p.id}
              href={`${route(vue)}${ecrireNavigation({ projets: bascule(p.id), vue, signal })}`}
              prefetch={false}
              aria-current={actif ? "true" : undefined}
              className="crm-projet"
              style={{ ["--projet" as keyof CSSProperties]: `var(--crm-projet-${teinteProjet(p.id)})` } as CSSProperties}
            >
              <span className="crm-projet__pastille" aria-hidden />
              <span className="crm-projet__nom">{p.label}</span>
              <span className="crm-projet__compte">{comptes.get(p.id) ?? 0}</span>
            </Link>
          );
        })}
      </div>

      {/* La vue change, le projet et les filtres restent : ils voyagent dans
          l'URL, pas dans un état que la navigation effacerait. */}
      <div className="crm-vues" role="group" aria-label="Affichage">
        {(["liste", "pipeline"] as VueAcquereurs[]).map((v) => (
          <Link
            key={v}
            href={`${route(v)}${ecrireNavigation({ projets: selection, vue: v, signal })}`}
            prefetch={false}
            aria-current={vue === v ? "true" : undefined}
            className="crm-vues__choix"
          >
            {v === "liste" ? "☰ Liste" : "▤ Pipeline"}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Badge de projet d'une ligne ou d'une carte.
 *
 * Affiché seulement quand plusieurs projets sont à l'écran : sous l'onglet
 * « Villa Verdun », répéter « Villa Verdun » sur chaque ligne n'apprend rien et
 * mange la place du reste.
 *
 * Le NOM est toujours écrit. La couleur ne fait qu'aider à repérer, elle ne
 * porte jamais l'information — ni pour qui ne distingue pas ces teintes, ni à
 * l'impression.
 */
export function BadgeProjet({
  propertyId,
  label,
  className = "",
}: {
  propertyId: string | null;
  label: string | null;
  className?: string;
}) {
  if (!label) return null;
  const style = propertyId
    ? ({ ["--projet" as keyof CSSProperties]: `var(--crm-projet-${teinteProjet(propertyId)})` } as CSSProperties)
    : undefined;
  return (
    <span className={`crm-badge-projet ${className}`} style={style}>
      <span className="crm-badge-projet__pastille" aria-hidden />
      {label}
    </span>
  );
}
