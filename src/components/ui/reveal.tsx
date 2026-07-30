"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type RevealVariant = "up" | "blur" | "scale" | "rise";

interface RevealProps {
  children: ReactNode;
  /** Décalage d'apparition (ms) pour un effet d'escalier discret. */
  delayMs?: number;
  /** Style de révélation (relief). */
  variant?: RevealVariant;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "span";
  /** Rejoue à chaque entrée dans le viewport (par défaut : une seule fois). */
  once?: boolean;
}

const variantClass: Record<RevealVariant, string> = {
  up: "",
  blur: "reveal-blur",
  scale: "reveal-scale",
  rise: "reveal-rise",
};

/**
 * Révèle son contenu (fondu + mouvement) lorsqu'il entre dans le viewport.
 * Plusieurs variantes de relief (montée, flou, échelle, grande montée) et un
 * décalage configurable pour des cascades. Respecte `prefers-reduced-motion`
 * (le CSS neutralise alors l'animation) et reste visible sans IntersectionObserver.
 */
export function Reveal({
  children,
  delayMs = 0,
  variant = "up",
  className = "",
  as = "div",
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.14 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${variantClass[variant]} ${visible ? "is-visible" : ""} ${className}`}
      style={
        delayMs ? ({ "--reveal-delay": `${delayMs}ms` } as CSSProperties) : undefined
      }
    >
      {children}
    </Tag>
  );
}
