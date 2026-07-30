import {
  appreciationLabels,
  priorityLabels,
  segmentLabels,
  stageLabels,
} from "@/modules/crm/labels";
import { agingLevel, initials, timeSince } from "@/modules/crm/format";

/**
 * Composants de présentation du CRM (server components purs). Aucune logique
 * client : lisibilité, contraste et cohérence des pastilles / scores / avatars.
 */

export function Chip({
  children,
  variant = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  variant?: "neutral" | "gold" | "danger" | "ok";
  dot?: boolean;
}) {
  const cls =
    variant === "gold"
      ? "crm-chip crm-chip--gold"
      : variant === "danger"
        ? "crm-chip crm-chip--danger"
        : variant === "ok"
          ? "crm-chip crm-chip--ok"
          : "crm-chip";
  return <span className={dot ? `${cls} crm-chip--dot` : cls}>{children}</span>;
}

function stageVariant(stage: string): "neutral" | "gold" | "danger" | "ok" {
  if (stage === "nouveau") return "gold";
  if (stage === "perdu") return "danger";
  if (stage === "mandat_signe") return "ok";
  return "neutral";
}

export function StageBadge({ stage }: { stage: string }) {
  return <Chip variant={stageVariant(stage)}>{stageLabels[stage] ?? stage}</Chip>;
}

export function SegmentBadge({ segment }: { segment: string }) {
  if (!segment || segment === "non_determine") {
    return <span className="text-xs text-[var(--crm-text-faint)]">Segment non déterminé</span>;
  }
  return <Chip variant="neutral">{segmentLabels[segment] ?? segment}</Chip>;
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const variant = priority === "rappel_prioritaire" ? "gold" : "neutral";
  return <Chip variant={variant} dot>{priorityLabels[priority] ?? priority}</Chip>;
}

export function AppreciationBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const variant = value === "fort_potentiel" ? "ok" : "neutral";
  return <Chip variant={variant}>{appreciationLabels[value] ?? value}</Chip>;
}

export function ScoreMeter({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const value = typeof score === "number" ? Math.max(0, Math.min(100, score)) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="crm-label">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--crm-text)]">
          {value == null ? "—" : `${value}`}
          <span className="text-[var(--crm-text-faint)]">{value == null ? "" : " / 100"}</span>
        </span>
      </div>
      <div className="crm-meter" role="meter" aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--crm-line)] bg-[var(--crm-elevated)] font-semibold text-[var(--crm-gold)]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function AgingDot({ createdAt }: { createdAt: string }) {
  const level = agingLevel(createdAt);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs crm-aging--${level}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      <span className="text-[var(--crm-text-dim)]">{timeSince(createdAt)}</span>
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  icon = "◇",
}: {
  title: string;
  hint?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[var(--crm-line)] bg-[var(--crm-panel)] px-6 py-16 text-center crm-fade-in">
      <span aria-hidden className="text-2xl text-[var(--crm-gold)]">{icon}</span>
      <p className="text-sm font-medium text-[var(--crm-text)]">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-[var(--crm-text-dim)]">{hint}</p> : null}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="crm-eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-1 text-lg font-semibold text-[var(--crm-text)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
