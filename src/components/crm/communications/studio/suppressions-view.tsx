"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, EmptyState, SectionTitle } from "@/components/crm/ui";
import { Modal } from "@/components/crm/modal";
import { channelLabels, suppressionReasonLabels } from "@/modules/communications";
import { releaseSuppressionAction } from "@/modules/communications/actions";
import { safeAction } from "@/modules/crm/safe-action";

/**
 * **Registre des oppositions.**
 *
 * `privacy_records` porte le CHOIX et la base légale ; cette table porte un FAIT
 * bloquant. Le studio réutilise strictement l'existant : aucune seconde source
 * de vérité n'est créée.
 *
 * Une opposition ne peut jamais autoriser un envoi — seulement l'empêcher. Sa
 * levée est réservée à l'administrateur, exige un motif, et est tracée dans
 * l'audit **sans donnée personnelle** (identifiants et motif uniquement).
 *
 * ⚠️ Aucune coordonnée n'est affichée : seul le NOM du contact l'est. Montrer
 * l'adresse visée par une opposition la révélerait sans nécessité.
 */

export interface SuppressionRowView {
  id: string;
  contactName: string;
  channel: "email" | "sms" | "tout";
  scope: "marketing" | "transactionnel" | "tout";
  reason: string;
  source: string;
  provider: string | null;
  notes: string | null;
  createdAt: string;
  active: boolean;
  releasedAt: string | null;
  releasedReason: string | null;
}

const SCOPE_LABELS: Record<SuppressionRowView["scope"], string> = {
  marketing: "Marketing",
  transactionnel: "Transactionnel",
  tout: "Toute finalité",
};

const SOURCE_LABELS: Record<string, string> = {
  humain: "Saisie humaine",
  fournisseur: "Remontée fournisseur",
  import: "Import",
};

/** Une opposition « tout canal / toute portée » prévaut sur toutes les autres. */
function isGlobal(row: SuppressionRowView): boolean {
  return row.channel === "tout" && row.scope === "tout";
}

function channelLabel(channel: SuppressionRowView["channel"]): string {
  return channel === "tout" ? "Tous canaux" : channelLabels[channel];
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

type Filter = "actives" | "toutes";

export function SuppressionsView({
  rows,
  canRelease,
}: {
  rows: SuppressionRowView[];
  canRelease: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("actives");
  const [target, setTarget] = useState<SuppressionRowView | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () => (filter === "actives" ? rows.filter((r) => r.active) : rows),
    [rows, filter],
  );

  const globalCount = rows.filter((r) => r.active && isGlobal(r)).length;

  const submitRelease = () => {
    if (!target || busy) return;
    setBusy(true);
    startTransition(async () => {
      const res = await safeAction(() =>
        releaseSuppressionAction({ suppressionId: target.id, reason }),
      );
      setFeedback({
        ok: res.ok,
        message: res.ok
          ? "Opposition levée. L'action est tracée dans l'audit, sans donnée personnelle."
          : (res.error ?? "Levée impossible."),
      });
      setBusy(false);
      if (res.ok) {
        setTarget(null);
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <section className="min-w-0 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
      <SectionTitle
        eyebrow="Protection des personnes"
        title="Oppositions"
        action={
          <div className="crm-tabs" role="tablist" aria-label="Filtre des oppositions">
            {(
              [
                ["actives", "Actives"],
                ["toutes", "Toutes"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={`crm-tab ${filter === value ? "crm-tab--active" : ""}`}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <p className="crm-wrap mb-3 text-sm text-[var(--crm-text-dim)]">
        Une opposition <strong>bloque</strong> l&apos;envoi, quelle que soit la base légale, et ne
        peut jamais l&apos;autoriser. Une opposition <strong>globale</strong> prévaut sur toutes les
        autres. La levée est réservée aux administrateurs et exige un motif.
      </p>

      {globalCount > 0 ? (
        <p
          role="status"
          className="crm-wrap mb-3 rounded-[10px] border px-3 py-2 text-[13px] text-[var(--crm-text-dim)]"
          style={{ borderColor: "var(--crm-danger)", background: "var(--crm-panel-2)" }}
        >
          {globalCount} opposition(s) globale(s) active(s) : tous canaux, toute finalité.
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {feedback?.message ?? ""}
      </p>
      {feedback ? (
        <p
          className="crm-wrap mb-3 rounded-[10px] border px-3 py-2 text-sm text-[var(--crm-text-dim)]"
          style={{
            borderColor: feedback.ok ? "var(--crm-success)" : "var(--crm-danger)",
            background: "var(--crm-panel-2)",
          }}
        >
          {feedback.message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={filter === "actives" ? "Aucune opposition active" : "Aucune opposition enregistrée"}
          hint="Les oppositions proviennent d'une désinscription, d'une plainte, d'un rebond définitif ou d'une demande explicite."
          icon="⦸"
        />
      ) : (
        <div className="crm-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">
              Oppositions enregistrées : contact, canal, portée, motif, source et date.
            </caption>
            <thead>
              <tr className="border-b border-[var(--crm-line)] text-left">
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">
                  Contact
                </th>
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">
                  Portée
                </th>
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">
                  Motif
                </th>
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">
                  Source
                </th>
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">
                  Date
                </th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-[var(--crm-line-soft)] last:border-0">
                  <td className="px-2 py-2.5">
                    <p className="crm-wrap text-[var(--crm-text)]">{row.contactName}</p>
                    {!row.active ? (
                      <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
                        Levée le{" "}
                        {row.releasedAt ? dateFormat.format(new Date(row.releasedAt)) : "—"}
                        {row.releasedReason ? ` · ${row.releasedReason}` : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="flex flex-wrap gap-1.5">
                      <Chip variant={isGlobal(row) ? "danger" : "neutral"} dot>
                        {channelLabel(row.channel)}
                      </Chip>
                      <Chip variant={row.scope === "tout" ? "danger" : "neutral"}>
                        {SCOPE_LABELS[row.scope]}
                      </Chip>
                    </span>
                  </td>
                  <td className="crm-wrap px-2 py-2.5 text-[var(--crm-text-dim)]">
                    {suppressionReasonLabels[
                      row.reason as keyof typeof suppressionReasonLabels
                    ] ?? row.reason}
                  </td>
                  <td className="crm-wrap px-2 py-2.5 text-[12px] text-[var(--crm-text-faint)]">
                    {SOURCE_LABELS[row.source] ?? row.source}
                    {row.provider ? ` · ${row.provider}` : ""}
                  </td>
                  <td className="px-2 py-2.5 text-[12px] text-[var(--crm-text-faint)]">
                    {dateFormat.format(new Date(row.createdAt))}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {row.active && canRelease ? (
                      <button
                        type="button"
                        className="crm-btn crm-btn--ghost crm-btn--sm"
                        onClick={() => {
                          setTarget(row);
                          setReason("");
                          setFeedback(null);
                        }}
                      >
                        Lever
                      </button>
                    ) : row.active ? (
                      <span className="text-[12px] text-[var(--crm-text-faint)]">
                        Levée réservée à l&apos;administrateur
                      </span>
                    ) : (
                      <Chip>Levée</Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Lever une opposition"
        description="Décision sensible : elle rouvre un canal fermé à la demande d'une personne. Le motif est obligatoire et conservé dans le journal d'audit, sans donnée personnelle."
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitRelease();
          }}
        >
          <p className="crm-wrap text-sm text-[var(--crm-text-dim)]">
            Contact : <strong className="text-[var(--crm-text)]">{target?.contactName}</strong> ·{" "}
            {target ? channelLabel(target.channel) : ""} ·{" "}
            {target ? SCOPE_LABELS[target.scope] : ""}
          </p>
          <label className="flex flex-col gap-1">
            <span className="crm-label">Motif de la levée (obligatoire)</span>
            <textarea
              className="crm-textarea"
              value={reason}
              minLength={5}
              maxLength={1000}
              required
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="crm-btn crm-btn--ghost"
              onClick={() => setTarget(null)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="crm-btn crm-btn--gold"
              disabled={busy || pending || reason.trim().length < 5}
            >
              Lever l&apos;opposition
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
