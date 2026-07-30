"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY } from "./copy";

/**
 * CTA mobile discret et fixe. Apparaît une fois la hero dépassée (pour ne pas
 * doubler le CTA principal déjà visible), uniquement sur petit écran.
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
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border-dark bg-onyx/95 p-3 backdrop-blur-sm transition-transform duration-300 md:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link
        href={ANALYSE_ROUTE}
        className="flex min-h-[3rem] items-center justify-center gap-2 bg-text-on-dark px-6 text-sm font-medium text-wood-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
      >
        {CTA_PRIMARY}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
