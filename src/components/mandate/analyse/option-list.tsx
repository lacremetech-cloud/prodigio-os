"use client";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionListProps<T extends string> {
  options: readonly Option<T>[];
  selected?: T;
  onSelect: (value: T) => void;
  error?: string;
  ariaLabel: string;
}

/**
 * Liste d'options à choix unique — cartes **solides et généreuses**.
 *
 * Trois retours au geste : l'**appui** est ressenti immédiatement (la carte se
 * resserre), la **sélection** soulève la carte, dore la bordure et fait
 * apparaître la coche. Seules `transform`, `border-color` et `box-shadow` sont
 * animées : `transition-all` embarquait aussi l'épaisseur de bordure, qui
 * provoque un recalcul de mise en page à chaque survol.
 */
export function OptionList<T extends string>({
  options,
  selected,
  onSelect,
  error,
  ariaLabel,
}: OptionListProps<T>) {
  return (
    <div>
      <div role="group" aria-label={ariaLabel} className="flex flex-col gap-3.5">
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.value)}
              className={`group flex min-h-[3.75rem] items-center justify-between gap-4 border bg-[color:var(--color-onyx-soft)] px-6 py-4 text-left transition-[transform,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-0 active:scale-[0.99] active:duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] ${
                isSelected
                  ? "-translate-y-0.5 border-2 border-[color:var(--color-gold)] shadow-[0_16px_40px_-18px_rgba(154,123,69,0.7)]"
                  : "border-[color:var(--color-border-strong-dark)] hover:-translate-y-0.5 hover:border-text-on-dark hover:shadow-[var(--shadow-lg)]"
              }`}
            >
              <span className="text-base text-text-on-dark sm:text-lg">{option.label}</span>
              <span
                key={isSelected ? "on" : "off"}
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                  isSelected
                    ? "animate-check-pop border-gold bg-gold text-white"
                    : "scale-90 border-[color:var(--color-border-strong-dark)] text-transparent group-hover:border-text-on-dark"
                }`}
              >
                <span className="text-xs">✓</span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-4 text-sm text-[color:var(--color-danger-on-dark)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
