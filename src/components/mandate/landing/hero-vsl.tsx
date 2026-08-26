"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildVslEmbedUrl, VSL_YOUTUBE_ID } from "@/config/vsl";
import { media } from "@/lib/media";
import { hero } from "./copy";

/**
 * Écrin VSL — un seul geste.
 *
 * Toute la zone est cliquable : au PREMIER clic, le film s'ouvre immédiatement
 * dans une expérience agrandie (quasi plein écran sur ordinateur, plein écran
 * sur mobile), avec le son et les contrôles natifs. L'utilisateur n'a jamais à
 * faire « lecture → chercher le plein écran → recliquer ».
 *
 * À la fermeture, la page est restituée EXACTEMENT à la même position de
 * défilement (le verrouillage du corps mémorise puis restaure l'offset), et le
 * focus revient sur l'écrin. Aucun saut, aucune perte de progression.
 *
 * Aucune lecture automatique : rien ne démarre tant que l'utilisateur n'a pas
 * exprimé son intention. C'est plus sobre, plus rapide, et cela évite les
 * blocages navigateur.
 */
export function HeroVsl() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group relative block w-full cursor-pointer overflow-hidden border border-[color:var(--color-border-dark)] bg-onyx text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--color-focus)]"
      >
        {/* Cadre cinéma : plus large que haut, proche du format panoramique. */}
        <span className="block aspect-video w-full sm:aspect-[2/1]">
          <Image
            src={media.vsl.src}
            alt={media.vsl.alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 780px"
            className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          />
        </span>

        {/* Voile : lisibilité du repère de lecture, sans éteindre l'image. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,12,14,0.28)_0%,rgba(12,12,14,0.10)_45%,rgba(12,12,14,0.72)_100%)]"
        />

        {/* Repère de lecture — sobre, sans halo ni pulsation. */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-full border border-ivory/70 bg-onyx/35 backdrop-blur-[2px] transition-colors duration-300 group-hover:border-ivory group-hover:bg-ivory sm:size-20"
          >
            <svg
              viewBox="0 0 24 24"
              className="ml-1 size-6 fill-ivory transition-colors duration-300 group-hover:fill-wood-black sm:size-7"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>

        <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-4 p-4 sm:p-5">
          <span className="font-signature text-[0.7rem] uppercase tracking-[0.2em] text-ivory/85">
            {hero.vslLabel}
          </span>
          <span className="font-signature text-[0.7rem] uppercase tracking-[0.2em] text-ivory/85 underline decoration-ivory/40 underline-offset-4 transition-colors group-hover:decoration-ivory">
            {hero.vslOpen}
          </span>
        </span>
      </button>

      {open ? <VslModal onClose={close} /> : null}
    </>
  );
}

/**
 * Expérience vidéo agrandie. Overlay plein écran : le lecteur occupe l'essentiel
 * de la surface disponible, avec les contrôles natifs et le son actif.
 */
function VslModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Verrouille le défilement SANS perdre la position : on fige le corps à
  // l'offset courant, puis on le restaure à l'identique.
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflowY: body.style.overflowY,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflowY = "scroll"; // conserve la gouttière : aucun décalage
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflowY = previous.overflowY;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Échap ferme ; le focus est amené sur le bouton de fermeture et maintenu
  // dans la boîte de dialogue.
  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Film de présentation — Système Prodigio"
      className="fixed inset-0 z-[100] flex flex-col bg-onyx/97 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
    >
      {/* Fond cliquable : un clic hors du lecteur ferme l'expérience. */}
      <button
        type="button"
        aria-label="Fermer le film"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      <div className="relative flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <span className="font-signature text-[0.7rem] uppercase tracking-[0.22em] text-ivory/70">
          {hero.vslLabel}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 border border-ivory/40 px-4 py-2 font-signature text-[0.7rem] uppercase tracking-[0.18em] text-ivory transition-colors hover:border-ivory hover:bg-ivory hover:text-wood-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-on-dark,var(--color-ivory))]"
        >
          Fermer
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-3 pb-4 sm:px-6 sm:pb-6">
        <div className="aspect-video w-full max-w-[min(100%,calc((100vh-8rem)*16/9))] bg-black">
          <iframe
            src={buildVslEmbedUrl(VSL_YOUTUBE_ID, {
              mute: false,
              autoplay: true,
              controls: true,
            })}
            title="Film de présentation — Système Prodigio"
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
