"use client";

import { useState } from "react";
import { domaineLisible, type ComptesBien } from "@/modules/properties/cockpit/raccourcis";

/**
 * Bandeau de tête du cockpit : le tunnel, la brochure, et l'état des demandes.
 *
 * Ces trois choses existaient déjà, mais éparpillées — le lien du tunnel dans
 * la liste des origines autorisées, la brochure dans un réglage, les dossiers
 * acquéreurs huit sections plus bas. Les rassembler ne change aucune donnée ;
 * cela change le temps qu'il faut pour les atteindre, et c'est ce qu'on vient
 * chercher ici tous les jours.
 */

function Copier({ valeur, quoi }: { valeur: string; quoi: string }) {
  const [fait, setFait] = useState(false);
  return (
    <button
      type="button"
      className="crm-btn crm-btn--sm"
      aria-label={`Copier le lien ${quoi}`}
      onClick={() => {
        void navigator.clipboard?.writeText(valeur).then(() => {
          setFait(true);
          window.setTimeout(() => setFait(false), 1600);
        });
      }}
    >
      {fait ? "Copié" : "Copier"}
    </button>
  );
}

function Lien({
  titre,
  url,
  quoi,
  absent,
}: {
  titre: string;
  url: string | null;
  quoi: string;
  /** Ce qu'il faut faire quand le lien n'existe pas encore. */
  absent: string;
}) {
  const domaine = domaineLisible(url);
  return (
    <div className="crm-panel-2 flex flex-col gap-2 p-3.5">
      <span className="crm-label">{titre}</span>
      {url ? (
        <>
          <span
            className="crm-ellipsis text-sm font-semibold text-[var(--crm-text)]"
            title={url}
          >
            {domaine ?? url}
          </span>
          <div className="flex flex-wrap gap-2">
            <a
              className="crm-btn crm-btn--sm crm-btn--primaire"
              href={url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Ouvrir ↗
            </a>
            <Copier valeur={url} quoi={quoi} />
          </div>
        </>
      ) : (
        <p className="crm-wrap text-xs font-medium text-[var(--crm-text-dim)]">{absent}</p>
      )}
    </div>
  );
}

function Compteur({
  valeur,
  libelle,
  accent,
  alerte,
}: {
  valeur: number;
  libelle: string;
  accent: string;
  /** Un zéro est une bonne nouvelle : on ne le met pas en avant. */
  alerte?: boolean;
}) {
  const vif = alerte ? valeur > 0 : false;
  return (
    <div className="crm-panel-2 flex flex-col gap-0.5 p-3.5">
      <span className="crm-label">{libelle}</span>
      <span
        className="text-[1.75rem] font-bold leading-tight tabular-nums"
        style={{ color: vif ? `var(${accent})` : "var(--crm-text)" }}
      >
        {valeur}
      </span>
    </div>
  );
}

export function RaccourcisBien({
  tunnelUrl,
  brochureUrl,
  comptes,
}: {
  tunnelUrl: string | null;
  brochureUrl: string | null;
  comptes: ComptesBien;
}) {
  return (
    <section aria-label="Raccourcis du bien" className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Lien
          titre="Tunnel"
          url={tunnelUrl}
          quoi="du tunnel"
          absent="Aucun site autorisé à afficher le formulaire. Ajoutez-le dans « Formulaire acquéreur », plus bas."
        />
        <Lien
          titre="Brochure"
          url={brochureUrl}
          quoi="de la brochure"
          absent="Pas encore de brochure. Elle se renseigne dans « Formulaire acquéreur », plus bas."
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Compteur valeur={comptes.total} libelle="Demandes" accent="--crm-univers" />
        <Compteur valeur={comptes.aujourdhui} libelle="Aujourd’hui" accent="--crm-success" alerte />
        <Compteur valeur={comptes.aTraiter} libelle="À traiter" accent="--crm-warning" alerte />
        <Compteur
          valeur={comptes.sansResponsable}
          libelle="Sans responsable"
          accent="--crm-danger"
          alerte
        />
      </div>
    </section>
  );
}
