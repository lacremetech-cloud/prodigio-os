"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_NAV } from "./copy";

/**
 * Appel à l'action collant (mobile).
 *
 * Il apparaît une fois la hero dépassée, et s'efface dès qu'un VRAI appel à
 * l'action est visible à l'écran — inutile de doubler un bouton que la personne
 * a déjà sous les yeux. Il réapparaît dès que ce bouton sort du champ.
 *
 * Il pointe vers `ANALYSE_ROUTE`, exactement comme les autres CTA : aucune
 * logique d'ouverture parallèle du parcours n'est introduite.
 */
export function StickyCta() {
  const [past, setPast] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setPast(window.scrollY > window.innerHeight * 0.9);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Surveille les CTA de la page : tant que l'un d'eux est visible, on s'efface.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(`main a[href="${ANALYSE_ROUTE}"]`),
    );
    if (!targets.length) return;

    const visibles = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibles.add(entry.target);
          else visibles.delete(entry.target);
        }
        setCtaVisible(visibles.size > 0);
      },
      { threshold: 0.5 },
    );
    for (const t of targets) observer.observe(t);
    return () => observer.disconnect();
  }, []);

  const shown = past && !ctaVisible;

  return (
    <div
      aria-hidden={!shown}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border-dark bg-onyx/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link
        href={ANALYSE_ROUTE}
        tabIndex={shown ? undefined : -1}
        className="flex min-h-[3.25rem] items-center justify-center gap-2 bg-ivory px-6 text-[0.95rem] font-semibold text-wood-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
      >
        {CTA_NAV}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
