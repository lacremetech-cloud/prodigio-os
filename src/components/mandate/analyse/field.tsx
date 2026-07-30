"use client";

import { useId, type InputHTMLAttributes } from "react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
}

/**
 * Champ de saisie **plein** (surface ivoire, texte encre) — jamais transparent :
 * lisibilité maximale, aspect « dossier ». Libellé au-dessus, message d'erreur
 * accessible (lié via aria-describedby).
 */
export function Field({ label, error, className = "", ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-xs uppercase tracking-[0.18em] text-text-on-dark-muted"
      >
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-2 min-h-[3.25rem] w-full rounded-[var(--radius-md)] border bg-surface px-4 py-3 text-base text-wood-black shadow-[var(--shadow-sm)] transition-shadow placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 ${
          error
            ? "border-[color:var(--color-danger-on-light)] focus:ring-[color:var(--color-danger-on-light)]"
            : "border-[color:var(--color-border)] focus:border-[color:var(--color-gold-soft)] focus:ring-[color:var(--color-gold-soft)]"
        }`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-[color:var(--color-danger-on-dark)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
