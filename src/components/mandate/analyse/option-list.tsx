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
 * Liste d'options à choix unique, élégante et sobre. Chaque option est un bouton
 * accessible (aria-pressed) ; l'option retenue porte un accent or discret.
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
      <div role="group" aria-label={ariaLabel} className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.value)}
              className={`group flex min-h-[3.25rem] items-center justify-between gap-4 border px-5 py-4 text-left transition-colors duration-200 ${
                isSelected
                  ? "border-2 border-text-on-dark bg-[color:var(--color-onyx-soft)] text-text-on-dark"
                  : "border border-[color:var(--color-border-strong-dark)] text-text-on-dark/90 hover:border-text-on-dark hover:bg-[color:var(--color-onyx-soft)]"
              }`}
            >
              <span className="text-base sm:text-lg">{option.label}</span>
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isSelected
                    ? "border-gold bg-gold text-white"
                    : "border-[color:var(--color-border-strong-dark)] text-transparent group-hover:border-text-on-dark"
                }`}
              >
                <span className="text-[0.7rem]">✓</span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p
          className="mt-4 text-sm text-[color:var(--color-danger-on-dark)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
