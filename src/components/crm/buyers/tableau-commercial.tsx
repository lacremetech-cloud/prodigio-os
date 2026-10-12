import Link from "next/link";
import type { CSSProperties } from "react";
import type { BuyerListItem } from "@/modules/buyers/crm/queries";

/**
 * Tableau de bord d'un commercial, pensé pour un téléphone tenu d'une main.
 *
 * Il ouvre l'application entre deux rendez-vous et veut quatre réponses en une
 * seconde : qui est arrivé aujourd'hui, qui attend un rappel, combien de
 * visites sont calées, combien de dossiers il porte. Tout le reste est à un
 * clic, pas sur cet écran.
 *
 * Les chiffres se déduisent des dossiers déjà chargés : aucune requête de plus,
 * et surtout aucun compteur qui pourrait diverger de la liste qu'il ouvrira
 * juste après.
 */

function memeJour(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

/** Un dossier clos ne demande plus rien : il ne doit alimenter aucun chiffre. */
function encoreOuvert(item: BuyerListItem): boolean {
  return item.profile.outcome == null;
}

export interface ChiffresCommercial {
  nouveauxAujourdhui: number;
  aRappeler: number;
  visitesPlanifiees: number;
  dossiers: number;
}

export function compterPourCommercial(items: BuyerListItem[]): ChiffresCommercial {
  const ouverts = items.filter(encoreOuvert);
  return {
    nouveauxAujourdhui: ouverts.filter((i) => memeJour(i.profile.last_interest_at)).length,
    aRappeler: ouverts.filter((i) => i.overdue || i.noNextAction).length,
    visitesPlanifiees: ouverts.filter((i) => i.profile.pipeline_stage === "visite").length,
    dossiers: ouverts.length,
  };
}

/**
 * Tuile de chiffre. Elle etait grise sur gris : un nombre, un libelle pale,
 * aucun repere. Elle porte desormais une pastille d'icone coloree et un
 * chiffre qui se lit de l'autre bout de la piece — c'est le seul ecran que le
 * commercial regarde en arrivant le matin, souvent sur un telephone.
 *
 * La couleur n'est jamais le seul signal : l'icone et le libelle disent la
 * meme chose.
 */
function Chiffre({
  valeur,
  libelle,
  href,
  icone,
  vif,
  alerte,
}: {
  valeur: number;
  libelle: string;
  href: string;
  icone: string;
  /** Variable d'aplat (`--crm-vif-*`). */
  vif: string;
  alerte?: boolean;
}) {
  // Un zero n'est jamais mis en alerte : zero rappel en retard est une bonne
  // nouvelle, pas un probleme.
  const enAlerte = Boolean(alerte) && valeur > 0;
  return (
    <Link
      href={href}
      className="crm-panel flex min-w-0 flex-col gap-2 p-4 transition-colors hover:border-[var(--crm-univers)]"
      style={{ ["--tuile" as keyof CSSProperties]: `var(${vif})` } as CSSProperties}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="crm-kpi__label crm-wrap">{libelle}</span>
        <span
          aria-hidden
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-sm"
          style={{
            color: "var(--tuile)",
            background: "color-mix(in srgb, var(--tuile) 15%, var(--crm-panel))",
          }}
        >
          {icone}
        </span>
      </span>
      <span
        className="text-[2rem] font-bold leading-none tabular-nums"
        style={{ color: enAlerte ? "var(--tuile)" : "var(--crm-text)" }}
      >
        {valeur}
      </span>
    </Link>
  );
}

export function TableauCommercial({ items }: { items: BuyerListItem[] }) {
  const c = compterPourCommercial(items);
  return (
    <section className="flex flex-col gap-3">
      {/* Deux colonnes sur telephone, quatre au-dela : chaque chiffre reste
          lisible sans zoom, et la rangee ne se brise jamais au milieu. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Chiffre valeur={c.nouveauxAujourdhui} libelle="Arrivés aujourd’hui"
                 icone="✦" vif="--crm-vif-nouveau"
                 href="/crm/acquereurs?signal=nouveaux" />
        <Chiffre valeur={c.aRappeler} libelle="À rappeler" alerte
                 icone="☎︎" vif="--crm-vif-a_contacter"
                 href="/crm/acquereurs?signal=sans_action" />
        <Chiffre valeur={c.visitesPlanifiees} libelle="Visites planifiées"
                 icone="◷" vif="--crm-vif-rdv_planifie"
                 href="/crm/acquereurs/pipeline" />
        <Chiffre valeur={c.dossiers} libelle="Dossiers en cours"
                 icone="◈" vif="--crm-vif-signe"
                 href="/crm/acquereurs" />
      </div>
    </section>
  );
}
