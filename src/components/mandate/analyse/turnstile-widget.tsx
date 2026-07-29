"use client";

import { useEffect, useRef } from "react";

/**
 * Widget Cloudflare Turnstile (mode « Managed », rendu explicite).
 *
 * Rôle strictement limité côté navigateur : obtenir un **jeton** et le remonter
 * au parent. Toute la vérification a lieu côté serveur (siteverify). Le jeton
 * n'est ni persisté, ni journalisé côté client.
 *
 * Apparence « interaction-only » : le widget reste **invisible** tant que
 * Cloudflare ne juge pas un challenge nécessaire — discret et premium sur le
 * fond sombre du parcours. En cas d'échec / d'expiration, le parent réinitialise
 * le widget (via `resetKey`) pour permettre un nouvel essai.
 */

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  appearance?: "always" | "execute" | "interaction-only";
  theme?: "auto" | "light" | "dark";
  size?: "normal" | "flexible" | "compact";
  retry?: "auto" | "never";
  language?: string;
}

interface TurnstileApi {
  render: (el: HTMLElement, opts: TurnstileRenderOptions) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
  getResponse: (id?: string) => string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

/** Charge le script Turnstile une seule fois (idempotent). */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile")));
      if (window.turnstile) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileWidgetProps {
  /** Clé de site PUBLIQUE (NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
  siteKey: string;
  /** Action déclarée (doit correspondre à la vérification serveur). */
  action: string;
  /** Remonte le jeton obtenu. */
  onToken: (token: string) => void;
  /** Jeton expiré : le parent l'oublie et attend un nouveau jeton. */
  onExpire?: () => void;
  /** Erreur de challenge / réseau : le parent l'oublie. */
  onError?: () => void;
  /**
   * Compteur de réinitialisation : à chaque incrément (> 0), le widget est
   * réinitialisé pour émettre un nouveau jeton (après échec ou expiration).
   */
  resetKey?: number;
  className?: string;
}

export function TurnstileWidget({
  siteKey,
  action,
  onToken,
  onExpire,
  onError,
  resetKey = 0,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Les callbacks vivent dans une ref : leurs changements ne doivent PAS
  // reconstruire le widget (sinon on perd le jeton et on relance un challenge).
  const cbRef = useRef({ onToken, onExpire, onError });
  useEffect(() => {
    cbRef.current = { onToken, onExpire, onError };
  }, [onToken, onExpire, onError]);

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current) return; // déjà rendu
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          theme: "dark",
          size: "flexible",
          retry: "auto",
          language: "fr",
          callback: (token) => cbRef.current.onToken(token),
          "error-callback": () => cbRef.current.onError?.(),
          "expired-callback": () => cbRef.current.onExpire?.(),
          "timeout-callback": () => cbRef.current.onExpire?.(),
        });
      })
      .catch(() => cbRef.current.onError?.());

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Idempotent : ignore si déjà retiré.
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action]);

  // Réinitialisation à la demande du parent (après échec / expiration).
  useEffect(() => {
    if (resetKey === 0) return; // montage initial : rien à réinitialiser
    if (window.turnstile && widgetIdRef.current) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // ignore
      }
    }
  }, [resetKey]);

  return <div ref={containerRef} className={className} />;
}
