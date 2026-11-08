import { describe, expect, it } from "vitest";

import { MESSAGE_WHATSAPP, composerWhatsApp, lienWhatsApp } from "./message-whatsapp";

/** Le texte dicté, recopié ici indépendamment du module : si l'un des deux
 *  bouge, le test casse. C'est le seul garde-fou contre une faute qui partirait
 *  à des acquéreurs. */
const ATTENDU = [
  "Bonjour,",
  "Je suis le propriétaire de la maison à Cassis pour laquelle vous avez fait une demande d’information. Je me suis permis de vous envoyer un email intégrant la brochure de la maison qui vous intéresse ainsi qu’une seconde maison située à 3 min seulement.",
  "",
  "N’hésitez pas à me rappeler quand vous le pourrez pour échanger et organiser une visite. Je me permettrai également de vous rappeler très prochainement.",
  "",
  "Bien cordialement,",
  "Jean-Charles Castellano",
  "06 68 68 04 07",
].join("\n");

describe("le message WhatsApp prérempli", () => {
  it("est exactement celui qui a été dicté", () => {
    expect(MESSAGE_WHATSAPP).toBe(ATTENDU);
  });

  it("garde ses accents et ses apostrophes typographiques", () => {
    expect(MESSAGE_WHATSAPP).toContain("propriétaire");
    expect(MESSAGE_WHATSAPP).toContain("intégrant");
    expect(MESSAGE_WHATSAPP).toContain("située");
    expect(MESSAGE_WHATSAPP).toContain("d’information");
    expect(MESSAGE_WHATSAPP).toContain("qu’une");
    expect(MESSAGE_WHATSAPP).toContain("N’hésitez");
    // L'apostrophe droite trahirait un copier-coller abîmé.
    expect(MESSAGE_WHATSAPP).not.toContain("d'information");
  });

  it("garde ses deux lignes vides, donc ses trois paragraphes", () => {
    expect(MESSAGE_WHATSAPP.split("\n\n")).toHaveLength(3);
  });

  it("se termine par la signature et le numéro", () => {
    expect(MESSAGE_WHATSAPP.endsWith("Jean-Charles Castellano\n06 68 68 04 07")).toBe(true);
  });

  it("ne contient aucune variable oubliée", () => {
    expect(MESSAGE_WHATSAPP).not.toMatch(/\{\{|\}\}|\$\{|undefined|null/);
  });
});

describe("le lien WhatsApp", () => {
  it("vise le bon destinataire, en chiffres seulement", () => {
    expect(lienWhatsApp("+33 6 12 34 56 78")).toMatch(/^https:\/\/wa\.me\/33612345678\?text=/);
    expect(lienWhatsApp("06.12.34.56.78")).toMatch(/^https:\/\/wa\.me\/0612345678\?text=/);
  });

  it("transporte le message sans l'abîmer", () => {
    const lien = lienWhatsApp("+33612345678")!;
    const texte = decodeURIComponent(new URL(lien).searchParams.get("text") ?? "");
    expect(texte).toBe(MESSAGE_WHATSAPP);
  });

  it("encode les sauts de ligne plutôt que de les perdre", () => {
    expect(lienWhatsApp("0612345678")).toContain("%0A");
  });

  it("ne rend pas de lien quand il n'y a aucun chiffre", () => {
    for (const v of [null, undefined, "", "   ", "non renseigné"]) {
      expect(lienWhatsApp(v)).toBeNull();
    }
  });
});

describe("le message WhatsApp est celui du BIEN", () => {
  /*
   * Le texte historique parle d'une « maison a Cassis » et d'« une seconde
   * maison situee a 3 min ». Envoye a un prospect des 2 Alpes — un
   * appartement, dans les Alpes, sans seconde maison — il est faux a chaque
   * ligne, et le bouton est a un clic sur chaque fiche.
   */
  const AIRELLES =
    "Bonjour [Prénom], moi c’est Édouard, votre contact sur place pour le projet des appartements aux 2 Alpes.";

  it("remplace le prénom quand on le connaît", () => {
    expect(composerWhatsApp(AIRELLES, "Rayyan")).toBe(
      "Bonjour Rayyan, moi c’est Édouard, votre contact sur place pour le projet des appartements aux 2 Alpes.",
    );
  });

  it("LE CAS QUI COMPTE : sans prénom, la phrase reste correcte", () => {
    // Un dépôt peut ne porter aucun prénom. Ni « Bonjour , » ni le crochet
    // tel quel, et la virgule reste : « Bonjour moi c’est » se lirait comme
    // une faute de frappe.
    for (const vide of [null, undefined, "", "   "]) {
      expect(composerWhatsApp(AIRELLES, vide), String(vide)).toBe(
        "Bonjour, moi c’est Édouard, votre contact sur place pour le projet des appartements aux 2 Alpes.",
      );
    }
  });

  it("ne laisse jamais le jeton dans un message envoyé", () => {
    for (const prenom of ["Rayyan", null, ""]) {
      expect(composerWhatsApp(AIRELLES, prenom)).not.toContain("[Prénom]");
    }
  });

  it("un bien sans message configuré retombe sur le texte historique", () => {
    // Mieux vaut un texte lisible qu'une conversation WhatsApp vide.
    for (const absent of [null, undefined, "", "   "]) {
      expect(composerWhatsApp(absent, "Rayyan")).toBe(MESSAGE_WHATSAPP);
    }
  });

  it("le texte de Cassis n'a pas de jeton, et n'est pas touché", () => {
    expect(MESSAGE_WHATSAPP).not.toContain("[Prénom]");
    expect(composerWhatsApp(MESSAGE_WHATSAPP, "Rayyan")).toBe(MESSAGE_WHATSAPP);
  });

  it("le lien porte le message du bien, pas un texte figé", () => {
    const lien = lienWhatsApp("+33 6 62 78 45 04", AIRELLES, "Rayyan")!;
    expect(lien).toContain("33662784504");
    expect(decodeURIComponent(lien)).toContain("Bonjour Rayyan, moi c’est Édouard");
  });
});

describe("le jeton qui ouvre le message", () => {
  /* Le modèle des Airelles commence par le prénom : « [Prénom] bonjour, ».
     Le jeton n'a alors aucune espace devant lui, et la règle de repli écrite
     pour « Bonjour [Prénom], » laissait sortir « bonjour, » — précédé d'une
     espace et privé de sa majuscule. */
  const MODELE = "[Prénom] bonjour,\n\nJe fais suite à votre intérêt.";

  it("place le prénom quand il existe", () => {
    expect(composerWhatsApp(MODELE, "Miguel")).toMatch(/^Miguel bonjour,/);
  });

  it("sans prénom, ouvre proprement sur une majuscule", () => {
    const r = composerWhatsApp(MODELE, null);
    expect(r).toMatch(/^Bonjour,/);
    expect(r.startsWith(" ")).toBe(false);
  });

  it("ne change rien à un modèle dont le jeton est au milieu", () => {
    expect(composerWhatsApp("Bonjour [Prénom], moi c’est Édouard.", null)).toBe(
      "Bonjour, moi c’est Édouard.",
    );
    expect(composerWhatsApp("Bonjour [Prénom], moi c’est Édouard.", "Miguel")).toBe(
      "Bonjour Miguel, moi c’est Édouard.",
    );
  });

  it("un prénom fait de blancs est traité comme absent", () => {
    expect(composerWhatsApp(MODELE, "   ")).toMatch(/^Bonjour,/);
  });
});
