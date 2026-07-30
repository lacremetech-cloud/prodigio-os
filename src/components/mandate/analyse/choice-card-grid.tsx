"use client";

import Image from "next/image";
import { media } from "@/lib/media";
import {
  PROPERTY_TYPES,
  propertyTypeLabels,
  type PropertyType,
} from "@/modules/mandates/funnel";

interface ChoiceCardGridProps {
  selected?: PropertyType;
  onSelect: (value: PropertyType) => void;
  error?: string;
}

/**
 * Sélection visuelle du type de propriété : grandes cartes photographiques, une
 * image par catégorie, état sélectionné subtil (accent or + assombrissement).
 */
export function ChoiceCardGrid({
  selected,
  onSelect,
  error,
}: ChoiceCardGridProps) {
  return (
    <div>
      <div
        role="group"
        aria-label="Nature de la propriété"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {PROPERTY_TYPES.map((value) => {
          const { label, image } = propertyTypeLabels[value];
          const asset = media[image];
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(value)}
              className={`group relative aspect-[4/3] overflow-hidden text-left transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] ${
                isSelected
                  ? "-translate-y-1 border-2 border-[color:var(--color-gold)] shadow-[0_22px_50px_-20px_rgba(154,123,69,0.8)]"
                  : "border border-[color:var(--color-border-strong-dark)] hover:-translate-y-1 hover:border-text-on-dark hover:shadow-[var(--shadow-lg)]"
              }`}
            >
              <Image
                src={asset.src}
                alt={asset.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className={`object-cover transition-transform duration-500 ${
                  isSelected ? "scale-[1.03]" : "group-hover:scale-[1.03]"
                }`}
              />
              <span
                aria-hidden="true"
                className={`absolute inset-0 transition-opacity duration-300 ${
                  isSelected
                    ? "bg-[linear-gradient(180deg,rgba(12,12,14,0.32)_0%,rgba(12,12,14,0.88)_100%)]"
                    : "bg-[linear-gradient(180deg,rgba(12,12,14,0.12)_0%,rgba(12,12,14,0.78)_100%)]"
                }`}
              />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                <span className="text-base font-medium text-ivory sm:text-lg">
                  {label}
                </span>
                <span
                  aria-hidden="true"
                  className={`mb-1 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isSelected
                      ? "border-gold bg-gold text-white"
                      : "border-text-on-dark/70 text-transparent"
                  }`}
                >
                  <span className="text-xs">✓</span>
                </span>
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
