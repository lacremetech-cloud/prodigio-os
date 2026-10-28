import { describe, expect, it } from "vitest";

import {
  LANGUES_FORMULAIRE,
  TEXTES_FORMULAIRE,
  normaliserLangue,
  textes,
  versionMention,
} from "./langue";
import {
  BUDGET_CHOICE_LABELS,
  BUDGET_QUESTION,
  BUYER_BUDGET_CHOICES,
  UNIVERSAL_STEPS,
} from "./universal";
import { UNIVERSAL_PRIVACY_NOTICE } from "./universal-payload";

describe("lecture du paramètre de langue", () => {
  it("reconnaît les deux langues servies", () => {
    expect(normaliserLangue("fr")).toBe("fr");
    expect(normaliserLangue("en")).toBe("en");
  });

  it("accepte les variantes qu'un navigateur ou une pub peuvent produire", () => {
    // `?lang=en-GB` vient d'un lien construit à la main ; `EN` d'une faute de
    // frappe. Aucun des deux ne doit renvoyer un Britannique vers le français.
    expect(normaliserLangue("en-GB")).toBe("en");
    expect(normaliserLangue("EN")).toBe("en");
    expect(normaliserLangue(" en ")).toBe("en");
    expect(normaliserLangue("en-US")).toBe("en");
  });

  it("retombe sur le français plutôt que de casser", () => {
    // Une URL mal copiée doit afficher un formulaire valide, pas une erreur.
    expect(normaliserLangue(undefined)).toBe("fr");
    expect(normaliserLangue(null)).toBe("fr");
    expect(normaliserLangue("")).toBe("fr");
    expect(normaliserLangue("de")).toBe("fr");
    expect(normaliserLangue("n'importe quoi")).toBe("fr");
  });

  it("prend la première valeur quand le paramètre est répété", () => {
    expect(normaliserLangue(["en", "fr"])).toBe("en");
  });
});

describe("le français ne bouge pas", () => {
  // Ce bloc garde les deux villas de Cassis : leurs formulaires tournent
  // aujourd'hui et ne doivent RIEN voir changer.
  const fr = textes("fr");

  it("réutilise les textes d'origine, sans les recopier", () => {
    expect(fr.questionBudget).toBe(BUDGET_QUESTION);
    expect(fr.choixBudget).toBe(BUDGET_CHOICE_LABELS);
    expect(fr.mentionConfidentialite).toBe(UNIVERSAL_PRIVACY_NOTICE);
    expect(fr.titresEtapes).toEqual([UNIVERSAL_STEPS[0].title, UNIVERSAL_STEPS[1].title]);
  });

  it("compose le fil d'étapes comme avant", () => {
    expect(fr.etape(1, "Votre projet")).toBe("Étape 1 / 2 · Votre projet");
    expect(fr.etapeAria(2)).toBe("Étape 2 sur 2");
  });
});

describe("l'anglais", () => {
  const en = textes("en");

  it("couvre exactement les mêmes codes de budget", () => {
    // LE POINT QUI COMPTE. La réponse est stockée sous forme de CODE, et ce
    // code pilote le score, l'alerte au-dessus d'1 M€ et le choix du modèle
    // d'e-mail. Un code traduit dans une langue et pas dans l'autre, et un
    // prospect anglais se retrouverait sans libellé — ou pire, mal classé.
    expect(Object.keys(en.choixBudget).sort()).toEqual([...BUYER_BUDGET_CHOICES].sort());
  });

  it("annonce les montants en euros, jamais en livres", () => {
    // Des tranches en livres feraient dire au même code deux choses
    // différentes selon la langue : £500 000 valent environ 575 000 €.
    const montants = Object.values(en.choixBudget).join(" ");
    expect(montants).toContain("€");
    expect(montants).not.toMatch(/[£$]/);
  });

  it("écrit les nombres à l'anglaise", () => {
    // « 1,2 M€ » se lit « 12 » pour un anglophone. Le séparateur de milliers
    // est la virgule, et le symbole passe DEVANT le nombre.
    expect(en.choixBudget["500k_1m"]).toContain("€500,000");
    expect(en.choixBudget["500k_1m"]).not.toContain("500 000");
  });

  it("ne laisse aucun texte en français", () => {
    const suspects = ["Étape", "Brochure vous", "Votre demande", "Merci", "Téléphone", "Prénom"];
    const tout = JSON.stringify({
      ...en,
      etape: en.etape(1, "Your project"),
      etapeAria: en.etapeAria(1),
      confirmationCorps: en.confirmationCorps("Les Airelles"),
    });
    for (const mot of suspects) expect(tout, mot).not.toContain(mot);
  });

  it("tient debout sans nom de bien", () => {
    // La vitrine n'est pas toujours publiée : la phrase doit rester correcte.
    expect(en.confirmationCorps(null)).toBe("Thank you. We will get back to you shortly.");
    expect(en.confirmationCorps("Les Airelles")).toContain("about Les Airelles");
  });
});

describe("toutes les langues", () => {
  it("portent exactement les mêmes clés", () => {
    // Une clé oubliée en anglais afficherait « undefined » à un prospect.
    const [fr, en] = LANGUES_FORMULAIRE.map((l) => Object.keys(TEXTES_FORMULAIRE[l]).sort());
    expect(en).toEqual(fr);
  });

  it("n'ont aucune chaîne vide", () => {
    for (const langue of LANGUES_FORMULAIRE) {
      for (const [cle, valeur] of Object.entries(TEXTES_FORMULAIRE[langue])) {
        if (typeof valeur === "string") expect(valeur.trim(), `${langue}.${cle}`).not.toBe("");
      }
    }
  });

  it("portent la langue dans le numéro de version de la mention", () => {
    // `consent_notice_text` conserve le texte MONTRÉ. Le numéro de version
    // doit dire dans quelle langue il l'a été, sinon la preuve est muette.
    expect(versionMention("fr")).toMatch(/-fr$/);
    expect(versionMention("en")).toMatch(/-en$/);
    expect(versionMention("fr")).not.toBe(versionMention("en"));
  });
});
