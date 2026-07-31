"use client";

import { useState } from "react";

/**
 * Valeur copiable (e-mail, téléphone) affichée sans troncature involontaire.
 * N'affiche le bouton « copier » que lorsqu'une valeur réelle est fournie — les
 * valeurs masquées (rôle non autorisé) restent en simple texte, jamais copiables.
 */
export function CopyableValue({
  value,
  copyable,
  href,
}: {
  value: string;
  /** Valeur réelle à copier ; `null` si masquée / absente (aucun bouton). */
  copyable?: string | null;
  /** Lien optionnel (mailto:/tel:) enveloppant la valeur. */
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  const body = href ? (
    <a className="crm-wrap underline decoration-dotted underline-offset-2 hover:text-[var(--crm-gold)]" href={href}>
      {value}
    </a>
  ) : (
    <span className="crm-wrap">{value}</span>
  );

  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      {body}
      {copyable ? (
        <button
          type="button"
          className="shrink-0 text-[11px] text-[var(--crm-gold)] underline"
          aria-label="Copier"
          onClick={() => {
            void navigator.clipboard?.writeText(copyable).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "copié" : "copier"}
        </button>
      ) : null}
    </span>
  );
}
