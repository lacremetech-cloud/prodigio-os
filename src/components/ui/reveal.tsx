"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Décalage d'apparition (ms) pour un effet d'escalier discret. */
  delayMs?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}

/**
 * Révèle son contenu en fondu-montée lorsqu'il entre dans le viewport.
 * Respecte `prefers-reduced-motion` (le CSS neutralise alors l'animation) et
 * reste visible si l'IntersectionObserver n'est pas disponible (dégradation).
 */
export function Reveal({
  children,
  delayMs = 0,
  className = "",
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      // Dégradation : révèle au prochain frame (asynchrone, hors corps d'effet).
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={visible && delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
