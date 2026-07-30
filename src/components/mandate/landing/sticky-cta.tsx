"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY } from "./copy";

/**
 * CTA mobile fixe, généreux et visible. Apparaît une fois la hero dépassée (pour
 * ne pas doubler le CTA principal déjà à l'écran), uniquement sur petit écran.
 */
export function StickyCta() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShown(window.scrollY > window.innerHeight * 0.85);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-gold-soft)]/30 bg-onyx/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm transition-transform duration-300 md:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link
        href={ANALYSE_ROUTE}
        className="cta-shine relative flex min-h-[3.5rem] items-center justify-center gap-2 bg-[color:var(--color-gold-soft)] px-6 text-[0.95rem] font-semibold text-wood-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
      >
        {CTA_PRIMARY}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
