"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { buildVslEmbedUrl, VSL_YOUTUBE_ID } from "@/config/vsl";
import { media } from "@/lib/media";

/**
 * Écrin VSL de la hero — pièce maîtresse.
 *
 * - Intégration YouTube **nocookie**, 16:9, **sans habillage** (pas de contrôles
 *   natifs, pas de suggestions, pas de branding).
 * - **Lecture auto silencieuse** au chargement (`autoplay` + `mute` +
 *   `playsinline`) ; **poster premium** derrière tant que la vidéo n'est pas là.
 * - Bouton premium **« Activer le son »** : relance idéalement depuis le début.
 * - Si l'autoplay est bloqué : **bouton de lecture** élégant immédiatement.
 * - Contrôles indispensables une fois le son actif (revoir / couper le son).
 * - L'identifiant de la vidéo est centralisé dans `@/config/vsl`.
 */

export type VslStatus = "idle" | "playing" | "sound" | "blocked";

/** Logique pure (testable) : quand proposer l'activation du son. */
export function shouldShowSoundButton(status: VslStatus): boolean {
  return status === "playing";
}

/** Logique pure (testable) : quand proposer le bouton de lecture de secours. */
export function shouldShowPlayFallback(status: VslStatus): boolean {
  return status === "blocked";
}

interface YTPlayer {
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (v: number) => void;
  seekTo: (s: number, allowSeekAhead?: boolean) => void;
  getPlayerState: () => number;
}
interface YTNamespace {
  Player: new (el: Element, opts: { events?: Record<string, (e: unknown) => void> }) => YTPlayer;
  PlayerState: { PLAYING: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YT indisponible"));
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("script YT"));
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function HeroVsl() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [status, setStatus] = useState<VslStatus>("idle");
  const [src, setSrc] = useState(() =>
    buildVslEmbedUrl(VSL_YOUTUBE_ID, { mute: true, autoplay: true, controls: false }),
  );
  const started = status === "playing" || status === "sound";

  // Rattache l'API IFrame à l'iframe existante (pilotage son / redémarrage).
  useEffect(() => {
    let cancelled = false;
    const blockedTimer = window.setTimeout(() => {
      // Si rien ne joue au bout d'un moment, proposer une lecture manuelle.
      setStatus((s) => (s === "idle" ? "blocked" : s));
    }, 2600);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !iframeRef.current) return;
        playerRef.current = new YT.Player(iframeRef.current, {
          events: {
            onStateChange: (e: unknown) => {
              const data = (e as { data: number }).data;
              if (data === YT.PlayerState.PLAYING) {
                setStatus((s) => (s === "sound" ? "sound" : "playing"));
              }
            },
            onError: () => setStatus((s) => (s === "sound" ? s : "blocked")),
          },
        });
      })
      .catch(() => {
        // API indisponible : l'iframe autoplay muet peut jouer seule ; sinon on
        // laisse le minuteur basculer en « blocked » (bouton de lecture).
      });

    return () => {
      cancelled = true;
      window.clearTimeout(blockedTimer);
    };
  }, []);

  /** Active le son et reprend depuis le début (API si dispo, sinon rechargement). */
  function enableSound() {
    const player = playerRef.current;
    if (player?.unMute) {
      player.unMute();
      player.setVolume(100);
      player.seekTo(0, true);
      player.playVideo();
    } else {
      // Repli sans API : recharge la vidéo avec le son, depuis le début.
      setSrc(buildVslEmbedUrl(VSL_YOUTUBE_ID, { mute: false, autoplay: true, controls: true }));
    }
    setStatus("sound");
  }

  /** Coupe le son (garde la lecture). */
  function muteSound() {
    playerRef.current?.mute?.();
    setStatus("playing");
  }

  /** Relance depuis le début (avec le son actif). */
  function replay() {
    const player = playerRef.current;
    if (player?.seekTo) {
      player.seekTo(0, true);
      player.playVideo();
    } else {
      setSrc(buildVslEmbedUrl(VSL_YOUTUBE_ID, { mute: false, autoplay: true, controls: true }));
    }
    setStatus("sound");
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden border border-[color:var(--color-border-dark)] bg-onyx shadow-[var(--shadow-lg)]">
      {/* Lecteur YouTube (nocookie, sans habillage) — sous le poster tant que la
          lecture n'a pas démarré. */}
      <iframe
        ref={iframeRef}
        id="prodigio-vsl"
        src={src}
        title="Film de présentation — Système Prodigio"
        className="absolute inset-0 h-full w-full"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />

      {/* Poster premium (LCP), AU-DESSUS du lecteur, estompé une fois la lecture
          engagée (révèle alors la vidéo). */}
      <Image
        src={media.vsl.src}
        alt={media.vsl.alt}
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 1024px"
        className={`z-10 object-cover transition-opacity duration-700 ${started ? "pointer-events-none opacity-0" : "opacity-100"}`}
      />
      {/* Voile pour la lisibilité des repères / boutons. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-10 transition-opacity duration-700 ${started ? "opacity-0" : "opacity-100"}`}
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(12,12,14,0.45) 0%, rgba(12,12,14,0.15) 40%, rgba(12,12,14,0.75) 100%)",
        }}
      />

      {/* Repères cinématographiques discrets. */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <span className="absolute left-4 top-4 hidden font-signature text-[0.62rem] uppercase tracking-[0.28em] text-ivory/70 sm:block">
          Scene 01 · Film de présentation
        </span>
        <span className="absolute right-4 top-4 hidden font-signature text-[0.62rem] uppercase tracking-[0.28em] text-ivory/70 sm:block">
          4K · Immobilier d&apos;exception
        </span>
        <span className="absolute bottom-4 left-4 font-signature text-[0.62rem] tabular-nums tracking-[0.22em] text-ivory/60">
          00:00 — VSL
        </span>
      </div>

      {/* Bouton « Activer le son » (lecture muette en cours). */}
      {shouldShowSoundButton(status) ? (
        <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-5 sm:p-6">
          <button
            type="button"
            onClick={enableSound}
            className="group inline-flex items-center gap-3 border border-ivory/80 bg-onyx/60 px-6 py-3 text-sm font-medium text-ivory backdrop-blur-sm transition-colors hover:bg-ivory hover:text-wood-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
          >
            <SpeakerIcon />
            <span>Activer le son — Découvrir Prodigio</span>
          </button>
        </div>
      ) : null}

      {/* Bouton de lecture de secours (autoplay bloqué). */}
      {shouldShowPlayFallback(status) ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <button
            type="button"
            onClick={enableSound}
            aria-label="Lancer le film de présentation avec le son"
            className="group flex size-20 items-center justify-center rounded-full border border-ivory/80 bg-onyx/50 text-ivory backdrop-blur-sm transition-colors hover:bg-ivory hover:text-wood-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
          >
            <svg viewBox="0 0 24 24" className="ml-1 size-8" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* Contrôles indispensables une fois le son actif. */}
      {status === "sound" ? (
        <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={replay}
            aria-label="Revoir depuis le début"
            className="inline-flex items-center gap-2 border border-ivory/40 bg-onyx/50 px-3 py-2 text-xs text-ivory backdrop-blur-sm transition-colors hover:border-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
          >
            ↺ Revoir
          </button>
          <button
            type="button"
            onClick={muteSound}
            aria-label="Couper le son"
            className="inline-flex size-9 items-center justify-center border border-ivory/40 bg-onyx/50 text-ivory backdrop-blur-sm transition-colors hover:border-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
          >
            <SpeakerIcon muted />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SpeakerIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
      {muted ? (
        <path d="M17 9l4 6M21 9l-4 6" strokeLinecap="round" />
      ) : (
        <path d="M16.5 8.5a5 5 0 010 7M19 6a8 8 0 010 12" strokeLinecap="round" />
      )}
    </svg>
  );
}
