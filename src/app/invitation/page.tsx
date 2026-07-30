import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config";
import { signOutAction } from "@/modules/crm/auth/actions";
import { hasCrmAccess, ROLE_PERMISSIONS, type CrmRole } from "@/modules/crm/auth/roles";
import { roleLabels } from "@/modules/crm/labels";
import { InvitationAccept } from "@/components/crm/invitation-accept";
import type { MyPendingInvitationRow } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-onyx)] px-6 py-16 text-[var(--color-text-on-dark)]">
      <div className="w-full max-w-[460px]">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-gold-soft)]">
            Prodigio OS
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold">
            Rejoindre l’équipe
          </h1>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-dark)] bg-[#101015] p-8 shadow-[var(--shadow-lg)]">
          {children}
        </div>
        <p className="mt-8 text-center text-xs text-[var(--color-text-on-dark-muted)]">
          <Link href="/" className="underline-offset-4 hover:underline">
            Retour au site public
          </Link>
        </p>
      </div>
    </main>
  );
}

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <h2 className="text-lg font-semibold text-[var(--color-text-on-dark)]">{title}</h2>
      <p className="text-sm text-[var(--color-text-on-dark-muted)]">{body}</p>
      {action}
    </div>
  );
}

function SignOutButton({ label = "Se déconnecter" }: { label?: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-sm text-[var(--color-gold-soft)] underline-offset-4 hover:underline"
      >
        {label}
      </button>
    </form>
  );
}

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <Message
          title="Invitation indisponible"
          body="L’authentification n’est pas configurée sur cet environnement. Réessayez depuis la production."
        />
      </Shell>
    );
  }

  if (params.error === "lien") {
    return (
      <Shell>
        <Message
          title="Lien invalide ou expiré"
          body="Ce lien d’invitation n’est plus valide. Demandez à un administrateur de vous renvoyer une invitation."
          action={
            <Link
              href="/connexion"
              className="text-sm text-[var(--color-gold-soft)] underline-offset-4 hover:underline"
            >
              Aller à la connexion
            </Link>
          }
        />
      </Shell>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <Message
          title="Session expirée"
          body="Votre lien d’invitation a expiré ou a déjà été utilisé. Rouvrez le lien reçu par e-mail, ou connectez-vous si vous avez déjà défini votre accès."
          action={
            <Link
              href="/connexion"
              className="text-sm text-[var(--color-gold-soft)] underline-offset-4 hover:underline"
            >
              Aller à la connexion
            </Link>
          }
        />
      </Shell>
    );
  }

  const { data: pendingRows } = await supabase.rpc("crm_my_pending_invitation");
  const invitation = (Array.isArray(pendingRows) ? pendingRows[0] : null) as
    | MyPendingInvitationRow
    | null;

  // Déjà membre et aucune invitation à traiter → vers le CRM.
  if (!invitation) {
    const { data: roles } = await supabase.rpc("crm_active_roles");
    if (hasCrmAccess(Array.isArray(roles) ? (roles as string[]) : [])) {
      redirect("/crm");
    }
    return (
      <Shell>
        <Message
          title="Aucune invitation valide"
          body="Aucune invitation en attente ne correspond à ce compte. L’e-mail connecté ne correspond peut-être pas à celui invité. Déconnectez-vous puis rouvrez le lien reçu, ou contactez un administrateur."
          action={<SignOutButton />}
        />
      </Shell>
    );
  }

  if (invitation.status === "revoquee") {
    return (
      <Shell>
        <Message
          title="Invitation révoquée"
          body="Cette invitation a été annulée par un administrateur. Contactez votre équipe Prodigio pour en obtenir une nouvelle."
          action={<SignOutButton />}
        />
      </Shell>
    );
  }

  if (invitation.status === "expiree") {
    return (
      <Shell>
        <Message
          title="Invitation expirée"
          body="Cette invitation a dépassé sa date de validité. Demandez à un administrateur de vous la renvoyer."
          action={<SignOutButton />}
        />
      </Shell>
    );
  }

  if (invitation.status === "acceptee") {
    return (
      <Shell>
        <Message
          title="Invitation déjà acceptée"
          body="Votre accès est actif. Vous pouvez rejoindre votre espace."
          action={
            <Link
              href="/crm"
              className="text-sm text-[var(--color-gold-soft)] underline-offset-4 hover:underline"
            >
              Ouvrir le CRM
            </Link>
          }
        />
      </Shell>
    );
  }

  // en_attente : formulaire d'acceptation.
  const roleToken = invitation.role as CrmRole;
  return (
    <Shell>
      <InvitationAccept
        email={user.email ?? invitation.email}
        organizationName={invitation.organization_name}
        roleLabel={roleLabels[roleToken] ?? invitation.role}
        rolePermissions={ROLE_PERMISSIONS[roleToken] ?? ""}
        greetingName={invitation.first_name}
      />
      <div className="mt-6 border-t border-[var(--color-border-dark)] pt-4 text-center">
        <SignOutButton label="Ce n’est pas vous ? Se déconnecter" />
      </div>
    </Shell>
  );
}
