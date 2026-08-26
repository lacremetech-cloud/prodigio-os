"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { media } from "@/lib/media";
import { hero } from "./copy";

/**
 * Le film n'est chargé qu'à l'ouverture : ni iframe YouTube, ni script d'API
 * sur le premier écran. C'est la mesure la plus efficace pour la vitesse
 * ressentie — le hero n'attend plus qu'une image.
 */
const VslModal = dynamic(() => import("./vsl-modal").then((m) => m.VslModal), {
  ssr: false,
});

const VSL_TITLE = "Film de présentation — Système Prodigio";

/**
 * Affiche du film, dans le hero.
 *
 * **Toute la surface est cliquable** : un seul geste ouvre le film en grand,
 * avec le son. Le visiteur n'a jamais à viser un bouton, puis à chercher le
 * plein écran, puis à recliquer.
 *
 * L'affiche ne bouge pas d'elle-même. Au survol, elle s'éclaircit très
 * légèrement et la pastille de lecture s'élargit : le geste est annoncé, rien
 * n'est réclamé.
 */
export function HeroVsl() {
  const [open, setOpen] = useState(false);
  // Position de reprise : rouvrir le film ne fait pas revoir le début.
  const [resumeAt, setResumeAt] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Lire le ${VSL_TITLE.toLowerCase()}`}
        className="group relative block aspect-video w-full overflow-hidden border border-[color:var(--color-border-dark)] bg-onyx text-left shadow-[var(--shadow-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
      >
        <Image
          src={media.vsl.src}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02]"
        />
        {/* Voile : lisibilité des repères, et léger éclaircissement au survol. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-80"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(12,12,14,0.45) 0%, rgba(12,12,14,0.15) 40%, rgba(12,12,14,0.75) 100%)",
          }}
        />

        {/* Repères cinématographiques discrets. */}
        <span className="absolute left-4 top-4 hidden font-signature text-[0.62rem] uppercase tracking-[0.28em] text-ivory/70 sm:block">
          Scene 01 · Film de présentation
        </span>
        <span className="absolute right-4 top-4 hidden font-signature text-[0.62rem] uppercase tracking-[0.28em] text-ivory/70 sm:block">
          4K · Immobilier d&apos;exception
        </span>

        {/* Pastille de lecture — centrale, évidente, sans clignoter. */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ivory/50 bg-onyx/45 text-ivory backdrop-blur-sm transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:border-ivory group-hover:bg-onyx/65 group-active:scale-100 sm:size-20"
        >
          <svg viewBox="0 0 24 24" className="ml-1 size-6 sm:size-7" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>

        {/* Invitation discrète, en bas de l'affiche. */}
        <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
          <span className="max-w-[26rem] text-[0.72rem] leading-snug text-ivory/75 sm:text-sm">
            {hero.vslInvite}
          </span>
          <span className="font-signature text-[0.62rem] uppercase tracking-[0.22em] text-ivory/60">
            {hero.vslDuration}
          </span>
        </span>
      </button>

      {open ? (
        <VslModal
          title={VSL_TITLE}
          startAt={resumeAt}
          onProgress={setResumeAt}
          onClose={() => {
            setOpen(false);
            // Le focus revient à l'affiche : un visiteur au clavier reprend
            // exactement là où il avait ouvert le film.
            triggerRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
