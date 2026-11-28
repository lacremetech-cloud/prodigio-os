import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSIGNE, LONGUEUR_MAX_QUESTION, repondreSurLeBien } from "./assistant";

/**
 * L'ASSISTANT DU DOSSIER.
 *
 * Ces tests ne jugent pas la qualité d'une réponse — cela se juge en la
 * lisant. Ils verrouillent deux choses qui ne doivent jamais bouger : les
 * garde-fous de la consigne, et le fait que la route soit DERRIÈRE LE CODE.
 *
 * Ce second point est le vrai danger de cette fonctionnalité. Une API posée à
 * côté d'une page protégée, et qui oublie de vérifier ce que la page vérifie,
 * est une porte dérobée : il suffirait de demander « combien de chambres ? »
 * pour obtenir ce que le code protège. On ne le découvre pas en regardant
 * l'écran, parce que l'écran, lui, est bien fermé.
 */

describe("la consigne de l'assistant", () => {
  it("interdit d'inventer, et donne la phrase de repli", () => {
    /* Un brief sert à tourner et à écrire des publicités : une surface
       inventée part dans une annonce. « Ce n'est pas dans le dossier » est
       une bonne réponse ; une phrase plausible et fausse n'en est pas une. */
    expect(CONSIGNE).toContain("N'INVENTE RIEN");
    expect(CONSIGNE).toContain("Ce n'est pas dans le dossier");
  });

  it("demande de signaler les interdits de communication", () => {
    /* Le dossier porte des choses qu'on ne dit jamais en publicité. Si
       l'assistant les restitue sans les signaler, elles finissent dans un
       script. */
    expect(CONSIGNE).toContain("INTERDITS DE COMMUNICATION");
  });

  it("demande de distinguer le documenté du dit-de-mémoire", () => {
    /* Le dossier le dit lui-même : le mandataire a répondu de mémoire, et
       diverge des relevés sur plusieurs points. Un assistant qui mélange les
       deux rendrait un chiffre faux avec l'autorité d'un chiffre vrai. */
    expect(CONSIGNE.toLowerCase()).toContain("mémoire");
    expect(CONSIGNE.toLowerCase()).toContain("documentée");
  });

  it("demande une réponse brève : on la lit entre deux prises", () => {
    expect(CONSIGNE.toLowerCase()).toContain("brièvement");
  });
});

describe("l'appel au modèle", () => {
  it("ne part pas sans clé, et le dit clairement", async () => {
    /* Dormant tant que la clé est absente, plutôt qu'une erreur opaque. */
    const r = await repondreSurLeBien("Combien de chambres ?", "matière", {
      ANTHROPIC_API_KEY: undefined,
    });
    expect(r).toEqual({ ok: false, motif: "non_configure" });
  });

  it("ne part pas sur une question vide", async () => {
    const r = await repondreSurLeBien("   \n  ", "matière", { ANTHROPIC_API_KEY: "test" });
    expect(r).toEqual({ ok: false, motif: "vide" });
  });
});

describe("la route des questions", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "app", "briefs", "[slug]", "question", "route.ts"),
    "utf8",
  );

  it("vérifie le jeton de lecture avant tout", () => {
    /* LE test de cette fonctionnalité. Sans cette ligne, la route répond à
       n'importe qui sur un dossier confidentiel. */
    expect(source).toContain("jetonValide");
    const verification = source.indexOf("jetonValide");
    const appelModele = source.indexOf("repondreSurLeBien");
    expect(verification).toBeGreaterThan(-1);
    expect(appelModele).toBeGreaterThan(verification);
  });

  it("refuse par un 403, sans dire si le bien existe", () => {
    /* Distinguer « ce bien n'existe pas » de « code faux » renseignerait un
       curieux sur ce qui existe. Une seule réponse pour les deux. */
    expect(source).toContain("403");
    expect(source).toContain("Accès refusé.");
  });

  it("plafonne le nombre de questions", () => {
    /* Une route qui appelle un modèle payant, ouverte à qui a le code, sans
       plafond, est une facture qui attend un onglet laissé ouvert. */
    expect(source).toContain("PLAFOND");
    expect(source).toContain("429");
  });

  it("borne la longueur de la question", () => {
    expect(source).toContain("LONGUEUR_MAX_QUESTION");
    expect(LONGUEUR_MAX_QUESTION).toBeLessThanOrEqual(2_000);
  });
});

describe("la bulle, dans le document", () => {
  const document = readFileSync(
    join(process.cwd(), "src", "content", "briefs", "chalet-6511.ts"),
    "utf8",
  );

  it("n'appelle plus l'interface d'artefact, qui n'existe pas ici", () => {
    expect(document).not.toContain("window.claude");
  });

  it("interroge la route protégée du bien", () => {
    expect(document).toContain("/briefs/chalet-6511/question");
  });

  it("n'écrit jamais la réponse du modèle en HTML brut", () => {
    /* La réponse vient d'un modèle, qui lit un dossier. On ne lui laisse pas
       poser de balises dans la page. */
    expect(document).not.toContain("innerHTML");
    expect(document).toContain("textContent");
  });
});
