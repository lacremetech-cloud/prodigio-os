"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneField } from "@/components/mandate/analyse/phone-field";
import { TurnstileWidget } from "@/components/mandate/analyse/turnstile-widget";
import {
  ATTRIBUTION_STORAGE_KEY,
  type StoredAttribution,
} from "@/modules/mandates/funnel/attribution";
import { generateIdempotencyKey } from "@/modules/mandates/funnel/idempotency";
import { submitBuyerInterestAction } from "@/modules/buyers/funnel/submit";
import { buyerSubmissionRequestSchema } from "@/modules/buyers/funnel/payload";
import { validateBuyerAnswers } from "@/modules/buyers/funnel/validate";
import { BUYER_TURNSTILE_ACTION } from "@/modules/buyers/funnel/turnstile";
import {
  availabilityLabels,
  budgetBandLabels,
  buyerConsent,
  buyerFunnel,
  decisionModeLabels,
  financingLabels,
  projectNatureLabels,
  purchaseHorizonLabels,
  recallPreferenceLabels,
} from "@/modules/buyers/funnel/content";
import {
  AVAILABILITIES,
  BUDGET_BANDS,
  CONTACT_PREFERENCES,
  DECISION_MODES,
  FINANCINGS,
  PROJECT_NATURES,
  PURCHASE_HORIZONS,
  RECALL_PREFERENCES,
} from "@/modules/buyers/funnel/schema";
import type {
  Availability,
  BudgetBand,
  DecisionMode,
  Financing,
  ProjectNature,
  PurchaseHorizon,
  RecallPreference,
} from "@/modules/buyers/funnel/schema";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const STORAGE_KEY = "prodigio.buyer.v1";
const LAST_STEP = 7;
const CONFIRM_STEP = 8;

interface Draft {
  projectNature?: ProjectNature;
  budgetBand?: BudgetBand;
  financing?: Financing;
  purchaseHorizon?: PurchaseHorizon;
  availability?: Availability;
  decisionMode?: DecisionMode;
  residenceCountry: string;
  residenceArea: string;
  contact: {
    firstName: string;
    lastName: string;
    phoneRaw: string;
    phoneCountry: string;
    emailRaw: string;
    preference?: (typeof CONTACT_PREFERENCES)[number];
    recallPreference?: RecallPreference;
    consent: boolean;
  };
  company: string;
}

const emptyDraft: Draft = {
  residenceCountry: "France",
  residenceArea: "",
  contact: {
    firstName: "",
    lastName: "",
    phoneRaw: "",
    phoneCountry: "FR",
    emailRaw: "",
    recallPreference: undefined,
    consent: false,
  },
  company: "",
};

function readAttribution(): StoredAttribution | null {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAttribution) : null;
  } catch {
    return null;
  }
}

export function BuyerFunnel({ slug, propertyName }: { slug: string; propertyName: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [challengeResetKey, setChallengeResetKey] = useState(0);

  const idempotencyKeyRef = useRef<string>("");
  const turnstileTokenRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);

  // Hydratation (reprise de session éventuelle).
  useEffect(() => {
    let restoredStep = 1;
    let restoredDraft = emptyDraft;
    let key = "";
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { step?: number; draft?: Draft; idempotencyKey?: string };
        if (parsed.draft) restoredDraft = { ...emptyDraft, ...parsed.draft };
        if (typeof parsed.step === "number" && parsed.step >= 1 && parsed.step <= LAST_STEP) {
          restoredStep = parsed.step;
        }
        if (typeof parsed.idempotencyKey === "string") key = parsed.idempotencyKey;
      }
    } catch {
      // état illisible : on repart proprement.
    }
    idempotencyKeyRef.current = key || generateIdempotencyKey();
    // Applique l'état restauré hors du corps de l'effet (évite les rendus en
    // cascade et la règle react-hooks/set-state-in-effect).
    const raf = requestAnimationFrame(() => {
      setDraft(restoredDraft);
      setStep(restoredStep);
      setHydrated(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Persistance (sauf écran de confirmation).
  useEffect(() => {
    if (!hydrated || status === "done") return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step, draft, idempotencyKey: idempotencyKeyRef.current }),
      );
    } catch {
      // quota / mode privé : sans effet sur le parcours.
    }
  }, [hydrated, step, draft, status]);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);
  const patchContact = useCallback(
    (p: Partial<Draft["contact"]>) => setDraft((d) => ({ ...d, contact: { ...d.contact, ...p } })),
    [],
  );

  const setTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenRef.current = token;
  }, []);

  const submit = useCallback(async () => {
    if (submitInFlightRef.current) return;
    const validation = validateBuyerAnswers({
      projectNature: draft.projectNature,
      budgetBand: draft.budgetBand,
      financing: draft.financing,
      purchaseHorizon: draft.purchaseHorizon,
      availability: draft.availability,
      decisionMode: draft.decisionMode,
      residence: { country: draft.residenceCountry, area: draft.residenceArea },
      contact: draft.contact,
      company: draft.company,
    });
    if (!validation.ok) {
      setErrors(validation.fieldErrors);
      setStatus("error");
      const hasVisible = Object.keys(validation.fieldErrors).some((k) => k.startsWith("contact."));
      setErrorMessage(hasVisible ? null : buyerFunnel.errors.validation);
      return;
    }

    const attribution = readAttribution();
    const request = buyerSubmissionRequestSchema.safeParse({
      slug,
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
      setErrorMessage(buyerFunnel.errors.validation);
      return;
    }

    submitInFlightRef.current = true;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const result = await submitBuyerInterestAction({
        ...request.data,
        turnstileToken: turnstileTokenRef.current,
      });
      if (result.ok) {
        setStatus("done");
        setDirection(1);
        setStep(CONFIRM_STEP);
        turnstileTokenRef.current = null;
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* noop */
        }
      } else {
        setStatus("error");
        setErrorMessage(result.message);
        if (result.reason === "turnstile" || result.resetChallenge) {
          turnstileTokenRef.current = null;
          setChallengeResetKey((k) => k + 1);
        }
      }
    } catch {
      setStatus("error");
      setErrorMessage(buyerFunnel.errors.generic);
    } finally {
      submitInFlightRef.current = false;
    }
  }, [draft, slug]);

  const validateStep = useCallback(
    (s: number): boolean => {
      const e: Record<string, string> = {};
      if (s === 1 && !draft.projectNature) e.projectNature = "Sélectionnez une réponse.";
      if (s === 2 && !draft.budgetBand) e.budgetBand = "Sélectionnez une réponse.";
      if (s === 3 && !draft.financing) e.financing = "Sélectionnez une réponse.";
      if (s === 4 && !draft.purchaseHorizon) e.purchaseHorizon = "Sélectionnez une réponse.";
      if (s === 5 && !draft.availability) e.availability = "Sélectionnez une réponse.";
      if (s === 6) {
        if (!draft.decisionMode) e.decisionMode = "Sélectionnez une réponse.";
        if (!draft.residenceCountry.trim()) e["residence.country"] = "Indiquez votre pays.";
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    },
    [draft],
  );

  const goNext = useCallback(() => {
    if (step >= 1 && step <= 6 && !validateStep(step)) return;
    if (step === LAST_STEP) {
      void submit();
      return;
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, LAST_STEP));
  }, [step, validateStep, submit]);

  const goBack = useCallback(() => {
    setErrors({});
    setStatus("idle");
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  if (!hydrated) return <div className="min-h-dvh bg-onyx" />;

  return (
    <main className="grain relative isolate flex min-h-dvh flex-col bg-onyx text-ivory">
      <div aria-hidden className="absolute inset-0" style={{ background: "var(--overlay-immersive)" }} />
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-gold-soft">Manifester mon intérêt</p>
            <p className="truncate text-sm text-text-on-dark-muted">{propertyName}</p>
          </div>
          {step <= LAST_STEP ? (
            <a href={`/bien/${slug}`} className="text-xs text-text-on-dark-muted underline-offset-2 hover:underline">
              Retour au bien
            </a>
          ) : null}
        </header>

        {step <= LAST_STEP ? <ProgressRail step={step} total={LAST_STEP} /> : null}

        <div
          key={step}
          className={`mt-8 flex flex-1 flex-col ${
            direction === -1 ? "animate-step-back" : "animate-step-fwd"
          }`}
        >
          {step === 1 ? (
            <ChoiceStep
              title="Quelle est la nature de votre projet ?"
              options={PROJECT_NATURES.map((v) => ({ value: v, label: projectNatureLabels[v] }))}
              selected={draft.projectNature}
              onSelect={(v) => {
                patch({ projectNature: v as ProjectNature });
                setErrors({});
              }}
              error={errors.projectNature}
            />
          ) : null}
          {step === 2 ? (
            <ChoiceStep
              title="Quel budget envisagez-vous ?"
              hint="Une fourchette suffit — elle nous aide à vous orienter."
              options={BUDGET_BANDS.map((v) => ({ value: v, label: budgetBandLabels[v] }))}
              selected={draft.budgetBand}
              onSelect={(v) => {
                patch({ budgetBand: v as BudgetBand });
                setErrors({});
              }}
              error={errors.budgetBand}
            />
          ) : null}
          {step === 3 ? (
            <ChoiceStep
              title="Où en êtes-vous de votre financement ?"
              options={FINANCINGS.map((v) => ({ value: v, label: financingLabels[v] }))}
              selected={draft.financing}
              onSelect={(v) => {
                patch({ financing: v as Financing });
                setErrors({});
              }}
              error={errors.financing}
            />
          ) : null}
          {step === 4 ? (
            <ChoiceStep
              title="Dans quel horizon souhaitez-vous acheter ?"
              options={PURCHASE_HORIZONS.map((v) => ({ value: v, label: purchaseHorizonLabels[v] }))}
              selected={draft.purchaseHorizon}
              onSelect={(v) => {
                patch({ purchaseHorizon: v as PurchaseHorizon });
                setErrors({});
              }}
              error={errors.purchaseHorizon}
            />
          ) : null}
          {step === 5 ? (
            <ChoiceStep
              title="Seriez-vous disponible pour un échange ?"
              options={AVAILABILITIES.map((v) => ({ value: v, label: availabilityLabels[v] }))}
              selected={draft.availability}
              onSelect={(v) => {
                patch({ availability: v as Availability });
                setErrors({});
              }}
              error={errors.availability}
            />
          ) : null}
          {step === 6 ? (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-medium sm:text-3xl">Votre situation</h2>
                <p className="mt-2 text-sm text-text-on-dark-muted">
                  Prenez-vous la décision seul(e) ou à plusieurs ?
                </p>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DECISION_MODES.map((v) => (
                    <OptionButton
                      key={v}
                      label={decisionModeLabels[v]}
                      selected={draft.decisionMode === v}
                      onClick={() => {
                        patch({ decisionMode: v });
                        setErrors((e) => ({ ...e, decisionMode: "" }));
                      }}
                    />
                  ))}
                </div>
                {errors.decisionMode ? <FieldErr msg={errors.decisionMode} /> : null}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Pays de résidence" error={errors["residence.country"]}>
                  <input
                    className="funnel-input"
                    value={draft.residenceCountry}
                    onChange={(e) => patch({ residenceCountry: e.target.value })}
                    placeholder="France"
                  />
                </Field>
                <Field label="Ville / région (facultatif)">
                  <input
                    className="funnel-input"
                    value={draft.residenceArea}
                    onChange={(e) => patch({ residenceArea: e.target.value })}
                    placeholder="Paris, Genève…"
                  />
                </Field>
              </div>
            </div>
          ) : null}
          {step === 7 ? (
            <ContactStep
              draft={draft}
              patchContact={patchContact}
              errors={errors}
              resetKey={challengeResetKey}
              onToken={setTurnstileToken}
            />
          ) : null}
          {step === CONFIRM_STEP ? <ConfirmationScreen recall={draft.contact.recallPreference} /> : null}
        </div>

        {step <= LAST_STEP ? (
          <footer className="mt-8 flex flex-col gap-3">
            {errorMessage ? <FieldErr msg={errorMessage} /> : null}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-sm text-text-on-dark-muted underline-offset-2 hover:underline disabled:opacity-40"
                onClick={goBack}
                disabled={step === 1 || status === "submitting"}
              >
                Retour
              </button>
              <button
                type="button"
                className="cta-shine inline-flex items-center gap-2 rounded-full bg-ivory px-8 py-3.5 text-sm font-semibold text-wood-black transition hover:-translate-y-0.5 disabled:opacity-60"
                onClick={goNext}
                disabled={status === "submitting"}
              >
                {step === LAST_STEP
                  ? status === "submitting"
                    ? "Envoi…"
                    : "Envoyer ma demande"
                  : "Continuer"}
                <span aria-hidden>→</span>
              </button>
            </div>
            <p className="text-center text-[11px] text-text-on-dark-muted/70">{buyerFunnel.securityNote}</p>
          </footer>
        ) : null}
      </div>

      <style>{`
        .funnel-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border-strong-dark);
          background: rgba(255,255,255,0.04);
          padding: 0.75rem 0.9rem;
          color: var(--color-text-on-dark);
          font-size: 0.95rem;
        }
        .funnel-input::placeholder { color: var(--color-text-on-dark-muted); opacity: 0.7; }
        .funnel-input:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
      `}</style>
    </main>
  );
}

function ProgressRail({ step, total }: { step: number; total: number }) {
  const pct = Math.round((Math.min(step, total) / total) * 100);
  return (
    <div className="mt-6 flex items-center gap-3" aria-hidden>
      <div className="h-px flex-1 bg-ivory/15">
        <div className="h-px bg-gold-soft transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-text-on-dark-muted">
        {Math.min(step, total)} / {total}
      </span>
    </div>
  );
}

function ChoiceStep({
  title,
  hint,
  options,
  selected,
  onSelect,
  error,
}: {
  title: string;
  hint?: string;
  options: { value: string; label: string }[];
  selected: string | undefined;
  onSelect: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-balance text-2xl font-medium sm:text-3xl">{title}</h2>
        {hint ? <p className="mt-2 text-sm text-text-on-dark-muted">{hint}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <OptionButton
            key={o.value}
            label={o.label}
            selected={selected === o.value}
            onClick={() => onSelect(o.value)}
          />
        ))}
      </div>
      {error ? <FieldErr msg={error} /> : null}
    </div>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3.5 text-left text-sm transition ${
        selected
          ? "border-gold-soft bg-ivory/10 text-ivory"
          : "border-border-dark bg-ivory/[0.03] text-text-on-dark-muted hover:border-border-strong-dark hover:text-ivory"
      }`}
    >
      <span>{label}</span>
      <span aria-hidden className={selected ? "animate-check-pop text-gold-soft" : "opacity-0"}>
        ✓
      </span>
    </button>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-text-on-dark-muted">{label}</span>
      {children}
      {error ? <FieldErr msg={error} /> : null}
    </label>
  );
}

function FieldErr({ msg }: { msg: string }) {
  return (
    <p role="alert" className="text-xs text-danger-on-dark">
      {msg}
    </p>
  );
}

function ContactStep({
  draft,
  patchContact,
  errors,
  resetKey,
  onToken,
}: {
  draft: Draft;
  patchContact: (p: Partial<Draft["contact"]>) => void;
  errors: Record<string, string>;
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const c = draft.contact;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-medium sm:text-3xl">Vos coordonnées</h2>
        <p className="mt-2 text-sm text-text-on-dark-muted">
          Pour qu’un conseiller dédié puisse revenir vers vous.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prénom" error={errors["contact.firstName"]}>
          <input
            className="funnel-input"
            value={c.firstName}
            onChange={(e) => patchContact({ firstName: e.target.value })}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Nom" error={errors["contact.lastName"]}>
          <input
            className="funnel-input"
            value={c.lastName}
            onChange={(e) => patchContact({ lastName: e.target.value })}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <PhoneField
        label="Téléphone"
        numberValue={c.phoneRaw}
        country={c.phoneCountry}
        onNumberChange={(v) => patchContact({ phoneRaw: v })}
        onCountryChange={(iso) => patchContact({ phoneCountry: iso })}
        error={errors["contact.phoneRaw"]}
      />

      <Field label="E-mail" error={errors["contact.emailRaw"]}>
        <input
          className="funnel-input"
          type="email"
          value={c.emailRaw}
          onChange={(e) => patchContact({ emailRaw: e.target.value })}
          autoComplete="email"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Canal préféré (facultatif)">
          <select
            className="funnel-input"
            value={c.preference ?? ""}
            onChange={(e) =>
              patchContact({
                preference: (e.target.value || undefined) as Draft["contact"]["preference"],
              })
            }
          >
            <option value="">Indifférent</option>
            {CONTACT_PREFERENCES.map((p) => (
              <option key={p} value={p}>
                {p === "telephone" ? "Téléphone" : p === "email" ? "E-mail" : "Indifférent"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Moment de rappel" error={errors["contact.recallPreference"]}>
          <select
            className="funnel-input"
            value={c.recallPreference ?? ""}
            onChange={(e) =>
              patchContact({ recallPreference: (e.target.value || undefined) as RecallPreference })
            }
          >
            <option value="">Choisir…</option>
            {RECALL_PREFERENCES.map((p) => (
              <option key={p} value={p}>
                {recallPreferenceLabels[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Honeypot (masqué). */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        onChange={() => {}}
      />

      <label className="flex items-start gap-2 text-sm text-text-on-dark-muted">
        <input
          type="checkbox"
          className="mt-1"
          checked={c.consent}
          onChange={(e) => patchContact({ consent: e.target.checked })}
        />
        <span>{buyerConsent.label}</span>
      </label>
      {errors["contact.consent"] ? <FieldErr msg={errors["contact.consent"]} /> : null}
      <p className="text-[11px] text-text-on-dark-muted/70">{buyerConsent.helper}</p>

      {TURNSTILE_SITE_KEY ? (
        <TurnstileWidget
          siteKey={TURNSTILE_SITE_KEY}
          action={BUYER_TURNSTILE_ACTION}
          onToken={(t) => onToken(t)}
          onExpire={() => onToken(null)}
          onError={() => onToken(null)}
          resetKey={resetKey}
          className="mx-auto w-full max-w-sm"
        />
      ) : null}
    </div>
  );
}

function ConfirmationScreen({ recall }: { recall?: RecallPreference }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <span aria-hidden className="animate-check-pop text-4xl text-gold-soft">
        ✓
      </span>
      <h2 className="mt-5 text-3xl font-medium">{buyerFunnel.confirmation.title}</h2>
      <p className="mt-4 max-w-md text-pretty text-text-on-dark-muted">{buyerFunnel.confirmation.body}</p>
      {recall ? (
        <p className="mt-3 text-sm text-text-on-dark-muted/80">
          Rappel souhaité : {recallPreferenceLabels[recall]}.
        </p>
      ) : null}
      <p className="mt-6 text-[11px] text-text-on-dark-muted/70">{buyerFunnel.confirmation.reassurance}</p>
    </div>
  );
}
