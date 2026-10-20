"use client";

import { useCallback, useEffect, useRef } from "react";
import { buildVslEmbedUrl, VSL_YOUTUBE_ID } from "@/config/vsl";
import { createVslMilestoneTracker } from "@/lib/analytics";

interface YTPlayer {
  playVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}
interface YTNamespace {
  Player: new (
    el: Element,
    opts: { events?: Record<string, (e: unknown) => void> },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Charge l'API IFrame de YouTube — **une seule fois**, et seulement quand le
 * film est réellement ouvert. Rien de tout cela ne pèse sur le premier écran.
 */
let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
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

/** Éléments focalisables d'un conteneur, dans l'ordre du document. */
function focusables(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button, [href], iframe, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.offsetParent !== null || el.tagName === "IFRAME");
}

interface VslModalProps {
  onClose: () => void;
  /** Reprise : seconde à laquelle le film avait été interrompu. */
  startAt: number;
  /** Mémorise la position au moment de la fermeture. */
  onProgress: (seconds: number) => void;
  title: string;
}

/**
 * Le film, en grand.
 *
 * Ouvert d'un seul geste depuis l'affiche du hero : la lecture démarre
 * immédiatement, **avec le son** — le geste du visiteur l'autorise. Sur
 * ordinateur, une fenêtre quasi plein écran ; sur mobile, on demande en plus le
 * plein écran natif, et le lecteur garde son propre bouton plein écran là où
 * l'API n'est pas disponible (iOS).
 *
 * À la fermeture, la page reprend **exactement** où elle était : la position de
 * défilement est gelée à l'ouverture puis restituée, sans saut ni rechargement.
 */
export function VslModal({ onClose, startAt, onProgress, title }: VslModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const progressRef = useRef(startAt);

  const requestClose = useCallback(() => {
    onProgress(progressRef.current);
    onClose();
  }, [onClose, onProgress]);

  // Gel du défilement — `position: fixed` plutôt que `overflow: hidden`, qui
  // laisse certains navigateurs mobiles perdre la position.
  useEffect(() => {
    const { body } = document;
    const scrollY = window.scrollY;
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

  // Plein écran natif quand le navigateur le permet (Android, ordinateurs).
  // iOS refuse sur un élément quelconque : la fenêtre quasi plein écran et le
  // bouton du lecteur y suffisent. L'échec est donc silencieux et sans effet.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node?.requestFullscreen) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    void node.requestFullscreen().catch(() => {});
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  // Échappement, et piège à focus : la tabulation reste dans la fenêtre.
  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const items = focusables(root);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  // Lecteur : progression mémorisée et paliers de lecture mesurés.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const milestones = createVslMilestoneTracker();
    milestones.play();

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !frameRef.current) return;
        playerRef.current = new YT.Player(frameRef.current, {
          events: {
            onStateChange: (e: unknown) => {
              const state = (e as { data: number }).data;
              if (state === YT.PlayerState.ENDED) milestones.complete();
            },
          },
        });
        timer = window.setInterval(() => {
          const player = playerRef.current;
          if (!player?.getDuration) return;
          const duration = player.getDuration();
          const current = player.getCurrentTime();
          if (!duration) return;
          progressRef.current = current;
          milestones.progress(current / duration);
        }, 1000);
      })
      .catch(() => {
        // Sans l'API, la vidéo joue quand même : seule la mesure est perdue.
      });

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      playerRef.current = null;
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="animate-fade fixed inset-0 z-[60] flex items-center justify-center bg-onyx/95 p-4 backdrop-blur-sm sm:p-8"
      onClick={(e) => {
        // Seul le fond ferme : un clic sur le lecteur ne doit rien déclencher.
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={requestClose}
        aria-label="Fermer le film"
        className="absolute right-4 top-4 z-10 inline-flex size-11 items-center justify-center rounded-full border border-ivory/30 bg-onyx/70 text-ivory transition-colors duration-200 hover:border-ivory hover:bg-onyx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] sm:right-6 sm:top-6"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="aspect-video w-full max-w-6xl overflow-hidden bg-black shadow-[0_60px_140px_-40px_rgba(0,0,0,0.95)]">
        <iframe
          ref={frameRef}
          src={buildVslEmbedUrl(VSL_YOUTUBE_ID, {
            autoplay: true,
            mute: false,
            controls: true,
            loop: false,
            fullscreen: true,
            start: startAt,
          })}
          title={title}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}
