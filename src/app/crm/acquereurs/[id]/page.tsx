import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { requireCrmSession } from "@/modules/crm/auth/session";
import {
  canDecideMandate,
  canOperate,
  canTreatBuyers,
  canViewBuyerHistory,
  canViewContactDetails,
} from "@/modules/crm/auth/roles";
import { getBuyerProfileDetail } from "@/modules/buyers/crm/queries";
import { memberDisplayName } from "@/modules/crm/data/queries";
import { buyerAuditEventLabels, buyerStageVisual } from "@/modules/buyers/crm/labels";
import { formatCents } from "@/modules/buyers/crm/criteria";
import {
  BUDGET_CHOICE_COURT,
  BUDGET_CHOICE_LABELS,
  BUDGET_QUESTION,
  type BuyerBudgetChoice,
} from "@/modules/buyers/funnel/universal";
import {
  availabilityLabels,
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
import { SectionTitle } from "@/components/crm/ui";
import {
} from "@/modules/buyers/crm/qualification";
import { getMessagesForEntity } from "@/modules/communications/queries";
import { EntityCommunications } from "@/components/crm/communications/entity-communications";
import { CopyableValue } from "@/components/crm/copyable";
import { ContactRapide } from "@/components/crm/buyers/contact-rapide";
import type { BuyerInterestRow } from "@/lib/supabase/types";
import { numeroAppelable } from "@/modules/buyers/crm/telephone";
import { ecrireNavigation, lireVue } from "@/modules/buyers/crm/navigation";
import { PlanifierVisite } from "@/components/crm/buyers/planifier-visite";
import {
  BuyerActivityForm,
  BuyerAssignmentForm,
  BuyerOfferForm,
  BuyerOutcomeForm,
  BuyerReopenForm,
  BuyerTaskList,
} from "@/components/crm/buyers/buyer-actions";
import { SuiviCommercial } from "@/components/crm/buyers/suivi-commercial";
import { changementsLisibles } from "@/modules/buyers/crm/journal";
import { etatFigePertinent } from "@/modules/buyers/crm/reprise";
import { budgetARepeter } from "@/modules/buyers/crm/budget-affichage";

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
/**
 * L'état figé d'une manifestation, en texte.
 *
 * Ces colonnes sont gelées depuis la reprise du 14 octobre 2026 : elles ne
 * décrivent plus rien d'actuel. Affichées en badges, elles contredisaient
 * l'en-tête — Gilles « À rappeler » en haut, « À contacter » sur son bloc
 * Jean Jaurès. On les garde parce qu'elles racontent d'où l'on vient, mais au
 * passé et en petit : une date, une origine, aucune couleur de statut.
 *
 * Les libellés viennent du vocabulaire commun, qui traduit aussi les valeurs
 * disparues : « en_reflexion » n'existe plus, et l'afficher brut livrerait un
 * identifiant technique à un commercial.
 */


export default async function BuyerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  /*
   * Le retour reconduit a l'ECRAN D'OU L'ON VIENT : le projet selectionne et la
   * vue (liste ou pipeline) voyagent dans l'URL depuis la ligne cliquee. Sans
   * cela, revenir d'une fiche renvoyait a la liste complete, et il fallait
   * re-selectionner son projet a chaque dossier traite.
   *
   * Aucune validation des projets ici : ils ne servent qu'a reconstruire un
   * lien, et la page de destination les revalide contre ce que l'utilisateur a
   * reellement le droit de voir.
   */
  const nav = await searchParams;
  const vueRetour = lireVue(nav.vue);
  const projetsRetour = (() => {
    const brut = Array.isArray(nav.projets) ? nav.projets.join(",") : nav.projets ?? "";
    return brut.split(",").map((v) => v.trim()).filter(Boolean);
  })();
  const retour =
    (vueRetour === "pipeline" ? "/crm/acquereurs/pipeline" : "/crm/acquereurs") +
    ecrireNavigation({
      projets: projetsRetour,
      vue: vueRetour,
      signal: typeof nav.signal === "string" ? nav.signal : undefined,
    });
  const session = await requireCrmSession(`/crm/acquereurs/${id}`);
  const canViewContacts = canViewContactDetails(session.roles);
  const canOperateBuyers = canTreatBuyers(session.roles);
  /* Réaffecter — donner un dossier à quelqu'un, retirer celui d'un autre —
     reste un acte d'encadrement. Un commercial prend un dossier libre et rend
     le sien, rien de plus : entre deux associés, pouvoir se reprendre un
     dossier en silence est une source de conflit. */
  const canReassignBuyers = canOperate(session.roles);
  const canDecide = canDecideMandate(session.roles);
  const showAudit = canViewBuyerHistory(session.roles);

  const detail = await getBuyerProfileDetail(id, canViewContacts);
  // Dossier inexistant OU non autorisé : dans les deux cas rien n'est révélé.
  if (!detail) notFound();

  const communications = await getMessagesForEntity("buyer_profile", id, {
    canViewDetails: canViewContacts,
  });
  const { profile, interests, assignees, tasks, activities, auditEvents, auditIndisponible, members } =
    detail;

  /*
   * Tentatives et dernier appel PAR MANIFESTATION, dérivés des activités déjà
   * chargées — exactement comme la vue `crm_buyer_interest_activity` les agrège
   * pour la liste. Les deux affichages lisent donc le même fait : un appel
   * consigné depuis le panneau apparaît ici, et réciproquement.
   *
   * Un message n'est pas un appel : seuls `appel` et `tentative_appel` comptent.
   */
  const resumeParManifestation = new Map<
    string,
    { call_attempts: number; last_call_at: string | null }
  >();
  for (const a of activities) {
    if (!a.interest_id) continue;
    if (a.type !== "appel" && a.type !== "tentative_appel") continue;
    const actuel = resumeParManifestation.get(a.interest_id) ?? {
      call_attempts: 0,
      last_call_at: null,
    };
    actuel.call_attempts += 1;
    if (!actuel.last_call_at || a.occurred_at > actuel.last_call_at) {
      actuel.last_call_at = a.occurred_at;
    }
    resumeParManifestation.set(a.interest_id, actuel);
  }

  const stageV = buyerStageVisual(profile.pipeline_stage);
  const isClosed = profile.pipeline_stage === "gagne" || profile.pipeline_stage === "perdu";

  const interestProperties = [
    ...new Map(
      interests.map((i) => [i.interest.property_id, i.propertyLabel ?? "Bien sans nom"]),
    ),
  ].map(([id, label]) => ({ id, label }));

  const memberOptions = [...members.entries()].map(([userId, info]) => ({
    userId,
    name: memberDisplayName(userId, members),
  }));

  /* Donnees du bandeau de tete. Toutes viennent de ce qui est deja charge :
     rien n'est invente pour remplir la ligne. */
  const premierInteret = interests[0];
  const resumeBien = premierInteret?.propertyLabel ?? null;
  const choixBudget = premierInteret?.interest.budget_choice ?? null;
  const resumeBudget = choixBudget
    ? BUDGET_CHOICE_COURT[choixBudget as BuyerBudgetChoice] ?? choixBudget
    : null;
  // Prochaine action et retard : calcules par la requete (l'heure courante
  // n'a rien a faire dans le rendu).
  const prochaine = detail.nextTask;
  const prochaineEnRetard = detail.nextTaskOverdue;

  // Un numero masque n'est jamais composable : le composant le refuse.
  const appelable = numeroAppelable(detail.phone);

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------- En-tête */}
      {/*
        Bandeau de tete : tout ce qu'on doit savoir avant de decrocher le
        telephone — qui, a quelle etape, sur quel bien, avec quel budget, suivi
        par qui, et quoi faire ensuite. C'etait disperse sur trois sections et
        une colonne laterale ; il fallait faire defiler la page pour savoir s'il
        y avait une action en attente.
      */}
      <header className="crm-panel flex flex-col gap-3 p-4">
        <Link
          href={retour}
          className="w-fit text-xs font-medium text-[var(--crm-text-dim)] hover:text-[var(--crm-text)]"
        >
          ← {vueRetour === "pipeline" ? "Pipeline" : "Boîte de réception"}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="crm-display crm-wrap text-[26px] leading-tight text-[var(--crm-text)]">
              {detail.name}
            </h1>
            <p className="mt-0.5 text-[12.5px] text-[var(--crm-text-dim)]">
              {profile.interest_count} intérêt{profile.interest_count > 1 ? "s" : ""}
              {profile.last_interest_at ? ` · dernier ${timeSince(profile.last_interest_at)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="crm-chip crm-chip--accent"
              style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(stageV.cssVar) } as CSSProperties}
            >
              <span aria-hidden>{stageV.icon}</span>
              {stageV.label}
            </span>
          </div>
        </div>

        <dl className="crm-resume">
          <Resume label="Bien demandé">
            {resumeBien ?? <Absent>Aucun bien rattaché</Absent>}
          </Resume>
          <Resume label="Budget déclaré">
            {resumeBudget ? (
              <span className="font-semibold">{resumeBudget}</span>
            ) : (
              <Absent>Non renseigné</Absent>
            )}
          </Resume>
          <Resume label="Responsable">
            {assignees.length > 0 ? (
              assignees.map((a) => a.name).join(", ")
            ) : (
              <Absent>Non affecté</Absent>
            )}
          </Resume>
          <Resume label="Prochaine action">
            {prochaine ? (
              <span className={prochaineEnRetard ? "font-semibold text-[var(--crm-danger)]" : ""}>
                {prochaine.title}
                {prochaine.due_at ? ` · ${formatDateTime(prochaine.due_at)}` : ""}
              </span>
            ) : (
              <Absent>À programmer</Absent>
            )}
          </Resume>
        </dl>
      </header>

      {/* ------------------------------------------------- Suivi commercial
          Juste sous l'en-tête, avant tout le reste : c'est ce qu'on vient
          changer après un appel. Il vivait dans « Ce que la personne a
          déclaré », qui présente les RÉPONSES du prospect — un choix d'agence
          s'y lisait comme une déclaration du client. */}
      <SuiviCommercial
        buyerProfileId={profile.id}
        etape={profile.pipeline_stage}
        qualification={profile.qualification}
        qualificationReason={profile.qualification_reason}
        responsables={assignees.map((a) => a.name)}
        prochaine={
          prochaine
            ? {
                titre: prochaine.title,
                echeance: prochaine.due_at,
                responsable: prochaine.assignee_user_id
                  ? memberDisplayName(prochaine.assignee_user_id, members)
                  : null,
                enRetard: prochaineEnRetard,
              }
            : null
        }
        modifiable={canOperateBuyers && !isClosed}
      />

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ------------------------------------------------ Colonne principale */}
        <div className="flex flex-col gap-5">
          {/* Identité & coordonnées */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Personne" title="Identité et coordonnées" />
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Field label="Nom">{detail.name}</Field>
              <div className="min-w-0">
                <dt className="crm-label">Téléphone</dt>
                <dd className="crm-wrap text-[15.5px] font-semibold text-[var(--crm-text)]">
                  {detail.phone ? (
                    <CopyableValue
                      value={detail.phone}
                      copyable={canViewContacts ? detail.phone : null}
                      href={canViewContacts ? `tel:${detail.phone}` : undefined}
                    />
                  ) : (
                    "Non renseigné"
                  )}
                </dd>
              </div>
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
            {/* Memes boutons que la liste : le meme geste se fait de la meme
                maniere aux deux endroits. */}
            <ContactRapide numero={appelable} email={detail.email} className="mt-3" />
          </section>

          {/* ---- 2. LE CONTEXTE : ce qu'on doit savoir avant de parler ------
              La prochaine tâche se lit déjà dans le bloc commercial, juste
              au-dessus. Il manquait l'autre moitié : de quoi on a parlé la
              dernière fois. Elle vivait au milieu de l'historique complet,
              sous le formulaire de saisie — donc après tout ce qui sert à
              écrire, alors que c'est ce qu'on lit en premier. */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Contexte" title="Dernier échange" />
            {(() => {
              /* La plus récente, calculée et non supposée : l'ordre de la
                 requête n'est pas un contrat. */
              const dernier = [...activities].sort((a, b) =>
                (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""),
              )[0];
              if (!dernier) {
                return (
                  <p className="text-sm text-[var(--crm-text-dim)]">Aucun échange enregistré.</p>
                );
              }
              return (
                <>
                  <p className="text-sm text-[var(--crm-text)]">
                    {activityTypeLabels[dernier.type] ?? dernier.type}
                    {dernier.outcome
                      ? ` · ${activityOutcomeLabels[dernier.outcome] ?? dernier.outcome}`
                      : ""}
                    <span className="text-[var(--crm-text-faint)]">
                      {" "}
                      · {formatDateTime(dernier.occurred_at)}
                      {dernier.author_user_id
                        ? ` · ${memberDisplayName(dernier.author_user_id, members)}`
                        : ""}
                    </span>
                  </p>
                  {/* La note EN ENTIER : c'est elle qu'on relit avant de
                      décrocher, et une note coupée ne sert à rien. */}
                  {dernier.body ? (
                    <p className="crm-wrap mt-1.5 text-sm text-[var(--crm-text)]">{dernier.body}</p>
                  ) : null}
                </>
              );
            })()}
          </section>

          {/* ---- 3. ENREGISTRER UN ÉCHANGE ----------------------------------
              Le formulaire vivait DANS l'historique, au-dessus de la liste :
              écrire et relire au même endroit, sans que rien ne sépare les
              deux. Il a désormais son bloc, juste après ce qu'on vient de
              lire. */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Suivi" title="Enregistrer un échange" />
            {canOperateBuyers ? (
              <div className="mb-3">
                <BuyerActivityForm
                  buyerProfileId={profile.id}
                  interests={interests.map(({ interest, propertyLabel }) => ({
                    id: interest.id,
                    label: propertyLabel ?? "Bien sans nom",
                  }))}
                  members={memberOptions}
                />
              </div>
            ) : null}
          </section>

          {/* ---- 4. L'HISTORIQUE, après la saisie ---------------------------- */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Historique" title="Tous les échanges" />
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
              <SectionTitle eyebrow="Traçabilité" title="Ce qui a changé, et quand" />
              {auditIndisponible ? (
                /* Dire « Aucun événement » quand la base a REFUSÉ de répondre
                   envoie chercher un bug qui n'existe pas. */
                <p className="text-sm text-[var(--crm-text-dim)]">
                  Historique momentanément indisponible. Signalez-le, il ne manque rien aux
                  activités ci-dessus.
                </p>
              ) : auditEvents.length === 0 ? (
                <p className="text-sm text-[var(--crm-text-dim)]">Aucun événement.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {auditEvents.map((e) => (
                    <li key={e.id} className="flex flex-col gap-0.5 text-xs">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[var(--crm-text)]">
                          {buyerAuditEventLabels[e.event_type] ?? e.event_type}
                        </span>
                        <span className="text-[11px] text-[var(--crm-text-faint)]">
                          {formatDateTime(e.created_at)}
                          {e.actor_user_id ? ` · ${memberDisplayName(e.actor_user_id, members)}` : ""}
                        </span>
                      </div>
                      {/* CE QUI A CHANGÉ, et pas seulement qu'il s'est passé
                          quelque chose. « Traitement enregistré · 14:29 ·
                          Antoine » n'apprenait rien : on rouvrait le dossier
                          pour comparer de tête. Les anciennes et nouvelles
                          valeurs étaient déjà dans le journal, jamais lues. */}
                      {changementsLisibles(e.old_value, e.new_value).map((c) => (
                        <span key={c} className="crm-wrap text-[11.5px] text-[var(--crm-text-dim)]">
                          {c}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-[var(--crm-text-faint)]">
                Journal technique non modifiable, distinct des activités métier.
              </p>
            </section>
          ) : null}

          {/* ---- 5a. PLANIFIER UNE VISITE -----------------------------------
              C'etait un accordeon nomme « Ce que la personne a declare », qu'il
              fallait deplier pour atteindre le seul geste qu'il contenait
              vraiment : caler une visite. Le budget en est parti (l'en-tete le
              porte), et il ne restait qu'un couvercle sur une commande.
              C'est une section, elle porte le nom de ce qu'on y fait, et elle
              precede l'offre : on visite avant d'offrir. */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Action dédiée" title="Planifier une visite" />
            {interests.length === 0 ? (
              <p className="text-sm text-[var(--crm-text-dim)]">
                Aucun projet : il n&rsquo;y a rien à visiter tant qu&rsquo;aucun bien n&rsquo;est
                rattaché.
              </p>
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
                    </div>

                    {/* L'état d'AVANT la reprise, au passé et en petit — et
                        seulement pour les demandes qui l'ont réellement
                        traversée. Voir `etatFigePertinent`. */}
                    {(() => {
                      const fige = etatFigePertinent(i, profile);
                      return fige ? (
                        <p className="mt-1 text-[11px] text-[var(--crm-text-faint)]">
                          Avant la reprise du 14 octobre 2026, ce projet portait : {fige}
                        </p>
                      ) : null;
                    })()}

                    {/* Tentatives et dernier appel, PAR PROJET : c'est ce que le
                        panneau rapide affiche, et les deux lisent la meme
                        source. */}
                    <p className="mt-1 text-[12.5px] text-[var(--crm-text-faint)]">
                      {resumeParManifestation.get(i.id)?.call_attempts ?? 0} tentative
                      {(resumeParManifestation.get(i.id)?.call_attempts ?? 0) > 1 ? "s" : ""}
                      {resumeParManifestation.get(i.id)?.last_call_at
                        ? ` · dernier appel ${formatDateTime(resumeParManifestation.get(i.id)!.last_call_at!)}`
                        : ""}
                    </p>

                    {/* Le budget n'est PLUS repete ici. L'en-tete de la fiche
                        le porte deja, et le voir deux fois — trois, pour qui a
                        trois projets — n'apprenait rien.

                        Sauf quand il DIFFERE de celui de l'en-tete. Ca arrive :
                        Christiane DORAT a rempli trois formulaires le meme
                        jour, « 500 000 € – 1 M€ » puis « Plus d'1 M€ » deux
                        fois. L'en-tete montre sa reponse la plus recente ; le
                        fait qu'elle ait d'abord annonce moins se lit ici, et
                        nulle part ailleurs. */}
                    {budgetARepeter(i.budget_choice, choixBudget) ? (
                      <ReponseBudget choix={i.budget_choice} surCeBien />
                    ) : null}

                    {/* Les autres champs ne sont renseignes que par l'ancien
                        formulaire. Les afficher vides alignait huit tirets qui
                        n'apprenaient rien : on ne montre que ce qui a ete
                        reellement repondu. */}
                    <ReponsesComplementaires interet={i} />

                    {/* Caler la visite et deplacer l'etape se font PAR PROJET.
                        Ces deux commandes vivaient dans la colonne laterale et
                        agissaient sur « la personne » : caler une visite a
                        Verdun deplaçait aussi son interet Jean Jaures. */}
                    {canOperateBuyers && !isClosed ? (
                      <div className="mt-3 flex flex-col gap-3 border-t border-[var(--crm-line-soft)] pt-3">
                        <div>
                          <PlanifierVisite buyerProfileId={profile.id} interestId={i.id} />
                        </div>
                      </div>
                    ) : null}


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

          {/* ---- 5. Visites et offres ---------------------------------------- */}
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

          {/* ---- 6. D'où elle vient : replié.
              On le consulte une fois, au premier appel ; le garder déplié
              coûtait un défilement à chaque ouverture de fiche. */}

          {/* Attribution marketing consolidée du dossier */}
          <details className="crm-panel crm-repli p-4">
            <summary className="crm-repli__titre">Attribution marketing</summary>
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
          </details>
        </div>

        {/* ------------------------------------------------- Colonne latérale */}
        <div className="flex flex-col gap-5">
          {/* Un RÉSUMÉ, plus un formulaire. Programmer la suite se fait là où
              l'on consigne l'échange : deux endroits pour poser un rappel,
              c'était une décision saisie deux fois — et deux rappels quand on
              oubliait l'avoir déjà posé ailleurs. */}
          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Suivi" title="Tâches ouvertes" />
            {canOperateBuyers ? (
              <BuyerTaskList buyerProfileId={profile.id} tasks={tasks} />
            ) : (
              <p className="text-sm text-[var(--crm-text-dim)]">
                {tasks.length} tâche{tasks.length > 1 ? "s" : ""}.
              </p>
            )}
          </section>

          <section className="crm-panel p-4">
            <SectionTitle eyebrow="Équipe" title="Affectation" />
            <BuyerAssignmentForm
              buyerProfileId={profile.id}
              assignees={assignees}
              members={memberOptions}
              canAssign={canReassignBuyers}
              canSelfAssign={canOperateBuyers}
              currentUserId={session.userId}
            />
          </section>

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

        </div>
      </div>
    </div>
  );
}

/**
 * La reponse au questionnaire budget — la seule question posee par le
 * formulaire, et la premiere chose qu'on veut savoir avant d'appeler.
 *
 * Elle etait lue dans `budget_band`, un champ que le formulaire universel ne
 * remplit JAMAIS : la fiche affichait donc un tiret alors que la reponse etait
 * bien en base, dans `budget_choice`. On rappelle aussi la question posee :
 * « pas de projet » est une reponse pleine, pas une absence de reponse.
 */
function ReponseBudget({
  choix,
  surCeBien = false,
}: {
  choix: string | null;
  /** Vrai quand la reponse de ce bien DIFFERE de celle portee par l'en-tete. */
  surCeBien?: boolean;
}) {
  if (!choix) return null;
  const libelle = BUDGET_CHOICE_LABELS[choix as BuyerBudgetChoice] ?? choix;
  const sansProjet = choix === "aucun_projet";
  return (
    <div
      className="crm-panel mt-3 p-3.5"
      style={{
        ["--chip-accent" as keyof CSSProperties]: sansProjet
          ? "var(--crm-st-neutre)"
          : "var(--crm-st-signe)",
      } as CSSProperties}
    >
      <p className="crm-label">
        {surCeBien ? `Sur ce bien — ${BUDGET_QUESTION}` : BUDGET_QUESTION}
      </p>
      <p
        className="crm-wrap mt-1 text-[17px] font-bold leading-snug"
        style={{
          color: sansProjet ? "var(--crm-text-dim)" : "var(--crm-st-signe)",
        }}
      >
        {libelle}
      </p>
    </div>
  );
}

/**
 * Champs de l'ANCIEN formulaire. Le formulaire universel ne les demande pas :
 * les afficher vides alignait huit tirets qui n'apprenaient rien. On ne montre
 * donc que ce qui a ete reellement repondu, et rien du tout sinon.
 */
function ReponsesComplementaires({
  interet: i,
}: {
  interet: BuyerInterestRow;
}) {
  const lignes: { label: string; valeur: string }[] = [];
  const ajouter = (label: string, valeur: string | null | undefined) => {
    if (valeur) lignes.push({ label, valeur });
  };
  ajouter("Projet", label(projectNatureLabels, i.project_nature));
  ajouter("Financement", label(financingLabels, i.financing));
  ajouter("Horizon", label(purchaseHorizonLabels, i.purchase_horizon));
  ajouter("Disponibilité", label(availabilityLabels, i.availability));
  ajouter("Décision", label(decisionModeLabels, i.decision_mode));
  ajouter("Résidence", [i.residence_area, i.residence_country].filter(Boolean).join(", "));
  ajouter(
    "Préférence de contact",
    [
      label(contactPreferenceLabels, i.contact_preference),
      label(recallPreferenceLabels, i.contact_recall_preference),
    ]
      .filter(Boolean)
      .join(" · "),
  );
  if (lignes.length === 0) return null;
  return (
    <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {lignes.map((l) => (
        <Field key={l.label} label={l.label} small>
          {l.valeur}
        </Field>
      ))}
    </dl>
  );
}

/** Une case du bandeau de tete : une etiquette, une valeur, rien de plus. */
function Resume({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="crm-ligne__ent">{label}</dt>
      <dd className="crm-wrap text-[13.5px] text-[var(--crm-text)]">{children}</dd>
    </div>
  );
}

/** Donnee absente : on l'ecrit, on ne laisse pas une case vide. */
function Absent({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--crm-text-faint)]">{children}</span>;
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
