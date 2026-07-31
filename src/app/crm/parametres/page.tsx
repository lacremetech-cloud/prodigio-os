import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canManageMembers } from "@/modules/crm/auth/roles";
import { getMembersMap } from "@/modules/crm/data/queries";
import { roleLabels } from "@/modules/crm/labels";
import { Avatar, Chip } from "@/components/crm/ui";
import type { CrmRole } from "@/modules/crm/auth/roles";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const session = await requireCrmSession("/crm/parametres");
  const isAdmin = canManageMembers(session.roles);
  const members = await getMembersMap();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="crm-eyebrow">Administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Paramètres</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Équipe, rôles et sécurité de l’espace interne.
        </p>
      </header>

      <section className="crm-panel p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Membres de l’équipe
        </h2>
        {members.size === 0 ? (
          <p className="text-sm text-[var(--crm-text-faint)]">Aucun membre listé.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {Array.from(members.entries()).map(([userId, info]) => {
              const name = info.email ?? `Membre ${userId.slice(0, 6)}`;
              const role = (info.role in roleLabels ? info.role : null) as CrmRole | null;
              return (
                <li
                  key={userId}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={name} size={30} />
                    <span className="crm-ellipsis text-sm text-[var(--crm-text)]" title={name}>{name}</span>
                  </div>
                  <Chip variant={role === "administrateur" ? "gold" : "neutral"}>
                    {role ? roleLabels[role] : info.role}
                  </Chip>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="crm-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Rôles
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(roleLabels) as CrmRole[]).map((r) => (
            <div key={r} className="rounded-[10px] border border-[var(--crm-line-soft)] p-3">
              <p className="text-sm font-medium text-[var(--crm-text)]">{roleLabels[r]}</p>
              <p className="mt-1 text-xs text-[var(--crm-text-faint)]">
                {r === "administrateur"
                  ? "Accès complet, gestion des membres, journal d’audit, paramètres économiques."
                  : r === "manager"
                    ? "Pilotage des dossiers, décision de segment, résultat commercial, audit."
                    : r === "setter"
                      ? "Setting : affectation, appels, notes, tâches, stades."
                      : r === "agent_immobilier"
                        ? "Dossiers partagés (préparé — non pleinement opérationnel en V1)."
                        : "Lecture limitée d’un dossier partagé (préparé — coordonnées masquées)."}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[var(--crm-text-faint)]">
          V1 pleinement opérationnelle pour administrateur, manager et setter. Les rôles vivent en
          base (aucun rôle codé en dur dans l’interface).
        </p>
      </section>

      {isAdmin ? (
        <section className="crm-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
              Équipe &amp; accès
            </h2>
            <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
              Inviter des membres, gérer les rôles, activer ou désactiver un accès — sans jamais
              ouvrir Supabase.
            </p>
          </div>
          <Link href="/crm/parametres/equipe" className="crm-btn crm-btn--gold shrink-0">
            Gérer l’équipe
          </Link>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="crm-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
              Règles économiques &amp; organisations porteuses
            </h2>
            <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
              Versionner les conditions économiques (par partenaire / segment, date d’effet,
              historique) et enregistrer les agences habilitées à porter les mandats. Aucune valeur
              n’est codée en dur.
            </p>
          </div>
          <Link href="/crm/parametres/regles-economiques" className="crm-btn crm-btn--gold shrink-0">
            Configurer
          </Link>
        </section>
      ) : null}

      <section className="crm-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
            Google Calendar
          </h2>
          <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
            Connectez votre agenda pour planifier les estimations à partir de vos disponibilités
            réelles. Les jetons restent chiffrés côté serveur.
          </p>
        </div>
        <Link href="/crm/parametres/calendrier" className="crm-btn shrink-0">
          Gérer mon calendrier
        </Link>
      </section>

      <section className="crm-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Sécurité
        </h2>
        <ul className="flex flex-col gap-1.5 text-sm text-[var(--crm-text-dim)]">
          <li>· RLS PostgreSQL active sur toutes les tables (aucun accès public direct).</li>
          <li>· Écritures uniquement via des fonctions SECURITY DEFINER qui vérifient le rôle.</li>
          <li>· Journal d’audit non modifiable pour chaque changement sensible.</li>
          <li>· Coordonnées sensibles masquées pour les rôles non autorisés.</li>
          <li>· Aucune clé service_role côté navigateur ni dans le dépôt.</li>
        </ul>
      </section>
    </div>
  );
}
