"use client";

/** Frontière d’erreur du CRM : message clair + possibilité de réessayer. */
export default function CrmError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] px-6 py-16 text-center">
      <span aria-hidden className="text-2xl text-[var(--color-danger-on-dark)]">
        ⚠
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--crm-text)]">
          Une erreur est survenue lors du chargement.
        </p>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Vos données sont intactes. Vous pouvez réessayer.
        </p>
      </div>
      <button type="button" onClick={() => reset()} className="crm-btn crm-btn--gold crm-btn--sm">
        Réessayer
      </button>
    </div>
  );
}
