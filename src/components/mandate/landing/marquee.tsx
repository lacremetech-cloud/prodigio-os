/**
 * Bandeau défilant sobre. Le contenu est dupliqué pour un défilement continu.
 * Purement décoratif (masqué aux lecteurs d'écran) ; l'animation est neutralisée
 * sous `prefers-reduced-motion`. Séparateur typographique simple — ni étoile, ni
 * losange, ni ornement « luxe ».
 */
interface MarqueeProps {
  items: string[];
  tone?: "dark" | "light";
}

export function Marquee({ items, tone = "dark" }: MarqueeProps) {
  const color = tone === "dark" ? "text-ivory/40" : "text-wood-black/35";
  const border = tone === "dark" ? "border-border-dark" : "border-border";
  const sequence = [...items, ...items];

  return (
    <div aria-hidden="true" className={`overflow-hidden border-y ${border} py-4`}>
      <div className="marquee-track">
        {sequence.map((item, i) => (
          <span
            key={i}
            className={`mx-7 inline-flex items-center gap-7 font-signature text-[0.72rem] uppercase tracking-[0.28em] ${color}`}
          >
            {item}
            <span className="h-px w-6 bg-current opacity-40" />
          </span>
        ))}
      </div>
    </div>
  );
}
