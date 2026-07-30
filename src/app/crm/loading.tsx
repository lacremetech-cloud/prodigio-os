/** État de chargement premium (squelette) partagé par les pages du CRM. */
export default function CrmLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-7 w-48 animate-pulse rounded bg-[var(--crm-panel-2)]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-[12px] bg-[var(--crm-panel)]" />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[12px] bg-[var(--crm-panel)]" />
        ))}
      </div>
      <span className="sr-only">Chargement du CRM…</span>
    </div>
  );
}
