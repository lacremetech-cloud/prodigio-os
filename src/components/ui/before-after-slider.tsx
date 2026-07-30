"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { MediaAsset } from "@/lib/media";

interface BeforeAfterSliderProps {
  before: MediaAsset;
  after: MediaAsset;
  beforeLabel: string;
  afterLabel: string;
  className?: string;
}

/**
 * Comparateur avant / après **interactif** : le visiteur déplace lui-même le
 * curseur (glisser, clic, ou flèches du clavier) pour révéler l'annonce standard
 * d'un côté et l'écrin Prodigio de l'autre. Un `input[type=range]` invisible
 * assure le pilotage tactile **et** l'accessibilité clavier.
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  className = "",
}: BeforeAfterSliderProps) {
  const [pos, setPos] = useState(50);
  const [active, setActive] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={frameRef}
      className={`group relative aspect-[16/10] w-full select-none overflow-hidden border border-border-dark bg-onyx shadow-[var(--shadow-lg)] sm:aspect-[16/9] ${className}`}
    >
      {/* APRÈS — base (écrin Prodigio) */}
      <Image
        src={after.src}
        alt={after.alt}
        fill
        sizes="(max-width: 1024px) 100vw, 1024px"
        className="object-cover object-top"
      />
      <span className="pointer-events-none absolute right-4 top-4 z-10 border border-[color:var(--color-gold-soft)]/60 bg-onyx/70 px-3 py-1.5 font-signature text-[0.62rem] uppercase tracking-[0.22em] text-gold-soft backdrop-blur-sm">
        {afterLabel}
      </span>

      {/* AVANT — couche découpée (annonce standard) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <Image
          src={before.src}
          alt={before.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover object-top"
        />
        <span className="pointer-events-none absolute left-4 top-4 z-10 border border-ivory/30 bg-onyx/70 px-3 py-1.5 font-signature text-[0.62rem] uppercase tracking-[0.22em] text-ivory/85 backdrop-blur-sm">
          {beforeLabel}
        </span>
      </div>

      {/* Poignée visuelle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 z-20 flex items-center"
        style={{ left: `calc(${pos}% - 1px)` }}
      >
        <div className="h-full w-0.5 bg-ivory/80 shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
        <div
          className={`absolute left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full border border-ivory bg-onyx/70 text-ivory backdrop-blur-sm transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-105"}`}
        >
          <span className="text-lg leading-none">↔</span>
        </div>
      </div>

      {/* Contrôle réel : range invisible (tactile + clavier). */}
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        onPointerDown={() => setActive(true)}
        onPointerUp={() => setActive(false)}
        onBlur={() => setActive(false)}
        aria-label={`Comparer : ${beforeLabel} à gauche, ${afterLabel} à droite`}
        aria-valuetext={`${Math.round(pos)}% ${afterLabel}`}
        className="absolute inset-0 z-30 h-full w-full cursor-ew-resize appearance-none bg-transparent opacity-0 focus-visible:opacity-100"
      />
    </div>
  );
}
