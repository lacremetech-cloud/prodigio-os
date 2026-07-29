"use client";

import { analysis } from "@/modules/mandates/funnel";
import { Field } from "./field";
import type { DraftAnswers } from "./use-analyse-machine";

interface LocationFieldsProps {
  value: DraftAnswers["location"];
  onChange: (patch: Partial<DraftAnswers["location"]>) => void;
  errors: Record<string, string>;
}

/** Étape localisation : ville, code postal, pays. Pas d'adresse exacte. */
export function LocationFields({ value, onChange, errors }: LocationFieldsProps) {
  const t = analysis.steps.location;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field
        label={t.cityLabel}
        value={value.city}
        onChange={(e) => onChange({ city: e.target.value })}
        error={errors["location.city"]}
        autoComplete="address-level2"
        autoFocus
        className="sm:col-span-2"
      />
      <Field
        label={t.postalLabel}
        value={value.postalCode}
        onChange={(e) => onChange({ postalCode: e.target.value })}
        error={errors["location.postalCode"]}
        autoComplete="postal-code"
        inputMode="text"
      />
      <Field
        label={t.countryLabel}
        value={value.country}
        onChange={(e) => onChange({ country: e.target.value })}
        error={errors["location.country"]}
        autoComplete="country-name"
      />
      <p className="text-sm text-text-on-dark-muted sm:col-span-2">{t.note}</p>
    </div>
  );
}
