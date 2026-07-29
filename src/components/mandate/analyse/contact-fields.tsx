"use client";

import { analysis, consent, type ContactPreference } from "@/modules/mandates/funnel";
import { Field } from "./field";
import type { DraftAnswers } from "./use-analyse-machine";

interface ContactFieldsProps {
  value: DraftAnswers["contact"];
  onChange: (patch: Partial<DraftAnswers["contact"]>) => void;
  errors: Record<string, string>;
  honeypot: string;
  onHoneypotChange: (value: string) => void;
}

/**
 * Étape coordonnées : identité, téléphone, e-mail, préférence de contact, et
 * accord explicite (formulation provisoire à valider juridiquement). Le champ
 * « company » est un honeypot masqué aux humains et aux lecteurs d'écran.
 */
export function ContactFields({
  value,
  onChange,
  errors,
  honeypot,
  onHoneypotChange,
}: ContactFieldsProps) {
  const t = analysis.steps.contact;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label={t.firstNameLabel}
          value={value.firstName}
          onChange={(e) => onChange({ firstName: e.target.value })}
          error={errors["contact.firstName"]}
          autoComplete="given-name"
          autoFocus
        />
        <Field
          label={t.lastNameLabel}
          value={value.lastName}
          onChange={(e) => onChange({ lastName: e.target.value })}
          error={errors["contact.lastName"]}
          autoComplete="family-name"
        />
        <Field
          label={t.phoneLabel}
          value={value.phoneRaw}
          onChange={(e) => onChange({ phoneRaw: e.target.value })}
          error={errors["contact.phoneRaw"]}
          autoComplete="tel"
          inputMode="tel"
          type="tel"
        />
        <Field
          label={t.emailLabel}
          value={value.emailRaw}
          onChange={(e) => onChange({ emailRaw: e.target.value })}
          error={errors["contact.emailRaw"]}
          autoComplete="email"
          inputMode="email"
          type="email"
        />
      </div>

      {/* Préférence de contact (facultatif) */}
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.18em] text-text-on-dark-muted">
          {t.preferenceLabel}
        </legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {t.preferenceOptions.map((option) => {
            const isActive = value.preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  onChange({ preference: option.value as ContactPreference })
                }
                className={`border px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-gold bg-[color:var(--color-onyx-soft)] text-ivory"
                    : "border-[color:var(--color-border-dark)] text-ivory/80 hover:border-[color:var(--color-gold-soft)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Consentement explicite */}
      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={value.consent}
            onChange={(e) => onChange({ consent: e.target.checked })}
            aria-invalid={errors["contact.consent"] ? true : undefined}
            className="mt-1 size-5 shrink-0 accent-[color:var(--color-gold)]"
          />
          <span className="text-sm leading-relaxed text-ivory/90">
            {consent.label}
          </span>
        </label>
        {errors["contact.consent"] ? (
          <p className="mt-2 text-sm text-[#e6a68f]" role="alert">
            {errors["contact.consent"]}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-text-on-dark-muted">
          {consent.helper}
        </p>
      </div>

      {/* Honeypot anti-spam : masqué visuellement et aux technologies d'assistance. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Société (ne pas remplir)
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => onHoneypotChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
