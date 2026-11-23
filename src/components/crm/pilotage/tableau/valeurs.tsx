import Link from "next/link";
import type { Total } from "@/modules/pilotage/commission";
import type { Exact } from "@/modules/pilotage/exact";
import { formatEurosExact, formatTotal } from "@/modules/pilotage/affichage";
import type { Calcule, Frequence, Indicateurs } from "@/modules/pilotage/tableau";
import { periodeLabels, PERIODES } from "@/modules/pilotage/meta/periodes";
import { adressePeriode } from "@/modules/pilotage/periode-choisie";
import type { ChoixPeriode } from "@/modules/pilotage/tableau";

/**
 * L'affichage des chiffres de la page Pilotage. Un chiffre absent n'est jamais
 * un zéro : « manquant » (une donnée du pilotage manque, avec sa raison),
 * « en attente » (Meta pas encore lu pour cela), « — » (sans objet : aucun
 * lead, aucune dépense). Les montants exacts s'arrondissent ici, et seulement ici.
 */

export type Format = "euros" | "euros_centimes" | "ratio" | "pourcent" | "nombre";

const nombre1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nombre2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pourcent2 = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eurosCentimes = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const UN = BigInt(1);

/** Une fraction exacte en nombre flottant — pour l'affichage seulement. */
export function enNombre(x: Exact): number {
  return Number(x.n) / Number(x.d);
}

export function formatExact(x: Exact, format: Format): string {
  switch (format) {
    case "euros":
      return formatEurosExact(x);
    case "euros_centimes":
      return eurosCentimes.format(enNombre(x) / 100);
    case "ratio":
      return nombre1.format(enNombre(x));
    case "pourcent":
      return pourcent2.format(enNombre(x));
    case "nombre":
      return x.d === UN ? new Intl.NumberFormat("fr-FR").format(Number(x.n)) : nombre1.format(enNombre(x));
  }
}

function Manquant({ raison }: { raison: string }) {
  return (
    <span className="text-xs font-medium text-[var(--crm-warning)]">
      manquant <span className="font-normal">— {raison}</span>
    </span>
  );
}

function EnAttente() {
  return <span className="text-sm text-[var(--crm-text-faint)]">en attente</span>;
}

function SansObjet({ raison }: { raison: string }) {
  return (
    <span className="text-[var(--crm-text-faint)]" title={raison}>
      —<span className="crm-sr-only"> ({raison})</span>
    </span>
  );
}

export function Valeur({ calcule, format }: { calcule: Calcule; format: Format }) {
  switch (calcule.etat) {
    case "ok":
      return <span className="tabular-nums">{formatExact(calcule.valeur, format)}</span>;
    case "manquant":
      return <Manquant raison={calcule.raison} />;
    case "en_attente":
      return <EnAttente />;
    case "sans_objet":
      return <SansObjet raison={calcule.raison} />;
  }
}

/** Une commission : un total honnête sur ce qui lui manque, ou « manquant ». */
export function ValeurTotal({ total }: { total: Total | null }) {
  if (total === null) return <Manquant raison="aucune condition saisie" />;
  return <span className="tabular-nums">{formatTotal(total)}</span>;
}

/** Un chiffre Meta : `null` tant que Meta n'a pas été lu. */
export function ValeurMeta({
  indicateurs,
  champ,
  format,
}: {
  indicateurs: Indicateurs | null;
  champ: "depense" | "leads" | "impressions" | "coutParLead" | "ctr" | "cpm";
  format: Format;
}) {
  if (!indicateurs) return <EnAttente />;
  const v = indicateurs[champ];
  if ("etat" in v) return <Valeur calcule={v} format={format} />;
  return <span className="tabular-nums">{formatExact(v, format)}</span>;
}

export function ValeurFrequence({ frequence }: { frequence: Frequence }) {
  switch (frequence.etat) {
    case "ok":
      return <span className="tabular-nums">{nombre2.format(frequence.valeur)}</span>;
    case "en_attente":
      return <EnAttente />;
    case "indisponible":
      return <SansObjet raison={frequence.raison} />;
    case "dates_au_choix":
      return <SansObjet raison="la couverture se lit chez Meta pour les périodes proposées seulement" />;
  }
}

/** Une tuile : un libellé, un chiffre, une aide. */
export function Tuile({
  libelle,
  aide,
  children,
  grand = false,
}: {
  libelle: string;
  aide?: string;
  children: React.ReactNode;
  grand?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5">
      <dt className="crm-kpi__label">{libelle}</dt>
      <dd className={grand ? "text-2xl font-semibold text-[var(--crm-text)]" : "text-lg font-semibold text-[var(--crm-text)]"}>
        {children}
      </dd>
      {aide ? <dd className="text-[11px] text-[var(--crm-text-faint)]">{aide}</dd> : null}
    </div>
  );
}

export function Section({
  id,
  titre,
  sousTitre,
  children,
}: {
  id: string;
  titre: string;
  sousTitre?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="crm-panel flex min-w-0 flex-col gap-4 p-5" aria-labelledby={id}>
      <div>
        <h2 id={id} className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          {titre}
        </h2>
        {sousTitre ? <p className="mt-1 text-xs text-[var(--crm-text-faint)]">{sousTitre}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Le choix de la période : les neuf périodes proposées, ou des dates au choix.
 * Un simple formulaire GET — il marche sans script, et l'adresse se partage.
 */
export function SelecteurPeriode({
  chemin,
  choix,
  aujourdHui,
}: {
  chemin: string;
  choix: ChoixPeriode;
  aujourdHui: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Période" className="crm-tabs flex-wrap self-start">
        {PERIODES.map((p) => {
          const actif = choix.type === "proposee" && choix.periode === p;
          return (
            <Link
              key={p}
              href={adressePeriode(chemin, { type: "proposee", periode: p })}
              prefetch={false}
              aria-current={actif ? "page" : undefined}
              className={actif ? "crm-tab crm-tab--active inline-flex items-center" : "crm-tab inline-flex items-center"}
            >
              {periodeLabels[p]}
            </Link>
          );
        })}
      </nav>
      <form method="get" action={chemin} className="flex flex-wrap items-end gap-2" aria-label="Dates au choix">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Du</span>
          <input
            className="crm-input"
            type="date"
            name="du"
            required
            max={aujourdHui}
            defaultValue={choix.type === "dates" ? choix.debut : undefined}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Au</span>
          <input
            className="crm-input"
            type="date"
            name="au"
            required
            max={aujourdHui}
            defaultValue={choix.type === "dates" ? choix.fin : undefined}
          />
        </label>
        <button type="submit" className={choix.type === "dates" ? "crm-btn crm-btn--primaire crm-btn--sm" : "crm-btn crm-btn--secondaire crm-btn--sm"}>
          Dates au choix
        </button>
      </form>
    </div>
  );
}
