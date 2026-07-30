"use client";

import { useEffect, useRef } from "react";

/**
 * Boîte de dialogue accessible (backdrop, fermeture Échap / clic extérieur,
 * focus initial, `aria-modal`). Sert le formulaire d'invitation et les
 * confirmations d'actions sensibles.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  labelledBy = "crm-modal-title",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Focus le panneau à l'ouverture (accessibilité clavier).
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        aria-label="Fermer"
        tabIndex={-1}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-t-[16px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-5 shadow-[var(--shadow-lg)] outline-none crm-fade-in sm:rounded-[16px] sm:p-6"
      >
        <div className="mb-4">
          <h2 id={labelledBy} className="text-lg font-semibold text-[var(--crm-text)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--crm-text-dim)]">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
