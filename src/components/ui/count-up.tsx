"use client";

import { useEffect, useRef, useState } from "react";

/** Courbe d'accélération douce (sortie exponentielle) — pure, testable. */
export function easeOutExpo(t: number): number {
  if (t >= 1) return 1;
  if (t <= 0) return 0;
  return 1 - Math.pow(2, -10 * t);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface CountUpProps {
  value: number;
  durationMs?: number;
  className?: string;
  /** Suffixe éventuel (ex. « + »). */
  suffix?: string;
}

/**
 * Compteur animé de 0 → `value` au premier passage dans le viewport (rAF).
 * Rendu SSR = valeur finale (no-JS friendly). Respecte `prefers-reduced-motion`
 * (affiche directement la valeur, sans animation).
 */
export function CountUp({ value, durationMs = 1600, className, suffix = "" }: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);
  const doneRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || doneRef.current) return;
    // Mouvement réduit / pas d'IntersectionObserver : on garde la valeur finale
    // (déjà affichée) — aucune écriture d'état synchrone dans l'effet.
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      return;
    }

    let raf = 0;
    let start = 0;
    const run = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min((ts - start) / durationMs, 1);
      setDisplay(Math.round(easeOutExpo(t) * value));
      if (t < 1) raf = requestAnimationFrame(run);
      else doneRef.current = true;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setDisplay(0); // reset dans un callback asynchrone (autorisé)
            raf = requestAnimationFrame(run);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString("fr-FR")}
      {suffix}
    </span>
  );
}
