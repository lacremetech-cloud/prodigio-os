"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type SignInState } from "@/modules/crm/auth/actions";

const initialState: SignInState = { ok: false };

const CHAMP =
  "h-11 w-full rounded-[8px] border border-[#D5DCE5] bg-white px-3.5 text-[15px] text-[#17202E] outline-none transition-colors placeholder:text-[#9AA7B6] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20";

const ETIQUETTE = "text-[12px] font-semibold text-[#5A6978]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#059669] px-6 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
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
  /**
   * Afficher / masquer : sur un mot de passe long tapé depuis un portable, le
   * seul recours sans cela est de tout effacer et de recommencer.
   */
  const [visible, setVisible] = useState(false);
  const error = state.error;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <label className="flex flex-col gap-1.5">
        <span className={ETIQUETTE}>Adresse e-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={CHAMP}
          placeholder="nom@entreprise.fr"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={ETIQUETTE}>Mot de passe</span>
        <span className="relative block">
          <input
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${CHAMP} pr-[88px]`}
            placeholder="••••••••••"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            /* Le bouton DIT ce qu'il fera, et son état est annoncé aux lecteurs
               d'écran : une icône d'œil seule ne dit jamais si le mot de passe
               est actuellement visible ou masqué. */
            aria-pressed={visible}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[6px] px-2.5 py-1.5 text-[12px] font-semibold text-[#5A6978] hover:bg-[#F1F4F8] hover:text-[#17202E]"
          >
            {visible ? "Masquer" : "Afficher"}
          </button>
        </span>
      </label>

      {accessError ? (
        <p
          role="alert"
          className="rounded-[8px] border border-[#E4D8B4] bg-[#FDF7E7] px-3.5 py-2.5 text-[13px] text-[#7A5C12]"
        >
          Votre compte n’a pas encore accès à Prodigio OS. Contactez un administrateur.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[8px] border border-[#F0C9C9] bg-[#FDF2F2] px-3.5 py-2.5 text-[13px] text-[#9B2C2C]"
        >
          {error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
