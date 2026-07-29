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
              className={`group relative aspect-[4/3] overflow-hidden border text-left transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                isSelected
                  ? "border-gold"
                  : "border-[color:var(--color-border-dark)] hover:border-[color:var(--color-gold-soft)]"
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
                    ? "bg-[linear-gradient(180deg,rgba(20,17,13,0.25)_0%,rgba(20,17,13,0.82)_100%)]"
                    : "bg-[linear-gradient(180deg,rgba(20,17,13,0.15)_0%,rgba(20,17,13,0.72)_100%)]"
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
                      : "border-ivory/50 text-transparent"
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
        <p className="mt-4 text-sm text-[#e6a68f]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
