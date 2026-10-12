import Link from "next/link";
import type { CSSProperties } from "react";
import type { BuyerListItem } from "@/modules/buyers/crm/queries";
import { formatDateTime } from "@/modules/crm/format";

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
  enRetard: number;
  sansAction: number;
  visitesPlanifiees: number;
  dossiers: number;
}

/*
 * Un seul compteur « A rappeler » additionnait deux choses differentes : les
 * dossiers dont l'echeance est passee, et ceux pour lesquels personne n'a rien
 * prevu. Les deux demandent une action, mais pas la meme — et le libelle
 * mentait sur la moitie du chiffre : un dossier sans tache n'a aucun rappel a
 * honorer. La tuile ouvrait en plus une liste filtree sur l'une des deux
 * moities seulement, si bien que le chiffre annonce et la liste obtenue ne
 * concordaient pas.
 *
 * Les deux ensembles sont disjoints par construction (`overdue` suppose une
 * tache, `noNextAction` son absence) : les separer ne compte rien deux fois.
 */
export function compterPourCommercial(items: BuyerListItem[]): ChiffresCommercial {
  const ouverts = items.filter(encoreOuvert);
  return {
    nouveauxAujourdhui: ouverts.filter((i) => memeJour(i.profile.last_interest_at)).length,
    enRetard: ouverts.filter((i) => i.overdue).length,
    sansAction: ouverts.filter((i) => i.noNextAction).length,
    visitesPlanifiees: ouverts.filter((i) => i.profile.pipeline_stage === "visite").length,
    dossiers: ouverts.length,
  };
}

/**
 * Les visites a venir, deduites des dossiers deja charges.
 *
 * Une visite, dans ce CRM, c'est une tache a echeance plus l'etape « visite » :
 * c'est exactement ce qu'ecrit le formulaire « Planifier la visite ». On relit
 * donc le meme fait, sans deuxieme requete et sans table parallele qui
 * pourrait divergir du compteur juste au-dessus.
 *
 * Une visite deja passee n'est pas « a venir » : elle a lieu ou elle est
 * manquee, et elle remonte alors dans « En retard ».
 */
export function prochainesVisites(
  items: BuyerListItem[],
  now: number = Date.now(),
): BuyerListItem[] {
  return items
    .filter((i) => {
      if (!encoreOuvert(i)) return false;
      if (i.profile.pipeline_stage !== "visite") return false;
      const quand = i.nextTask?.due_at;
      if (!quand) return false;
      const t = new Date(quand).getTime();
      return !Number.isNaN(t) && t >= now;
    })
    .sort((a, b) => (a.nextTask?.due_at ?? "").localeCompare(b.nextTask?.due_at ?? ""));
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
  const visites = prochainesVisites(items).slice(0, 5);
  return (
    <section className="flex flex-col gap-4">
      {/* Deux colonnes sur telephone, cinq au-dela : chaque chiffre reste
          lisible sans zoom, et la rangee ne se brise jamais au milieu.
          Chaque tuile ouvre EXACTEMENT les dossiers qu'elle compte. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Chiffre valeur={c.nouveauxAujourdhui} libelle="Arrivés aujourd’hui"
                 icone="✦" vif="--crm-vif-nouveau"
                 href="/crm/acquereurs?signal=nouveaux" />
        <Chiffre valeur={c.enRetard} libelle="En retard" alerte
                 icone="!" vif="--crm-vif-perdu"
                 href="/crm/acquereurs?signal=en_retard" />
        <Chiffre valeur={c.sansAction} libelle="Sans action prévue" alerte
                 icone="☎︎" vif="--crm-vif-a_contacter"
                 href="/crm/acquereurs?signal=sans_action" />
        <Chiffre valeur={c.visitesPlanifiees} libelle="Visites planifiées"
                 icone="◷" vif="--crm-vif-rdv_planifie"
                 href="/crm/acquereurs/pipeline" />
        <Chiffre valeur={c.dossiers} libelle="Dossiers en cours"
                 icone="◈" vif="--crm-vif-signe"
                 href="/crm/acquereurs" />
      </div>

      {/* Ce qui est cale, et quand. Le compteur disait « 3 visites » sans
          jamais dire lesquelles ni a quelle heure : il fallait ouvrir le
          pipeline puis chaque fiche pour retrouver sa propre journee. */}
      <div className="crm-panel flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-[var(--crm-text)]">Prochaines visites</h2>
          <Link
            href="/crm/acquereurs/pipeline"
            className="text-xs font-medium text-[var(--crm-univers)] hover:underline"
          >
            Tout voir
          </Link>
        </div>
        {visites.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-5 text-center text-xs text-[var(--crm-text-faint)]">
            Aucune visite planifiée. Ouvrez une fiche pour en caler une.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {visites.map((v) => (
              <li key={v.profile.id}>
                <Link
                  href={`/crm/acquereurs/${v.profile.id}`}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5 transition-colors hover:border-[var(--crm-line-hover)]"
                >
                  <span className="min-w-0">
                    <span className="crm-ellipsis block text-sm font-semibold text-[var(--crm-text)]">
                      {v.name}
                    </span>
                    <span className="crm-ellipsis block text-[11px] text-[var(--crm-text-faint)]">
                      {v.lastPropertyLabel ?? "Bien non précisé"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--crm-text-dim)]">
                    {v.nextTask?.due_at ? formatDateTime(v.nextTask.due_at) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
