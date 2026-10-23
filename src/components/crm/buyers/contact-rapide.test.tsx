// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ContactRapide } from "./contact-rapide";
import { MESSAGE_WHATSAPP } from "@/modules/buyers/crm/message-whatsapp";

afterEach(cleanup);

/**
 * Ce test existe parce qu'un module juste n'est pas un bouton juste. Le texte
 * peut être parfait dans `message-whatsapp.ts` et ne jamais atteindre le lien
 * sur lequel le commercial appuie. C'est le branchement qu'on vérifie ici, pas
 * la chaîne de caractères.
 */
function lienWa(): HTMLAnchorElement {
  return screen.getByRole("link", { name: /WhatsApp au/ }) as HTMLAnchorElement;
}

describe("le bouton WhatsApp des surfaces du CRM", () => {
  it("ouvre la conversation du prospect avec le message déjà écrit", () => {
    render(<ContactRapide numero="+33 6 12 34 56 78" email="a@b.fr" />);
    const url = new URL(lienWa().href);
    expect(url.host).toBe("wa.me");
    expect(url.pathname).toBe("/33612345678");
    expect(url.searchParams.get("text")).toBe(MESSAGE_WHATSAPP);
  });

  it("porte le même lien en version compacte, celle de la liste", () => {
    render(<ContactRapide numero="0612345678" compact />);
    expect(lienWa().href).toContain("%0A");
    expect(new URL(lienWa().href).searchParams.get("text")).toBe(MESSAGE_WHATSAPP);
  });

  it("n'affiche pas de bouton WhatsApp sans numéro exploitable", () => {
    render(<ContactRapide numero="non renseigné" email="a@b.fr" />);
    expect(screen.queryByRole("link", { name: /WhatsApp au/ })).toBeNull();
    // L'e-mail, lui, reste proposé : on ne retire pas plus que nécessaire.
    expect(screen.getByRole("link", { name: /Écrire à/ })).toBeTruthy();
  });

  it("laisse les boutons Appeler et E-mail intacts", () => {
    render(<ContactRapide numero="+33612345678" email="a@b.fr" />);
    expect(
      (screen.getByRole("link", { name: /Appeler le/ }) as HTMLAnchorElement).getAttribute("href"),
    ).toBe("tel:+33612345678");
    expect(
      (screen.getByRole("link", { name: /Écrire à/ }) as HTMLAnchorElement).getAttribute("href"),
    ).toBe("mailto:a@b.fr");
  });

  it("ouvre WhatsApp dans un autre onglet, sans ouvrir la fiche au passage", () => {
    render(<ContactRapide numero="0612345678" />);
    expect(lienWa().target).toBe("_blank");
    expect(lienWa().rel).toContain("noopener");
  });
});
