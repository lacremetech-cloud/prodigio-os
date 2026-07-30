/**
 * Bandeau défilant cinématographique (marquee). Le contenu est dupliqué pour un
 * défilement continu et sans couture. Purement décoratif (masqué aux lecteurs
 * d'écran) ; l'animation est neutralisée sous `prefers-reduced-motion`.
 */
interface MarqueeProps {
  items: string[];
  tone?: "dark" | "light";
}

export function Marquee({ items, tone = "dark" }: MarqueeProps) {
  const color = tone === "dark" ? "text-ivory/45" : "text-wood-black/40";
  const border = tone === "dark" ? "border-border-dark" : "border-border";
  const dot = tone === "dark" ? "text-gold-soft" : "text-gold";
  const sequence = [...items, ...items];

  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden border-y ${border} py-5`}
    >
      <div className="marquee-track">
        {sequence.map((item, i) => (
          <span
            key={i}
            className={`mx-8 inline-flex items-center gap-8 font-signature text-sm uppercase tracking-[0.34em] ${color}`}
          >
            {item}
            <span className={dot}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
