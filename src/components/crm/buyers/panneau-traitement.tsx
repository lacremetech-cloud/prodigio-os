"use client";

import { formatDateCourte } from "@/modules/crm/format";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MutableRefObject } from "react";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import {
  assignBuyerAction,
  enregistrerTraitementAction,
  selfAssignBuyerAction,
} from "@/modules/buyers/crm/actions";
import { safeAction } from "@/modules/crm/safe-action";
import { MOTIFS_NON_QUALIFIE } from "@/modules/buyers/crm/qualification";
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
import {
  activiteLabel,
  appelleUnRappel,
  etape as definitionEtape,
  ETAPES_ACTIVES,
} from "@/modules/buyers/crm/vocabulaire";
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
  moiUserId = null,
  peutAffecterAutrui = false,
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
  /** Mon identifiant : me prendre un dossier libre passe par « claim ». */
  moiUserId?: string | null;
  /**
   * Vrai si je peux affecter le dossier a QUELQU'UN D'AUTRE.
   *
   * La base le reserve a l'encadrement (`crm_buyer_assign` exige
   * administrateur, manager ou setter) : prendre un dossier libre et
   * reaffecter celui d'un collegue sont deux actes differents, sans quoi deux
   * associes se reprendraient leurs dossiers sans que l'autre le sache. Un
   * commercial ne voit donc qu'un nom possible : le sien.
   */
  peutAffecterAutrui?: boolean;
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
  /** Vrai le temps de la prise du dossier : « M'attribuer » ne doit pas
      partir deux fois sur un double clic. */
  const [attribution, setAttribution] = useState(false);
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

  /**
   * L'ÉTAPE QUE LE FAIT MÉTIER PORTE DÉJÀ.
   *
   * Programmer un rappel ET devoir choisir « À rappeler » dans un second
   * sélecteur, c'est saisir deux fois la même décision — et c'est la moitié
   * des dossiers qui restent « À contacter » alors qu'un rappel est posé,
   * parce que personne ne pense à toucher le menu après avoir fait le geste
   * qui compte.
   *
   * Le choix manuel PRIME toujours : ce calcul ne s'applique qu'à défaut.
   *
   * DEUX RÈGLES, ET LEUR ASYMÉTRIE EST VOULUE.
   *
   *  • Une VISITE pose l'étape sans condition. Planifier une visite à
   *    quelqu'un de classé « pas intéressé », c'est précisément dire qu'il
   *    l'est redevenu : le fait est trop fort pour être ignoré.
   *  • Un RAPPEL ne déplace QUE les dossiers encore actifs. Rappeler quelqu'un
   *    rangé en vivier ou marqué mauvais numéro ne doit pas le repêcher en
   *    silence dans la file d'appels ; sortir un dossier du traitement reste
   *    une décision humaine, et seule une autre décision humaine l'annule.
   */
  function etapeAutomatique(): string | null {
    if (!quand) return null;
    if (typeAction === "visite") return "visite_planifiee";
    if (typeAction === "rappel" && ETAPES_ACTIVES.includes(row.stage as never)) {
      return "a_rappeler";
    }
    return null;
  }

  /**
   * Les noms que la base ACCEPTERA, et eux seuls.
   *
   * Proposer un nom pour se voir refuser ensuite est pire que ne pas le
   * proposer : on croit avoir confié le dossier. Un commercial ne voit donc
   * que le sien.
   */
  const affectables = peutAffecterAutrui
    ? membres
    : membres.filter((m) => m.userId === moiUserId);

  /**
   * Confier le dossier.
   *
   * DEUX CHEMINS, et leur asymétrie est voulue : prendre un dossier libre
   * passe par « claim », réaffecter celui d'un collègue par « assign », que la
   * base réserve à l'encadrement. Sans cette distinction, deux associés se
   * reprendraient leurs dossiers sans que l'autre le sache.
   */
  async function confierA(userId: string) {
    if (attribution) return;
    setAttribution(true);
    setErreur(null);
    const r = await safeAction(() =>
      userId === moiUserId
        ? selfAssignBuyerAction({ buyerProfileId: row.buyerProfileId })
        : assignBuyerAction({ buyerProfileId: row.buyerProfileId, userId }),
    );
    setAttribution(false);
    if (!r.ok) {
      setErreur(r.error ?? "L’attribution a échoué.");
      return;
    }
    onEnregistre();
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
    const etapeDeduite = etapeAutomatique();

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
        stage: etape ?? etapeDeduite,
        nextActionKind: typeAction === "aucune" ? null : typeAction,
        nextActionAt: depuisChampLocal(quand),
        nextActionTitle:
          typeAction === "visite"
            ? "Visite"
            : typeAction === "rappel"
              ? "Rappeler"
              : titreAction.trim() || null,
        nextActionAssignee: responsable,
        /* Solder le rappel qui a amené ce dossier dans la file — MAIS
           seulement si un échange a réellement eu lieu.
           Il était soldé à CHAQUE sauvegarde : corriger une qualification,
           ou rattraper une étape, faisait disparaître le rappel sans que rien
           ne le dise. Un rappel qu'on n'a pas honoré ne doit pas s'effacer
           parce qu'on a touché au dossier pour autre chose. */
        completeTaskId: activite ? row.nextActionId : null,
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
  /* Le titulaire du dossier, s'il y en a un. La ligne ne porte que des
     identifiants ; les noms sont déjà là, dans l'équipe passée en props —
     aucune requête de plus pour afficher qui suit. */
  /**
   * LE DERNIER ÉCHANGE, QUEL QU'IL SOIT.
   *
   * La ligne porte deux traces distinctes : le dernier APPEL (avec son
   * résultat) et la dernière NOTE. Afficher le seul appel ferait disparaître
   * un e-mail ou un WhatsApp consigné depuis ; n'afficher que la note ferait
   * disparaître un appel sans réponse, qui n'en laisse aucune. On prend donc
   * la plus récente des deux, et on la nomme.
   */
  const dernierEchange: { quoi: string; quand: string | null } | null = (() => {
    const appel = row.lastCallAt ? Date.parse(row.lastCallAt) : null;
    const note = row.lastNoteAt ? Date.parse(row.lastNoteAt) : null;
    if (appel === null && note === null) return null;
    if (appel !== null && (note === null || appel >= note)) {
      return {
        quoi: row.lastCallOutcome ? activiteLabel(row.lastCallOutcome) : "Appel",
        quand: row.lastCallAt,
      };
    }
    return {
      quoi: row.lastNoteBy ? `Note de ${row.lastNoteBy}` : "Note",
      quand: row.lastNoteAt,
    };
  })();

  const responsableNom =
    row.assigneeIds.length === 0
      ? null
      : (row.assigneeIds
          .map((id) => membres.find((m) => m.userId === id)?.name)
          .filter(Boolean)
          .join(", ") || "un collègue");
  const budget = row.budgetChoice
    ? BUDGET_CHOICE_COURT[row.budgetChoice as BuyerBudgetChoice] ?? row.budgetChoice
    : null;

  return (
    <aside className="crm-panneau" aria-label={`Traitement de ${row.name}`}>
      {/* ---- En-tête : COMPRENDRE ET CONTACTER, sans rien dérouler ----------
          Qui, quels biens, quel budget, comment l'appeler, qui le suit, et où
          en est le dossier sur ses deux axes. Tout ce qu'il faut pour décrocher
          le téléphone tient ici, au-dessus de tout formulaire. */}
      <header className="crm-panneau__tete">
        <div className="crm-panneau__tete-haut">
        <div className="min-w-0 flex-1">
          <p className="crm-panneau__rang">
            {position > 0 && total > 0 ? `Dossier ${position} sur ${total}` : "Dossier"}
          </p>
          <h2 className="crm-panneau__nom">
              {row.name}
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
        </div>

        {/* Les boutons d'appel AVANT le formulaire : le geste le plus fréquent
            ne doit jamais se mériter par un défilement. */}
        <ContactRapide numero={row.phoneMasked} email={row.emailMasked} />

        {/* Les DEUX axes, côte à côte et toujours visibles. Ils répondent à deux
            questions distinctes — où en est le dossier, ce qu'on en pense — et
            ne se déduisent jamais l'un de l'autre. */}
        <div className="crm-panneau__axes">
          <ChoixEtape
            valeur={etape}
            actuelle={row.stage}
            onChoisir={setEtape}
            disabled={enCours}
          />
          <ChoixQualification
            valeur={qualification}
            actuelle={row.qualification}
            onChoisir={setQualification}
            disabled={enCours}
          />
          {/* Le responsable se lit ici, et se prend ici. Un dossier libre qu'on
              s'apprête à appeler doit pouvoir être pris sans quitter l'écran —
              sinon deux commerciaux appellent la même personne. */}
          {responsableNom ? (
            <span className="crm-panneau__suivi" title="Responsable du dossier">
              Suivi par {responsableNom}
            </span>
          ) : (
            /* LES NOMS POSSIBLES, pas un bouton unique. « M'attribuer » ne
               disait pas qu'on pouvait confier le dossier a quelqu'un d'autre,
               et obligeait a ouvrir la fiche pour le faire. La liste est
               limitee a ce que la base acceptera : moi seul si je suis
               commercial, toute l'equipe si j'encadre. */
            <select
              className="crm-panneau__attribuer-choix"
              value=""
              disabled={attribution || enCours}
              aria-label="Confier ce dossier"
              onChange={(e) => {
                const id = e.target.value;
                if (id) void confierA(id);
              }}
            >
              <option value="">{attribution ? "…" : "Confier à…"}</option>
              {affectables.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === moiUserId ? `${m.name} (moi)` : m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Le motif n'apparaît que s'il est exigé : un champ qui attend sans
            servir fait croire qu'il manque une réponse. */}
        {qualification === "non_qualifie" ? (
          <select
            className="crm-select w-full"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            disabled={enCours}
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

      {row.phoneInvalid ? (
        <p className="crm-panneau__alerte" role="status">
          Numéro signalé invalide : ce dossier est sorti de la file d’appels. Passez par e-mail,
          ou corrigez le numéro dans le dossier.
        </p>
      ) : null}

      <div className="crm-panneau__corps">
        {/* ---- LE CONTEXTE, AVANT LE FORMULAIRE -------------------------------
            Ce qu'on doit SAVOIR passe avant ce qu'on doit SAISIR. La dernière
            note vivait tout en bas, après les onze boutons et les trois
            formulaires : la seule phrase qui dit de quoi on a parlé la
            dernière fois arrivait après tout ce qui sert à parler. */}
        <section className="crm-contexte" aria-label="Où en est ce dossier">
          <div className="crm-contexte__ligne">
            <span className="crm-contexte__etiquette">À faire</span>
            {row.nextActionAt ? (
              <span className={row.overdue ? "crm-contexte__retard" : undefined}>
                {row.nextActionTitle ?? "Tâche"} · {dateCourte(row.nextActionAt)}
                {row.overdue ? " — en retard" : ""}
              </span>
            ) : (
              <span className="crm-contexte__vide">Rien de programmé</span>
            )}
          </div>

          <div className="crm-contexte__ligne">
            <span className="crm-contexte__etiquette">Dernier échange</span>
            {dernierEchange ? (
              <span>
                {dernierEchange.quoi}
                {dernierEchange.quand ? ` · ${dateCourte(dernierEchange.quand)}` : ""}
                {row.callAttempts > 0
                  ? ` · ${row.callAttempts} tentative${row.callAttempts > 1 ? "s" : ""}`
                  : ""}
              </span>
            ) : (
              <span className="crm-contexte__vide">Aucun échange enregistré</span>
            )}
          </div>

          {/* La note en entier, pas tronquée : c'est elle qu'on relit avant de
              décrocher, et une note coupée au milieu ne sert à rien. */}
          {row.lastNote ? (
            <p className="crm-contexte__note">
              <span className="crm-contexte__note-date">{dateCourte(row.lastNoteAt)}</span>
              {row.lastNote}
            </p>
          ) : null}

          <button type="button" className="crm-contexte__tout" onClick={ouvrirLaFiche}>
            Tout l’historique
          </button>
        </section>

        {/* ---- UN SEUL BLOC : ENREGISTRER UN ÉCHANGE ---------------------------
            Quatre sections demandaient quatre décisions là où il n'y en a
            qu'une : ce qui s'est passé, et ce qu'on fait ensuite. L'étape et la
            qualification vivent désormais dans l'en-tête, toujours visibles et
            modifiables — mais jamais exigées pour enregistrer un appel. */}
        <section className="crm-bloc">
          <h3 className="crm-bloc__titre">Enregistrer un échange</h3>
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

          <div className="crm-bloc__suite">
            <p className="crm-label">La suite à donner</p>
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
            {/* Dire ce que la sauvegarde va faire SEULE, avant qu'elle le
                fasse. Une étape qui bouge sans annonce se lit comme un bug. */}
            {etape === null && etapeAutomatique() ? (
              <p className="crm-bloc__deduit">
                L’étape passera à « {etapeLabel(etapeAutomatique()!)} ».
              </p>
            ) : null}
            {/* Ce qui va être soldé, annoncé avant de l'être : une tâche qui
                disparaît en silence se lit comme une tâche perdue. */}
            {activite && row.nextActionId ? (
              <p className="crm-bloc__deduit">
                « {row.nextActionTitle ?? "La tâche en cours"} » sera marquée faite.
              </p>
            ) : null}
          </div>
        </section>
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
