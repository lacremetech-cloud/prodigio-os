import type { CSSProperties } from "react";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { Chip, SectionTitle } from "@/components/crm/ui";
import {
  BLOCKED_REASON_LABELS,
  type BlockedReason,
} from "@/modules/communications";
import type { ReasonCount, StudioStats } from "@/modules/communications/studio/queries";

/**
 * Vue d'ensemble chiffrée. **Aucune statistique inventée** : chaque tuile
 * correspond à un décompte réel en base, et son libellé dit exactement ce qui
 * est compté.
 *
 * Sémantique non négociable :
 *   • « En file chez le fournisseur » ne signifie ni « envoyé », ni « livré » ;
 *   • « Livraison prouvée » exige une preuve remontée par le fournisseur.
 */

interface Tile {
  key: string;
  label: string;
  /** Ce qui est compté, sans ambiguïté possible. */
  meaning: string;
  value: number;
  cssVar: string;
  icon: string;
}

function StatTile({ tile }: { tile: Tile }) {
  return (
    <div
      className="crm-panel crm-kpi crm-fade-in flex min-w-0 flex-col gap-1 p-4"
      style={{ ["--kpi-accent" as keyof CSSProperties]: cssVarRef(tile.cssVar) } as CSSProperties}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="crm-wrap text-[11px] uppercase tracking-wide text-[var(--crm-text-faint)]">
          {tile.label}
        </p>
        <span aria-hidden className="crm-kpi__icon text-sm">
          {tile.icon}
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--crm-text)]">{tile.value}</p>
      <p className="crm-wrap mt-1 text-[11px] leading-snug text-[var(--crm-text-dim)]">
        {tile.meaning}
      </p>
    </div>
  );
}

function ReasonList({
  title,
  reasons,
  translate,
  emptyLabel,
}: {
  title: string;
  reasons: ReasonCount[];
  translate: (reason: string) => string;
  emptyLabel: string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold text-[var(--crm-text)]">{title}</h3>
      {reasons.length === 0 ? (
        <p className="text-[12px] text-[var(--crm-text-faint)]">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {reasons.map((r) => (
            <li
              key={r.reason}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2"
            >
              <span className="crm-wrap text-[13px] text-[var(--crm-text-dim)]">
                {translate(r.reason)}
              </span>
              <Chip>{r.count}</Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OverviewStats({
  stats,
  blockedReasons,
  skippedReasons,
}: {
  stats: StudioStats;
  blockedReasons: ReasonCount[];
  skippedReasons: ReasonCount[];
}) {
  const tiles: Tile[] = [
    {
      key: "prepares",
      label: "Messages préparés",
      meaning: "Un message existe et est tracé. Préparé ne veut pas dire envoyé.",
      value: stats.prepares,
      cssVar: "--crm-st-nouveau",
      icon: "✎",
    },
    {
      key: "attente",
      label: "En attente d’envoi",
      meaning: "Planifiés ou en attente. Rien n’a encore été remis au fournisseur.",
      value: stats.enAttente,
      cssVar: "--crm-st-a_contacter",
      icon: "◷",
    },
    {
      key: "file",
      label: "En file chez le fournisseur",
      meaning: "Accepté par le fournisseur. Ni « envoyé », ni « livré » : la livraison n’est pas établie.",
      value: stats.enFileFournisseur,
      cssVar: "--crm-st-eligibilite",
      icon: "→",
    },
    {
      key: "livres",
      label: "Livraisons prouvées",
      meaning: "Livraison confirmée par une preuve fournisseur enregistrée. Sans preuve, aucun message n’est compté ici.",
      value: stats.livraisonsProuvees,
      cssVar: "--crm-st-signe",
      icon: "✓",
    },
    {
      key: "echecs",
      label: "Échecs",
      meaning: "Panne technique constatée, motif normalisé et tracé.",
      value: stats.echecs,
      cssVar: "--crm-st-perdu",
      icon: "!",
    },
    {
      key: "bloques",
      label: "Bloqués par la politique",
      meaning: "Décision de Prodigio, jamais du fournisseur. Motif toujours consultable.",
      value: stats.bloques,
      cssVar: "--crm-st-eligibilite",
      icon: "⦸",
    },
    {
      key: "ignores",
      label: "Communications ignorées",
      meaning: "Événements écartés de la file, motif obligatoire : aucune perte silencieuse.",
      value: stats.ignores,
      cssVar: "--crm-st-neutre",
      icon: "×",
    },
    {
      key: "oppositions",
      label: "Oppositions actives",
      meaning: "Elles bloquent l’envoi et ne peuvent jamais l’autoriser.",
      value: stats.oppositionsActives,
      cssVar: "--crm-st-perdu",
      icon: "⦸",
    },
    {
      key: "systeme",
      label: "Automatisations système",
      meaning: "Les communications transactionnelles existantes, en lecture seule.",
      value: stats.automatisationsSysteme,
      cssVar: "--crm-st-signe",
      icon: "⚙",
    },
    {
      key: "brouillons",
      label: "Brouillons personnalisés",
      meaning: "Workflows en préparation. Aucun ne s’exécute ni ne peut être activé en V1.",
      value: stats.brouillonsPersonnalises,
      cssVar: "--crm-st-nouveau",
      icon: "✎",
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <StatTile key={tile.key} tile={tile} />
        ))}
      </div>

      {stats.livresSansPreuve > 0 ? (
        <p
          role="alert"
          className="crm-wrap rounded-[10px] border px-3 py-2.5 text-sm text-[var(--crm-text)]"
          style={{ borderColor: "var(--crm-danger)", background: "var(--crm-panel-2)" }}
        >
          Anomalie : {stats.livresSansPreuve} message(s) au statut « livré » sans preuve
          fournisseur. Ce cas ne devrait pas exister — la base l&apos;interdit. À investiguer avant
          toute activation.
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4 lg:grid-cols-2">
        <div className="min-w-0 lg:col-span-2">
          <SectionTitle eyebrow="Traçabilité" title="Motifs constatés" />
          <p className="crm-wrap text-sm text-[var(--crm-text-dim)]">
            Chaque communication non partie porte un motif. Rien n&apos;est écarté sans raison
            lisible.
          </p>
        </div>
        <ReasonList
          title="Blocages par la politique"
          reasons={blockedReasons}
          translate={(r) => BLOCKED_REASON_LABELS[r as BlockedReason] ?? r}
          emptyLabel="Aucun blocage constaté."
        />
        <ReasonList
          title="Événements ignorés dans la file"
          reasons={skippedReasons}
          translate={(r) => r}
          emptyLabel="Aucun événement ignoré."
        />
      </div>
    </section>
  );
}
