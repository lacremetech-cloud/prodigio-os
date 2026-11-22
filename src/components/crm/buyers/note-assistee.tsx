"use client";

import { useEffect, useRef, useState } from "react";
import { structurerNoteAction } from "@/modules/buyers/crm/actions";
import { safeAction } from "@/modules/crm/safe-action";

/**
 * LA NOTE, DICTÉE PUIS MISE EN FORME.
 *
 * « Il raccroche, il fait un audio dans le CRM, l'IA nous met carré en
 * écriture. » Deux gestes, dans cet ordre, et le second ne dépend pas du
 * premier : on peut aussi coller un transcript d'appel et demander la mise en
 * forme sans avoir dicté un mot.
 *
 * TROIS RÈGLES QUI NE BOUGENT PAS :
 *
 *  1. La dictée AJOUTE, elle n'écrase jamais. On dicte souvent en deux fois,
 *     et perdre la première moitié en reprenant la parole serait le genre de
 *     défaut qui fait abandonner l'outil le jour même.
 *  2. La mise en forme est RÉVERSIBLE. Le texte d'origine est gardé tant que
 *     le panneau est ouvert : si la version mise en forme ne convient pas, un
 *     bouton rend la dictée mot pour mot.
 *  3. Rien n'est enregistré ici. Le bouton rend un brouillon dans la même zone
 *     de texte qu'avant ; c'est le commercial qui relit et enregistre.
 */

/* Le navigateur n'a pas de types pour cette API : elle n'est pas standardisée,
   et Chrome l'expose encore préfixée. On déclare le strict nécessaire plutôt
   que d'ajouter une dépendance pour quatre propriétés. */
interface ResultatDictee {
  readonly isFinal: boolean;
  readonly length: number;
  item(i: number): { transcript: string };
  [i: number]: { transcript: string };
}
interface EvenementDictee {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    item(i: number): ResultatDictee;
    [i: number]: ResultatDictee;
  };
}
interface Dictaphone {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: EvenementDictee) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type FabriqueDictaphone = new () => Dictaphone;

function fabriqueDictaphone(): FabriqueDictaphone | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: FabriqueDictaphone;
    webkitSpeechRecognition?: FabriqueDictaphone;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function NoteAssistee({
  buyerProfileId,
  note,
  onNote,
  disabled,
  resumeDisponible,
}: {
  buyerProfileId: string;
  note: string;
  onNote: (v: string) => void;
  disabled?: boolean;
  /** Faux si la clé d'API manque : le bouton ne s'affiche alors pas du tout,
      plutôt que de proposer une action qui échouerait. */
  resumeDisponible: boolean;
}) {
  const [dicteePossible, setDicteePossible] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Le texte d'avant la mise en forme, pour pouvoir y revenir. */
  const [avant, setAvant] = useState<string | null>(null);
  const dictaphone = useRef<Dictaphone | null>(null);

  /* La détection se fait APRÈS le montage : au rendu serveur, `window`
     n'existe pas, et afficher le bouton puis le retirer ferait sauter
     l'interface. Firefox ne sait pas dicter : on n'y montre rien. */
  useEffect(() => {
    setDicteePossible(fabriqueDictaphone() !== null);
  }, []);

  /* Un dictaphone encore à l'écoute après la fermeture du panneau continue de
     capter le micro — et la pastille rouge reste allumée dans l'onglet. */
  useEffect(() => {
    return () => {
      try {
        dictaphone.current?.stop();
      } catch {
        /* déjà arrêté : rien à faire */
      }
    };
  }, []);

  function basculerDictee() {
    if (ecoute) {
      dictaphone.current?.stop();
      return;
    }
    const Fabrique = fabriqueDictaphone();
    if (!Fabrique) return;

    const appareil = new Fabrique();
    appareil.lang = "fr-FR";
    appareil.continuous = true;
    appareil.interimResults = false;

    appareil.onresult = (e) => {
      let ajout = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r?.isFinal) ajout += r[0]?.transcript ?? "";
      }
      if (!ajout.trim()) return;
      /* On lit la valeur courante au moment de l'ajout : entre deux phrases
         dictées, le commercial a pu taper au clavier. */
      onNote(`${note}${note && !note.endsWith(" ") ? " " : ""}${ajout.trim()}`);
    };
    appareil.onerror = (e) => {
      setEcoute(false);
      setMessage(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Micro refusé. Autorisez-le dans la barre d’adresse, puis réessayez."
          : "La dictée s’est interrompue. Votre texte est intact.",
      );
    };
    appareil.onend = () => setEcoute(false);

    try {
      appareil.start();
      dictaphone.current = appareil;
      setEcoute(true);
      setMessage(null);
    } catch {
      setMessage("La dictée n’a pas pu démarrer.");
    }
  }

  async function mettreEnForme() {
    if (!note.trim() || enCours) return;
    /* On coupe le micro d'abord : laisser la dictée tourner pendant que le
       texte est remplacé mélangerait les deux. */
    if (ecoute) dictaphone.current?.stop();
    setEnCours(true);
    setMessage(null);
    const origine = note;
    /* `safeAction` : une exception non rattrapée démonterait l'écran et
       emporterait la note qu'on vient de dicter. C'est l'incident du 25 août,
       et le garde-fou qui l'empêche vaut pour cet appel comme pour les autres. */
    const r = await safeAction(() => structurerNoteAction({ buyerProfileId, brut: note }));
    setEnCours(false);
    if (!r.ok) {
      setMessage(r.error ?? "La mise en forme n’a pas abouti.");
      return;
    }
    const mise = "note" in r ? r.note : undefined;
    const tronquee = "tronquee" in r ? r.tronquee : false;
    setAvant(origine);
    onNote(mise ?? origine);
    setMessage(
      tronquee
        ? "Mis en forme. Le texte était très long : seul le début a été utilisé."
        : "Mis en forme. Relisez avant d’enregistrer.",
    );
  }

  function revenirAvant() {
    if (avant === null) return;
    onNote(avant);
    setAvant(null);
    setMessage("Texte d’origine rétabli.");
  }

  if (!dicteePossible && !resumeDisponible) return null;

  return (
    <div className="crm-note-outils">
      {dicteePossible ? (
        <button
          type="button"
          onClick={basculerDictee}
          disabled={disabled || enCours}
          aria-pressed={ecoute}
          className={`crm-btn crm-btn--sm ${ecoute ? "crm-note-outils__ecoute" : ""}`}
        >
          {ecoute ? "■ Arrêter la dictée" : "● Dicter"}
        </button>
      ) : null}

      {resumeDisponible ? (
        <button
          type="button"
          onClick={mettreEnForme}
          disabled={disabled || enCours || !note.trim()}
          className="crm-btn crm-btn--sm"
          title="Reprend votre dictée ou votre transcript et la remet au format attendu"
        >
          {enCours ? "Mise en forme…" : "Mettre en forme"}
        </button>
      ) : null}

      {avant !== null ? (
        <button
          type="button"
          onClick={revenirAvant}
          disabled={disabled || enCours}
          className="crm-btn crm-btn--sm crm-btn--ghost"
        >
          Revenir à ma version
        </button>
      ) : null}

      {/* `aria-live` : la dictée et la mise en forme changent le texte sans
          que rien ne bouge visuellement à l'endroit où l'on regarde. */}
      {message ? (
        <p className="crm-note-outils__message" role="status" aria-live="polite">
          {message}
        </p>
      ) : ecoute ? (
        <p className="crm-note-outils__message" role="status" aria-live="polite">
          À l’écoute — parlez, le texte s’ajoute au fur et à mesure.
        </p>
      ) : null}
    </div>
  );
}
