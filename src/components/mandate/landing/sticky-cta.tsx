"use client";

import { useEffect, useState } from "react";
import { LandingCta } from "@/components/ui/landing-cta";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY } from "./copy";

/**
 * CTA collant — **mobile et ordinateur**.
 *
 * L'en-tête de la page défile et disparaît : sans ce rappel, l'ordinateur
 * restait plusieurs écrans d'affilée sans aucun bouton visible. Il apparaît une
 * fois la hero dépassée et **s'efface dès qu'un appel à l'action principal est
 * réellement à l'écran** — observé sur les boutons eux-mêmes plutôt que déduit
 * d'une distance en pixels, qui se décalait à chaque évolution de la page.
 *
 * - Mobile : barre pleine largeur en bas, au-dessus de la zone sûre du système.
 * - Ordinateur : bouton flottant en bas à droite, discret mais toujours là.
 *
 * Il ouvre **exactement** le même parcours que les autres boutons : il n'existe
 * qu'une seule logique d'entrée dans le questionnaire.
 */
export function StickyCta() {
  const [passedHero, setPassedHero] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  // Franchissement de la hero — le rappel n'apparaît jamais d'entrée de jeu.
  useEffect(() => {
    function onScroll() {
      setPassedHero(window.scrollY > window.innerHeight * 0.85);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Présence à l'écran d'un appel à l'action principal.
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-cta-primary]");
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;

    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);
        }
        setCtaVisible(onScreen.size > 0);
      },
      // Un bouton compte comme « à l'écran » dès qu'il est franchement visible,
      // pas au premier pixel : sinon le rappel clignote en bord d'écran.
      { threshold: 0.6 },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const shown = passedHero && !ctaVisible;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-gold-soft)]/30 bg-onyx/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:inset-x-auto md:bottom-8 md:right-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none ${
        shown
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0 md:translate-y-4"
      }`}
      // Retiré de l'ordre de tabulation tant qu'il est masqué : un bouton
      // invisible ne doit pas capter le focus clavier.
      inert={!shown}
    >
      <LandingCta
        href={ANALYSE_ROUTE}
        tone="gold"
        size="md"
        location="sticky"
        className="w-full md:w-auto md:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]"
      >
        {CTA_PRIMARY}
      </LandingCta>
    </div>
  );
}
