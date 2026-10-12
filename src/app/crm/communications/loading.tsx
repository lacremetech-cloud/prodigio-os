/**
 * État de chargement du studio Communications : squelette respectant la
 * structure réelle (tuiles, encart d'activation, liste), afin que la page ne
 * « saute » pas au moment où les données arrivent.
 */
export default function CommunicationsLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-5" aria-busy="true" aria-live="polite">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[12px] bg-[var(--crm-panel)]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[14px] bg-[var(--crm-panel)]" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[12px] bg-[var(--crm-panel)]" />
        ))}
      </div>
      <span className="sr-only">Chargement du studio de communications…</span>
    </div>
  );
}
