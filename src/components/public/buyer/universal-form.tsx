"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneField } from "@/components/mandate/analyse/phone-field";
import { TurnstileWidget } from "@/components/mandate/analyse/turnstile-widget";
import { ATTRIBUTION_STORAGE_KEY } from "@/modules/mandates/funnel/attribution";
import { generateIdempotencyKey } from "@/modules/mandates/funnel/idempotency";
import { BUYER_TURNSTILE_ACTION } from "@/modules/buyers/funnel/turnstile";
import { submitUniversalInterestAction } from "@/modules/buyers/funnel/universal-submit";
import {
  UNIVERSAL_PRIVACY_NOTICE,
  universalSubmissionRequestSchema,
} from "@/modules/buyers/funnel/universal-payload";
import {
  BUDGET_CHOICE_LABELS,
  BUDGET_QUESTION,
  BUYER_BUDGET_CHOICES,
  UNIVERSAL_STEPS,
  universalStepOneSchema,
  universalStepTwoSchema,
  type BuyerBudgetChoice,
} from "@/modules/buyers/funnel/universal";
import { notifyParentHeight } from "./embed-bridge";

/**
 * Formulaire acquéreur **universel** — deux écrans, et jamais un troisième.
 *
 * Écran 1 : une seule question, celle qui qualifie. Écran 2 : quatre champs
 * obligatoires, l'information sur l'usage des données, et un accord marketing
 * **facultatif** qui ne conditionne rien. Une personne qui refuse toute
 * utilisation marketing reçoit la brochure exactement comme les autres.
 *
 * Aucun e-mail ni SMS n'est déclenché : la brochure est remise à l'écran.
 */

interface Draft {
  budgetChoice: BuyerBudgetChoice | null;
  firstName: string;
  lastName: string;
  emailRaw: string;
  phoneRaw: string;
  phoneCountry: string;
  marketingOptIn: boolean;
  company: string;
}

// Accès LITTÉRAL à `process.env.NEXT_PUBLIC_…` : c'est la seule forme que Next
// remplace statiquement dans un bundle client. Passer par `env` de `@/config`
// donnerait `undefined` au navigateur.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const emptyDraft: Draft = {
  budgetChoice: null,
  firstName: "",
  lastName: "",
  emailRaw: "",
  phoneRaw: "",
  phoneCountry: "FR",
  marketingOptIn: false,
  company: "",
};

interface StoredAttribution {
  first?: unknown;
  last?: unknown;
}

function readAttribution(): StoredAttribution | null {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAttribution) : null;
  } catch {
    return null;
  }
}

export function UniversalBuyerForm({
  slug,
  propertyName,
  brochureAvailable,
}: {
  slug: string;
  /** Renseigné UNIQUEMENT si la vitrine est publiée. Sinon la page reste anonyme. */
  propertyName: string | null;
  brochureAvailable: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [brochureUrl, setBrochureUrl] = useState<string | null>(null);
  const [challengeResetKey, setChallengeResetKey] = useState(0);

  const idempotencyKeyRef = useRef<string>("");
  const turnstileTokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    idempotencyKeyRef.current = generateIdempotencyKey();
  }, []);

  // Embarqué en iframe, le formulaire doit annoncer sa hauteur au parent, sinon
  // il est tronqué ou noyé dans du vide. Rien d'autre ne sort du cadre.
  useEffect(() => {
    notifyParentHeight(rootRef.current);
  }, [step, status, errors, brochureUrl]);

  const setTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenRef.current = token;
  }, []);

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  function goToContact() {
    const parsed = universalStepOneSchema.safeParse({ budgetChoice: draft.budgetChoice });
    if (!parsed.success) {
      setErrors({ budgetChoice: parsed.error.issues[0]?.message ?? "Réponse requise." });
      return;
    }
    setErrors({});
    setStep(2);
  }

  async function submit() {
    if (inFlightRef.current) return;

    const stepTwo = universalStepTwoSchema.safeParse({
      firstName: draft.firstName,
      lastName: draft.lastName,
      emailRaw: draft.emailRaw,
      phoneRaw: draft.phoneRaw,
      phoneCountry: draft.phoneCountry,
      marketingOptIn: draft.marketingOptIn,
    });
    if (!stepTwo.success) {
      const next: Record<string, string> = {};
      for (const issue of stepTwo.error.issues) {
        const champ = String(issue.path[0] ?? "");
        if (champ && !next[champ]) next[champ] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    const attribution = readAttribution();
    const request = universalSubmissionRequestSchema.safeParse({
      slug,
      answers: {
        budgetChoice: draft.budgetChoice,
        ...stepTwo.data,
        company: draft.company,
      },
      context: {
        idempotencyKey: idempotencyKeyRef.current,
        originUrl: window.location.href,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent || null,
        firstTouch: attribution?.first ?? null,
        lastTouch: attribution?.last ?? null,
        submittedAt: new Date().toISOString(),
      },
    });
    if (!request.success) {
      setStatus("error");
      setErrorMessage("Votre saisie n'a pas pu être validée. Vérifiez les champs.");
      return;
    }

    inFlightRef.current = true;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const result = await submitUniversalInterestAction({
        ...request.data,
        turnstileToken: turnstileTokenRef.current,
      });
      if (result.ok) {
        setBrochureUrl(result.brochureUrl ?? null);
        setStatus("done");
      } else {
        setStatus("error");
        setErrorMessage(result.message);
        if (result.resetChallenge) setChallengeResetKey((k) => k + 1);
      }
    } catch {
      setStatus("error");
      setErrorMessage("Le serveur n'a pas répondu. Réessayez dans un instant.");
    } finally {
      inFlightRef.current = false;
    }
  }

  // --- Confirmation ---------------------------------------------------------
  if (status === "done") {
    return (
      <div ref={rootRef} className="uf-root">
        <div className="uf-card" role="status">
          <h1 className="uf-title">Votre demande est enregistrée.</h1>
          <p className="uf-text">
            Merci. Nous revenons vers vous rapidement
            {propertyName ? ` au sujet de ${propertyName}` : ""}.
          </p>
          {brochureUrl ? (
            <a className="uf-btn uf-btn--primary uf-btn--wide" href={brochureUrl} target="_blank" rel="noopener noreferrer">
              Accéder à la brochure
            </a>
          ) : brochureAvailable ? (
            <p className="uf-note">
              La brochure vous sera transmise par votre interlocuteur.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const stepTitle = UNIVERSAL_STEPS[step - 1]?.title ?? "";

  return (
    <div ref={rootRef} className="uf-root">
      <div className="uf-card">
        <p className="uf-step" aria-label={`Étape ${step} sur 2`}>
          Étape {step} / 2 · {stepTitle}
        </p>

        {/* ----------------------------------------------------------- 1 */}
        {step === 1 ? (
          <fieldset className="uf-fieldset">
            <legend className="uf-title">{BUDGET_QUESTION}</legend>
            <div className="uf-choices">
              {BUYER_BUDGET_CHOICES.map((choice) => (
                <label
                  key={choice}
                  className={`uf-choice ${draft.budgetChoice === choice ? "uf-choice--on" : ""}`}
                >
                  <input
                    type="radio"
                    name="budgetChoice"
                    value={choice}
                    checked={draft.budgetChoice === choice}
                    onChange={() => {
                      set("budgetChoice")(choice);
                      setErrors({});
                    }}
                  />
                  <span>{BUDGET_CHOICE_LABELS[choice]}</span>
                </label>
              ))}
            </div>
            {errors.budgetChoice ? (
              <p role="alert" className="uf-error">
                {errors.budgetChoice}
              </p>
            ) : null}
            <button type="button" className="uf-btn uf-btn--primary uf-btn--wide" onClick={goToContact}>
              Continuer
            </button>
          </fieldset>
        ) : null}

        {/* ----------------------------------------------------------- 2 */}
        {step === 2 ? (
          <form
            className="uf-fieldset"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h1 className="uf-title">Recevoir la brochure</h1>

            <div className="uf-grid">
              <Field
                label="Prénom"
                value={draft.firstName}
                onChange={set("firstName")}
                error={errors.firstName}
                autoComplete="given-name"
              />
              <Field
                label="Nom"
                value={draft.lastName}
                onChange={set("lastName")}
                error={errors.lastName}
                autoComplete="family-name"
              />
            </div>
            <Field
              label="E-mail"
              type="email"
              value={draft.emailRaw}
              onChange={set("emailRaw")}
              error={errors.emailRaw}
              autoComplete="email"
            />
            <PhoneField
              label="Téléphone"
              numberValue={draft.phoneRaw}
              country={draft.phoneCountry}
              onNumberChange={set("phoneRaw")}
              onCountryChange={set("phoneCountry")}
              error={errors.phoneRaw}
            />

            {/* Pot de miel — invisible, jamais annoncé aux lecteurs d'écran. */}
            <div aria-hidden="true" className="uf-hp">
              <label>
                Société
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={draft.company}
                  onChange={(e) => set("company")(e.target.value)}
                />
              </label>
            </div>

            <p className="uf-note">{UNIVERSAL_PRIVACY_NOTICE}</p>

            {/* Facultatif, décoché, et sans effet sur l'envoi. */}
            <label className="uf-check">
              <input
                type="checkbox"
                checked={draft.marketingOptIn}
                onChange={(e) => set("marketingOptIn")(e.target.checked)}
              />
              <span>
                J’accepte de recevoir d’autres biens susceptibles de m’intéresser.{" "}
                <em>Facultatif — votre demande aboutit sans cette case.</em>
              </span>
            </label>

            {TURNSTILE_SITE_KEY ? (
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                action={BUYER_TURNSTILE_ACTION}
                onToken={(t) => setTurnstileToken(t)}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
                resetKey={challengeResetKey}
              />
            ) : null}

            {errorMessage ? (
              <p role="alert" className="uf-error">
                {errorMessage}
              </p>
            ) : null}

            <div className="uf-actions">
              <button type="button" className="uf-btn" onClick={() => setStep(1)}>
                ← Retour
              </button>
              <button
                type="submit"
                className="uf-btn uf-btn--primary"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Envoi…" : "Recevoir la brochure"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="uf-field">
      <span className="uf-label">{label}</span>
      <input
        className="uf-input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <span role="alert" className="uf-error">
          {error}
        </span>
      ) : null}
    </label>
  );
}
