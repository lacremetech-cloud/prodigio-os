/** Squelette de chargement de l'écran « Équipe & accès ». */
export default function TeamLoading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 animate-pulse rounded bg-[var(--crm-panel-2)]" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-[12px] bg-[var(--crm-panel)]" />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-[12px] bg-[var(--crm-panel)]" />
        ))}
      </div>
      <span className="sr-only">Chargement de l’équipe…</span>
    </div>
  );
}
