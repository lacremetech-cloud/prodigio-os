"use client";

import { useId, type InputHTMLAttributes } from "react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
}

/**
 * Champ de saisie sur fond immersif sombre : libellé au-dessus, ligne fine qui
 * s'illumine au focus, message d'erreur accessible (lié via aria-describedby).
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
        className={`mt-2 w-full border-0 border-b bg-transparent px-0 py-2.5 text-lg text-ivory placeholder:text-ivory/30 focus:outline-none focus:ring-0 ${
          error
            ? "border-b-2 border-[#d98a72]"
            : "border-[color:var(--color-border-dark)] focus:border-gold"
        } transition-colors`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-[#e6a68f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
