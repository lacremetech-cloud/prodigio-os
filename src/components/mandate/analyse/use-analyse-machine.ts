"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ATTRIBUTION_STORAGE_KEY,
  contactSchema,
  generateIdempotencyKey,
  locationSchema,
  submissionRequestSchema,
  validateFunnelAnswers,
  type ContactPreference,
  type MandateSituation,
  type PropertyType,
  type RecallPreference,
  type SaleHorizon,
  type StoredAttribution,
  type ValueBand,
} from "@/modules/mandates/funnel";
import { track } from "@/lib/analytics";
import type { AppreciationKey } from "@/modules/mandates/scoring";
import { submitMandateFunnelAction } from "@/modules/mandates/funnel/submit";

/** Brouillon des réponses, tolérant aux valeurs partielles pendant la saisie. */
export interface DraftAnswers {
  propertyType?: PropertyType;
  location: { city: string; postalCode: string; country: string };
  valueBand?: ValueBand;
  saleHorizon?: SaleHorizon;
  mandateSituation?: MandateSituation;
  contact: {
    firstName: string;
    lastName: string;
    phoneRaw: string;
    phoneCountry: string; // ISO 3166-1 alpha-2 (défaut « FR »)
    emailRaw: string;
    preference?: ContactPreference;
    recallPreference?: RecallPreference;
    consent: boolean;
  };
  company: string; // honeypot
}

export type Status = "idle" | "submitting" | "error" | "done";

// Index d'étapes : 0 = intro, 1..6 = étapes, 7 = confirmation.
export const INTRO_STEP = 0;
export const FIRST_STEP = 1;
export const LAST_STEP = 6;
export const CONFIRMATION_STEP = 7;

const STORAGE_KEY = "prodigio.analyse.v1";

function emptyDraft(): DraftAnswers {
  return {
    location: { city: "", postalCode: "", country: "France" },
    contact: {
      firstName: "",
      lastName: "",
      phoneRaw: "",
      phoneCountry: "FR",
      emailRaw: "",
      consent: false,
    },
    company: "",
  };
}

interface PersistedState {
  step: number;
  draft: DraftAnswers;
  idempotencyKey: string;
}

type Errors = Record<string, string>;

export interface AnalyseMachine {
  hydrated: boolean;
  step: number;
  direction: 1 | -1;
  draft: DraftAnswers;
  errors: Errors;
  status: Status;
  errorMessage: string | null;
  appreciation: AppreciationKey | null;
  /** Compteur de réinitialisation du widget anti-abus (Turnstile). */
  challengeResetKey: number;
  patch: (patch: Partial<DraftAnswers>) => void;
  patchLocation: (patch: Partial<DraftAnswers["location"]>) => void;
  patchContact: (patch: Partial<DraftAnswers["contact"]>) => void;
  /** Mémorise (ou oublie avec `null`) le jeton Turnstile courant. */
  setTurnstileToken: (token: string | null) => void;
  start: () => void;
  goNext: () => void;
  goBack: () => void;
}

/** Validation d'une étape isolée ; renvoie une map d'erreurs (vide si valide). */
function validateStep(step: number, draft: DraftAnswers): Errors {
  const errors: Errors = {};
  switch (step) {
    case 1:
      if (!draft.propertyType) errors.propertyType = "Merci de choisir une catégorie.";
      break;
    case 2: {
      const parsed = locationSchema.safeParse(draft.location);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors[`location.${issue.path[0] as string}`] = issue.message;
        }
      }
      break;
    }
    case 3:
      if (!draft.valueBand) errors.valueBand = "Merci de choisir une réponse.";
      break;
    case 4:
      if (!draft.saleHorizon) errors.saleHorizon = "Merci de choisir une réponse.";
      break;
    case 5:
      if (!draft.mandateSituation)
        errors.mandateSituation = "Merci de choisir une réponse.";
      break;
    case 6: {
      const parsed = contactSchema.safeParse(draft.contact);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors[`contact.${issue.path[0] as string}`] = issue.message;
        }
      }
      break;
    }
  }
  return errors;
}

function readAttribution(): StoredAttribution | null {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAttribution) : null;
  } catch {
    return null;
  }
}

/**
 * Machine d'état de l'analyse d'éligibilité : étapes, brouillon persistant
 * (reprise sans perte), validation, et dépôt idempotent protégé contre les
 * doubles soumissions.
 */
export function useAnalyseMachine(): AnalyseMachine {
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<number>(INTRO_STEP);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<DraftAnswers>(emptyDraft);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appreciation, setAppreciation] = useState<AppreciationKey | null>(null);
  const [challengeResetKey, setChallengeResetKey] = useState(0);
  const idempotencyKeyRef = useRef<string>("");
  // Jeton Turnstile courant. Conservé en ref (jamais persisté, jamais dans le
  // brouillon sessionStorage) : le jeton est éphémère et à usage unique.
  const turnstileTokenRef = useRef<string | null>(null);
  // Verrou SYNCHRONE anti-double-envoi (double-clic rapide, réentrance). Un ref
  // est mis à jour immédiatement, contrairement à `status` (asynchrone) qui, sur
  // deux clics quasi simultanés, reste encore « idle » au second clic.
  const submitInFlightRef = useRef(false);

  // Hydratation depuis sessionStorage (reprise), une fois monté. La lecture est
  // synchrone ; l'application de l'état est différée d'un frame (hors corps
  // d'effet) — l'UI affiche un écran neutre jusqu'à `hydrated`, sans clignotement.
  useEffect(() => {
    let restored: PersistedState | null = null;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw) as PersistedState;
    } catch {
      restored = null;
    }

    idempotencyKeyRef.current =
      restored?.idempotencyKey ?? generateIdempotencyKey();

    const raf = requestAnimationFrame(() => {
      if (restored?.draft) setDraft({ ...emptyDraft(), ...restored.draft });
      if (
        typeof restored?.step === "number" &&
        restored.step >= 0 &&
        restored.step <= LAST_STEP
      ) {
        setStep(restored.step);
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Persistance à chaque changement (hors confirmation, qui ne se reprend pas).
  useEffect(() => {
    if (!hydrated || status === "done") return;
    try {
      const toPersist: PersistedState = {
        step,
        draft,
        idempotencyKey: idempotencyKeyRef.current,
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
    } catch {
      // Ignore silencieusement.
    }
  }, [hydrated, step, draft, status]);

  const patch = useCallback((next: Partial<DraftAnswers>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);

  const patchLocation = useCallback(
    (next: Partial<DraftAnswers["location"]>) => {
      setDraft((prev) => ({ ...prev, location: { ...prev.location, ...next } }));
    },
    [],
  );

  const patchContact = useCallback(
    (next: Partial<DraftAnswers["contact"]>) => {
      setDraft((prev) => ({ ...prev, contact: { ...prev.contact, ...next } }));
    },
    [],
  );

  const setTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenRef.current = token;
  }, []);

  const submit = useCallback(
    async (finalDraft: DraftAnswers) => {
      // Anti-double-envoi : si une soumission est déjà en cours (double-clic
      // rapide, réentrance), on ignore ce second appel. `submitMandateFunnelAction`
      // n'est donc appelée qu'UNE fois par soumission.
      if (submitInFlightRef.current) return;

      // Validation robuste au honeypot rempli par autofill : si l'unique échec
      // est le champ leurre `company` (rempli automatiquement par un navigateur
      // ou un gestionnaire de mots de passe), il est neutralisé et la
      // soumission se poursuit — un humain ne doit jamais être bloqué par le
      // piège anti-robot (Turnstile reste la vraie garde, côté serveur).
      const validation = validateFunnelAnswers({
        propertyType: finalDraft.propertyType,
        location: finalDraft.location,
        valueBand: finalDraft.valueBand,
        saleHorizon: finalDraft.saleHorizon,
        mandateSituation: finalDraft.mandateSituation,
        contact: finalDraft.contact,
        company: finalDraft.company,
      });

      if (!validation.ok) {
        // Cartographie précise : une erreur sous CHAQUE champ concerné (plutôt
        // qu'un message générique). Les chemins Zod (« contact.phoneRaw ») sont
        // alignés sur les clés lues par les champs de l'étape.
        const fieldErrors: Errors = validation.fieldErrors;
        setErrors(fieldErrors);
        setStatus("error");
        // Aucune erreur silencieuse : on n'omet le message global QUE si au moins
        // un champ visible sur cette étape (coordonnées) porte l'erreur. Sinon —
        // erreur rattachée à une étape antérieure, invisible ici — on affiche un
        // message global clair plutôt que rien.
        const hasVisibleFieldError = Object.keys(fieldErrors).some((key) =>
          key.startsWith("contact."),
        );
        setErrorMessage(
          hasVisibleFieldError ? null : "Merci de vérifier les informations saisies.",
        );
        return;
      }

      const attribution = readAttribution();
      const request = submissionRequestSchema.safeParse({
        answers: validation.data,
        context: {
          idempotencyKey: idempotencyKeyRef.current,
          originUrl: window.location.href,
          referrer: document.referrer || null,
          userAgent: navigator.userAgent || null,
          firstTouch: attribution?.first ?? null,
          lastTouch: attribution?.last ?? null,
          variant: null,
          submittedAt: new Date().toISOString(),
        },
      });

      if (!request.success) {
        setStatus("error");
        setErrorMessage("Merci de vérifier les informations saisies.");
        return;
      }

      // Verrou posé juste avant l'unique appel réseau ; libéré dans `finally`
      // (l'utilisateur peut réessayer après un échec).
      submitInFlightRef.current = true;
      setStatus("submitting");
      setErrorMessage(null);

      try {
        const result = await submitMandateFunnelAction({
          ...request.data,
          // Seul élément anti-abus transmis par le navigateur : le jeton.
          turnstileToken: turnstileTokenRef.current,
        });
        if (result.ok) {
          track({ event: "eligibility_submitted" });
          setAppreciation(result.appreciation);
          setStatus("done");
          setDirection(1);
          setStep(CONFIRMATION_STEP);
          turnstileTokenRef.current = null;
          try {
            window.sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
        } else {
          setStatus("error");
          setErrorMessage(result.message);
          // Échec / indisponibilité de la vérification anti-abus : on oublie le
          // jeton (usage unique) et on réinitialise le widget pour réessayer.
          if (result.reason === "turnstile" || result.resetChallenge) {
            turnstileTokenRef.current = null;
            setChallengeResetKey((k) => k + 1);
          }
        }
      } catch {
        setStatus("error");
        setErrorMessage(
          "Un incident est survenu lors de la transmission. Vos réponses sont conservées : vous pouvez réessayer.",
        );
      } finally {
        submitInFlightRef.current = false;
      }
    },
    [],
  );

  const goToStep = useCallback((next: number, dir: 1 | -1) => {
    setDirection(dir);
    setStep(next);
    setErrors({});
  }, []);

  const start = useCallback(() => {
    // Mesure seule : aucune réponse, aucune donnée personnelle n'accompagne
    // l'événement. Le contrat de données du CRM n'est pas concerné.
    track({ event: "eligibility_started" });
    goToStep(FIRST_STEP, 1);
  }, [goToStep]);

  // Navigation SANS effet de bord dans un updater `setStep` : on lit `step` de la
  // clôture (à jour via les dépendances). Sous React StrictMode (dev), les
  // updaters d'état sont invoqués DEUX fois pour détecter les impuretés — placer
  // `submit()` dans l'updater le déclencherait donc en double. Ici, `submit()`
  // est appelé une seule fois, hors updater.
  const goBack = useCallback(() => {
    if (status === "submitting") return;
    if (step <= INTRO_STEP) return;
    setDirection(-1);
    setErrors({});
    setStatus((s) => (s === "error" ? "idle" : s));
    setErrorMessage(null);
    setStep(step - 1);
  }, [status, step]);

  const goNext = useCallback(() => {
    if (status === "submitting") return;
    const stepErrors = validateStep(step, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    // Seul le NUMÉRO de l'étape est mesuré, jamais son contenu.
    track({ event: "eligibility_step_completed", step });
    if (step === LAST_STEP) {
      void submit(draft); // la confirmation est déclenchée par submit()
      return;
    }
    setDirection(1);
    setStep(step + 1);
  }, [status, step, draft, submit]);

  return useMemo(
    () => ({
      hydrated,
      step,
      direction,
      draft,
      errors,
      status,
      errorMessage,
      appreciation,
      challengeResetKey,
      patch,
      patchLocation,
      patchContact,
      setTurnstileToken,
      start,
      goNext,
      goBack,
    }),
    [
      hydrated,
      step,
      direction,
      draft,
      errors,
      status,
      errorMessage,
      appreciation,
      challengeResetKey,
      patch,
      patchLocation,
      patchContact,
      setTurnstileToken,
      start,
      goNext,
      goBack,
    ],
  );
}
