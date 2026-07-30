import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCrmSession } from "@/modules/crm/auth/session";
import {
  canDecideSegment,
  canManageAppointments,
  canOperate,
  canPlanEstimation,
  canViewAudit,
  canViewContactDetails,
  maskContactValue,
} from "@/modules/crm/auth/roles";
import { getLeadDetail, memberDisplayName } from "@/modules/crm/data/queries";
import {
  getAppointmentsForOpportunity,
  listBookableAgents,
} from "@/modules/calendar/queries";
import {
  appointmentStatusLabels,
  appointmentStatusTone,
} from "@/modules/calendar/labels";
import { formatAppointmentRange } from "@/modules/calendar/format";
import { DEFAULT_ESTIMATION_CONFIG } from "@/modules/calendar/config";
import { EstimationScheduler } from "@/components/crm/calendar/estimation-scheduler";
import { AppointmentActions } from "@/components/crm/calendar/appointment-actions";
import { buildTimeline } from "@/modules/crm/timeline";
import { formatDate, formatDateTime } from "@/modules/crm/format";
import {
  contactPreferenceLabels,
  label,
  mandateSituationLabel,
  outcomeLabels,
  priorityLabels,
  propertyLabel,
  recallPreferenceLabels,
  responsibilityLabels,
  saleHorizonLabel,
  stageLabels,
  valueBandLabel,
} from "@/modules/crm/labels";
import {
  ActivityForm,
  AssignControl,
  OutcomeForm,
  SegmentDecisionForm,
  StageControl,
  TaskForm,
  TaskToggle,
  type MemberOption,
} from "@/components/crm/lead-actions";
import {
  AppreciationBadge,
  Avatar,
  Chip,
  PriorityBadge,
  ScoreMeter,
  SegmentBadge,
  StageBadge,
} from "@/components/crm/ui";
import type { Json } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dossier" };

function Panel({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="crm-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Info({ label: l, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="crm-label">{l}</span>
      <span className="text-sm text-[var(--crm-text)]">{value ?? "—"}</span>
    </div>
  );
}

interface Factor {
  key: string;
  value: string | null;
  points: number;
  max: number;
}
function readFactors(breakdown: Json | null, axis: "compatibility" | "maturity"): Factor[] {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return [];
  const axisObj = (breakdown as Record<string, unknown>)[axis];
  if (!axisObj || typeof axisObj !== "object") return [];
  const factors = (axisObj as Record<string, unknown>).factors;
  if (!Array.isArray(factors)) return [];
  return factors.map((f) => {
    const o = (f ?? {}) as Record<string, unknown>;
    return {
      key: String(o.key ?? ""),
      value: o.value == null ? null : String(o.value),
      points: Number(o.points ?? 0),
      max: Number(o.max ?? 0),
    };
  });
}

const FACTOR_LABELS: Record<string, string> = {
  value_band: "Bande de valeur",
  property_type: "Type de bien",
  sale_horizon: "Horizon de vente",
  mandate_situation: "Situation du mandat",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireCrmSession(`/crm/mandats/${id}`);
  const detail = await getLeadDetail(id);
  if (!detail) notFound();

  const { opportunity: o, contacts, submission, activities, tasks, auditEvents, assignees, members } = detail;
  const canView = canViewContactDetails(session.roles);
  const canOp = canOperate(session.roles);
  const canSeg = canDecideSegment(session.roles);
  const isAdmin = session.roles.includes("administrateur");
  const showAudit = canViewAudit(session.roles);

  // Rendez-vous d'estimation + agents réservables (calendrier connecté).
  const canPlan = canPlanEstimation(session.roles);
  const canManageRdv = canManageAppointments(session.roles);
  const isAgent = session.roles.includes("agent_immobilier");
  const [appointments, bookableAgents] = await Promise.all([
    getAppointmentsForOpportunity(id),
    canPlan ? listBookableAgents() : Promise.resolve([]),
  ]);
  const activeAppointments = appointments.filter((a) => a.status !== "annule");

  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
  const displayName = primary ? primary.name : "Dossier sans contact";

  const memberOptions: MemberOption[] = Array.from(members.entries()).map(([userId, info]) => ({
    userId,
    name: memberDisplayName(userId, members),
    role: info.role,
  }));
  const assignedUserIds = assignees.map((a) => a.userId);

  const timeline = buildTimeline({
    activities,
    auditEvents,
    tasks,
    nameFor: (uid) => (uid ? memberDisplayName(uid, members) : null),
  });

  const openTasks = tasks.filter((t) => t.status === "a_faire");
  const attemptCount = activities.filter(
    (a) => a.type === "appel" || a.type === "tentative_appel",
  ).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {/* En-tête */}
      <div className="flex flex-col gap-3">
        <Link href="/crm/mandats" className="text-xs text-[var(--crm-text-dim)] hover:text-[var(--crm-text)]">
          ← Retour aux leads
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} size={40} />
            <div>
              <h1 className="text-xl font-semibold text-[var(--crm-text)]">{displayName}</h1>
              <p className="text-xs text-[var(--crm-text-faint)]">
                Dossier ouvert le {formatDate(o.created_at)} · {propertyLabel(o.property_type) ?? "Type inconnu"}
                {o.location_city ? ` · ${o.location_city}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={o.pipeline_stage} />
            <AppreciationBadge value={submission?.public_appreciation ?? null} />
            <PriorityBadge priority={o.recommended_priority} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Colonne principale */}
        <div className="flex flex-col gap-5">
          {/* Synthèse */}
          <Panel title="Synthèse">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Contact principal" value={displayName} />
              <Info
                label="Téléphone"
                value={primary ? maskContactValue(primary.phone, canView) ?? "—" : "—"}
              />
              <Info
                label="E-mail"
                value={primary ? maskContactValue(primary.email, canView) ?? "—" : "—"}
              />
              <Info label="Stade" value={stageLabels[o.pipeline_stage] ?? o.pipeline_stage} />
              <Info label="Segment" value={<SegmentBadge segment={o.segment} />} />
              <Info
                label="Priorité recommandée"
                value={o.recommended_priority ? label(priorityLabels, o.recommended_priority) : "—"}
              />
              <Info
                label="Responsable"
                value={
                  assignees.length > 0
                    ? assignees.map((a) => `${a.name} (${label(responsibilityLabels, a.responsibility)})`).join(", ")
                    : "Non affecté"
                }
              />
              <Info
                label="Prochaine action"
                value={
                  openTasks[0]
                    ? `${openTasks[0].title}${openTasks[0].due_at ? ` — ${formatDateTime(openTasks[0].due_at)}` : ""}`
                    : "Aucune"
                }
              />
              <Info label="Tentatives d’appel" value={attemptCount} />
            </div>
          </Panel>

          {/* Estimation — rendez-vous physique */}
          {canPlan || appointments.length > 0 ? (
            <Panel
              title="Estimation"
              aside={
                canPlan ? (
                  <EstimationScheduler
                    opportunityId={id}
                    city={o.location_city}
                    defaultAddress={[o.location_city, o.location_postal_code]
                      .filter(Boolean)
                      .join(" ")}
                    defaultOwnerEmail={canView ? (primary?.email ?? null) : null}
                    defaultOwnerName={primary?.name ?? null}
                    ownerContactId={primary?.id ?? null}
                    agents={bookableAgents}
                    timezone={DEFAULT_ESTIMATION_CONFIG.timeZone}
                    durationMinutes={DEFAULT_ESTIMATION_CONFIG.defaultDurationMinutes}
                  />
                ) : undefined
              }
            >
              {appointments.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-6 text-center text-xs text-[var(--crm-text-faint)]">
                  Aucun rendez-vous d’estimation planifié.
                  {canPlan ? " Utilisez « Planifier l’estimation » pour réserver un créneau." : ""}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {(activeAppointments.length > 0 ? activeAppointments : appointments).map((a) => {
                    const canResult =
                      canManageRdv || (isAgent && a.agent_user_id === session.userId);
                    return (
                      <li
                        key={a.id}
                        className="rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[var(--crm-text)]">
                              {formatAppointmentRange(a.starts_at, a.ends_at, a.timezone)}
                            </p>
                            <p className="text-xs text-[var(--crm-text-faint)]">
                              Agent : {memberDisplayName(a.agent_user_id, members)}
                              {a.address ? ` · ${a.address}` : ""}
                            </p>
                          </div>
                          <Chip variant={appointmentStatusTone[a.status]}>
                            {appointmentStatusLabels[a.status]}
                          </Chip>
                        </div>
                        {a.cancel_reason ? (
                          <p className="mb-2 text-xs text-[var(--crm-text-dim)]">
                            Motif : {a.cancel_reason}
                          </p>
                        ) : null}
                        <AppointmentActions
                          appointmentId={a.id}
                          opportunityId={id}
                          status={a.status}
                          googleHtmlLink={a.google_html_link}
                          startsAt={a.starts_at}
                          endsAt={a.ends_at}
                          canManage={canManageRdv}
                          canResult={canResult}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          ) : null}

          {/* Bien candidat */}
          <Panel title="Bien candidat">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Type de bien" value={propertyLabel(o.property_type) ?? "—"} />
              <Info
                label="Localisation"
                value={
                  o.location_city
                    ? `${o.location_city}${o.location_postal_code ? ` (${o.location_postal_code})` : ""}`
                    : "—"
                }
              />
              <Info label="Pays" value={o.location_country ?? "France"} />
              <Info label="Valeur estimée" value={valueBandLabel(o.estimated_value_band) ?? "—"} />
              <Info label="Horizon de vente" value={saleHorizonLabel(o.sale_horizon) ?? "—"} />
              <Info label="Situation du mandat" value={mandateSituationLabel(o.mandate_situation) ?? "—"} />
            </div>
          </Panel>

          {/* Projet de vente */}
          <Panel title="Projet de vente">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Horizon" value={saleHorizonLabel(o.sale_horizon) ?? "—"} />
              <Info label="Situation actuelle" value={mandateSituationLabel(o.mandate_situation) ?? "—"} />
              <Info
                label="Préférence de contact"
                value={primary?.preferredChannel ? label(contactPreferenceLabels, primary.preferredChannel) : "—"}
              />
              <Info
                label="Préférence de rappel"
                value={
                  submission?.contact_recall_preference
                    ? label(recallPreferenceLabels, submission.contact_recall_preference)
                    : "—"
                }
              />
            </div>
            {contacts.length > 1 ? (
              <div className="mt-4">
                <p className="crm-label mb-2">Autres contacts du dossier</p>
                <div className="flex flex-wrap gap-2">
                  {contacts
                    .filter((c) => !c.isPrimary)
                    .map((c) => (
                      <Chip key={c.id}>
                        {c.name} · {c.role}
                      </Chip>
                    ))}
                </div>
              </div>
            ) : null}
          </Panel>

          {/* Analyse Prodigio */}
          <Panel title="Analyse Prodigio">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-4">
                <ScoreMeter label="Compatibilité (propriété)" score={o.compatibility_score} />
                <div className="flex flex-col gap-1.5">
                  {readFactors(submission?.score_breakdown ?? null, "compatibility").map((f) => (
                    <div key={f.key} className="flex items-center justify-between text-xs text-[var(--crm-text-dim)]">
                      <span>{FACTOR_LABELS[f.key] ?? f.key}</span>
                      <span className="tabular-nums">
                        {f.points}
                        <span className="text-[var(--crm-text-faint)]">/{f.max}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <ScoreMeter label="Maturité (projet)" score={o.maturity_score} />
                <div className="flex flex-col gap-1.5">
                  {readFactors(submission?.score_breakdown ?? null, "maturity").map((f) => (
                    <div key={f.key} className="flex items-center justify-between text-xs text-[var(--crm-text-dim)]">
                      <span>{FACTOR_LABELS[f.key] ?? f.key}</span>
                      <span className="tabular-nums">
                        {f.points}
                        <span className="text-[var(--crm-text-faint)]">/{f.max}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--crm-line-soft)] pt-4">
              <span className="crm-label">Recommandation automatique :</span>
              <PriorityBadge priority={o.recommended_priority} />
              <AppreciationBadge value={submission?.public_appreciation ?? null} />
              <span className="text-[11px] text-[var(--crm-text-faint)]">
                (recommandation — la décision de segment reste humaine)
              </span>
            </div>

            <div className="mt-4 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="crm-label">Décision de segment (humaine)</span>
                <SegmentBadge segment={o.segment} />
                {o.segment_is_derogation ? <Chip variant="gold">Dérogation</Chip> : null}
              </div>
              {o.segment_decision_reason ? (
                <p className="mb-3 text-xs text-[var(--crm-text-dim)]">
                  Motif : {o.segment_decision_reason}
                  {o.segment_decided_at ? ` · ${formatDate(o.segment_decided_at)}` : ""}
                </p>
              ) : null}
              {canSeg ? (
                <SegmentDecisionForm opportunityId={o.id} segment={o.segment} />
              ) : (
                <p className="text-xs text-[var(--crm-text-faint)]">
                  Seuls un manager ou un administrateur valident le segment.
                </p>
              )}
            </div>
          </Panel>

          {/* Acquisition */}
          <Panel title="Acquisition & attribution">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Landing d’origine" value={submission?.landing ?? "—"} />
              <Info label="Source" value={submission?.utm_source ?? "—"} />
              <Info label="Support (medium)" value={submission?.utm_medium ?? "—"} />
              <Info label="Campagne" value={submission?.utm_campaign ?? "—"} />
              <Info label="Ad set (term)" value={submission?.utm_term ?? "—"} />
              <Info label="Annonce (content)" value={submission?.utm_content ?? "—"} />
              <Info label="fbclid" value={submission?.fbclid ? "présent" : "—"} />
              <Info label="Referrer" value={submission?.referrer ?? "—"} />
              <Info label="Date de soumission" value={submission ? formatDateTime(submission.created_at) : "—"} />
            </div>
          </Panel>

          {/* Activité / historique */}
          <Panel title="Activité & historique">
            {timeline.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-6 text-center text-xs text-[var(--crm-text-faint)]">
                Aucune activité pour l’instant. Enregistrez un appel ou une note ci-contre.
              </p>
            ) : (
              <div className="crm-timeline flex flex-col gap-4">
                {timeline.map((e) => (
                  <div key={e.key} className="relative">
                    <span className="crm-timeline-dot" aria-hidden />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--crm-text)]">{e.title}</span>
                      <span className="text-[11px] text-[var(--crm-text-faint)]">
                        {formatDateTime(e.at)}
                        {e.author ? ` · ${e.author}` : ""}
                        {e.source === "audit" ? " · audit" : ""}
                      </span>
                    </div>
                    {e.body ? <p className="mt-0.5 text-xs text-[var(--crm-text-dim)]">{e.body}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {isAdmin ? (
            <details className="crm-panel p-5">
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
                Zone technique (administrateur) — réponses brutes
              </summary>
              <p className="mt-2 text-[11px] text-[var(--crm-text-faint)]">
                Données brutes de la soumission (jamais l’interface principale). Réservé à
                l’administration.
              </p>
              <pre className="crm-scroll mt-3 max-h-72 overflow-auto rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3 text-[11px] text-[var(--crm-text-dim)]">
                {JSON.stringify(
                  { normalized_answers: submission?.normalized_answers, raw_answers: submission?.raw_answers },
                  null,
                  2,
                )}
              </pre>
            </details>
          ) : null}
        </div>

        {/* Colonne d’actions (setting) */}
        <aside className="flex flex-col gap-5">
          {canOp ? (
            <>
              <Panel title="Affectation">
                <AssignControl
                  opportunityId={o.id}
                  members={memberOptions}
                  assignedUserIds={assignedUserIds}
                />
                {assignees.length === 0 ? (
                  <p className="mt-2 text-[11px] text-[var(--color-danger-on-dark)]">
                    Ce lead n’a pas de responsable : file « Non affectés ».
                  </p>
                ) : null}
              </Panel>

              <Panel title="Stade du pipeline">
                <StageControl opportunityId={o.id} stage={o.pipeline_stage} />
              </Panel>

              <Panel title="Enregistrer une activité">
                <ActivityForm opportunityId={o.id} />
              </Panel>

              <Panel title="Prochaine action">
                <TaskForm opportunityId={o.id} members={memberOptions} />
                {openTasks.length > 0 ? (
                  <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--crm-line-soft)] pt-4">
                    {openTasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs text-[var(--crm-text)]">{t.title}</p>
                          {t.due_at ? (
                            <p className="text-[11px] text-[var(--crm-text-faint)]">
                              {formatDateTime(t.due_at)}
                            </p>
                          ) : null}
                        </div>
                        <TaskToggle taskId={t.id} status={t.status} opportunityId={o.id} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>

              <Panel title="Résultat commercial">
                {o.outcome ? (
                  <p className="mb-3 text-sm text-[var(--crm-text)]">
                    Actuel : {label(outcomeLabels, o.outcome)}
                    {o.outcome_reason ? ` — ${o.outcome_reason}` : ""}
                  </p>
                ) : null}
                <OutcomeForm opportunityId={o.id} />
              </Panel>
            </>
          ) : (
            <Panel title="Accès">
              <p className="text-sm text-[var(--crm-text-dim)]">
                Votre rôle donne un accès en lecture à ce dossier.
              </p>
            </Panel>
          )}

          {showAudit ? (
            <Panel title="Journal d’audit">
              {auditEvents.length === 0 ? (
                <p className="text-xs text-[var(--crm-text-faint)]">Aucun événement.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {auditEvents.slice(0, 8).map((e) => (
                    <li key={e.id} className="text-[11px] text-[var(--crm-text-dim)]">
                      <span className="text-[var(--crm-text)]">{label(
                        { changement_stade: "Stade", changement_segment: "Segment", changement_affectation: "Affectation", resultat_commercial: "Résultat", changement_permission: "Permission", creation: "Création", resolution_doublon: "Doublon" },
                        e.event_type,
                      )}</span>{" "}
                      · {formatDateTime(e.created_at)}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
