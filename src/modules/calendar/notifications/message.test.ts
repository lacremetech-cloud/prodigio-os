import { describe, expect, it } from "vitest";
import { buildEstimationSlackMessage, crmDeepLink, escapeSlack } from "./message";
import type { EstimationAlertData } from "./types";

const base: EstimationAlertData = {
  kind: "created",
  opportunityId: "opp-1",
  crmBaseUrl: "https://go.prodigio.fr",
  startsAt: "2026-08-05T12:00:00.000Z", // 14:00 Europe/Paris (été)
  endsAt: "2026-08-05T13:30:00.000Z", // 15:30 Europe/Paris
  timezone: "Europe/Paris",
  oldStartsAt: null,
  oldEndsAt: null,
  agentName: "camille.agent",
  actorName: "manager.prodigio",
  ownerName: "Marie Dupont",
  ownerPhone: "+33612345678",
  ownerEmail: "marie@example.com",
  propertyType: "Villa d'architecte",
  city: "Annecy",
  address: "3 rue du Lac, 74000 Annecy",
  valueBand: "Plus de 2 M€",
  reason: null,
  googleHtmlLink: "https://www.google.com/calendar/event?eid=abc",
};

const json = (data: EstimationAlertData) => JSON.stringify(buildEstimationSlackMessage(data));

describe("message Slack — rendez-vous d'estimation", () => {
  it("création : titre, créneau/durée/fuseau, coordonnées, deep link et bouton Google", () => {
    const msg = buildEstimationSlackMessage(base);
    const s = JSON.stringify(msg);
    expect(msg.text).toContain("Nouveau rendez-vous d’estimation");
    expect(s).toContain("📅 Nouveau rendez-vous d’estimation");
    expect(s).toContain("14:00"); // heure locale Europe/Paris
    expect(s).toContain("15:30");
    expect(s).toContain("(90 min)");
    expect(s).toContain("Europe/Paris");
    expect(s).toContain("Planifié");
    // Coordonnées (canal privé, autorisées).
    expect(s).toContain("Marie Dupont");
    expect(s).toContain("+33612345678");
    expect(s).toContain("marie@example.com");
    expect(s).toContain("camille.agent");
    expect(s).toContain("manager.prodigio");
    expect(s).toContain("Villa d'architecte");
    expect(s).toContain("Annecy");
    expect(s).toContain("Plus de 2 M€");
    expect(s).toContain("3 rue du Lac, 74000 Annecy");
    // Deep link exact.
    expect(s).toContain("https://go.prodigio.fr/crm/mandats/opp-1");
    expect(s).toContain("Ouvrir le dossier dans Prodigio CRM");
    // Bouton Google Calendar (lien non sensible).
    expect(s).toContain("Voir dans Google Calendar");
    expect(s).toContain("https://www.google.com/calendar/event?eid=abc");
  });

  it("report : ancien ET nouveau créneau, « Reporté par »", () => {
    const s = json({
      ...base,
      kind: "rescheduled",
      oldStartsAt: "2026-08-04T09:00:00.000Z", // 11:00 Paris
      oldEndsAt: "2026-08-04T10:30:00.000Z",
    });
    expect(s).toContain("🔁 Rendez-vous d’estimation reporté");
    expect(s).toContain("Ancien créneau");
    expect(s).toContain("11:00");
    expect(s).toContain("Nouveau créneau");
    expect(s).toContain("14:00");
    expect(s).toContain("Reporté par");
  });

  it("annulation : créneau prévu, « Annulé par », motif seulement s'il existe", () => {
    const sans = json({ ...base, kind: "cancelled", reason: null });
    expect(sans).toContain("❌ Rendez-vous d’estimation annulé");
    expect(sans).toContain("Créneau qui était prévu");
    expect(sans).toContain("Annulé par");
    expect(sans).not.toContain("*Motif*");

    const avec = json({ ...base, kind: "cancelled", reason: "Propriétaire indisponible" });
    expect(avec).toContain("*Motif*");
    expect(avec).toContain("Propriétaire indisponible");
  });

  it("échappe les valeurs utilisateur (anti-mention @channel, anti-injection)", () => {
    const s = json({
      ...base,
      ownerName: "<!channel> <script>&co",
      address: "<https://evil|clic>",
    });
    expect(s).not.toContain("<!channel>");
    expect(s).not.toContain("<script>");
    expect(s).toContain("&lt;!channel&gt;");
    expect(escapeSlack("<a>&b")).toBe("&lt;a&gt;&amp;b");
  });

  it("n'expose jamais un lien Google porteur d'un secret", () => {
    const s = json({
      ...base,
      googleHtmlLink: "https://calendar.google.com/x?token=SECRET123",
    });
    expect(s).not.toContain("SECRET123");
    expect(s).not.toContain("Voir dans Google Calendar");
  });

  it("ne contient AUCUN champ interdit (jeton, secret, webhook, JWT, clé d'idempotence…)", () => {
    const s = json(base).toLowerCase();
    for (const forbidden of [
      "access_token",
      "refresh_token",
      "bearer ",
      "hooks.slack.com",
      "idempotency",
      "eyj", // début typique d'un JWT
      "secret",
      "ya29.", // access token google
    ]) {
      expect(s).not.toContain(forbidden);
    }
  });

  it("omet proprement les champs vides", () => {
    const s = json({
      ...base,
      ownerPhone: null,
      ownerEmail: null,
      address: null,
      valueBand: null,
      city: null,
      googleHtmlLink: null,
    });
    expect(s).not.toContain("📞");
    expect(s).not.toContain("✉️");
    expect(s).not.toContain("Adresse du rendez-vous");
    expect(s).not.toContain("Voir dans Google Calendar");
    // Le deep link CRM reste toujours présent.
    expect(s).toContain("/crm/mandats/opp-1");
  });

  it("crmDeepLink encode l'identifiant et normalise la base", () => {
    expect(crmDeepLink("https://go.prodigio.fr/", "opp-42")).toBe(
      "https://go.prodigio.fr/crm/mandats/opp-42",
    );
  });
});
