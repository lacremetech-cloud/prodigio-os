/**
 * Repère de section discret, inspiré des détails de production cinématographique :
 * numéro de section, fine ligne, et intitulé. Décoratif mais informatif.
 */
interface SectionMarkerProps {
  index: string;
  label: string;
  /** Rendu clair (sur ivoire) ou sombre (sur onyx). */
  tone?: "dark" | "light";
}

export function SectionMarker({ index, label, tone = "dark" }: SectionMarkerProps) {
  const muted =
    tone === "light" ? "text-ivory/60" : "text-text-secondary";
  const line = tone === "light" ? "bg-ivory/25" : "bg-border-strong";
  return (
    <div className={`flex items-center gap-4 ${muted}`}>
      <span className="font-signature text-xs tracking-[0.3em]">
        SECTION {index}
      </span>
      <span aria-hidden="true" className={`h-px w-10 ${line}`} />
      <span className="font-signature text-[0.7rem] uppercase tracking-[0.28em]">
        {label}
      </span>
    </div>
  );
}
