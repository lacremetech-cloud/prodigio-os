import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ecrireNavigation } from "./navigation";

/**
 * LES FILTRES SURVIVENT À L'ALLER-RETOUR VERS UNE FICHE.
 *
 * Signalé le 5 novembre : « lorsque l'on met des filtres, que l'on clique sur
 * un prospect, si on revient en arrière pour revenir sur la liste des
 * prospects tous les filtres se sont enlevés et il faut à chaque fois les
 * remettre ».
 *
 * Le défaut était entier : sur la liste, cinq filtres ne vivaient QUE dans la
 * mémoire du composant. Le « Précédent » du navigateur revenait sur une
 * adresse qui n'avait jamais su qu'ils existaient. Et le lien « ← Boîte de
 * réception » de la fiche ne reconduisait que le projet et le signal — ni le
 * budget, ni la qualification, ni l'étape, ni le responsable.
 *
 * Ce fichier garde les deux chemins de retour, parce qu'ils sont distincts et
 * qu'on en utilise l'un ou l'autre sans y penser.
 */

describe("l'adresse sait écrire les cinq filtres", () => {
  it("les porte tous ensemble", () => {
    const q = ecrireNavigation({
      projets: ["p1"],
      vue: "liste",
      signal: "en_retard",
      budget: "plus_1m",
      qualification: "a_qualifier",
      stage: "a_rappeler",
      responsable: "aucun",
    });
    for (const attendu of [
      "projets=p1",
      "signal=en_retard",
      "budget=plus_1m",
      "qualification=a_qualifier",
      "stage=a_rappeler",
      "responsable=aucun",
    ]) {
      expect(q, attendu).toContain(attendu);
    }
  });

  it("n'écrit pas ce qui ne filtre rien", () => {
    // Une adresse qui porte « budget=tous » est une adresse plus longue qui ne
    // dit rien de plus — et elle se partage moins bien.
    const q = ecrireNavigation({
      projets: [],
      vue: "liste",
      signal: "tous",
      budget: "tous",
      qualification: "tous",
      stage: "tous",
      responsable: "tous",
    });
    expect(q).toBe("");
  });
});

describe("chemin 1 — le lien « ← Boîte de réception » de la fiche", () => {
  const fiche = readFileSync("src/app/crm/acquereurs/[id]/page.tsx", "utf8");

  it("reconduit les cinq filtres, pas seulement le projet et le signal", () => {
    const debut = fiche.indexOf("const retour =");
    expect(debut).toBeGreaterThan(-1);
    const bloc = fiche.slice(debut, debut + 900);
    for (const cle of ["signal", "budget", "qualification", "stage", "responsable"]) {
      expect(bloc, cle).toContain(`nav.${cle}`);
    }
  });
});

describe("chemin 2 — le « Précédent » du navigateur", () => {
  const inbox = readFileSync("src/components/crm/buyers/buyer-inbox.tsx", "utf8");

  it("la liste écrit ses filtres dans l'adresse", () => {
    // Sans ça, « Précédent » revient sur une adresse nue et tout est perdu.
    expect(inbox).toContain("window.history.replaceState");
    for (const cle of ["signal", "budget", "qualification", "stage", "responsable"]) {
      expect(inbox, cle).toContain(`poser("${cle}"`);
    }
  });

  it("LE PIÈGE ÉVITÉ : aucun rechargement serveur à chaque clic de pastille", () => {
    /*
     * `router.replace` aurait redemandé la page au serveur à chaque clic —
     * exactement la tempête de rechargements qu'un travail précédent a
     * supprimée, sur l'écran le plus chargé du CRM. `replaceState` n'écrit que
     * l'adresse.
     *
     * On vérifie que l'effet de synchronisation n'appelle pas le routeur.
     */
    const debut = inbox.indexOf("window.history.replaceState");
    expect(debut).toBeGreaterThan(-1);
    const effet = inbox.slice(Math.max(0, debut - 1200), debut + 400);
    expect(effet).not.toContain("router.replace");
    expect(effet).not.toContain("router.push");
  });

  it("filtrer n'empile pas d'entrées d'historique", () => {
    // Avec `push`, revenir en arrière déferait les filtres un par un au lieu
    // de quitter la liste.
    expect(inbox).not.toContain("window.history.pushState");
  });

  it("la liste relit ces filtres au chargement", () => {
    const page = readFileSync("src/app/crm/acquereurs/page.tsx", "utf8");
    expect(page).toContain("stageInitial");
    expect(page).toContain("responsableInitial");
    expect(page).toContain("qualificationInitiale");
    expect(page).toContain("budgetInitial");
  });
});

describe("le contexte emporté vers la fiche est l'état VIVANT", () => {
  it("la liste recompose le contexte à partir des filtres courants", () => {
    // La photo prise par le serveur au chargement ne connaît pas les clics
    // faits depuis : s'en contenter ramenait aux filtres qu'on avait en
    // arrivant, pas à ceux qu'on venait de poser.
    const inbox = readFileSync("src/components/crm/buyers/buyer-inbox.tsx", "utf8");
    expect(inbox).toContain("contexteVivant");
    expect(inbox).toContain("contexte={contexteVivant}");
  });

  it("le pipeline emporte lui aussi les trois axes", () => {
    /* On vise le contexte du TABLEAU, celui qui mène à une fiche. La page en
       porte un second, sur le bandeau « N non qualifiées hors traitement » :
       celui-là ouvre délibérément un AUTRE écran — les dossiers que le
       pipeline écarte — et n'a donc pas à transporter les filtres courants. */
    const pipeline = readFileSync("src/app/crm/acquereurs/pipeline/page.tsx", "utf8");
    const tableau = pipeline.indexOf("<BuyerKanbanBoard");
    expect(tableau).toBeGreaterThan(-1);
    const debut = pipeline.indexOf("contexte={ecrireNavigation(", tableau);
    expect(debut).toBeGreaterThan(-1);
    const bloc = pipeline.slice(debut, debut + 300);
    expect(bloc).toContain("budget");
    expect(bloc).toContain("qualification");
  });
});
