"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY } from "./copy";

/** Marge (px) au-delà de laquelle on considère que le CTA final est à l'écran. */
const BOTTOM_ZONE = 900;

/**
 * CTA collant — **mobile et ordinateur**.
 *
 * L'en-tête de la page défile et disparaît : sans ce rappel, l'ordinateur
 * restait plusieurs écrans d'affilée sans aucun bouton visible. Il apparaît une
 * fois la hero dépassée et s'efface à l'approche du CTA final, pour ne jamais
 * doubler un appel à l'action déjà présent à l'écran.
 *
 * - Mobile : barre pleine largeur en bas d'écran.
 * - Ordinateur : bouton flottant en bas à droite, discret mais toujours là.
 */
export function StickyCta() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    function onScroll() {
      const passedHero = window.scrollY > window.innerHeight * 0.85;
      const nearEnd =
        window.scrollY + window.innerHeight >
        document.documentElement.scrollHeight - BOTTOM_ZONE;
      setShown(passedHero && !nearEnd);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-gold-soft)]/30 bg-onyx/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm transition-[transform,opacity] duration-300 md:inset-x-auto md:bottom-8 md:right-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none ${
        shown
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0 md:translate-y-4"
      }`}
    >
      <Link
        href={ANALYSE_ROUTE}
        className="cta-shine group relative flex min-h-[3.5rem] items-center justify-center gap-2 bg-[color:var(--color-gold-soft)] px-6 text-[0.95rem] font-semibold text-wood-black transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] md:min-h-[3.25rem] md:px-7 md:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]"
      >
        {CTA_PRIMARY}
        <span
          aria-hidden="true"
          className="transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      </Link>
    </div>
  );
}
