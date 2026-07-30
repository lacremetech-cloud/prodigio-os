"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ScrollScaleProps {
  children: ReactNode;
  /** Échelle de départ (élément centré) → échelle max (défilé vers le haut). */
  from?: number;
  to?: number;
  className?: string;
}

/**
 * Agrandit légèrement son contenu à mesure que l'on défile — la VSL « grandit »
 * au scroll (storytelling piloté au défilement), de façon fluide (rAF, passif).
 * Neutralisé si l'utilisateur préfère moins d'animations.
 */
export function ScrollScale({
  children,
  from = 1,
  to = 1.12,
  className = "",
}: ScrollScaleProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const p = Math.min(Math.max(-rect.top / (window.innerHeight * 0.9), 0), 1);
      const scale = from + (to - from) * p;
      el.style.transform = `scale(${scale.toFixed(3)})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [from, to]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ willChange: "transform", transformOrigin: "center top" }}
    >
      {children}
    </div>
  );
}
