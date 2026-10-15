"use client";

import { formatDateCourte } from "@/modules/crm/format";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MutableRefObject } from "react";
import Link from "next/link";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import { recordBuyerTreatmentAction } from "@/modules/buyers/crm/actions";
import { safeAction } from "@/modules/crm/safe-action";
import {
  MOTIFS_NON_QUALIFIE,
  QUALIFICATION_LABELS,
  BUYER_QUALIFICATIONS,
  RESULTATS_APPEL,
  proposeUnRappel,
  type ResultatAppel,
} from "@/modules/buyers/crm/qualification";
import { ChoixEtape, ChoixQualification } from "./choix-vocabulaire";
import { etape as definitionEtape } from "@/modules/buyers/crm/vocabulaire";
import { ContactRapide } from "./contact-rapide";
import { BadgeProjet } from "./barre-projets";
import { BUDGET_CHOICE_COURT, type BuyerBudgetChoice } from "@/modules/buyers/funnel/universal";

/**
 * Le panneau de traitement : un appel, une saisie, au suivant.
 *
 * Il ne contient PAS une fiche réduite. Une fiche complète comprimée dans un
 * panneau donne un formulaire qu'il faut parcourir ; ce qu'il faut, c'est un
 * écran où « injoignable, rappel demain, suivant » se fait sans défiler et sans
 * ouvrir quoi que ce soit.
 *
 * D'où ce qui n'y est PAS : l'offre, l'attribution marketing, l'étape du
 * pipeline, les réglages d'équipe. Ils vivent dans le dossier complet, à un
 * clic sur le nom. Les faire figurer ici coûterait un défilement à chaque appel
 * pour des champs qu'on touche une fois par mois.
 *
 * Les données restent SÉPARÉES jusqu'en base : le résultat de l'appel est un
 * fait daté, la qualification un jugement, la prochaine action un engagement.
 * Aucune ne se déduit d'une autre — un gros potentiel injoignable reste un gros
 * potentiel.
 */

type TypeAction = "aucune" | "rappel" | "visite";

/** Libellé de l'étape actuelle, traduit depuis l'historique au besoin. */
function etapeLabel(valeur: string): string {
  return definitionEtape(valeur).label;
}

function dansNJours(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return versChampLocal(d.toISOString());
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

/* Déléguée au formateur commun : celui du panneau s'en remettait au fuseau du
   navigateur, celui de la fiche à celui du serveur, et le même appel
   s'affichait avec deux heures d'écart selon l'écran. */
const dateCourte = (iso: string | null): string => formatDateCourte(iso);

export function PanneauTraitement({
  row,
  position,
  total,
  onFermer,
  onEnregistre,
  onSuivant,
  resteUnSuivant,
  saleRef,
  contexte,
}: {
  row: BuyerInboxRow;
  position: number;
  total: number;
  onFermer: () => void;
  /** Appelé après une sauvegarde CONFIRMÉE par le serveur, jamais avant. */
  onEnregistre: () => void;
  onSuivant: () => void;
  resteUnSuivant: boolean;
  /**
   * Miroir de l'état « saisie non enregistrée », tenu pour la liste : c'est
   * ELLE qui change de dossier, donc c'est elle qui doit pouvoir prévenir.
   * Perdre une note qu'on vient de dicter au téléphone est la façon la plus
   * sûre de faire abandonner l'outil.
   *
   * Une ref et non un état remonté : le parent n'a besoin de cette valeur qu'au
   * moment du clic, jamais pour se redessiner.
   */
  saleRef: MutableRefObject<boolean>;
  /** Projet, vue et filtre, recopiés dans le lien : c'est ce qui permet au
      « Retour à la liste » de la fiche complète de rendre l'écran d'où l'on
      vient, et pas la liste remise à zéro. */
  contexte: string;
}) {
  const [resultat, setResultat] = useState<ResultatAppel | null>(null);
  const [qualification, setQualification] = useState<string | null>(null);
  /* L'étape, absente du panneau jusqu'ici : il fallait ouvrir la fiche ou
     aller au pipeline pour la changer, c'est-à-dire quitter la file d'appels
     en plein milieu. */
  const [etape, setEtape] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [note, setNote] = useState("");
  const [typeAction, setTypeAction] = useState<TypeAction>("aucune");
  const [quand, setQuand] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Vrai quand on a demandé la fiche complète avec une saisie en cours. */
  const [arbitrage, setArbitrage] = useState(false);
  const envoiRef = useRef(false);
  const router = useRouter();

  /*
   * La saisie n'est PAS remise à zéro par un effet : le panneau est remonté par
   * sa clé quand le dossier change (voir `key` chez l'appelant). Un effet de
   * remise à zéro laisse un rendu intermédiaire où la saisie du dossier
   * PRÉCÉDENT est encore à l'écran sur le suivant — et c'est ainsi qu'un
   * « injoignable » se reporte tout seul d'un dossier à l'autre.
   */

  const sale =
    resultat !== null || qualification !== null || note.trim() !== "" || quand !== "";

  useEffect(() => {
    saleRef.current = sale;
    // Le panneau disparait sans toujours passer par « Enregistrer » : on rend
    // la main propre, sinon la liste croit a une saisie en cours a jamais.
    return () => {
      saleRef.current = false;
    };
  }, [sale, saleRef]);

  /** Choisir un résultat sans réponse propose un rappel : on n'impose rien. */
  function choisirResultat(v: ResultatAppel) {
    const nouveau = resultat === v ? null : v;
    setResultat(nouveau);
    if (nouveau && proposeUnRappel(nouveau) && typeAction === "aucune") {
      setTypeAction("rappel");
      setQuand(dansNJours(1));
    }
  }

  function choisirTypeAction(t: TypeAction) {
    setTypeAction(t);
    if (t === "aucune") setQuand("");
    else if (!quand) setQuand(dansNJours(t === "rappel" ? 1 : 2));
  }

  async function enregistrer(puisSuivant: boolean) {
    // Deux clics rapides ne doivent pas écrire deux fois : la garde est une
    // ref, lue et posée dans le même tour, là où un état arriverait trop tard.
    if (envoiRef.current) return;
    envoiRef.current = true;
    setEnCours(true);
    setErreur(null);

    /* `safeAction` : une action serveur qui lève ne doit JAMAIS faire tomber
       l'écran. Sans elle, une coupure réseau en plein enregistrement efface la
       note qu'on vient de taper. */
    const resultatAction = await safeAction(() =>
      recordBuyerTreatmentAction({
        buyerProfileId: row.buyerProfileId,
        interestId: row.interestId,
        callOutcome: resultat,
        qualification,
        qualificationReason: qualification === "non_qualifie" ? motif || null : null,
        note: note.trim() || null,
        /* L'étape choisie à la main prime. À défaut, planifier une visite la
           fait avancer toute seule — c'est le fait métier qui la porte, pas un
           menu qu'il faudrait penser à toucher. */
        stage: etape ?? (typeAction === "visite" && quand ? "visite_planifiee" : null),
        nextActionKind: typeAction === "aucune" ? null : typeAction,
        nextActionAt: depuisChampLocal(quand),
        nextActionTitle:
          typeAction === "visite" ? "Visite" : typeAction === "rappel" ? "Rappeler" : null,
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
    saleRef.current = false;
    onEnregistre();
    if (puisSuivant) onSuivant();
  }

  const lienFiche = `/crm/acquereurs/${row.buyerProfileId}${contexte}`;

  /**
   * Ouvrir la fiche complète. Avec une saisie en cours, on ne tranche PAS à la
   * place de la personne : on lui demande si elle enregistre ou abandonne.
   * Une boîte native ne propose que deux issues ; il en faut trois, et la
   * troisième est « je reste ici ».
   */
  function ouvrirLaFiche() {
    if (saleRef.current) {
      setArbitrage(true);
      return;
    }
    router.push(lienFiche);
  }

  async function enregistrerPuisOuvrir() {
    await enregistrer(false);
    // On n'ouvre QUE si l'enregistrement a reellement abouti : sinon la note
    // partirait avec la navigation, ce qui est exactement ce qu'on evite.
    if (!saleRef.current) router.push(lienFiche);
  }

  const peutEnregistrer = sale;
  const budget = row.budgetChoice
    ? BUDGET_CHOICE_COURT[row.budgetChoice as BuyerBudgetChoice] ?? row.budgetChoice
    : null;

  return (
    <aside className="crm-panneau" aria-label={`Traitement de ${row.name}`}>
      {/* ---- En-tête compact : qui, quel projet, quel budget, comment le joindre */}
      <header className="crm-panneau__tete">
        <div className="min-w-0 flex-1">
          <p className="crm-panneau__rang">
            {position > 0 && total > 0 ? `Dossier ${position} sur ${total}` : "Dossier"}
          </p>
          <h2 className="crm-panneau__nom">
            <Link href={`/crm/acquereurs/${row.buyerProfileId}`} prefetch={false}>
              {row.name}
            </Link>
          </h2>
          <div className="crm-panneau__meta">
            {row.lastPropertyId && row.lastPropertyLabel ? (
              <BadgeProjet propertyId={row.lastPropertyId} label={row.lastPropertyLabel} />
            ) : null}
            {budget ? <span className="crm-panneau__budget">{budget}</span> : null}
          </div>
          {row.phoneMasked || row.emailMasked ? (
            <p className="crm-panneau__coord">
              {row.phoneMasked}
              {row.phoneMasked && row.emailMasked ? " · " : ""}
              {row.emailMasked}
            </p>
          ) : null}
        </div>
        <button type="button" className="crm-panneau__fermer" onClick={onFermer} aria-label="Fermer">
          ✕
        </button>
      </header>

      {/*
        Le panneau COMPLETE la fiche, il ne la remplace pas. Tant que le seul
        chemin vers elle etait le nom — un texte, parmi d'autres textes — elle
        etait fonctionnelle mais introuvable : le geste naturel, cliquer la
        ligne, donnait le panneau. Un bouton, avec son icone ET son libelle.
      */}
      <div className="crm-panneau__vers-fiche">
        <button type="button" className="crm-lien-fiche" onClick={ouvrirLaFiche}>
          <span aria-hidden>⤢</span>
          Ouvrir la fiche complète
          <span aria-hidden>↗</span>
        </button>
      </div>

      {arbitrage ? (
        <div className="crm-arbitrage" role="alertdialog" aria-label="Saisie non enregistrée">
          <p className="crm-arbitrage__texte">
            Vous avez une saisie non enregistrée sur ce dossier.
          </p>
          <div className="crm-arbitrage__choix">
            <button
              type="button"
              className="crm-btn crm-btn--primaire"
              disabled={enCours}
              onClick={enregistrerPuisOuvrir}
            >
              {enCours ? "Enregistrement…" : "Enregistrer et ouvrir"}
            </button>
            <button
              type="button"
              className="crm-btn crm-btn--secondaire"
              disabled={enCours}
              onClick={() => {
                saleRef.current = false;
                router.push(lienFiche);
              }}
            >
              Abandonner et ouvrir
            </button>
            <button
              type="button"
              className="crm-btn crm-btn--secondaire"
              disabled={enCours}
              onClick={() => setArbitrage(false)}
            >
              Rester ici
            </button>
          </div>
        </div>
      ) : null}

      <div className="crm-panneau__actions-contact">
        <ContactRapide numero={row.phoneMasked} email={row.emailMasked} />
      </div>

      {row.phoneInvalid ? (
        <p className="crm-panneau__alerte" role="status">
          Numéro signalé invalide : ce dossier est sorti de la file d’appels. Passez par e-mail,
          ou corrigez le numéro dans le dossier.
        </p>
      ) : null}

      <div className="crm-panneau__corps">
        {/* ---- 1. Ce qui vient de se passer ---------------------------------- */}
        <section className="crm-bloc">
          <h3 className="crm-bloc__titre">Résultat de l’appel</h3>
          <div className="crm-grille crm-grille--2">
            {RESULTATS_APPEL.map((r) => (
              <button
                key={r.valeur}
                type="button"
                className="crm-gros-choix"
                aria-pressed={resultat === r.valeur}
                onClick={() => choisirResultat(r.valeur)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>

        {/* ---- Où en est le traitement ---------------------------------------
            Le MÊME composant que la fiche, et les mêmes sept étapes que le
            pipeline. Changer l'étape ici la change partout : c'est une
            propriété de la personne, pas de l'écran qui l'affiche. */}
        <section className="crm-bloc">
          <h3 className="crm-bloc__titre">
            Étape
            <span className="crm-bloc__actuel">actuelle : {etapeLabel(row.stage)}</span>
          </h3>
          <ChoixEtape valeur={etape} onChoisir={setEtape} />
        </section>

        {/* ---- 2. Ce qu'on en pense ------------------------------------------ */}
        <section className="crm-bloc">
          <h3 className="crm-bloc__titre">
            Qualification
            <span className="crm-bloc__actuel">actuelle : {QUALIFICATION_LABELS[row.qualification]}</span>
          </h3>
          {/* Trois colonnes : cinq options tiennent en DEUX rangees au lieu de
              trois, et le parcours critique repasse sous la ligne de
              flottaison d'un portable 768. */}
          <ChoixQualification valeur={qualification} onChoisir={setQualification} />
          {/* Le motif n'apparaît que s'il est exigé : un champ qui attend sans
              servir occupe la place et fait croire qu'il manque une réponse. */}
          {qualification === "non_qualifie" ? (
            <select
              className="crm-select mt-2 w-full"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              aria-label="Motif"
            >
              <option value="">Motif…</option>
              {MOTIFS_NON_QUALIFIE.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : null}
        </section>

        {/* ---- 3. Ce qu'il faut retenir --------------------------------------- */}
        <section className="crm-bloc">
          <h3 className="crm-bloc__titre">Note de l’échange</h3>
          <textarea
            className="crm-panneau__zone"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Objection, contexte, ce qu’il attend…"
          />
        </section>

        {/* ---- 4. Ce qu'on s'engage à faire ----------------------------------- */}
        <section className="crm-bloc">
          <h3 className="crm-bloc__titre">Prochaine action</h3>
          <div className="crm-grille crm-grille--3">
            <button
              type="button"
              className="crm-gros-choix"
              aria-pressed={typeAction === "aucune"}
              onClick={() => choisirTypeAction("aucune")}
            >
              Aucune
            </button>
            <button
              type="button"
              className="crm-gros-choix"
              aria-pressed={typeAction === "rappel"}
              onClick={() => choisirTypeAction("rappel")}
            >
              Rappeler
            </button>
            <button
              type="button"
              className="crm-gros-choix"
              aria-pressed={typeAction === "visite"}
              onClick={() => choisirTypeAction("visite")}
            >
              Visite
            </button>
          </div>

          {/* La date n'apparaît QUE si une action est choisie. Un champ de date
              toujours visible se remplit par réflexe, et l'agenda se couvre de
              rappels que personne n'a voulus. */}
          {typeAction !== "aucune" ? (
            <div className="mt-2 flex flex-col gap-2">
              {typeAction === "rappel" ? (
                <div className="crm-grille crm-grille--3">
                  <button type="button" className="crm-petit-choix" onClick={() => setQuand(dansNJours(1))}>
                    Demain
                  </button>
                  <button type="button" className="crm-petit-choix" onClick={() => setQuand(dansNJours(3))}>
                    3 jours
                  </button>
                  <button type="button" className="crm-petit-choix" onClick={() => setQuand(dansNJours(7))}>
                    1 semaine
                  </button>
                </div>
              ) : null}
              <input
                type="datetime-local"
                className="crm-select w-full"
                value={quand}
                onChange={(e) => setQuand(e.target.value)}
                aria-label={typeAction === "visite" ? "Date de la visite" : "Date du rappel"}
              />
              {typeAction === "visite" ? (
                <p className="crm-panneau__aide">
                  Planifier la visite fait passer ce dossier à l’étape « Visite ».
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ---- 5. L'historique, replié, mais sa dernière note visible ---------- */}
        <details className="crm-historique">
          <summary>
            Historique · {row.callAttempts} tentative{row.callAttempts > 1 ? "s" : ""}
            {row.lastCallAt ? ` · dernier appel ${dateCourte(row.lastCallAt)}` : ""}
          </summary>
          <p className="crm-historique__corps">
            Le détail complet des échanges se lit dans le dossier.
          </p>
        </details>
        {row.lastNote ? (
          <p className="crm-derniere-note">
            <span className="crm-derniere-note__date">{dateCourte(row.lastNoteAt)}</span>
            {row.lastNote}
          </p>
        ) : null}
      </div>

      {/* ---- Toujours atteignable, quelle que soit la longueur du corps ------- */}
      <footer className="crm-panneau__pied">
        {erreur ? (
          <p className="crm-panneau__erreur" role="alert">
            {erreur}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--secondaire flex-1"
            disabled={enCours || !peutEnregistrer}
            onClick={() => enregistrer(false)}
          >
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            className="crm-btn crm-btn--primaire flex-1"
            disabled={enCours || !peutEnregistrer || !resteUnSuivant}
            onClick={() => enregistrer(true)}
          >
            {enCours ? "Enregistrement…" : "Enregistrer et suivant"}
          </button>
        </div>
        {!resteUnSuivant ? (
          <p className="crm-panneau__aide mt-1.5">
            {total > 0 ? "Dernier dossier de la file." : "Aucun autre dossier à appeler maintenant."}
          </p>
        ) : null}
      </footer>
    </aside>
  );
}
