import type { ReactNode } from "react";

interface SectionHeadingProps {
  kicker: string;
  title: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}

/** Intertitre éditorial : kicker en capitales espacées + titre serif. */
export function SectionHeading({
  kicker,
  title,
  align = "left",
  tone = "light",
  className = "",
}: SectionHeadingProps) {
  const alignment = align === "center" ? "text-center mx-auto" : "text-left";
  // Kicker : champagne lisible sur sombre (9.7:1) ; gris neutre sur clair
  // (l'or ne passe pas AA en petit sur fond clair — réservé aux accents).
  const kickerColor = tone === "dark" ? "text-gold-soft" : "text-text-secondary";
  const titleColor = tone === "dark" ? "text-ivory" : "text-wood-black";

  return (
    <div className={`max-w-2xl ${alignment} ${className}`}>
      <p className={`eyebrow ${kickerColor}`}>{kicker}</p>
      <h2
        className={`mt-5 text-balance text-3xl leading-[1.15] sm:text-4xl md:text-[2.75rem] ${titleColor}`}
      >
        {title}
      </h2>
    </div>
  );
}
