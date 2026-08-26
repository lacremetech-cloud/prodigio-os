/**
 * Étiquette de section : un simple filet suivi d'un intitulé en capitales.
 *
 * Volontairement minimal — pas de numéro de section, pas de faux repère de
 * production cinématographique. La hiérarchie doit venir de la typographie et de
 * l'espace, pas d'un ornement répété à l'identique quinze fois.
 */
export function SectionLabel({
  children,
  tone = "light",
  className = "",
}: {
  children: string;
  /** `light` : sur fond ivoire. `dark` : sur fond onyx. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const text = tone === "dark" ? "text-ivory/70" : "text-text-secondary";
  const line = tone === "dark" ? "bg-ivory/30" : "bg-border-strong";
  return (
    <p className={`flex items-center gap-4 ${text} ${className}`}>
      <span aria-hidden="true" className={`h-px w-8 shrink-0 ${line}`} />
      <span className="font-signature text-[0.7rem] font-semibold uppercase tracking-[0.22em]">
        {children}
      </span>
    </p>
  );
}
