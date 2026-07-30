import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canConnectCalendar } from "@/modules/crm/auth/roles";
import { isGoogleCalendarConfigured, isSupabaseAdminConfigured } from "@/config";
import { getMyConnection } from "@/modules/calendar/service";
import { connectionStatusLabels } from "@/modules/calendar/labels";
import { CalendarConnectionManager } from "@/components/crm/calendar/calendar-connection";
import { Chip } from "@/components/crm/ui";

export const metadata: Metadata = { title: "Calendrier" };

const ERROR_MESSAGES: Record<string, string> = {
  config: "L'intégration Google Calendar n'est pas encore configurée (variables serveur manquantes).",
  role: "Votre rôle ne permet pas de connecter un calendrier.",
  etat: "La vérification de sécurité a échoué. Relancez la connexion.",
  refus: "Autorisation refusée côté Google. Vous pouvez réessayer.",
  connexion: "La connexion Google a échoué. Réessayez dans un instant.",
};

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await requireCrmSession("/crm/parametres/calendrier");
  const { connected: connectedParam, error: errorParam } = await searchParams;

  const canConnect = canConnectCalendar(session.roles);
  const configured = isGoogleCalendarConfigured() && isSupabaseAdminConfigured();
  const connection = await getMyConnection();
  const isConnected = connection?.status === "connecte";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="crm-eyebrow">Administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Google Calendar</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Connectez votre agenda pour planifier les rendez-vous d&apos;estimation à partir de vos
          disponibilités réelles.
        </p>
      </header>

      {connectedParam ? (
        <div className="crm-panel border-l-2 border-l-[var(--crm-gold)] p-4">
          <p className="text-sm text-[var(--crm-text)]">✓ Calendrier Google connecté.</p>
        </div>
      ) : null}
      {errorParam ? (
        <div className="crm-panel border-l-2 border-l-[var(--color-danger-on-dark)] p-4">
          <p className="text-sm text-[var(--crm-text)]">
            {ERROR_MESSAGES[errorParam] ?? "Une erreur est survenue."}
          </p>
        </div>
      ) : null}

      {!configured ? (
        <section className="crm-panel p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
            Configuration requise
          </h2>
          <p className="text-sm text-[var(--crm-text-dim)]">
            L&apos;intégration Google Calendar sera disponible une fois les variables serveur
            renseignées dans Vercel (identifiants OAuth et clé de chiffrement des jetons). Voir la
            documentation <code>docs/13-CALENDAR-ESTIMATIONS.md</code>.
          </p>
        </section>
      ) : null}

      <section className="crm-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
            Ma connexion
          </h2>
          {connection ? (
            <Chip variant={isConnected ? "ok" : connection.status === "connecte" ? "gold" : "danger"}>
              {connectionStatusLabels[connection.status] ?? connection.status}
            </Chip>
          ) : (
            <Chip variant="neutral">Non connecté</Chip>
          )}
        </div>

        {connection?.google_account_email ? (
          <p className="mb-4 text-sm text-[var(--crm-text-dim)]">
            Compte connecté : <span className="text-[var(--crm-text)]">{connection.google_account_email}</span>
          </p>
        ) : null}

        {!canConnect ? (
          <p className="text-sm text-[var(--crm-text-dim)]">
            En tant que setter, vous n&apos;avez pas besoin de connecter votre propre calendrier :
            vous consultez les disponibilités des agents lors de la planification d&apos;une
            estimation.
          </p>
        ) : configured ? (
          <CalendarConnectionManager
            connected={Boolean(isConnected)}
            selectedCalendarId={connection?.google_calendar_id ?? null}
            selectedCalendarSummary={connection?.google_calendar_summary ?? null}
          />
        ) : (
          <p className="text-sm text-[var(--crm-text-faint)]">
            Connexion indisponible tant que l&apos;intégration n&apos;est pas configurée.
          </p>
        )}
      </section>

      <section className="crm-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Sécurité des jetons
        </h2>
        <ul className="flex flex-col gap-1.5 text-sm text-[var(--crm-text-dim)]">
          <li>· Les jetons Google (accès et rafraîchissement) sont chiffrés au repos (AES-256-GCM).</li>
          <li>· Ils restent strictement côté serveur : jamais dans le navigateur, les logs ni le journal d&apos;audit.</li>
          <li>· Seul le rôle de service accède aux jetons ; le CRM n&apos;expose que des métadonnées.</li>
          <li>· La déconnexion révoque l&apos;accès chez Google et supprime les jetons stockés.</li>
        </ul>
      </section>

      <div>
        <Link href="/crm/parametres" className="text-xs text-[var(--crm-text-dim)] hover:text-[var(--crm-text)]">
          ← Retour aux paramètres
        </Link>
      </div>
    </div>
  );
}
