import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { estUnRobot, slugValide } = await import("./lien-brochure");

describe("forme d'un code de brochure", () => {
  it("accepte ce qu'on pose à la main", () => {
    expect(slugValide("verdun")).toBe(true);
    expect(slugValide("jean-jaures")).toBe(true);
    expect(slugValide("villa-verdun")).toBe(true);
    expect(slugValide("deux-alpes")).toBe(true);
  });

  it("refuse tout ce qui n'est pas un code", () => {
    /* Ce segment vient de l'URL et sert d'argument en base : il reste étroit
       par principe, sans point, sans barre, sans encodage. */
    expect(slugValide("Verdun")).toBe(false);
    expect(slugValide("../etc/passwd")).toBe(false);
    expect(slugValide("verdun/dossier")).toBe(false);
    expect(slugValide("verdun.html")).toBe(false);
    expect(slugValide("-verdun")).toBe(false);
    expect(slugValide("verdun-")).toBe(false);
    expect(slugValide("")).toBe(false);
    expect(slugValide("a".repeat(121))).toBe(false);
    expect(slugValide(null)).toBe(false);
    expect(slugValide(42)).toBe(false);
  });
});

describe("ce qui compte comme une ouverture", () => {
  const CHROME =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

  it("un vrai navigateur compte", () => {
    expect(estUnRobot(CHROME)).toBe(false);
    expect(estUnRobot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36")).toBe(
      false,
    );
  });

  it("les aperçus de messagerie ne comptent pas", () => {
    /* C'est le cas qui compte vraiment : la messagerie charge le lien pour en
       faire une vignette, AVANT que la personne n'ait rien fait. Le compter
       ferait rappeler un commercial pour rien. */
    expect(estUnRobot("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(estUnRobot("facebookexternalhit/1.1")).toBe(true);
    expect(estUnRobot("TelegramBot (like TwitterBot)")).toBe(true);
    expect(estUnRobot("Slackbot-LinkExpanding 1.0")).toBe(true);
  });

  it("les robots et les sondes ne comptent pas", () => {
    expect(estUnRobot("Googlebot/2.1")).toBe(true);
    expect(estUnRobot("curl/8.4.0")).toBe(true);
    expect(estUnRobot("python-requests/2.31.0")).toBe(true);
    expect(estUnRobot("HeadlessChrome/124.0")).toBe(true);
  });

  it("un agent absent ne compte pas : un navigateur en annonce toujours un", () => {
    expect(estUnRobot(null)).toBe(true);
    expect(estUnRobot("")).toBe(true);
    expect(estUnRobot("   ")).toBe(true);
  });
});
