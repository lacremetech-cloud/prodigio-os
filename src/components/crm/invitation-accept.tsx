"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptInvitationAction,
  setInvitationPasswordAction,
} from "@/modules/crm/team/accept-actions";
import { safeAction } from "@/modules/crm/safe-action";

/**
 * Écran d'acceptation d'invitation (côté personne invitée, connectée via le lien
 * Supabase). Permet de définir un mot de passe puis d'accepter — le rôle n'est
 * jamais choisi ici : il provient de l'invitation posée par un administrateur.
 * Après acceptation, redirection vers l'espace correspondant au rôle.
 */
export function InvitationAccept({
  email,
  organizationName,
  roleLabel,
  rolePermissions,
  greetingName,
}: {
  email: string;
  organizationName: string;
  roleLabel: string;
  rolePermissions: string;
  greetingName: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);

        if (password.length > 0) {
          if (password.length < 8) {
            setError("Le mot de passe doit contenir au moins 8 caractères.");
            return;
          }
          if (password !== confirm) {
            setError("Les deux mots de passe ne correspondent pas.");
            return;
          }
        }

        start(async () => {
          if (password.length > 0) {
            const pwd = await safeAction(() => setInvitationPasswordAction(password));
            if (!pwd.ok) {
              setError(pwd.error ?? "Impossible de définir le mot de passe.");
              return;
            }
          }
          const res = await safeAction(() => acceptInvitationAction());
          if (res.ok) {
            router.push("/crm");
            router.refresh();
          } else {
            setError(res.error ?? "Une erreur est survenue.");
          }
        });
      }}
    >
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-dark)] bg-[var(--color-onyx-soft)] px-4 py-3 text-sm">
        <p className="text-[var(--color-text-on-dark-muted)]">
          {greetingName ? `Bonjour ${greetingName}, vous` : "Vous"} êtes invité·e à rejoindre
        </p>
        <p className="mt-0.5 font-semibold text-[var(--color-text-on-dark)]">{organizationName}</p>
        <p className="mt-2 text-[var(--color-text-on-dark-muted)]">
          En tant que <span className="text-[var(--color-gold-soft)]">{roleLabel}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-on-dark-muted)]">{rolePermissions}</p>
        <p className="mt-2 text-xs text-[var(--color-text-on-dark-muted)]">
          Connecté·e en tant que <span className="text-[var(--color-text-on-dark)]">{email}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--color-text-on-dark-muted)]">
          Définissez un mot de passe pour vos prochaines connexions (facultatif si vous en avez déjà
          un).
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-text-on-dark-muted)]">
            Nouveau mot de passe
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-[var(--radius-md)] border border-[var(--color-border-strong-dark)] bg-[var(--color-onyx-soft)] px-4 text-[15px] text-[var(--color-text-on-dark)] outline-none transition-colors focus:border-[var(--color-gold)]"
            placeholder="Au moins 8 caractères"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-text-on-dark-muted)]">
            Confirmer le mot de passe
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-12 rounded-[var(--radius-md)] border border-[var(--color-border-strong-dark)] bg-[var(--color-onyx-soft)] px-4 text-[15px] text-[var(--color-text-on-dark)] outline-none transition-colors focus:border-[var(--color-gold)]"
            placeholder="Répétez le mot de passe"
          />
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--color-border-dark)] bg-[var(--color-onyx-soft)] px-4 py-3 text-sm text-[var(--color-danger-on-dark)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1406] transition-[transform,opacity] duration-150 hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Validation…" : "Accepter et rejoindre"}
      </button>
    </form>
  );
}
