import Link from "next/link";
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
    visitesPlanifiees: ouverts.filter((i) => i.profile.pipeline_stage === "visite_planifiee").length,
    dossiers: ouverts.length,
  };
}

function Chiffre({
  valeur,
  libelle,
  href,
  alerte,
}: {
  valeur: number;
  libelle: string;
  href: string;
  alerte?: boolean;
}) {
  return (
    <Link
      href={href}
      className="crm-panel flex min-w-0 flex-col gap-1 p-4 transition-colors hover:border-[var(--crm-univers)]"
    >
      <span
        className={`text-3xl font-semibold tabular-nums ${
          alerte && valeur > 0 ? "text-[var(--crm-danger)]" : "text-[var(--crm-text)]"
        }`}
      >
        {valeur}
      </span>
      <span className="crm-wrap text-xs text-[var(--crm-text-dim)]">{libelle}</span>
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
                 href="/crm/acquereurs?signal=nouveaux" />
        <Chiffre valeur={c.aRappeler} libelle="À rappeler" alerte
                 href="/crm/acquereurs?signal=sans_action" />
        <Chiffre valeur={c.visitesPlanifiees} libelle="Visites planifiées"
                 href="/crm/acquereurs/pipeline" />
        <Chiffre valeur={c.dossiers} libelle="Dossiers en cours"
                 href="/crm/acquereurs" />
      </div>
    </section>
  );
}
