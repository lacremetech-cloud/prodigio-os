import { describe, expect, it } from "vitest";

import { MESSAGE_WHATSAPP, lienWhatsApp } from "./message-whatsapp";

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
