"use client";

interface ProgressRailProps {
  step: number; // 1..6
  total?: number;
}

/**
 * Stepper premium en quatre temps : Propriété → Projet → Coordonnées →
 * Pré-analyse. Le pas courant est mis en avant (accent doré) ; l'avancement est
 * annoncé aux lecteurs d'écran. Rendu sur fond sombre du parcours.
 */
const PHASES = ["Votre propriété", "Votre projet", "Vos coordonnées", "Pré-analyse"];

/** Associe l'étape (1..6) à l'une des quatre phases (0..3). */
function phaseForStep(step: number): number {
  if (step <= 3) return 0; // type, localisation, valeur
  if (step <= 5) return 1; // horizon, situation de mandat
  if (step <= 6) return 2; // coordonnées
  return 3; // pré-analyse
}

export function ProgressRail({ step, total = 6 }: ProgressRailProps) {
  const current = Math.min(Math.max(step, 1), total);
  const active = phaseForStep(current);

  return (
    <div className="w-full">
      <ol className="flex items-center gap-2 sm:gap-3">
        {PHASES.map((label, i) => {
          const state = i < active ? "done" : i === active ? "current" : "todo";
          return (
            <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
              <span
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.62rem] transition-colors ${
                  state === "current"
                    ? "border-gold bg-gold text-wood-black"
                    : state === "done"
                      ? "border-gold-soft text-gold-soft"
                      : "border-[color:var(--color-border-strong-dark)] text-text-on-dark-muted"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={`hidden truncate text-[0.7rem] uppercase tracking-[0.16em] sm:inline ${
                  state === "current"
                    ? "text-ivory"
                    : state === "done"
                      ? "text-text-on-dark-muted"
                      : "text-text-on-dark-muted/60"
                }`}
              >
                {label}
              </span>
              {i < PHASES.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 ${i < active ? "bg-gold-soft" : "bg-[color:var(--color-border-dark)]"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <span className="sr-only" aria-live="polite">
        Étape {current} sur {total} — {PHASES[active]}
      </span>
    </div>
  );
}
