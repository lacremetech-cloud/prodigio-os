import Link from "next/link";
import type { CSSProperties } from "react";
import type { BuyerListItem } from "@/modules/buyers/crm/queries";
import { formatDateTime } from "@/modules/crm/format";
import type { Visite } from "@/modules/buyers/crm/visites";
import { CourbeArrivees } from "./courbe-arrivees";
import { datesDArrivee } from "@/modules/buyers/crm/arrivees";
import {
  BUDGET_CHOICE_COURT,
  type BuyerBudgetChoice,
} from "@/modules/buyers/funnel/universal";

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
  dossiers: number;
  aContacter: number;
  aRappeler: number;
  enCours: number;
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
    dossiers: ouverts.length,
    /*
     * « À contacter » = personne ne lui a encore parlé. C'est volontairement
     * différent de « sans action prévue » : un dossier appelé trois fois sans
     * succès n'est plus à contacter, il est à rappeler. Les deux comptaient
     * autrefois pareil, et le commercial rappelait en priorité des gens qu'il
     * venait d'avoir au téléphone.
     */
    aContacter: ouverts.filter((i) => i.callAttempts === 0).length,
    /* Un rappel est DÛ aujourd'hui ou en retard. Les rappels futurs ne sont pas
       comptés : ils ne demandent rien aujourd'hui. */
    aRappeler: ouverts.filter((i) => i.nextTask?.due_at && !estPlusTard(i.nextTask.due_at)).length,
    /* « En cours » : un échange est engagé et le dossier est encore ouvert. */
    enCours: ouverts.filter((i) => ETAPES_EN_COURS.has(i.stage)).length,
  };
}

const ETAPES_EN_COURS = new Set(["a_rappeler", "en_discussion", "visite", "offre"]);

/** Vrai si l'échéance tombe après aujourd'hui. */
function estPlusTard(iso: string): boolean {
  const d = new Date(iso);
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  return d.getTime() > fin.getTime();
}

/**
 * Le premier traitement : combien de dossiers ont reçu AU MOINS une tentative.
 *
 * Une tentative sans réponse compte : elle a été faite, c'est ce que mesure ce
 * nombre. Elle ne vaut PAS « personne jointe » — ce serait une autre mesure, et
 * les confondre fait croire à un travail abouti qui ne l'est pas.
 */
export function premierTraitement(items: BuyerListItem[]): {
  traites: number;
  total: number;
  pourcent: number;
  restants: number;
} {
  const ouverts = items.filter(encoreOuvert);
  const total = ouverts.length;
  const traites = ouverts.filter((i) => i.callAttempts > 0).length;
  return {
    traites,
    total,
    // Pas de division par zéro : un périmètre vide n'est pas « 0 % traité ».
    pourcent: total === 0 ? 0 : Math.round((traites / total) * 100),
    restants: total - traites,
  };
}

/**
 * Les dossiers a traiter, dans l'ordre ou ils brulent.
 *
 * Le tableau de bord annonçait « 3 sans action prevue » et s'arretait la : il
 * fallait cliquer, puis relire la liste pour retrouver lesquels. Un ecran du
 * matin doit donner les noms, pas seulement leur nombre.
 *
 * Un retard passe avant une absence d'action : l'echeance etait prise, elle est
 * depassee. Ensuite les arrivees recentes, les plus fraiches d'abord — un lead
 * refroidit vite.
 */
export function aTraiterEnPriorite(items: BuyerListItem[]): BuyerListItem[] {
  return items
    .filter(encoreOuvert)
    .filter((i) => i.overdue || i.noNextAction)
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return (b.profile.last_interest_at ?? "").localeCompare(
        a.profile.last_interest_at ?? "",
      );
    });
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
    <Link prefetch={false}
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

export function TableauCommercial({
  items,
  visites,
  chargeA,
}: {
  items: BuyerListItem[];
  /** Visites a venir, lues a la meme source que l'agenda des visites. */
  visites: Visite[];
  /** Instant de chargement (ISO) : la courbe en a besoin pour que son rendu
      serveur et son rendu navigateur tombent sur le meme jour. */
  chargeA: string;
}) {
  const c = compterPourCommercial(items);
  const prochaines = visites.slice(0, 5);
  const priorites = aTraiterEnPriorite(items);
  const traitement = premierTraitement(items);
  return (
    <section className="flex flex-col gap-4">
      {/* Est-ce que ça monte : la premiere question devant un funnel payant,
          et la seule a laquelle une rangee de compteurs ne repond pas. */}
      <CourbeArrivees dates={datesDArrivee(items)} chargeA={chargeA} />

      {/* Deux colonnes sur telephone, cinq au-dela : chaque chiffre reste
          lisible sans zoom, et la rangee ne se brise jamais au milieu.
          Chaque tuile ouvre EXACTEMENT les dossiers qu'elle compte. */}
      {/* Six compteurs qui repondent a « qu'est-ce que je fais maintenant ».
          Ils peuvent se chevaucher — un dossier a contacter est aussi un
          dossier total — et c'est voulu : ce ne sont pas des parts d'un
          camembert, ce sont six questions. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Chiffre valeur={c.dossiers} libelle="Leads totaux"
                 icone="◈" vif="--crm-vif-signe"
                 href="/crm/acquereurs" />
        <Chiffre valeur={c.nouveauxAujourdhui} libelle="Leads aujourd’hui"
                 icone="✦" vif="--crm-vif-nouveau"
                 href="/crm/acquereurs?signal=nouveaux" />
        <Chiffre valeur={c.aContacter} libelle="À contacter"
                 icone="☎︎" vif="--crm-vif-a_contacter"
                 href="/crm/acquereurs?signal=a_contacter" />
        <Chiffre valeur={c.aRappeler} libelle="À rappeler" alerte
                 icone="↻" vif="--crm-vif-proposition"
                 href="/crm/acquereurs?signal=a_rappeler" />
        <Chiffre valeur={c.enCours} libelle="En cours"
                 icone="◗" vif="--crm-vif-contact"
                 href="/crm/acquereurs?signal=en_cours" />
        <Chiffre valeur={visites.length} libelle="Visites à venir"
                 icone="◷" vif="--crm-vif-rdv_planifie"
                 href="/crm/visites" />
      </div>

      {/* Le premier traitement : la seule mesure qui dit si le travail du jour
          avance. Une tentative sans reponse y compte — elle a ete faite — mais
          ne vaut PAS « personne jointe ». */}
      {traitement.total > 0 ? (
        <div className="crm-panel flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--crm-text)]">
              Premier traitement : {traitement.pourcent} %
              <span className="ml-2 text-xs font-medium text-[var(--crm-text-dim)]">
                {traitement.traites} lead{traitement.traites > 1 ? "s" : ""} sur {traitement.total}
              </span>
            </h2>
            {traitement.restants > 0 ? (
              <Link prefetch={false}
                href="/crm/acquereurs?signal=a_contacter"
                className="crm-btn crm-btn--primaire inline-flex items-center"
              >
                Commencer les appels
              </Link>
            ) : null}
          </div>
          <div
            className="crm-progression"
            role="progressbar"
            aria-valuenow={traitement.pourcent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Premier traitement"
          >
            <span style={{ width: `${traitement.pourcent}%` }} />
          </div>
          <p className="text-xs text-[var(--crm-text-dim)]">
            {traitement.restants > 0
              ? `${traitement.restants} reste${traitement.restants > 1 ? "nt" : ""} à contacter.`
              : "Tout le monde a été contacté au moins une fois."}
          </p>
        </div>
      ) : null}

      <div className="crm-panel flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-[var(--crm-text)]">À traiter en priorité</h2>
          {priorites.length > 5 ? (
            <Link prefetch={false}
              href="/crm/acquereurs?signal=sans_action"
              className="text-xs font-medium text-[var(--crm-univers)] hover:underline"
            >
              Les {priorites.length}
            </Link>
          ) : null}
        </div>
        {priorites.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-5 text-center text-xs text-[var(--crm-text-faint)]">
            Chaque dossier ouvert a sa prochaine action. Rien ne traîne.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {priorites.slice(0, 5).map((d) => (
              <li key={d.profile.id}>
                <Link prefetch={false}
                  href={`/crm/acquereurs/${d.profile.id}`}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5 transition-colors hover:border-[var(--crm-line-hover)]"
                >
                  <span className="min-w-0">
                    <span className="crm-ellipsis block text-sm font-semibold text-[var(--crm-text)]">
                      {d.name}
                    </span>
                    <span className="crm-ellipsis block text-[11px] text-[var(--crm-text-faint)]">
                      {d.propertyLabel ?? "Bien non précisé"}
                      {d.budgetChoice
                        ? ` · ${BUDGET_CHOICE_COURT[d.budgetChoice as BuyerBudgetChoice] ?? d.budgetChoice}`
                        : ""}
                    </span>
                  </span>
                  {/* Le motif est ecrit, jamais seulement couleur. */}
                  <span
                    className="shrink-0 text-[11px] font-semibold"
                    style={{
                      color: d.overdue ? "var(--crm-vif-perdu)" : "var(--crm-vif-a_contacter)",
                    }}
                  >
                    {d.overdue ? "! En retard" : "☎︎ Sans action"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ce qui est cale, et quand. Le compteur disait « 3 visites » sans
          jamais dire lesquelles ni a quelle heure : il fallait ouvrir le
          pipeline puis chaque fiche pour retrouver sa propre journee. */}
      <div className="crm-panel flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-[var(--crm-text)]">Prochaines visites</h2>
          <Link prefetch={false}
            href="/crm/visites"
            className="text-xs font-medium text-[var(--crm-univers)] hover:underline"
          >
            Tout l’agenda
          </Link>
        </div>
        {prochaines.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-5 text-center text-xs text-[var(--crm-text-faint)]">
            Aucune visite planifiée. Ouvrez une fiche pour en caler une.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {prochaines.map((v) => (
              <li key={v.taskId}>
                <Link prefetch={false}
                  href={`/crm/acquereurs/${v.buyerProfileId}`}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5 transition-colors hover:border-[var(--crm-line-hover)]"
                >
                  <span className="min-w-0">
                    <span className="crm-ellipsis block text-sm font-semibold text-[var(--crm-text)]">
                      {v.name}
                    </span>
                    <span className="crm-ellipsis block text-[11px] text-[var(--crm-text-faint)]">
                      {v.propertyLabel ?? "Bien non précisé"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--crm-text-dim)]">
                    {formatDateTime(v.startsAt)}
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
