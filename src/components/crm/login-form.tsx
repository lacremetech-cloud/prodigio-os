"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type SignInState } from "@/modules/crm/auth/actions";

const initialState: SignInState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1406] transition-[transform,opacity] duration-150 hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  );
}

export function LoginForm({
  redirectTo,
  accessError,
}: {
  redirectTo?: string;
  accessError?: boolean;
}) {
  const [state, formAction] = useActionState(signInAction, initialState);
  const error = state.error;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-text-on-dark-muted)]">
          Adresse e-mail
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-12 rounded-[var(--radius-md)] border border-[var(--color-border-strong-dark)] bg-[var(--color-onyx-soft)] px-4 text-[15px] text-[var(--color-text-on-dark)] outline-none transition-colors placeholder:text-[var(--color-text-on-dark-muted)] focus:border-[var(--color-gold)]"
          placeholder="vous@prodigio.fr"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-text-on-dark-muted)]">
          Mot de passe
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-[var(--radius-md)] border border-[var(--color-border-strong-dark)] bg-[var(--color-onyx-soft)] px-4 text-[15px] text-[var(--color-text-on-dark)] outline-none transition-colors focus:border-[var(--color-gold)]"
          placeholder="••••••••••"
        />
      </label>

      {accessError ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--color-border-dark)] bg-[var(--color-onyx-soft)] px-4 py-3 text-sm text-[var(--color-danger-on-dark)]"
        >
          Votre compte n’a pas encore accès au CRM. Contactez un administrateur
          Prodigio.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--color-border-dark)] bg-[var(--color-onyx-soft)] px-4 py-3 text-sm text-[var(--color-danger-on-dark)]"
        >
          {error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
