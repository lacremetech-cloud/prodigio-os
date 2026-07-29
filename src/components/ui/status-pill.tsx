import type { ReactNode } from "react";

interface StatusPillProps {
  children: ReactNode;
}

/**
 * Petite pastille de statut, accessible (le point coloré est décoratif et
 * masqué aux lecteurs d'écran ; le texte porte l'information).
 */
export function StatusPill({ children }: StatusPillProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-secondary shadow-[var(--shadow-sm)]">
      <span aria-hidden="true" className="size-2 rounded-full bg-gold" />
      {children}
    </span>
  );
}
