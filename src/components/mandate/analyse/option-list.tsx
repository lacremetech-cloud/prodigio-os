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
              className={`group flex items-center justify-between gap-4 border px-5 py-4 text-left transition-colors duration-200 ${
                isSelected
                  ? "border-gold bg-[color:var(--color-onyx-soft)] text-ivory"
                  : "border-[color:var(--color-border-dark)] text-ivory/85 hover:border-[color:var(--color-gold-soft)] hover:text-ivory"
              }`}
            >
              <span className="text-base sm:text-lg">{option.label}</span>
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isSelected
                    ? "border-gold bg-gold text-white"
                    : "border-[color:var(--color-border-dark)] text-transparent group-hover:border-[color:var(--color-gold-soft)]"
                }`}
              >
                <span className="text-[0.7rem]">✓</span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-4 text-sm text-[#e6a68f]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
