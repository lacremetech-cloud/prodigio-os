"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createMandateDraftAction,
  deleteMandateDocumentAction,
  getDocumentSignedUrlAction,
  handoffCreatePropertyAction,
  proposeMandateAction,
  saveEstimationReportAction,
  signMandateAction,
  transitionMandateAction,
  uploadMandateDocumentAction,
  validateEligibilityAction,
  type ActionResult,
} from "@/modules/mandates/lifecycle/actions";
import {
  documentKindLabels,
  eligibilityDecisionLabels,
  feeBasisLabels,
  mandateStatusLabels,
} from "@/modules/mandates/lifecycle/labels";
import { parseEurosToCents } from "@/modules/mandates/lifecycle/money";
import { formatDate, formatDateTime } from "@/modules/crm/format";
import type {
  EconomicRuleSetRow,
  EstimationReportRow,
  MandateDocumentRow,
  MandateRow,
} from "@/lib/supabase/types";

// --- Hook d'action partagé ---------------------------------------------------
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = (fn: () => Promise<ActionResult>, onOk?: (res: ActionResult) => void) => {
    setError(null);
    setDone(false);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setDone(true);
        onOk?.(res);
        router.refresh();
      } else {
        setError(res.error ?? "Erreur");
      }
    });
  };
  return { pending, error, done, run };
}

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="crm-wrap text-xs text-[var(--color-danger-on-dark)]">
      {error}
    </p>
  );
}

function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-xs crm-aging--frais">Enregistré</span>;
}

/** Champ montant en euros (saisie libre, converti en centimes à l'envoi). */
function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="crm-label">{label}</span>
      <input
        className="crm-input"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ex. 850 000"
      />
    </label>
  );
}

// ================================================================ Estimation
export function EstimationReportForm({
  opportunityId,
  appointmentId,
  report,
  canEdit,
}: {
  opportunityId: string;
  appointmentId: string | null;
  report: EstimationReportRow | null;
  canEdit: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [outcome, setOutcome] = useState<string>(report?.outcome ?? "realisee");
  const [performedAt, setPerformedAt] = useState(
    report?.performed_at ? toLocalInput(report.performed_at) : "",
  );
  const [low, setLow] = useState(centsToField(report?.value_low_cents));
  const [recommended, setRecommended] = useState(centsToField(report?.value_recommended_cents));
  const [high, setHigh] = useState(centsToField(report?.value_high_cents));
  const [ownerExpected, setOwnerExpected] = useState(centsToField(report?.owner_expected_cents));
  const [condition, setCondition] = useState(report?.property_condition ?? "");
  const [strengths, setStrengths] = useState(report?.strengths ?? "");
  const [risks, setRisks] = useState(report?.risks ?? "");
  const [ownerProject, setOwnerProject] = useState(report?.owner_project_summary ?? "");
  const [confidential, setConfidential] = useState(report?.confidential_notes ?? "");
  const [recommendation, setRecommendation] = useState(report?.agent_recommendation ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <p className="text-xs text-[var(--crm-text-faint)]">
        Seuls un administrateur, un manager ou l’agent affecté renseignent l’estimation.
      </p>
    );
  }

  const realisee = outcome === "realisee";

  const submit = () => {
    setLocalError(null);
    // Conversion des montants (euros → centimes) avec contrôle de forme.
    const cents = {
      low: parseEurosToCents(low),
      recommended: parseEurosToCents(recommended),
      high: parseEurosToCents(high),
      ownerExpected: parseEurosToCents(ownerExpected),
    };
    for (const [k, v] of Object.entries(cents)) {
      if (v === undefined) {
        setLocalError(`Montant « ${k} » non valide.`);
        return;
      }
    }
    if (realisee && (cents.recommended == null || !performedAt)) {
      setLocalError("Une estimation réalisée exige la valeur recommandée et la date.");
      return;
    }
    run(() =>
      saveEstimationReportAction({
        opportunityId,
        outcome,
        performedAt: performedAt ? new Date(performedAt).toISOString() : null,
        valueLowCents: cents.low ?? null,
        valueRecommendedCents: cents.recommended ?? null,
        valueHighCents: cents.high ?? null,
        ownerExpectedCents: cents.ownerExpected ?? null,
        propertyCondition: condition || null,
        strengths: strengths || null,
        risks: risks || null,
        ownerProjectSummary: ownerProject || null,
        confidentialNotes: confidential || null,
        agentRecommendation: recommendation || null,
        nextAction: null,
        nextActionAt: null,
        appointmentId: appointmentId ?? null,
      }),
    );
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Résultat du rendez-vous</span>
          <select className="crm-select" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="realisee">Estimation réalisée</option>
            <option value="proprietaire_absent">Propriétaire absent</option>
            <option value="rdv_annule">Rendez-vous annulé</option>
            <option value="estimation_impossible">Estimation impossible</option>
            <option value="nouveau_rdv_necessaire">Nouveau rendez-vous nécessaire</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Date de l’estimation{realisee ? " (requise)" : ""}</span>
          <input
            type="datetime-local"
            className="crm-input"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
          />
        </label>
      </div>

      {realisee ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MoneyField label="Fourchette basse" value={low} onChange={setLow} />
            <MoneyField label="Valeur recommandée (requise)" value={recommended} onChange={setRecommended} />
            <MoneyField label="Fourchette haute" value={high} onChange={setHigh} />
          </div>
          <MoneyField label="Prix espéré par le propriétaire" value={ownerExpected} onChange={setOwnerExpected} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextArea label="État du bien" value={condition} onChange={setCondition} />
            <TextArea label="Projet du propriétaire" value={ownerProject} onChange={setOwnerProject} />
            <TextArea label="Points forts" value={strengths} onChange={setStrengths} />
            <TextArea label="Points de vigilance" value={risks} onChange={setRisks} />
          </div>
          <TextArea label="Recommandation de l’agent" value={recommendation} onChange={setRecommendation} />
          <label className="flex flex-col gap-1">
            <span className="crm-label">
              Notes confidentielles — internes, jamais montrées au propriétaire
            </span>
            <textarea
              className="crm-textarea"
              rows={2}
              value={confidential}
              onChange={(e) => setConfidential(e.target.value)}
              placeholder="Éléments sensibles réservés à l’équipe interne…"
            />
          </label>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--gold crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : report ? "Mettre à jour l’estimation" : "Enregistrer l’estimation"}
        </button>
        <Saved show={done} />
        <FieldError error={localError ?? error} />
      </div>
    </form>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="crm-label">{label}</span>
      <textarea className="crm-textarea" rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ============================================================== Éligibilité
export function EligibilityDecisionForm({
  opportunityId,
  current,
  canDecide,
}: {
  opportunityId: string;
  current: string | null;
  canDecide: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [decision, setDecision] = useState(current ?? "a_completer");
  const [reason, setReason] = useState("");
  const [derogation, setDerogation] = useState(false);
  const [derogationReason, setDerogationReason] = useState("");

  if (!canDecide) {
    return (
      <p className="text-xs text-[var(--crm-text-faint)]">
        Seuls un administrateur ou un manager valident l’éligibilité.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          validateEligibilityAction({
            opportunityId,
            decision,
            reason: reason || null,
            isDerogation: derogation,
            derogationReason: derogationReason || null,
          }),
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Décision d’éligibilité (humaine)</span>
          <select className="crm-select" value={decision} onChange={(e) => setDecision(e.target.value)}>
            {Object.entries(eligibilityDecisionLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm text-[var(--crm-text-dim)]">
          <input type="checkbox" checked={derogation} onChange={(e) => setDerogation(e.target.checked)} />
          Dérogation à la recommandation
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Motif de la décision {derogation ? "" : "(recommandé)"}</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Justification de l’éligibilité…"
        />
      </label>
      {derogation ? (
        <label className="flex flex-col gap-1">
          <span className="crm-label">Justification de la dérogation (obligatoire)</span>
          <textarea
            className="crm-textarea"
            rows={2}
            value={derogationReason}
            onChange={(e) => setDerogationReason(e.target.value)}
          />
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
          {pending ? "Validation…" : "Valider l’éligibilité"}
        </button>
        <Saved show={done} />
        <FieldError error={error} />
      </div>
    </form>
  );
}

// ================================================================= Mandat
export interface HolderOption {
  id: string;
  name: string;
}

export function MandateManager({
  opportunityId,
  mandate,
  holderOptions,
  activeRules,
  documents,
  canManagePartners,
}: {
  opportunityId: string;
  mandate: MandateRow | null;
  holderOptions: HolderOption[];
  activeRules: EconomicRuleSetRow[];
  documents: MandateDocumentRow[];
  canManagePartners: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [holder, setHolder] = useState(mandate?.holder_organization_id ?? "");
  const [mandateType, setMandateType] = useState(mandate?.mandate_type ?? "");
  const [exclusive, setExclusive] = useState<boolean>(mandate?.is_exclusive ?? false);
  const [ruleId, setRuleId] = useState(activeRules[0]?.id ?? "");
  const [startDate, setStartDate] = useState(mandate?.start_date ?? "");
  const [expiresAt, setExpiresAt] = useState(mandate?.expires_at ?? "");
  // Signature
  const [mandateNumber, setMandateNumber] = useState(mandate?.mandate_number ?? "");
  const [signedAt, setSignedAt] = useState("");
  const [signedDocId, setSignedDocId] = useState("");
  // Transition
  const [reasonCode, setReasonCode] = useState("");
  const [reason, setReason] = useState("");

  const noHolder = holderOptions.length === 0;
  const noRule = activeRules.length === 0;

  // --- Aucun mandat : créer un brouillon ---
  if (!mandate) {
    return (
      <div className="flex flex-col gap-3">
        {noHolder ? (
          <BlockingNotice canAct={canManagePartners}>
            Aucune organisation porteuse (agence habilitée) n’est configurée. Un mandat ne peut
            pas être porté par Prodigio. Un administrateur doit d’abord enregistrer l’agence
            porteuse.
          </BlockingNotice>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="crm-label">Organisation porteuse (agence habilitée)</span>
            <select className="crm-select" value={holder} onChange={(e) => setHolder(e.target.value)}>
              <option value="">Sélectionner l’agence porteuse…</option>
              {holderOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="crm-label">Type de mandat (facultatif)</span>
            <input className="crm-input" value={mandateType} onChange={(e) => setMandateType(e.target.value)} placeholder="ex. exclusif, simple…" />
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm text-[var(--crm-text-dim)]">
            <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} />
            Mandat exclusif
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            disabled={pending || noHolder}
            onClick={() =>
              run(() =>
                createMandateDraftAction({
                  opportunityId,
                  holderOrganizationId: holder || null,
                  mandateType: mandateType || null,
                  isExclusive: exclusive,
                }),
              )
            }
          >
            {pending ? "Création…" : "Créer un brouillon de mandat"}
          </button>
          <Saved show={done} />
          <FieldError error={error} />
        </div>
      </div>
    );
  }

  const terminal = ["refuse", "expire", "annule"].includes(mandate.status);
  const signedDocuments = documents.filter((d) => d.kind === "mandat_signe" || d.kind === "mandat_propose");

  return (
    <div className="flex flex-col gap-4">
      {/* Statut courant */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--crm-text)]">
        <span className="crm-label">Statut :</span>
        <span className="font-medium">{mandateStatusLabels[mandate.status] ?? mandate.status}</span>
        {mandate.mandate_number ? <span className="text-[var(--crm-text-dim)]">· n° {mandate.mandate_number}</span> : null}
      </div>

      {/* Brouillon → proposer */}
      {mandate.status === "brouillon" ? (
        <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-4">
          <p className="crm-label">Proposer le mandat (fige les conditions économiques)</p>
          {!mandate.holder_organization_id && noHolder ? (
            <BlockingNotice canAct={canManagePartners}>
              Organisation porteuse manquante : configurez d’abord l’agence habilitée.
            </BlockingNotice>
          ) : null}
          {noRule ? (
            <BlockingNotice canAct={canManagePartners}>
              Aucune règle économique active. Un administrateur doit définir une règle
              applicable (par partenaire / segment) avant toute proposition.{" "}
              <Link href="/crm/parametres/regles-economiques" className="underline">
                Configurer les règles
              </Link>
            </BlockingNotice>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="crm-label">Règle économique applicable</span>
              <select className="crm-select" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
                {activeRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.segment} · {feeBasisLabels[r.fee_basis] ?? r.fee_basis}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Prise d’effet (facultatif)</span>
              <input type="date" className="crm-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Échéance (facultatif)</span>
              <input type="date" className="crm-input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="crm-btn crm-btn--gold crm-btn--sm"
              disabled={pending || noRule || !ruleId}
              onClick={() =>
                run(() =>
                  proposeMandateAction({
                    mandateId: mandate.id,
                    economicRuleId: ruleId,
                    opportunityId,
                    mandateType: mandateType || null,
                    isExclusive: exclusive,
                    startDate: startDate || null,
                    expiresAt: expiresAt || null,
                  }),
                )
              }
            >
              {pending ? "Proposition…" : "Proposer le mandat"}
            </button>
            <TransitionButtons mandateId={mandate.id} opportunityId={opportunityId} statuses={["annule"]} run={run} pending={pending} reason={reason} setReason={setReason} reasonCode={reasonCode} setReasonCode={setReasonCode} />
          </div>
        </div>
      ) : null}

      {/* Proposé / en attente → signer, transitions */}
      {["propose", "en_attente_signature"].includes(mandate.status) ? (
        <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-4">
          <p className="crm-label">Signature (import manuel du document signé)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Numéro de mandat</span>
              <input className="crm-input" value={mandateNumber} onChange={(e) => setMandateNumber(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Date de signature</span>
              <input type="datetime-local" className="crm-input" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="crm-label">Document signé</span>
            {signedDocuments.length === 0 ? (
              <span className="text-xs text-[var(--crm-text-faint)]">
                Ajoutez d’abord le document signé dans la section « Documents » ci-dessous.
              </span>
            ) : (
              <select className="crm-select" value={signedDocId} onChange={(e) => setSignedDocId(e.target.value)}>
                <option value="">Sélectionner le document…</option>
                {signedDocuments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {documentKindLabels[d.kind] ?? d.kind} · {d.file_name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="crm-btn crm-btn--gold crm-btn--sm"
              disabled={pending || !mandateNumber || !signedAt || !signedDocId}
              onClick={() =>
                run(() =>
                  signMandateAction({
                    mandateId: mandate.id,
                    mandateNumber,
                    signedAt: signedAt ? new Date(signedAt).toISOString() : "",
                    signedDocumentId: signedDocId,
                    opportunityId,
                    startDate: startDate || null,
                    expiresAt: expiresAt || null,
                  }),
                )
              }
            >
              {pending ? "Signature…" : "Marquer signé"}
            </button>
            <TransitionButtons
              mandateId={mandate.id}
              opportunityId={opportunityId}
              statuses={mandate.status === "propose" ? ["en_attente_signature", "refuse", "annule", "expire"] : ["refuse", "annule", "expire"]}
              run={run}
              pending={pending}
              reason={reason}
              setReason={setReason}
              reasonCode={reasonCode}
              setReasonCode={setReasonCode}
            />
          </div>
        </div>
      ) : null}

      {/* Signé → expiration possible */}
      {mandate.status === "signe" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm crm-aging--frais">Mandat signé le {formatDate(mandate.signed_at)}.</span>
          <TransitionButtons mandateId={mandate.id} opportunityId={opportunityId} statuses={["expire"]} run={run} pending={pending} reason={reason} setReason={setReason} reasonCode={reasonCode} setReasonCode={setReasonCode} />
        </div>
      ) : null}

      {terminal ? (
        <p className="text-sm text-[var(--crm-text-dim)]">
          Mandat {mandateStatusLabels[mandate.status]?.toLowerCase()}.
          {mandate.end_reason ? ` Motif : ${mandate.end_reason}` : ""}
        </p>
      ) : null}

      <FieldError error={error} />
    </div>
  );
}

function TransitionButtons({
  mandateId,
  opportunityId,
  statuses,
  run,
  pending,
  reason,
  setReason,
  reasonCode,
  setReasonCode,
}: {
  mandateId: string;
  opportunityId: string;
  statuses: string[];
  run: (fn: () => Promise<ActionResult>) => void;
  pending: boolean;
  reason: string;
  setReason: (v: string) => void;
  reasonCode: string;
  setReasonCode: (v: string) => void;
}) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const labels: Record<string, string> = {
    en_attente_signature: "Passer en attente",
    refuse: "Refuser",
    annule: "Annuler",
    expire: "Expirer",
  };
  const needsReason = (s: string) => s === "refuse" || s === "annule" || s === "expire";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {statuses.map((s) => (
        <div key={s} className="flex flex-col gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--sm crm-btn--ghost"
            disabled={pending}
            onClick={() => {
              if (needsReason(s)) {
                setOpenFor(openFor === s ? null : s);
              } else {
                run(() => transitionMandateAction({ mandateId, status: s, opportunityId }));
              }
            }}
          >
            {labels[s] ?? s}
          </button>
          {openFor === s ? (
            <div className="flex flex-col gap-2 rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] p-3">
              <input
                className="crm-input text-xs"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                placeholder="Code de raison (facultatif)"
              />
              <input
                className="crm-input text-xs"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motif"
              />
              <button
                type="button"
                className="crm-btn crm-btn--sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    transitionMandateAction({
                      mandateId,
                      status: s,
                      opportunityId,
                      reasonCode: reasonCode || null,
                      reason: reason || null,
                    }),
                  )
                }
              >
                Confirmer « {labels[s] ?? s} »
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BlockingNotice({ children, canAct }: { children: React.ReactNode; canAct: boolean }) {
  return (
    <div className="rounded-[10px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-3">
      <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">{children}</p>
      {canAct ? (
        <Link href="/crm/parametres/regles-economiques" className="mt-2 inline-block text-xs text-[var(--crm-gold)] underline">
          Ouvrir la configuration
        </Link>
      ) : (
        <p className="mt-1 text-[11px] text-[var(--crm-text-faint)]">
          Action réservée à un administrateur.
        </p>
      )}
    </div>
  );
}

// ================================================================ Documents
export function DocumentsManager({
  opportunityId,
  mandateId,
  documents,
  canManage,
}: {
  opportunityId: string;
  mandateId: string | null;
  documents: MandateDocumentRow[];
  canManage: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [kind, setKind] = useState("mandat_signe");
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewing, startViewing] = useTransition();

  const openDocument = (documentId: string) => {
    setViewError(null);
    startViewing(async () => {
      const res = await getDocumentSignedUrlAction({ documentId });
      if (res.ok && res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        setViewError(res.error ?? "Impossible d’ouvrir le document.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <form
          className="flex flex-col gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const file = fileRef.current?.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("opportunityId", opportunityId);
            fd.set("kind", kind);
            if (mandateId) fd.set("mandateId", mandateId);
            fd.set("file", file);
            run(
              () => uploadMandateDocumentAction(fd),
              () => {
                if (fileRef.current) fileRef.current.value = "";
              },
            );
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Type de document</span>
              <select className="crm-select" value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(documentKindLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Fichier (PDF, JPEG ou PNG · 15 Mo max.)</span>
              <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" className="crm-input" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
              {pending ? "Téléversement…" : "Ajouter le document"}
            </button>
            <Saved show={done} />
            <FieldError error={error} />
          </div>
        </form>
      ) : null}

      {documents.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-6 text-center text-xs text-[var(--crm-text-faint)]">
          Aucun document. Les documents sont stockés de façon privée ; l’accès se fait par lien signé
          temporaire.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3"
            >
              <div className="min-w-0">
                <p className="crm-wrap text-sm text-[var(--crm-text)]">{d.file_name}</p>
                <p className="text-[11px] text-[var(--crm-text-faint)]">
                  {documentKindLabels[d.kind] ?? d.kind} · {formatDateTime(d.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="crm-btn crm-btn--sm crm-btn--ghost"
                  disabled={viewing}
                  onClick={() => openDocument(d.id)}
                >
                  {viewing ? "…" : "Consulter"}
                </button>
                {canManage ? (
                  <button
                    type="button"
                    className="crm-btn crm-btn--sm crm-btn--ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() => deleteMandateDocumentAction({ documentId: d.id, opportunityId }))
                    }
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FieldError error={viewError} />
    </div>
  );
}

// ============================================================ Handoff bien
export function PropertyHandoff({
  opportunityId,
  mandateId,
  propertyId,
  gateMet,
  canHandoff,
}: {
  opportunityId: string;
  mandateId: string | null;
  propertyId: string | null;
  gateMet: boolean;
  canHandoff: boolean;
}) {
  const { pending, error, run } = useAction();
  const router = useRouter();

  if (propertyId) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm crm-aging--frais">Bien créé dans Prodigio.</span>
        <Link href={`/crm/biens/${propertyId}`} className="crm-btn crm-btn--sm">
          Ouvrir la page du bien
        </Link>
      </div>
    );
  }

  if (!canHandoff) {
    return (
      <p className="text-xs text-[var(--crm-text-faint)]">
        La création du bien est réservée à un administrateur ou un manager.
      </p>
    );
  }

  if (!gateMet) {
    return (
      <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
        Le passage vers la Fabrique de biens sera disponible lorsque le dossier sera éligible au
        parcours premium, le mandat signé, l’organisation porteuse et le document signé présents.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="crm-btn crm-btn--gold crm-btn--sm"
        disabled={pending || !mandateId}
        onClick={() =>
          run(
            () => handoffCreatePropertyAction({ mandateId: mandateId ?? "", opportunityId }),
            (res) => {
              const id = res.data?.id ? String(res.data.id) : "";
              if (id) router.push(`/crm/biens/${id}`);
            },
          )
        }
      >
        {pending ? "Création…" : "Créer ce bien dans Prodigio"}
      </button>
      <FieldError error={error} />
    </div>
  );
}

// --- Helpers de conversion ---------------------------------------------------
function centsToField(cents: number | null | undefined): string {
  if (cents == null) return "";
  return String(cents / 100);
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

