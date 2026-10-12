import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { requireCrmSession } from "@/modules/crm/auth/session";
import {
  canDecideMandate,
  canTreatBuyers,
  canViewAudit,
  canViewContactDetails,
} from "@/modules/crm/auth/roles";
import { getBuyerProfileDetail } from "@/modules/buyers/crm/queries";
import { memberDisplayName } from "@/modules/crm/data/queries";
import { buyerAuditEventLabels, buyerStageVisual } from "@/modules/buyers/crm/labels";
import { formatCents } from "@/modules/buyers/crm/criteria";
import {
  availabilityLabels,
  budgetBandLabels,
  contactPreferenceLabels,
  decisionModeLabels,
  financingLabels,
  projectNatureLabels,
  purchaseHorizonLabels,
  recallPreferenceLabels,
} from "@/modules/buyers/funnel/content";
import { activityOutcomeLabels, activityTypeLabels } from "@/modules/crm/labels";
import { formatDateTime, timeSince } from "@/modules/crm/format";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { Chip, SectionTitle } from "@/components/crm/ui";
import { getMessagesForEntity } from "@/modules/communications/queries";
import { EntityCommunications } from "@/components/crm/communications/entity-communications";
import { CopyableValue } from "@/components/crm/copyable";
import { ContactRapide } from "@/components/crm/buyers/contact-rapide";
import { numeroAppelable } from "@/modules/buyers/crm/telephone";
import { PlanifierVisite } from "@/components/crm/buyers/planifier-visite";
import {
  BuyerActivityForm,
  BuyerAssignmentForm,
  BuyerOfferForm,
  BuyerOutcomeForm,
  BuyerReopenForm,
  BuyerStageForm,
  BuyerTaskForm,
} from "@/components/crm/buyers/buyer-actions";

export const metadata: Metadata = { title: "Fiche acquéreur" };

function label(map: Record<string, string>, v: string | null | undefined): string | null {
  if (!v) return null;
  return map[v] ?? v;
}

/**
 * Fiche acquéreur consolidée : identité, qualification, critères, intérêts par
 * bien, réponses détaillées du funnel, scores explicités, attribution,
 * affectation, prochaine action, tâches, activités, notes et historique audité.
 *
 * Toutes les données proviennent de requêtes soumises à la RLS ; les
 * coordonnées sont masquées côté serveur selon le rôle.
 */
export default async function BuyerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireCrmSession(`/crm/acquereurs/${id}`);
  const canViewContacts = canViewContactDetails(session.roles);
  const canOperateBuyers = canTreatBuyers(session.roles);
  const canDecide = canDecideMandate(session.roles);
  const showAudit = canViewAudit(session.roles);

  const detail = await getBuyerProfileDetail(id, canViewContacts);
  // Dossier inexistant OU non autorisé : dans les deux cas rien n'est révélé.
  if (!detail) notFound();

  const communications = await getMessagesForEntity("buyer_profile", id, {
    canViewDetails: canViewContacts,
  });
  const { profile, interests, assignees, tasks, activities, auditEvents, members } = detail;

  const stageV = buyerStageVisual(profile.pipeline_stage);
  const isClosed = profile.pipeline_stage === "gagne" || profile.pipeline_stage === "perdu";

  const interestProperties = [
    ...new Map(
      interests.map((i) => [i.interest.property_id, i.propertyLabel ?? "Bien sans nom"]),
    ),
  ].map(([id, label]) => ({ id, label }));

  const memberOptions = [...members.entries()].map(([userId, info]) => ({
    userId,
    name: info.email ? info.email.split("@")[0] || info.email : `Membre ${userId.slice(0, 6)}`,
  }));

  // Un numero masque n'est jamais composable : le composant le refuse.
  const appelable = numeroAppelable(detail.phone);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {/* ------------------------------------------------------------- En-tête */}
      <header className="flex flex-col gap-3">
        <Link href="/crm/acquereurs" className="text-xs text-[var(--crm-text-faint)] hover:text-[var(--crm-text)]">
          ← Boîte de réception acquéreurs
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="crm-eyebrow">Dossier acquéreur</p>
            <h1 className="mt-1 crm-wrap text-2xl font-semibold text-[var(--crm-text)]">
              {detail.name}
            </h1>
            <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
              {profile.interest_count} intérêt{profile.interest_count > 1 ? "s" : ""}
              {profile.first_interest_at
                ? ` · premier intérêt ${timeSince(profile.first_interest_at)}`
                : ""}
              {profile.last_interest_at
                ? ` · dernier ${timeSince(profile.last_interest_at)}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="crm-chip crm-chip--accent"
              style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(stageV.cssVar) } as CSSProperties}
            >
              <span aria-hidden>{stageV.icon}</span>
              {stageV.label}
            </span>
          </div>
        </div>
      </header>

      {profile.outcome ? (
        <div className="rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] p-3">
          <p className="text-sm text-[var(--crm-text)]">
            Dossier clos — <strong>{profile.outcome === "gagne" ? "Acquéreur gagné" : "Perdu"}</strong>
            {profile.outcome_reason ? ` : ${profile.outcome_reason}` : ""}
          </p>
          {profile.outcome_recorded_at ? (
            <p className="mt-0.5 text-[11px] text-[var(--crm-text-faint)]">
              Enregistré le {formatDateTime(profile.outcome_recorded_at)}
              {profile.outcome_recorded_by
                ? ` par ${memberDisplayName(profile.outcome_recorded_by, members)}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------ Colonne principale */}
        <div className="flex flex-col gap-5">
          {/* Identité & coordonnées */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Personne" title="Identité et coordonnées" />
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Field label="Nom">{detail.name}</Field>
              <Field label="Téléphone">
                {detail.phone ? (
                  <CopyableValue
                    value={detail.phone}
                    copyable={canViewContacts ? detail.phone : null}
                    href={canViewContacts ? `tel:${detail.phone}` : undefined}
                  />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="E-mail">
                {detail.email ? (
                  <CopyableValue
                    value={detail.email}
                    copyable={canViewContacts ? detail.email : null}
                    href={canViewContacts ? `mailto:${detail.email}` : undefined}
                  />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Contact enregistré">
                {detail.contact ? `depuis le ${formatDateTime(detail.contact.created_at)}` : "—"}
              </Field>
            </dl>
            {appelable ? <ContactRapide numero={appelable} className="mt-3" /> : null}
            <p className="mt-2 text-[11px] text-[var(--crm-text-faint)]">
              Ce dossier réutilise la fiche contact existante de la personne. Si elle est aussi
              vendeuse, ses données issues du parcours vendeur restent intactes : elles ne sont
              jamais écrasées par une manifestation d’intérêt acquéreur.
            </p>
          </section>

          {/* Intérêts par bien */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Demande" title="Ce que la personne a déclaré" />
            {interests.length === 0 ? (
              <p className="text-sm text-[var(--crm-text-dim)]">Aucun intérêt enregistré.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {interests.map(({ interest: i, propertyLabel, propertyCity }) => (
                  <li
                    key={i.id}
                    className="rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/crm/biens/${i.property_id}?interet=${i.id}`}
                          className="crm-wrap text-sm font-medium text-[var(--crm-text)] hover:text-[var(--crm-gold)]"
                        >
                          {propertyLabel ?? "Bien sans nom"}
                        </Link>
                        <p className="text-[11px] text-[var(--crm-text-faint)]">
                          {propertyCity ? `${propertyCity} · ` : ""}
                          {formatDateTime(i.created_at)}
                        </p>
                      </div>
                      <Chip variant={i.review_status === "nouveau" ? "gold" : "neutral"}>
                        {i.review_status === "nouveau"
                          ? "Nouveau"
                          : i.review_status === "consulte"
                            ? "Consulté"
                            : "Traité"}
                      </Chip>
                    </div>

                    {/* Réponses détaillées du funnel */}
                    <dl className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                      <Field label="Projet" small>{label(projectNatureLabels, i.project_nature) ?? "—"}</Field>
                      <Field label="Budget déclaré" small>{label(budgetBandLabels, i.budget_band) ?? "—"}</Field>
                      <Field label="Financement" small>{label(financingLabels, i.financing) ?? "—"}</Field>
                      <Field label="Horizon" small>{label(purchaseHorizonLabels, i.purchase_horizon) ?? "—"}</Field>
                      <Field label="Disponibilité" small>{label(availabilityLabels, i.availability) ?? "—"}</Field>
                      <Field label="Décision" small>{label(decisionModeLabels, i.decision_mode) ?? "—"}</Field>
                      <Field label="Résidence" small>
                        {[i.residence_area, i.residence_country].filter(Boolean).join(", ") || "—"}
                      </Field>
                      <Field label="Préférence de contact" small>
                        {[
                          label(contactPreferenceLabels, i.contact_preference),
                          label(recallPreferenceLabels, i.contact_recall_preference),
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Field>
                    </dl>


                    {/* Attribution marketing de CETTE soumission */}
                    {[i.utm_source, i.utm_campaign, i.utm_term, i.utm_content].some(Boolean) ? (
                      <p className="mt-1 text-[11px] text-[var(--crm-text-faint)]">
                        Acquisition —{" "}
                        {[
                          i.utm_source ? `source : ${i.utm_source}` : null,
                          i.utm_campaign ? `campagne : ${i.utm_campaign}` : null,
                          i.utm_term ? `ensemble : ${i.utm_term}` : null,
                          i.utm_content ? `publicité : ${i.utm_content}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Activités & notes */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Suivi" title="Activités et notes internes" />
            {canOperateBuyers ? (
              <div className="mb-3">
                <BuyerActivityForm buyerProfileId={profile.id} />
              </div>
            ) : null}
            {activities.length === 0 ? (
              <p className="text-sm text-[var(--crm-text-dim)]">Aucune activité enregistrée.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {activities.map((a) => (
                  <li key={a.id} className="border-l-2 border-[var(--crm-line)] pl-3">
                    <p className="text-xs text-[var(--crm-text)]">
                      {activityTypeLabels[a.type] ?? a.type}
                      {a.outcome ? ` · ${activityOutcomeLabels[a.outcome] ?? a.outcome}` : ""}
                    </p>
                    {a.body ? (
                      <p className="crm-wrap mt-0.5 text-xs text-[var(--crm-text-dim)]">{a.body}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-[var(--crm-text-faint)]">
                      {formatDateTime(a.occurred_at)}
                      {a.author_user_id ? ` · ${memberDisplayName(a.author_user_id, members)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Communications adressées à cette personne */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Communications" title="Messages envoyés à cette personne" />
            <EntityCommunications
              items={communications}
              emptyHint="Aucun message n'a encore été préparé pour ce dossier acquéreur."
            />
          </section>

          {/* Historique audité */}
          {showAudit ? (
            <section className="crm-panel p-4">
              <SectionTitle eyebrow="Traçabilité" title="Historique audité" />
              {auditEvents.length === 0 ? (
                <p className="text-sm text-[var(--crm-text-dim)]">Aucun événement.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {auditEvents.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                      <span className="text-[var(--crm-text)]">
                        {buyerAuditEventLabels[e.event_type] ?? e.event_type}
                      </span>
                      <span className="text-[11px] text-[var(--crm-text-faint)]">
                        {formatDateTime(e.created_at)}
                        {e.actor_user_id ? ` · ${memberDisplayName(e.actor_user_id, members)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-[var(--crm-text-faint)]">
                Journal technique non modifiable, distinct des activités métier.
              </p>
            </section>
          ) : null}
        </div>

        {/* ------------------------------------------------- Colonne latérale */}
        <div className="flex flex-col gap-5">
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Rendez-vous" title="Planifier la visite" />
            {canOperateBuyers ? (
              <PlanifierVisite buyerProfileId={profile.id} />
            ) : (
              <p className="text-sm text-[var(--crm-text-dim)]">
                Vous n’avez pas les droits pour planifier une visite sur ce dossier.
              </p>
            )}
          </section>

          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Pipeline" title="Étape commerciale" />
            {canOperateBuyers ? (
              <BuyerStageForm buyerProfileId={profile.id} stage={profile.pipeline_stage} />
            ) : (
              <p className="text-sm text-[var(--crm-text-dim)]">{stageV.label}</p>
            )}
          </section>

          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Équipe" title="Affectation" />
            <BuyerAssignmentForm
              buyerProfileId={profile.id}
              assignees={assignees}
              members={memberOptions}
              canAssign={canOperateBuyers}
            />
          </section>

          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Suivi" title="Prochaine action et tâches" />
            {canOperateBuyers ? (
              <BuyerTaskForm buyerProfileId={profile.id} tasks={tasks} />
            ) : (
              <p className="text-sm text-[var(--crm-text-dim)]">
                {tasks.length} tâche{tasks.length > 1 ? "s" : ""}.
              </p>
            )}
          </section>

          {/* Actions métier dédiées (jamais un simple changement d'étape) */}
          {canOperateBuyers && !isClosed ? (
            <section className="crm-panel p-4">
              <SectionTitle eyebrow="Action dédiée" title="Offre en cours" />
              {profile.offer_recorded_at ? (
                <p className="mb-2 text-xs text-[var(--crm-text-dim)]">
                  Offre enregistrée le {formatDateTime(profile.offer_recorded_at)}
                  {detail.offerPropertyLabel ? ` sur ${detail.offerPropertyLabel}` : ""}
                  {profile.offer_amount_cents != null
                    ? ` · ${formatCents(profile.offer_amount_cents)}`
                    : ""}
                </p>
              ) : null}
              <BuyerOfferForm buyerProfileId={profile.id} properties={interestProperties} />
            </section>
          ) : null}

          {canDecide && !isClosed ? (
            <section className="crm-panel p-4">
              <SectionTitle eyebrow="Action dédiée" title="Résultat commercial" />
              <BuyerOutcomeForm buyerProfileId={profile.id} />
            </section>
          ) : null}

          {canDecide && isClosed ? (
            <section className="crm-panel p-4">
              <SectionTitle eyebrow="Action dédiée" title="Rouvrir le dossier" />
              <BuyerReopenForm buyerProfileId={profile.id} />
            </section>
          ) : null}

          {/* Attribution marketing consolidée du dossier */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Origine" title="Attribution marketing" />
            <dl className="grid grid-cols-1 gap-1.5 text-xs">
              <Field label="Source" small>{profile.utm_source ?? "Non renseignée"}</Field>
              <Field label="Campagne" small>{profile.utm_campaign ?? "Non renseignée"}</Field>
              <Field label="Ensemble de pubs" small>{profile.utm_term ?? "Non renseigné"}</Field>
              <Field label="Publicité" small>{profile.utm_content ?? "Non renseignée"}</Field>
              <Field label="Funnel d’origine" small>{profile.origin_funnel_key ?? "—"}</Field>
            </dl>
            <p className="mt-2 text-[11px] text-[var(--crm-text-faint)]">
              Attribution du premier contact. L’historique complet, point de contact par point de
              contact, reste conservé sur chaque intérêt : il n’est jamais écrasé.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  small,
}: {
  label: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="crm-label">{label}</dt>
      <dd className={`crm-wrap ${small ? "text-xs" : "text-sm"} text-[var(--crm-text)]`}>
        {children}
      </dd>
    </div>
  );
}
