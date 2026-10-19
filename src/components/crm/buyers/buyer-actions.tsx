"use client";

import { useState } from "react";
import {
  assignBuyerAction,
  enregistrerTraitementAction,
  qualifyBuyerAction,
  recordBuyerOfferAction,
  recordBuyerOutcomeAction,
  reopenBuyerAction,
  releaseBuyerAction,
  selfAssignBuyerAction,
  setBuyerStageAction,
  setBuyerTaskStatusAction,
  updateBuyerTaskAction,
  unassignBuyerAction,
  upsertBuyerCriteriaAction,
} from "@/modules/buyers/crm/actions";
import {
  buyerQualificationLabels,
  buyerResponsibilityLabels,
  buyerStageLabels,
} from "@/modules/buyers/crm/labels";
import { movableBuyerStages } from "@/modules/buyers/crm/pipeline";
import {
  BlocActivite,
  BlocProchaineAction,
  ChoixProjet,
  dansNJours,
  depuisChampLocal,
  maintenantLocal,
  type TypeProchaineAction,
} from "./choix-vocabulaire";
import { centsToEuros, parseList } from "@/modules/buyers/crm/criteria";
import { FieldError, Saved, parseNumber, useAction } from "@/components/crm/property/shared";
import type {
  BuyerQualificationStatus,
  BuyerSearchCriteriaRow,
  TaskRow,
} from "@/lib/supabase/types";

/**
 * Actions client de la fiche acquéreur. Chacune délègue à une action serveur qui
 * délègue elle-même à une fonction SQL SECURITY DEFINER : **la base fait
 * autorité** (rôle, règles métier, audit). Ici on ne fait que collecter la
 * saisie, exiger une confirmation pour les actions sensibles, et afficher un
 * message neutre en cas de refus.
 */

// ------------------------------------------------------------ Qualification
export function BuyerQualificationForm({
  buyerProfileId,
  status,
  reason,
}: {
  buyerProfileId: string;
  status: string;
  reason: string | null;
}) {
  const { pending, error, done, run } = useAction();
  const [next, setNext] = useState(status);
  const [why, setWhy] = useState(reason ?? "");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Qualification (décision humaine)</span>
          <select
            className="crm-select"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-label="Statut de qualification"
          >
            {(Object.keys(buyerQualificationLabels) as BuyerQualificationStatus[]).map((k) => (
              <option key={k} value={k}>
                {buyerQualificationLabels[k]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="crm-btn crm-btn--sm crm-btn--primaire"
          disabled={pending}
          onClick={() =>
            run(() =>
              qualifyBuyerAction({ buyerProfileId, status: next, reason: why.trim() || null }),
            )
          }
        >
          {pending ? "…" : "Enregistrer"}
        </button>
        <Saved show={done} />
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">
          Motif {next === "ecarte" ? "(obligatoire pour écarter)" : "(facultatif)"}
        </span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Ce qui justifie cette décision…"
        />
      </label>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        La qualification est une décision humaine : elle ne se déduit jamais du score automatique
        ni de la recommandation opérationnelle.
      </p>
      <FieldError error={error} />
    </div>
  );
}

// -------------------------------------------------------------------- Étape
/**
 * Étape commerciale d'UNE manifestation.
 *
 * Elle portait sur la personne : déplacer quelqu'un vers « Visite » déplaçait
 * tous ses projets d'un coup. Elle porte maintenant sur le projet concerné.
 */
export function BuyerStageForm({
  buyerProfileId,
  interestId,
  stage,
}: {
  buyerProfileId: string;
  interestId: string;
  stage: string;
}) {
  const { pending, error, done, run } = useAction();
  const targets = movableBuyerStages(stage);

  if (targets.length === 0) {
    return (
      <p className="text-xs text-[var(--crm-text-dim)]">
        Ce dossier est clos. Sa réouverture est une décision tracée (voir ci-dessous).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 items-center gap-1.5">
          <span className="crm-label shrink-0">Étape</span>
          <select
            className="crm-select"
            value=""
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              e.currentTarget.selectedIndex = 0;
              if (v) run(() => setBuyerStageAction({ buyerProfileId, interestId, stage: v }));
            }}
            aria-label="Déplacer vers une étape"
          >
            <option value="">Déplacer vers…</option>
            {targets.map((s) => (
              <option key={s} value={s}>
                {buyerStageLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <Saved show={done} />
      </div>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        L&rsquo;étape est commune à la personne : elle change aussi dans la liste et le
        pipeline. Visites, offres et issue commerciale restent attachées au bien concerné.
      </p>
      <FieldError error={error} />
    </div>
  );
}

// -------------------------------------------------------------- Affectation
/**
 * Deux droits distincts, et c'est volontaire.
 *
 *  • `canAssign` — RÉAFFECTER : donner le dossier à quelqu'un, ou retirer
 *    celui d'un autre. Acte d'encadrement, réservé à l'agence. Entre deux
 *    associés qui se répartissent un portefeuille, pouvoir se reprendre un
 *    dossier sans que l'autre le sache est une source de conflit, pas un
 *    confort.
 *  • `canSelfAssign` — PRENDRE un dossier que personne ne suit, et rendre le
 *    sien. Acte de travail, ouvert à qui traite les dossiers.
 *
 * Le serveur applique la même séparation : afficher ou cacher un bouton n'a
 * jamais protégé quoi que ce soit.
 */
export function BuyerAssignmentForm({
  buyerProfileId,
  assignees,
  members,
  canAssign,
  canSelfAssign = false,
  currentUserId = null,
}: {
  buyerProfileId: string;
  assignees: { userId: string; name: string; responsibility: string }[];
  members: { userId: string; name: string }[];
  canAssign: boolean;
  canSelfAssign?: boolean;
  currentUserId?: string | null;
}) {
  const { pending, error, done, run } = useAction();
  const [userId, setUserId] = useState("");
  const [responsibility, setResponsibility] = useState("setter");

  return (
    <div className="flex flex-col gap-2">
      {assignees.length === 0 ? (
        <p className="text-xs text-[var(--crm-text-dim)]">Aucun responsable affecté.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {assignees.map((a) => (
            <li key={a.userId} className="crm-chip">
              {a.name} · {buyerResponsibilityLabels[a.responsibility] ?? a.responsibility}
              {canAssign ? (
                <button
                  type="button"
                  className="ml-1.5 text-[var(--crm-danger)]"
                  aria-label={`Retirer ${a.name}`}
                  disabled={pending}
                  onClick={() => run(() => unassignBuyerAction({ buyerProfileId, userId: a.userId }))}
                >
                  ✕
                </button>
              ) : canSelfAssign && a.userId === currentUserId ? (
                /* Rendre LE SIEN : un dossier pris par erreur ne doit pas
                   obliger à appeler l'agence. */
                <button
                  type="button"
                  className="ml-1.5 text-[var(--crm-danger)]"
                  aria-label="Rendre ce dossier"
                  disabled={pending}
                  onClick={() => run(() => releaseBuyerAction({ buyerProfileId }))}
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canAssign ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Affecter à</span>
            <select
              className="crm-select"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              aria-label="Membre à affecter"
            >
              <option value="">Choisir un membre…</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Responsabilité</span>
            <select
              className="crm-select"
              value={responsibility}
              onChange={(e) => setResponsibility(e.target.value)}
              aria-label="Responsabilité"
            >
              {Object.entries(buyerResponsibilityLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            disabled={pending || !userId}
            onClick={() => run(() => assignBuyerAction({ buyerProfileId, userId, responsibility }))}
          >
            Affecter
          </button>
          <Saved show={done} />
        </div>
      ) : null}

      {/* « M'attribuer » vit HORS du bloc de réaffectation : un commercial y a
          droit, au menu « Affecter à » non. Et il ne sert à rien quand le
          dossier a déjà un responsable. */}
      {canSelfAssign && assignees.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            disabled={pending}
            onClick={() => run(() => selfAssignBuyerAction({ buyerProfileId }))}
          >
            M’attribuer ce lead
          </button>
          <Saved show={done} />
        </div>
      ) : null}
      <FieldError error={error} />
    </div>
  );
}

// ----------------------------------------------------------------- Critères
export function BuyerCriteriaForm({
  buyerProfileId,
  criteria,
}: {
  buyerProfileId: string;
  criteria: BuyerSearchCriteriaRow | null;
}) {
  const { pending, error, done, run } = useAction();
  const [types, setTypes] = useState((criteria?.property_types ?? []).join(", "));
  const [locations, setLocations] = useState((criteria?.locations ?? []).join(", "));
  const [min, setMin] = useState(String(centsToEuros(criteria?.budget_min_cents) ?? ""));
  const [max, setMax] = useState(String(centsToEuros(criteria?.budget_max_cents) ?? ""));
  const [notes, setNotes] = useState(criteria?.notes ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const minValue = parseNumber(min);
    const maxValue = parseNumber(max);
    if (minValue === undefined || maxValue === undefined) {
      setLocalError("Budget invalide : saisissez un montant en euros.");
      return;
    }
    setLocalError(null);
    run(() =>
      upsertBuyerCriteriaAction({
        buyerProfileId,
        propertyTypes: parseList(types),
        locations: parseList(locations, true),
        budgetMinEuros: minValue,
        budgetMaxEuros: maxValue,
        purchaseHorizon: criteria?.purchase_horizon ?? null,
        financing: criteria?.financing ?? null,
        projectNature: criteria?.project_nature ?? null,
        decisionMode: criteria?.decision_mode ?? null,
        notes: notes.trim() || null,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Types de biens recherchés</span>
          <input
            className="crm-input"
            value={types}
            onChange={(e) => setTypes(e.target.value)}
            placeholder="villa_architecte, chalet…"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Localisations souhaitées</span>
          <input
            className="crm-input"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="megève, courchevel…"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Budget minimal (€)</span>
          <input
            className="crm-input"
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="Non renseigné"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Budget maximal (€)</span>
          <input
            className="crm-input"
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="Non renseigné"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Notes internes sur la recherche</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="crm-btn crm-btn--sm" disabled={pending} onClick={submit}>
          {pending ? "…" : "Enregistrer les critères"}
        </button>
        <Saved show={done} />
      </div>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        {criteria?.source === "humain"
          ? "Ces critères ont été affinés par l’équipe : ils ne seront plus écrasés par un nouvel intérêt."
          : "Ces critères sont amorcés depuis le funnel. Dès votre première modification, ils sont verrouillés et ne seront plus écrasés automatiquement."}
      </p>
      <FieldError error={localError ?? error} />
    </div>
  );
}

// ----------------------------------------------------- Offre / résultat / réouverture
export function BuyerOfferForm({ buyerProfileId, properties }: {
  buyerProfileId: string;
  properties: { id: string; label: string }[];
}) {
  const { pending, error, done, run } = useAction();
  const [propertyId, setPropertyId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const value = parseNumber(amount);
    if (value === undefined) {
      setLocalError("Montant invalide.");
      return;
    }
    setLocalError(null);
    setConfirming(false);
    run(() =>
      recordBuyerOfferAction({
        buyerProfileId,
        propertyId: propertyId || null,
        amountEuros: value,
        note: note.trim() || null,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Bien concerné</span>
          <select
            className="crm-select"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            aria-label="Bien concerné par l’offre"
          >
            <option value="">Non précisé</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Montant de l’offre (€)</span>
          <input
            className="crm-input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Facultatif"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Commentaire</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] p-2">
          <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
            Confirmer le passage du dossier en « Offre en cours » ? L’action est tracée dans le
            journal d’audit.
          </p>
          <button type="button" className="crm-btn crm-btn--sm crm-btn--primaire" disabled={pending} onClick={submit}>
            Confirmer
          </button>
          <button
            type="button"
            className="crm-btn crm-btn--sm crm-btn--ghost"
            onClick={() => setConfirming(false)}
          >
            Annuler
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Enregistrer une offre
          </button>
          <Saved show={done} />
        </div>
      )}
      <FieldError error={localError ?? error} />
    </div>
  );
}

export function BuyerOutcomeForm({ buyerProfileId }: { buyerProfileId: string }) {
  const { pending, error, done, run } = useAction();
  const [outcome, setOutcome] = useState<"gagne" | "perdu">("gagne");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (outcome === "perdu" && !reason.trim()) {
      setLocalError("Un motif de perte est obligatoire.");
      setConfirming(false);
      return;
    }
    setLocalError(null);
    setConfirming(false);
    run(() => recordBuyerOutcomeAction({ buyerProfileId, outcome, reason: reason.trim() || null }));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Résultat commercial</span>
          <select
            className="crm-select"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as "gagne" | "perdu")}
            aria-label="Résultat commercial"
          >
            <option value="gagne">Acquéreur gagné</option>
            <option value="perdu">Perdu</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">
          Motif {outcome === "perdu" ? "(obligatoire)" : "(facultatif)"}
        </span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={outcome === "perdu" ? "Pourquoi ce dossier est-il perdu ?" : ""}
        />
      </label>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] p-2">
          <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
            Confirmer la clôture du dossier en « {outcome === "gagne" ? "gagné" : "perdu"} » ?
            L’action est tracée dans le journal d’audit.
          </p>
          <button type="button" className="crm-btn crm-btn--sm crm-btn--primaire" disabled={pending} onClick={submit}>
            Confirmer
          </button>
          <button type="button" className="crm-btn crm-btn--sm crm-btn--ghost" onClick={() => setConfirming(false)}>
            Annuler
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" className="crm-btn crm-btn--sm" disabled={pending} onClick={() => setConfirming(true)}>
            Clore le dossier
          </button>
          <Saved show={done} />
        </div>
      )}
      <FieldError error={localError ?? error} />
    </div>
  );
}

export function BuyerReopenForm({ buyerProfileId }: { buyerProfileId: string }) {
  const { pending, error, done, run } = useAction();
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="crm-label">Motif de réouverture (obligatoire)</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--sm"
          disabled={pending || !reason.trim()}
          onClick={() => run(() => reopenBuyerAction({ buyerProfileId, reason: reason.trim() }))}
        >
          Rouvrir le dossier
        </button>
        <Saved show={done} />
      </div>
      <FieldError error={error} />
    </div>
  );
}

// --------------------------------------------------- Activités, notes, tâches
/**
 * « Ajouter une activité » — le MÊME bloc que le panneau de traitement.
 *
 * Il remplace « Type / Résultat de l'échange », qui décrivait le même fait avec
 * d'autres mots que le panneau : deux écrans, deux vocabulaires, et un
 * commercial qui ne savait plus lequel comptait. Les sept choix, la date réelle
 * modifiable, la note facultative et la prochaine action viennent tous des
 * composants partagés.
 *
 * Une seule sauvegarde porte l'activité, la note et l'engagement qui suit. En
 * deux appels, une coupure entre les deux laissait l'activité écrite et le
 * rappel perdu : un dossier qu'on croit suivi et que personne ne rappelle.
 */
export function BuyerActivityForm({
  buyerProfileId,
  interests,
  members,
}: {
  buyerProfileId: string;
  /** Les projets de la personne : une activité se rattache à l'un d'eux. */
  interests: { id: string; label: string }[];
  members: { userId: string; name: string }[];
}) {
  /* DEUX ENREGISTREMENTS DISTINCTS, DONC DEUX ETATS DISTINCTS.
     Un seul `useAction` ferait clignoter « Enregistré » sous les deux blocs
     quand on n'en a sauvegardé qu'un. */
  const suivi = useAction();
  const suite = useAction();
  /* `null` = « Général / Tous les biens ». L'activité appartient d'abord à la
     personne ; le bien est une précision. */
  const [interestId, setInterestId] = useState<string | null>(null);
  const [activite, setActivite] = useState<string | null>(null);
  const [quandActivite, setQuandActivite] = useState(maintenantLocal());
  const [note, setNote] = useState("");
  const [typeAction, setTypeAction] = useState<TypeProchaineAction>("aucune");
  const [quand, setQuand] = useState("");
  const [titre, setTitre] = useState("");
  const [responsable, setResponsable] = useState<string | null>(null);
  const enCours = suivi.pending || suite.pending;

  if (interests.length === 0) {
    return (
      <p className="text-xs text-[var(--crm-text-dim)]">
        Aucune manifestation d’intérêt : il n’y a pas de projet auquel rattacher une activité.
      </p>
    );
  }

  function choisirType(t: TypeProchaineAction) {
    setTypeAction(t);
    if (t === "aucune") setQuand("");
    else if (!quand) setQuand(dansNJours(t === "rappel" ? 1 : 2));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ---- CE QUI S'EST PASSE ------------------------------------------
          Deux gestes, deux blocs, deux enregistrements. Ils partageaient un
          bouton : noter un message vocal obligeait a repondre aussi a « et
          ensuite ? », et planifier un rappel trois jours plus tard renvoyait
          dans un formulaire d'activite vide. Ce sont deux moments differents
          du meme dossier. */}
      <div className="crm-sous-bloc">
        <p className="crm-sous-bloc__titre">Suivi</p>
        <ChoixProjet
          valeur={interestId}
          onChoisir={setInterestId}
          projets={interests.map((i) => ({ interestId: i.id, label: i.label }))}
          disabled={enCours}
        />

        <BlocActivite
          activite={activite}
          onActivite={setActivite}
          quand={quandActivite}
          onQuand={setQuandActivite}
          note={note}
          onNote={setNote}
          disabled={enCours}
        />

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            disabled={enCours || (!activite && !note.trim())}
            onClick={() =>
              suivi.run(
                () =>
                  enregistrerTraitementAction({
                    buyerProfileId,
                    interestId, // null = général
                    activite,
                    occurredAt: activite ? depuisChampLocal(quandActivite) : null,
                    note: note.trim() || null,
                  }),
                /* Vidé SEULEMENT après un succès confirmé : une coupure réseau
                   ne doit pas effacer la note qu'on vient de dicter au
                   téléphone. La prochaine action, elle, n'est pas touchée —
                   on ne vient pas de l'enregistrer. */
                () => {
                  setActivite(null);
                  setNote("");
                  setQuandActivite(maintenantLocal());
                },
              )
            }
          >
            {suivi.pending ? "…" : "Enregistrer le suivi"}
          </button>
          <Saved show={suivi.done} />
        </div>
        <FieldError error={suivi.error} />
      </div>

      {/* ---- CE QU'ON FAIT ENSUITE ---------------------------------------- */}
      <div className="crm-sous-bloc">
        <p className="crm-sous-bloc__titre">Prochaine action</p>
        {/* Une visite exige un bien : le menu réapparaît ici, car c'est cet
            enregistrement-là qui le rattachera. */}
        {typeAction === "visite" ? (
          <div className="mb-2">
            <ChoixProjet
              valeur={interestId}
              onChoisir={setInterestId}
              projets={interests.map((i) => ({ interestId: i.id, label: i.label }))}
              requis
              disabled={enCours}
            />
          </div>
        ) : null}
        <BlocProchaineAction
          type={typeAction}
          onType={choisirType}
          quand={quand}
          onQuand={setQuand}
          titre={titre}
          onTitre={setTitre}
          responsable={responsable}
          onResponsable={setResponsable}
          membres={members}
          disabled={enCours}
        />

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            /* « Rien à planifier » n'est pas une chose à enregistrer : c'est
               l'absence d'action. Et cela n'efface JAMAIS un rappel existant. */
            disabled={enCours || typeAction === "aucune"}
            onClick={() =>
              suite.run(
                () =>
                  enregistrerTraitementAction({
                    buyerProfileId,
                    interestId,
                    stage: typeAction === "visite" && quand ? "visite_planifiee" : null,
                    nextActionKind: typeAction,
                    nextActionAt: depuisChampLocal(quand),
                    nextActionTitle:
                      typeAction === "visite"
                        ? "Visite"
                        : typeAction === "rappel"
                          ? "Rappeler"
                          : titre.trim() || null,
                    nextActionAssignee: responsable,
                  }),
                () => {
                  setTypeAction("aucune");
                  setQuand("");
                  setTitre("");
                  setResponsable(null);
                },
              )
            }
          >
            {suite.pending ? "…" : "Enregistrer la prochaine action"}
          </button>
          <Saved show={suite.done} />
        </div>
        <FieldError error={suite.error} />
      </div>
    </div>
  );
}

/**
 * LES TÂCHES OUVERTES, ET RIEN DE PLUS.
 *
 * Ce bloc portait un SECOND formulaire de planification, concurrent de « la
 * suite à donner » du bloc d'échange. Deux endroits pour programmer un
 * rappel, c'est une décision saisie deux fois — et deux rappels quand on
 * oublie qu'on l'a déjà posé ailleurs.
 *
 * Il ne reste que ce qu'on vient y chercher : ce qui est dû, avec de quoi le
 * solder ou le corriger. Créer se fait là où l'on consigne l'échange, en même
 * temps que le reste.
 *
 * « Modifier » n'existait pas : on créait une tâche de remplacement et on
 * soldait l'ancienne. Retirer ce contournement sans offrir la correction
 * aurait enlevé une capacité au lieu d'en simplifier une.
 */
export function BuyerTaskList({
  buyerProfileId,
  tasks,
}: {
  buyerProfileId: string;
  tasks: TaskRow[];
}) {
  const { pending, error, done, run } = useAction();
  /** Identifiant de la tâche en cours de correction. */
  const [edite, setEdite] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [echeance, setEcheance] = useState("");

  const ouvertes = tasks.filter((t) => t.status === "a_faire");
  const closes = tasks.filter((t) => t.status !== "a_faire");

  function commencer(t: TaskRow) {
    setEdite(t.id);
    setTitre(t.title);
    /* `datetime-local` n'accepte ni fuseau ni secondes : on coupe l'ISO à la
       minute, dans l'heure locale, sinon le champ s'affiche vide. */
    setEcheance(
      t.due_at
        ? new Date(new Date(t.due_at).getTime() - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "",
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {ouvertes.length === 0 && closes.length === 0 ? (
        <p className="text-xs text-[var(--crm-text-dim)]">
          Aucune tâche. La prochaine se programme en enregistrant un échange.
        </p>
      ) : null}

      {ouvertes.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {ouvertes.map((t) => (
            <li
              key={t.id}
              className="rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-2.5 py-2"
            >
              {edite === t.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    className="crm-input"
                    value={titre}
                    aria-label="Intitulé de la tâche"
                    onChange={(e) => setTitre(e.target.value)}
                  />
                  <input
                    className="crm-input"
                    type="datetime-local"
                    value={echeance}
                    aria-label="Échéance"
                    onChange={(e) => setEcheance(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="crm-btn crm-btn--sm"
                      disabled={pending || !titre.trim()}
                      onClick={() =>
                        run(
                          () =>
                            updateBuyerTaskAction({
                              buyerProfileId,
                              taskId: t.id,
                              title: titre.trim(),
                              dueAt: echeance ? new Date(echeance).toISOString() : null,
                              /* Vider le champ EFFACE l'échéance. Sans ce
                                 drapeau, « enlever la date » et « ne pas y
                                 toucher » s'écriraient pareil. */
                              effacerEcheance: echeance === "",
                            }),
                          /* On ne referme QU'APRÈS un succès confirmé : fermer
                             avant, c'est faire croire que c'est enregistré. */
                          () => setEdite(null),
                        )
                      }
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      className="crm-btn crm-btn--sm crm-btn--ghost"
                      disabled={pending}
                      onClick={() => setEdite(null)}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="crm-wrap text-xs text-[var(--crm-text)]">
                    {t.title}
                    {t.due_at ? (
                      <span className="text-[var(--crm-text-faint)]">
                        {" "}
                        · {new Date(t.due_at).toLocaleString("fr-FR")}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="crm-btn crm-btn--sm crm-btn--ghost"
                      disabled={pending}
                      onClick={() => commencer(t)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="crm-btn crm-btn--sm crm-btn--ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          setBuyerTaskStatusAction({ buyerProfileId, taskId: t.id, status: "fait" }),
                        )
                      }
                    >
                      Terminer
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Les tâches soldées restent lisibles, au passé et en retrait : elles
          disent ce qui a été fait, et ne se modifient plus. */}
      {closes.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {closes.map((t) => (
            <li key={t.id} className="text-[11px] text-[var(--crm-text-faint)]">
              {t.title}
              {t.due_at ? ` · ${new Date(t.due_at).toLocaleString("fr-FR")}` : ""} · {t.status}
            </li>
          ))}
        </ul>
      ) : null}

      <Saved show={done} />
      <FieldError error={error} />
    </div>
  );
}
