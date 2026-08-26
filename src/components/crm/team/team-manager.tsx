"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/crm/modal";
import { ToastProvider, useToast } from "@/components/crm/toast";
import { Avatar, Chip, EmptyState } from "@/components/crm/ui";
import { roleLabels } from "@/modules/crm/labels";
import { ASSIGNABLE_ROLES, ROLE_PERMISSIONS } from "@/modules/crm/auth/roles";
import type { CrmRole } from "@/modules/crm/auth/roles";
import {
  teamStatusLabels,
  teamStatusVariant,
  type StatusVariant,
  type TeamCounters,
  type TeamEntry,
} from "@/modules/crm/team/status";
import {
  changeMemberRoleAction,
  inviteMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  setMemberStatusAction,
  type TeamActionResult,
} from "@/modules/crm/team/actions";
import { safeAction } from "@/modules/crm/safe-action";

function statusChipVariant(v: StatusVariant): "neutral" | "gold" | "danger" | "ok" {
  return v;
}

// ------------------------------------------------------------------ Stat tile
function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="crm-panel-2 flex flex-col gap-1 p-4">
      <span className="text-2xl font-semibold tabular-nums text-[var(--crm-text)]">{value}</span>
      <span className="text-xs text-[var(--crm-text-dim)]">{label}</span>
    </div>
  );
}

// -------------------------------------------------------------- Invite modal
function InviteForm({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (res: TeamActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CrmRole>("setter");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await safeAction(() =>
            inviteMemberAction({
              email: email.trim(),
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              role,
            }),
          );
          if (res.ok) {
            onDone(res);
            onClose();
          } else {
            setError(res.error ?? "Erreur");
          }
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="crm-label">Prénom</span>
          <input
            className="crm-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            placeholder="Prénom"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="crm-label">Nom</span>
          <input
            className="crm-input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            placeholder="Nom"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="crm-label">Adresse e-mail</span>
        <input
          className="crm-input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          placeholder="prenom@exemple.fr"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="crm-label">Rôle</span>
        <select
          className="crm-select"
          value={role}
          onChange={(e) => setRole(e.target.value as CrmRole)}
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
        <span className="mt-1 text-xs text-[var(--crm-text-dim)]">{ROLE_PERMISSIONS[role]}</span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger-on-dark)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" onClick={onClose}>
          Annuler
        </button>
        <button type="submit" className="crm-btn crm-btn--gold crm-btn--sm" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer l'invitation"}
        </button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------- Row actions
function RowActions({ entry, onChanged }: { entry: TeamEntry; onChanged: () => void }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    label: string;
    danger?: boolean;
    run: () => Promise<TeamActionResult>;
  }>(null);
  const [roleOpen, setRoleOpen] = useState(false);

  const runAction = (fn: () => Promise<TeamActionResult>, okMsg: string) => {
    start(async () => {
      const res = await safeAction(fn);
      if (res.ok) {
        toast(okMsg, "success");
        onChanged();
      } else {
        toast(res.error ?? "Erreur", "error");
      }
    });
  };

  const close = () => {
    setMenuOpen(false);
    setRoleOpen(false);
  };

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="crm-btn crm-btn--ghost crm-btn--sm"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={pending}
      >
        ⋯
      </button>

      {menuOpen ? (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={close}
          />
          <div
            role="menu"
            className="absolute right-0 top-9 z-20 w-56 rounded-[10px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-1.5 shadow-[var(--shadow-lg)] crm-fade-in"
          >
            {entry.kind === "invitation" && entry.pending ? (
              <>
                <MenuItem
                  onClick={() => {
                    close();
                    runAction(() => resendInvitationAction(entry.id), "Invitation renvoyée.");
                  }}
                >
                  Renvoyer l’invitation
                </MenuItem>
                <MenuItem
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirm({
                      title: "Révoquer l'invitation",
                      description: `L'invitation de ${entry.email} ne pourra plus être acceptée.`,
                      label: "Révoquer",
                      danger: true,
                      run: () => revokeInvitationAction(entry.id),
                    });
                  }}
                >
                  Révoquer l’invitation
                </MenuItem>
              </>
            ) : null}

            {entry.kind === "invitation" && !entry.pending ? (
              <p className="px-2.5 py-2 text-xs text-[var(--crm-text-faint)]">
                Aucune action disponible.
              </p>
            ) : null}

            {entry.kind === "member" ? (
              <>
                {!roleOpen ? (
                  <MenuItem
                    disabled={entry.isSelf}
                    onClick={() => setRoleOpen(true)}
                  >
                    Modifier le rôle
                  </MenuItem>
                ) : (
                  <div className="px-1.5 py-1.5">
                    <p className="mb-1 px-1 crm-label">Nouveau rôle</p>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <MenuItem
                        key={r}
                        onClick={() => {
                          close();
                          if (r === entry.roleToken) return;
                          setConfirm({
                            title: "Modifier le rôle",
                            description: `Attribuer le rôle « ${roleLabels[r]} » à ${entry.email} ?`,
                            label: "Confirmer",
                            run: () => changeMemberRoleAction(entry.userId, r),
                          });
                        }}
                      >
                        <span className="flex items-center gap-2">
                          {roleLabels[r]}
                          {r === entry.roleToken ? (
                            <span className="text-[var(--crm-gold)]">✓</span>
                          ) : null}
                        </span>
                      </MenuItem>
                    ))}
                  </div>
                )}

                {entry.rawStatus === "actif" ? (
                  <MenuItem
                    danger
                    disabled={entry.isSelf}
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirm({
                        title: "Désactiver l'accès",
                        description: `${entry.email} perdra immédiatement l'accès au CRM. Le compte n'est pas supprimé et peut être réactivé.`,
                        label: "Désactiver",
                        danger: true,
                        run: () => setMemberStatusAction(entry.userId, "suspendu"),
                      });
                    }}
                  >
                    Désactiver l’accès
                  </MenuItem>
                ) : (
                  <MenuItem
                    onClick={() => {
                      close();
                      runAction(
                        () => setMemberStatusAction(entry.userId, "actif"),
                        "Accès réactivé.",
                      );
                    }}
                  >
                    Réactiver l’accès
                  </MenuItem>
                )}
                {entry.isSelf ? (
                  <p className="px-2.5 py-1.5 text-[11px] text-[var(--crm-text-faint)]">
                    Vous ne pouvez pas modifier votre propre accès.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}

      <Modal
        open={confirm != null}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description}
      >
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--ghost crm-btn--sm"
            onClick={() => setConfirm(null)}
          >
            Annuler
          </button>
          <button
            type="button"
            className={`crm-btn crm-btn--sm ${confirm?.danger ? "" : "crm-btn--gold"}`}
            disabled={pending}
            onClick={() => {
              const c = confirm;
              setConfirm(null);
              if (c) runAction(c.run, "Modification enregistrée.");
            }}
          >
            {confirm?.label ?? "Confirmer"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center rounded-[7px] px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
        danger
          ? "text-[var(--color-danger-on-dark)] hover:bg-[rgba(240,165,140,0.08)]"
          : "text-[var(--crm-text)] hover:bg-[var(--crm-panel-2)]"
      }`}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Entry row
function EntryRow({ entry, onChanged }: { entry: TeamEntry; onChanged: () => void }) {
  const roleLabel = roleLabels[entry.roleToken] ?? entry.roleToken;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--crm-line-soft)] px-2 py-3 last:border-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
      {/* Nom + e-mail */}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={entry.name} size={34} />
        <div className="min-w-0">
          <p className="crm-ellipsis text-sm font-medium text-[var(--crm-text)]" title={entry.name}>
            {entry.name}
          </p>
          <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">{entry.email}</p>
        </div>
      </div>

      {/* Rôle (desktop) */}
      <div className="hidden sm:block">
        <Chip variant={entry.roleToken === "administrateur" ? "gold" : "neutral"}>{roleLabel}</Chip>
      </div>

      {/* Statut + date (desktop) */}
      <div className="hidden flex-col gap-1 sm:flex">
        <Chip variant={statusChipVariant(teamStatusVariant[entry.status])}>
          {teamStatusLabels[entry.status]}
        </Chip>
        <span className="text-[11px] text-[var(--crm-text-faint)]">{entry.dateLabel}</span>
      </div>

      {/* Actions */}
      <RowActions entry={entry} onChanged={onChanged} />

      {/* Mobile: rôle + statut sous la ligne */}
      <div className="col-span-2 flex flex-wrap items-center gap-2 sm:hidden">
        <Chip variant={entry.roleToken === "administrateur" ? "gold" : "neutral"}>{roleLabel}</Chip>
        <Chip variant={statusChipVariant(teamStatusVariant[entry.status])}>
          {teamStatusLabels[entry.status]}
        </Chip>
        <span className="text-[11px] text-[var(--crm-text-faint)]">{entry.dateLabel}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Team manager
function TeamManagerInner({
  entries,
  counters,
  adminConfigured,
}: {
  entries: TeamEntry[];
  counters: TeamCounters;
  adminConfigured: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);

  const onChanged = () => router.refresh();

  const onInvited = (res: TeamActionResult) => {
    if (res.emailSent) {
      toast("Invitation envoyée.", "success");
    } else if (res.configMissing) {
      toast(
        "Invitation enregistrée. L'e-mail n'a pas été envoyé (clé serveur manquante).",
        "info",
      );
    } else if (res.error) {
      toast(res.error, "error");
    } else {
      toast("Invitation enregistrée.", "success");
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Équipe &amp; accès</h1>
          <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
            Membres, invitations et rôles de votre organisation.
          </p>
        </div>
        <button
          type="button"
          className="crm-btn crm-btn--gold"
          onClick={() => setInviteOpen(true)}
        >
          + Inviter un membre
        </button>
      </header>

      {!adminConfigured ? (
        <div
          role="alert"
          className="rounded-[12px] border border-[rgba(203,180,136,0.4)] bg-[rgba(203,180,136,0.08)] px-4 py-3 text-sm text-[var(--crm-text-dim)]"
        >
          <p className="font-medium text-[var(--crm-gold)]">
            Envoi d’invitations désactivé — configuration serveur manquante
          </p>
          <p className="mt-1">
            La clé serveur <code>SUPABASE_SECRET_KEY</code> n’est pas configurée sur cet
            environnement. Vous pouvez préparer des invitations, mais l’e-mail d’accès Supabase ne
            sera <strong>pas</strong>{" "}envoyé tant que la clé n’est pas ajoutée (voir la
            documentation « Utilisateurs &amp; accès »). Message réservé aux administrateurs.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <StatTile value={counters.activeMembers} label="Membres actifs" />
        <StatTile value={counters.pendingInvitations} label="Invitations en attente" />
        <StatTile value={counters.disabledMembers} label="Accès désactivés" />
      </div>

      <section className="crm-panel p-3 sm:p-4">
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 px-2 pb-2 sm:grid">
          <span className="crm-label">Membre</span>
          <span className="crm-label">Rôle</span>
          <span className="crm-label">Statut</span>
          <span className="crm-label text-right">Actions</span>
        </div>
        {entries.length === 0 ? (
          <EmptyState
            title="Aucun membre pour l'instant"
            hint="Invitez votre premier collaborateur pour composer votre équipe."
          />
        ) : (
          <div>
            {entries.map((e) => (
              <EntryRow key={e.kind === "member" ? e.userId : e.id} entry={e} onChanged={onChanged} />
            ))}
          </div>
        )}
      </section>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Inviter un membre"
        description="La personne recevra un e-mail pour définir son accès et rejoindre votre organisation."
      >
        <InviteForm onClose={() => setInviteOpen(false)} onDone={onInvited} />
      </Modal>
    </div>
  );
}

export function TeamManager(props: {
  entries: TeamEntry[];
  counters: TeamCounters;
  adminConfigured: boolean;
}) {
  return (
    <ToastProvider>
      <TeamManagerInner {...props} />
    </ToastProvider>
  );
}
