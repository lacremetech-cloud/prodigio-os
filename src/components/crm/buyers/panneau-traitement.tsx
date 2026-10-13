"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import { recordBuyerTreatmentAction } from "@/modules/buyers/crm/actions";
import { safeAction } from "@/modules/crm/safe-action";
import {
  MOTIFS_NON_QUALIFIE,
  QUALIFICATION_LABELS,
  BUYER_QUALIFICATIONS,
  RESULTATS_APPEL,
  etapeProposee,
  proposeUnRappel,
  type ResultatAppel,
} from "@/modules/buyers/crm/qualification";
import { BUYER_PIPELINE_STAGES, buyerStageLabels } from "@/modules/buyers/crm/labels";
import { ContactRapide } from "./contact-rapide";
import { BadgeProjet } from "./barre-projets";
import { BUDGET_CHOICE_COURT, type BuyerBudgetChoice } from "@/modules/buyers/funnel/universal";

/**
 * Le panneau de traitement : appeler, consigner, qualifier, programmer, suivant.
 *
 * Il s'ouvre À CÔTÉ de la liste, qui reste visible et chargée. Ouvrir un dossier
 * était une navigation de page complète — 3,2 s mesurées, et la liste détruite
 * puis reconstruite au retour. Ici, tout ce qu'il affiche vient de la ligne
 * déjà en mémoire : l'ouverture est instantanée parce qu'il n'y a rien à aller
 * chercher.
 *
 * Les quatre données restent SÉPARÉES : le résultat de l'appel est un fait, la
 * qualification un jugement, l'étape l'état de l'affaire, la prochaine action
 * un engagement daté. Aucune ne se déduit d'une autre.
 */

function dansNJours(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

/** `datetime-local` veut une heure locale sans fuseau ; l'ISO en porte un. */
function versChampLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function depuisChampLocal(valeur: string): string | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function dateCourte(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ResultatEnregistrement {
  ok: boolean;
  error?: string;
}

export function PanneauTraitement({
  row,
  position,
  total,
  onFermer,
  onEnregistre,
  onSuivant,
  resteUnSuivant,
}: {
  row: BuyerInboxRow;
  position: number;
  total: number;
  onFermer: () => void;
  /** Appelé après une sauvegarde CONFIRMÉE par le serveur, jamais avant. */
  onEnregistre: () => void;
  onSuivant: () => void;
  resteUnSuivant: boolean;
}) {
  const [resultat, setResultat] = useState<ResultatAppel | null>(null);
  const [qualification, setQualification] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [note, setNote] = useState("");
  const [rappelLe, setRappelLe] = useState("");
  const [etape, setEtape] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const envoiRef = useRef(false);

  /*
   * La saisie n'est PAS remise à zéro par un effet : le panneau est remonté par
   * sa clé quand le dossier change (voir `key` chez l'appelant). Un effet de
   * remise à zéro laisse un rendu intermédiaire où la saisie du dossier
   * PRÉCÉDENT est encore à l'écran sur le dossier suivant — et c'est ainsi
   * qu'un « injoignable » se reporte tout seul d'un dossier à l'autre.
   */

  const etapeSuggeree = etapeProposee(resultat, row.stage);
  const suggereRappel = proposeUnRappel(resultat);
  const etapeRetenue = etape ?? etapeSuggeree;

  async function enregistrer(puisSuivant: boolean) {
    // Deux clics rapides ne doivent pas écrire deux fois : la garde est une
    // ref, lue et posée dans le même tour, là où un état arriverait trop tard.
    if (envoiRef.current) return;
    envoiRef.current = true;
    setEnCours(true);
    setErreur(null);

    /* `safeAction` : une action serveur qui lève ne doit JAMAIS faire tomber
       l'écran. Sans elle, une coupure réseau en plein enregistrement efface la
       note qu'on vient de taper — c'est l'incident d'août, et c'est exactement
       ce qu'on ne veut pas sur une session d'appels. */
    const resultatAction = await safeAction(() =>
      recordBuyerTreatmentAction({
        buyerProfileId: row.buyerProfileId,
        interestId: row.interestId,
        callOutcome: resultat,
      qualification,
        qualificationReason: qualification === "non_qualifie" ? motif || null : null,
        note: note.trim() || null,
        stage: etapeRetenue,
        nextActionKind: rappelLe ? "rappel" : null,
        nextActionAt: depuisChampLocal(rappelLe),
        nextActionTitle: rappelLe ? "Rappeler" : null,
      // Traiter un dossier solde le rappel qui l'avait amené dans la file.
        completeTaskId: row.nextActionId,
      }),
    );

    setEnCours(false);
    envoiRef.current = false;

    if (!resultatAction.ok) {
      // La saisie reste intacte et on NE BOUGE PAS de dossier : réécrire une
      // note qu'on vient de taper est la pire façon de perdre une session.
      setErreur(resultatAction.error ?? "L’enregistrement a échoué. Réessayez.");
      return;
    }
    onEnregistre();
    if (puisSuivant) onSuivant();
  }

  const peutEnregistrer =
    resultat !== null || qualification !== null || note.trim() !== "" || rappelLe !== "";

  return (
    <aside className="crm-panneau" aria-label={`Traitement de ${row.name}`}>
      <header className="crm-panneau__tete">
        <div className="min-w-0">
          <p className="crm-eyebrow">
            Dossier {position} sur {total}
          </p>
          <h2 className="crm-panneau__nom">
            <Link href={`/crm/acquereurs/${row.buyerProfileId}`} prefetch={false}>
              {row.name}
            </Link>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {row.lastPropertyId && row.lastPropertyLabel ? (
              <BadgeProjet propertyId={row.lastPropertyId} label={row.lastPropertyLabel} />
            ) : null}
            {row.budgetChoice ? (
              <span className="crm-panneau__budget">
                {BUDGET_CHOICE_COURT[row.budgetChoice as BuyerBudgetChoice] ?? row.budgetChoice}
              </span>
            ) : null}
          </div>
        </div>
        <button type="button" className="crm-panneau__fermer" onClick={onFermer} aria-label="Fermer">
          ✕
        </button>
      </header>

      <div className="crm-panneau__corps">
        {/* 1. Joindre la personne — avant tout le reste. */}
        <section className="crm-panneau__bloc">
          <ContactRapide numero={row.phoneMasked} email={row.emailMasked} />
          {row.phoneInvalid ? (
            <p className="crm-panneau__alerte" role="status">
              Numéro signalé invalide. Ce dossier est sorti de la file d’appels ; passez par
              e-mail, ou corrigez le numéro dans la fiche.
            </p>
          ) : null}
        </section>

        {/* 2. Ce qu'on sait déjà, en une ligne. */}
        <section className="crm-panneau__bloc crm-panneau__rappel">
          <p>
            <strong>{row.callAttempts}</strong> tentative{row.callAttempts > 1 ? "s" : ""} ·
            dernier appel {dateCourte(row.lastCallAt)}
          </p>
          {row.lastNote ? (
            <p className="crm-panneau__note-ancienne">
              <span className="crm-panneau__note-date">{dateCourte(row.lastNoteAt)}</span>
              {row.lastNote}
            </p>
          ) : (
            <p className="crm-panneau__note-ancienne crm-panneau__vide">Aucune note.</p>
          )}
        </section>

        {/* 3. Le résultat de CET appel. */}
        <section className="crm-panneau__bloc">
          <h3 className="crm-panneau__titre">Résultat de l’appel</h3>
          <div className="crm-choix">
            {RESULTATS_APPEL.map((r) => (
              <button
                key={r.valeur}
                type="button"
                className="crm-choix__item"
                aria-pressed={resultat === r.valeur}
                onClick={() => setResultat(resultat === r.valeur ? null : r.valeur)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {resultat === "mauvais_numero" ? (
            <p className="crm-panneau__aide">
              Le numéro sortira de la file d’appels. Le dossier reste ouvert.
            </p>
          ) : null}
        </section>

        {/* 4. La qualification — facultative, surtout sur un injoignable. */}
        <section className="crm-panneau__bloc">
          <h3 className="crm-panneau__titre">
            Qualification{" "}
            <span className="crm-panneau__actuelle">
              · actuelle : {QUALIFICATION_LABELS[row.qualification]}
            </span>
          </h3>
          <div className="crm-choix">
            {BUYER_QUALIFICATIONS.map((q) => (
              <button
                key={q}
                type="button"
                className={`crm-choix__item crm-choix__item--${q}`}
                aria-pressed={qualification === q}
                onClick={() => setQualification(qualification === q ? null : q)}
              >
                {QUALIFICATION_LABELS[q]}
              </button>
            ))}
          </div>
          {qualification === "non_qualifie" ? (
            <label className="crm-panneau__champ">
              <span>Motif</span>
              <select
                className="crm-select"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              >
                <option value="">Choisir un motif…</option>
                {MOTIFS_NON_QUALIFIE.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>

        {/* 5. La note. */}
        <section className="crm-panneau__bloc">
          <h3 className="crm-panneau__titre">Note</h3>
          <textarea
            className="crm-panneau__zone"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contexte, objection, prochaine étape…"
          />
        </section>

        {/* 6. La prochaine action. */}
        <section className="crm-panneau__bloc">
          <h3 className="crm-panneau__titre">Prochaine action</h3>
          <div className="crm-choix">
            <button type="button" className="crm-choix__item" onClick={() => setRappelLe(versChampLocal(dansNJours(1)))}>
              Demain
            </button>
            <button type="button" className="crm-choix__item" onClick={() => setRappelLe(versChampLocal(dansNJours(3)))}>
              Dans 3 jours
            </button>
            {rappelLe ? (
              <button type="button" className="crm-choix__item" onClick={() => setRappelLe("")}>
                Retirer
              </button>
            ) : null}
          </div>
          <input
            type="datetime-local"
            className="crm-select mt-2 w-full"
            value={rappelLe}
            onChange={(e) => setRappelLe(e.target.value)}
            aria-label="Date du rappel"
          />
          {suggereRappel && !rappelLe ? (
            <p className="crm-panneau__aide">Sans réponse : programmez un rappel.</p>
          ) : null}
        </section>

        {/* 7. L'étape — en secondaire, parce qu'elle n'est pas à toucher à chaque appel. */}
        <details className="crm-panneau__secondaire">
          <summary>
            Étape : {buyerStageLabels[row.stage] ?? row.stage}
            {etapeSuggeree && !etape ? ` → ${buyerStageLabels[etapeSuggeree]} (proposé)` : null}
          </summary>
          <div className="crm-choix mt-2">
            {BUYER_PIPELINE_STAGES.filter(
              (s) => !["offre", "gagne", "perdu"].includes(s),
            ).map((s) => (
              <button
                key={s}
                type="button"
                className="crm-choix__item"
                aria-pressed={etapeRetenue === s}
                onClick={() => setEtape(etapeRetenue === s ? null : s)}
              >
                {buyerStageLabels[s]}
              </button>
            ))}
          </div>
          <p className="crm-panneau__aide">
            Offre, gagné et perdu passent par leur action dédiée, avec motif et traçabilité.
          </p>
        </details>
      </div>

      <footer className="crm-panneau__pied">
        {erreur ? (
          <p className="crm-panneau__erreur" role="alert">
            {erreur}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--secondaire"
            disabled={enCours || !peutEnregistrer}
            onClick={() => enregistrer(false)}
          >
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            className="crm-btn crm-btn--primaire"
            disabled={enCours || !peutEnregistrer || !resteUnSuivant}
            onClick={() => enregistrer(true)}
          >
            {enCours ? "Enregistrement…" : "Enregistrer et suivant"}
          </button>
        </div>
        {!resteUnSuivant ? (
          <p className="crm-panneau__aide">Dernier dossier de la file.</p>
        ) : null}
      </footer>
    </aside>
  );
}
