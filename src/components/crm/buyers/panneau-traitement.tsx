"use client";

import { formatDateCourte } from "@/modules/crm/format";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MutableRefObject } from "react";
import Link from "next/link";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import { enregistrerTraitementAction } from "@/modules/buyers/crm/actions";
import { safeAction } from "@/modules/crm/safe-action";
import { MOTIFS_NON_QUALIFIE, QUALIFICATION_LABELS } from "@/modules/buyers/crm/qualification";
import {
  BlocActivite,
  BlocProchaineAction,
  ChoixEtape,
  ChoixProjet,
  ChoixQualification,
  dansNJours,
  depuisChampLocal,
  maintenantLocal,
  type TypeProchaineAction,
} from "./choix-vocabulaire";
import { appelleUnRappel, etape as definitionEtape } from "@/modules/buyers/crm/vocabulaire";
import { ContactRapide } from "./contact-rapide";
import { useHauteurVisible } from "./hauteur-visible";
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

/** Libellé de l'étape actuelle, traduit depuis l'historique au besoin. */
function etapeLabel(valeur: string): string {
  return definitionEtape(valeur).label;
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
  membres,
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
  /** L'équipe, pour choisir le responsable du rappel. */
  membres: { userId: string; name: string }[];
  /** Projet, vue et filtre, recopiés dans le lien : c'est ce qui permet au
      « Retour à la liste » de la fiche complète de rendre l'écran d'où l'on
      vient, et pas la liste remise à zéro. */
  contexte: string;
}) {
  /* `null` = général. L'activité appartient d'abord à la personne ; le bien
     est une précision qu'on apporte quand l'échange la mérite. */
  const [projet, setProjet] = useState<string | null>(null);
  const [activite, setActivite] = useState<string | null>(null);
  /* Préremplie à maintenant, modifiable : on note souvent un appel après
     coup, et dater la note de l'heure de saisie fausserait la chronologie. */
  const [quandActivite, setQuandActivite] = useState(maintenantLocal());
  const [qualification, setQualification] = useState<string | null>(null);
  /* L'étape, absente du panneau jusqu'ici : il fallait ouvrir la fiche ou
     aller au pipeline pour la changer, c'est-à-dire quitter la file d'appels
     en plein milieu. */
  const [etape, setEtape] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [note, setNote] = useState("");
  const [typeAction, setTypeAction] = useState<TypeProchaineAction>("aucune");
  const [quand, setQuand] = useState("");
  const [titreAction, setTitreAction] = useState("");
  /* Null = moi. Le cas courant, et laisser le choix vide évite d'affecter un
     rappel à quelqu'un d'autre par inattention. */
  const [responsable, setResponsable] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Vrai quand on a demandé la fiche complète avec une saisie en cours. */
  const [arbitrage, setArbitrage] = useState(false);
  const envoiRef = useRef(false);
  const router = useRouter();

  /* Le panneau suit la hauteur du viewport VISUEL : sans cela, « Enregistrer »
     passe sous le clavier dès qu'on touche la note. */
  useHauteurVisible();

  /*
   * La saisie n'est PAS remise à zéro par un effet : le panneau est remonté par
   * sa clé quand le dossier change (voir `key` chez l'appelant). Un effet de
   * remise à zéro laisse un rendu intermédiaire où la saisie du dossier
   * PRÉCÉDENT est encore à l'écran sur le suivant — et c'est ainsi qu'un
   * « injoignable » se reporte tout seul d'un dossier à l'autre.
   */

  const sale =
    activite !== null ||
    qualification !== null ||
    etape !== null ||
    note.trim() !== "" ||
    quand !== "";

  useEffect(() => {
    saleRef.current = sale;
    // Le panneau disparait sans toujours passer par « Enregistrer » : on rend
    // la main propre, sinon la liste croit a une saisie en cours a jamais.
    return () => {
      saleRef.current = false;
    };
  }, [sale, saleRef]);

  /** Choisir un résultat sans réponse propose un rappel : on n'impose rien. */
  function choisirResultat(v: string | null) {
    const nouveau = activite === v ? null : v;
    setActivite(nouveau);
    setQuandActivite(maintenantLocal());
    /* Un appel sans réponse ou un message vocal appelle un rappel : la
       conversation n'a pas eu lieu, elle reste à avoir. On le PROPOSE, le
       commercial reste libre de l'enlever. Un message envoyé, lui, n'appelle
       rien : on attend une réponse, on ne se rappelle pas soi-même. */
    if (nouveau && appelleUnRappel(nouveau) && typeAction === "aucune") {
      setTypeAction("rappel");
      setQuand(dansNJours(1));
    }
  }

  function choisirTypeAction(t: TypeProchaineAction) {
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
      enregistrerTraitementAction({
        buyerProfileId: row.buyerProfileId,
        interestId: projet,
        activite,
        occurredAt: activite ? depuisChampLocal(quandActivite) : null,
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
          typeAction === "visite"
            ? "Visite"
            : typeAction === "rappel"
              ? "Rappeler"
              : titreAction.trim() || null,
        nextActionAssignee: responsable,
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
        {/* ---- 1. Ce qui vient de se passer ----------------------------------
            Le MÊME bloc que la fiche. Il remplace « Résultat de l'appel », qui
            ne savait dire ni « WhatsApp envoyé » ni « e-mail », et qui portait
            un vocabulaire différent de celui de la fiche pour le même fait. */}
        <section className="crm-bloc">
          <h3 className="crm-bloc__titre">Ajouter une activité</h3>
          <ChoixProjet
            valeur={projet}
            onChoisir={setProjet}
            projets={row.projets}
            disabled={enCours}
          />
          <BlocActivite
            activite={activite}
            onActivite={choisirResultat}
            quand={quandActivite}
            onQuand={setQuandActivite}
            note={note}
            onNote={setNote}
            disabled={enCours}
          />
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

        {/* ---- 3. Ce qu'on s'engage à faire -----------------------------------
            Le MÊME bloc que la fiche. Il porte désormais un responsable : un
            commercial qui prend l'appel d'un dossier qui n'est pas le sien doit
            pouvoir rendre le rappel à son titulaire sans réattribuer le
            dossier entier. */}
        <section className="crm-bloc">
          <h3 className="crm-bloc__titre">Prochaine action</h3>
          {/* Une visite exige un bien : le menu réapparaît, même sur une
              personne qui n'en suit qu'un, pour que le rattachement soit vu. */}
          {typeAction === "visite" ? (
            <div className="mb-2">
              <ChoixProjet
                valeur={projet}
                onChoisir={setProjet}
                projets={row.projets}
                requis
                disabled={enCours}
              />
            </div>
          ) : null}
          <BlocProchaineAction
            type={typeAction}
            onType={choisirTypeAction}
            quand={quand}
            onQuand={setQuand}
            titre={titreAction}
            onTitre={setTitreAction}
            responsable={responsable}
            onResponsable={setResponsable}
            membres={membres}
            disabled={enCours}
          />
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
