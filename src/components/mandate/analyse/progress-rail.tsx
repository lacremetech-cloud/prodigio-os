"use client";

interface ProgressRailProps {
  step: number; // 1..6
  total?: number;
}

const pad = (n: number) => n.toString().padStart(2, "0");

/**
 * Indicateur discret « 0X — 06 » et ligne de progression très fine. Annonce
 * l'étape courante aux lecteurs d'écran via une région live polie.
 */
export function ProgressRail({ step, total = 6 }: ProgressRailProps) {
  const current = Math.min(Math.max(step, 1), total);
  const pct = (current / total) * 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className="font-signature text-xs tracking-[0.28em] text-gold-soft">
          {pad(current)} <span className="text-text-on-dark-muted">— {pad(total)}</span>
        </span>
        <span className="eyebrow text-[0.68rem] text-text-on-dark-muted">
          Analyse confidentielle
        </span>
      </div>
      <div className="relative mt-3 h-px w-full bg-[color:var(--color-border-dark)]">
        <div
          className="absolute inset-y-0 left-0 bg-gold transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="sr-only" aria-live="polite">
        Étape {current} sur {total}
      </span>
    </div>
  );
}
