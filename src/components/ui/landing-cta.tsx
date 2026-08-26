"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CTA_VARIANT } from "@/config/cta";
import { trackCtaClick, type CtaLocation } from "@/lib/analytics";

type Tone = "contrast" | "gold" | "ghost-dark";
type Size = "md" | "lg" | "xl";

const tones: Record<Tone, string> = {
  // Bouton clair plein (sur fond sombre) — contraste maximal, très visible.
  contrast:
    "bg-text-on-dark text-wood-black border border-text-on-dark hover:bg-white",
  // Bouton doré — accent premium fort pour la conversion. Dégradé vertical
  // (matière plutôt qu'aplat), fine arête claire en haut, ombre colorée : le
  // bouton se détache du fond au lieu d'y être posé.
  gold:
    "text-wood-black border border-[color:var(--color-gold-soft)] " +
    "bg-[linear-gradient(180deg,#e0cba3_0%,#cbb488_52%,#bda471_100%)] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_34px_-14px_rgba(203,180,136,0.65)] " +
    "hover:bg-[linear-gradient(180deg,#ecdcba_0%,#dcc79c_52%,#cbb488_100%)] " +
    "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_44px_-14px_rgba(203,180,136,0.8)]",
  // Contour clair sur sombre.
  "ghost-dark":
    "border border-ivory/70 text-ivory hover:bg-ivory hover:text-wood-black",
};

const sizes: Record<Size, string> = {
  md: "min-h-[3rem] px-6 py-3 text-[0.9rem]",
  lg: "min-h-[3.5rem] px-8 py-4 text-[0.95rem]",
  xl: "min-h-[4.25rem] px-10 py-5 text-base sm:text-lg",
};

interface LandingCtaProps extends Omit<ComponentProps<typeof Link>, "className"> {
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  className?: string;
  /**
   * Emplacement dans la page — transmis à la mesure pour comparer les zones.
   * Aucune donnée personnelle n'accompagne l'événement.
   */
  location?: CtaLocation;
}

/**
 * Appel à l'action de la landing.
 *
 * Trois retours au geste, dans cet ordre de perception : **survol** (le bouton
 * se soulève de 2 px et s'éclaircit), **appui** (il redescend et se resserre
 * très légèrement — la pression est ressentie), **focus clavier** (anneau
 * visible). Le reflet traversant reste réservé au survol : rien ne bouge tant
 * que le visiteur n'a rien fait.
 *
 * Pas de halo pulsé ni de rebond : un bouton qui s'agite en permanence se lit
 * comme une sollicitation, pas comme une invitation.
 */
export function LandingCta({
  children,
  tone = "contrast",
  size = "xl",
  className = "",
  location,
  onClick,
  ...props
}: LandingCtaProps) {
  // Les grands boutons de la page (hors en-tête et hors rappel collant) sont
  // les repères que le rappel collant observe pour s'effacer.
  const isPrimary =
    location !== undefined && location !== "nav" && location !== "sticky";

  return (
    <Link
      data-cta-primary={isPrimary ? "" : undefined}
      className={`cta-shine group relative inline-flex items-center justify-center gap-3 font-medium tracking-[0.01em] transition-[transform,background-color,border-color,color,box-shadow] duration-200 will-change-transform hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.55)] active:translate-y-0 active:scale-[0.985] active:duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] ${sizes[size]} ${tones[tone]} ${className}`}
      onClick={(e) => {
        if (location) trackCtaClick(location, CTA_VARIANT);
        onClick?.(e);
      }}
      {...props}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className="transition-transform duration-300 group-hover:translate-x-1.5"
      >
        →
      </span>
    </Link>
  );
}
