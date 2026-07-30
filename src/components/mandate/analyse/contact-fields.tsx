"use client";

import { useEffect, useRef } from "react";
import {
  analysis,
  consent,
  type ContactPreference,
  type RecallPreference,
} from "@/modules/mandates/funnel";
import { Field } from "./field";
import { PhoneField } from "./phone-field";
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Met le focus sur le PREMIER champ invalide dès qu'une erreur apparaît
  // (après une tentative de soumission) — accessibilité et guidage précis.
  useEffect(() => {
    const hasError = Object.keys(errors).some((k) => k.startsWith("contact."));
    if (!hasError) return;
    const first = rootRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    first?.focus();
  }, [errors]);

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
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
        <div className="sm:col-span-2">
          <PhoneField
            label={t.phoneLabel}
            numberValue={value.phoneRaw}
            country={value.phoneCountry}
            onNumberChange={(v) => onChange({ phoneRaw: v })}
            onCountryChange={(iso) => onChange({ phoneCountry: iso })}
            error={errors["contact.phoneRaw"]}
          />
        </div>
        <Field
          label={t.emailLabel}
          value={value.emailRaw}
          onChange={(e) => onChange({ emailRaw: e.target.value })}
          error={errors["contact.emailRaw"]}
          autoComplete="email"
          inputMode="email"
          type="email"
          className="sm:col-span-2"
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
                className={`inline-flex min-h-[2.75rem] items-center px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "border-2 border-text-on-dark bg-[color:var(--color-onyx-soft)] text-text-on-dark"
                    : "border border-[color:var(--color-border-strong-dark)] text-text-on-dark/90 hover:border-text-on-dark"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Préférence de rappel (créneau souhaité) — requise */}
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.18em] text-text-on-dark-muted">
          {t.recallLabel}
        </legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {t.recallOptions.map((option) => {
            const isActive = value.recallPreference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  onChange({
                    recallPreference: option.value as RecallPreference,
                  })
                }
                className={`inline-flex min-h-[2.75rem] items-center px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "border-2 border-text-on-dark bg-[color:var(--color-onyx-soft)] text-text-on-dark"
                    : "border border-[color:var(--color-border-strong-dark)] text-text-on-dark/90 hover:border-text-on-dark"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {errors["contact.recallPreference"] ? (
          <p
            className="mt-2 text-sm text-[color:var(--color-danger-on-dark)]"
            role="alert"
          >
            {errors["contact.recallPreference"]}
          </p>
        ) : null}
      </fieldset>

      {/* Consentement explicite */}
      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={value.consent}
            onChange={(e) => onChange({ consent: e.target.checked })}
            aria-invalid={errors["contact.consent"] ? true : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[color:var(--color-gold)]"
          />
          <span className="text-sm leading-relaxed text-text-on-dark">
            {consent.label}
          </span>
        </label>
        {errors["contact.consent"] ? (
          <p
            className="mt-2 text-sm text-[color:var(--color-danger-on-dark)]"
            role="alert"
          >
            {errors["contact.consent"]}
          </p>
        ) : null}
        <p className="mt-3 text-sm leading-relaxed text-text-on-dark-muted">
          {consent.helper}
        </p>
      </div>

      {/* Honeypot (leurre) : masqué visuellement et aux technologies d'assistance.
          Défense PARTIELLE seulement — ne protège pas contre les abus automatisés.
          Cloudflare Turnstile reste requis avant la mise en production.

          IMPORTANT : le champ ne doit JAMAIS être rempli par l'autofill du
          navigateur ni par un gestionnaire de mots de passe (sinon un humain se
          voit bloqué). D'où : aucun libellé « Société »/company (déclencheur
          d'autofill), un `name` neutre, `autocomplete="off"` et les marqueurs
          d'exclusion 1Password (`data-1p-ignore`) / LastPass (`data-lpignore`) /
          Bitwarden & autres (`data-form-type="other"`). En dernier recours,
          `validateFunnelAnswers` neutralise côté machine un honeypot malgré tout
          rempli. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-extra-field">Ne pas remplir</label>
        <input
          id="contact-extra-field"
          name="contact-extra-field"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          value={honeypot}
          onChange={(e) => onHoneypotChange(e.target.value)}
        />
      </div>
    </div>
  );
}
