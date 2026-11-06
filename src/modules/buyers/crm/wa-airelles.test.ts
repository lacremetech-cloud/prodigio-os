import { describe, expect, it } from "vitest";
import { composerWhatsApp, lienWhatsApp } from "@/modules/buyers/crm/message-whatsapp";

// Le texte EXACT lu en base ce 6 novembre apres l'alignement.
const MODELE =
  "Bonjour [Prénom], je me présente, Édouard, votre contact sur place pour le projet des appartements aux 2 Alpes. Vous avez normalement reçu la brochure, et je suis là pour répondre à toutes vos questions. Si vous voulez, on peut se programmer un petit échange de 10 minutes au téléphone. Qu’est-ce qui vous arrangerait le mieux, plutôt en journée ou en soirée ? Au plaisir d’échanger !";

describe("le message WhatsApp des Airelles, tel qu'il est en base", () => {
  it("avec un prénom", () => {
    const t = composerWhatsApp(MODELE, "Rayyân");
    expect(t.startsWith("Bonjour Rayyân, je me présente, Édouard, votre contact sur place")).toBe(true);
  });

  it("sans prénom : la virgule reste, pas de trou", () => {
    const t = composerWhatsApp(MODELE, null);
    expect(t.startsWith("Bonjour, je me présente, Édouard, votre contact sur place")).toBe(true);
    expect(t).not.toContain("[Prénom]");
    expect(t).not.toContain("Bonjour ,");
  });

  it("le lien WhatsApp se construit sur le numéro du prospect", () => {
    const l = lienWhatsApp("+33 6 12 34 56 78", MODELE, "Rayyân");
    expect(l).toContain("33612345678");
    expect(decodeURIComponent(l!)).toContain("je me présente, Édouard");
  });
});
