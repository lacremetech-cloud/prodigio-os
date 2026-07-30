import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteEvent,
  getUserInfo,
  insertEvent,
  queryFreeBusy,
} from "./client";
import { GoogleApiError } from "./errors";

/** Réponse fetch factice. */
function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

let calls: { url: string; init?: RequestInit }[] = [];

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.restoreAllMocks();
});

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  });
}

describe("client Google Calendar (fetch mocké)", () => {
  it("getUserInfo lit l'e-mail du compte", async () => {
    stubFetch(() => fakeResponse(200, { email: "agent@prodigio.fr", email_verified: true }));
    const info = await getUserInfo("tok");
    expect(info.email).toBe("agent@prodigio.fr");
    expect(calls[0]?.url).toContain("/oauth2/v3/userinfo");
  });

  it("queryFreeBusy renvoie les plages occupées du calendrier", async () => {
    stubFetch(() =>
      fakeResponse(200, {
        calendars: {
          primary: { busy: [{ start: "2026-08-05T08:00:00Z", end: "2026-08-05T09:00:00Z" }] },
        },
      }),
    );
    const busy = await queryFreeBusy("tok", "primary", "2026-08-05T00:00:00Z", "2026-08-06T00:00:00Z");
    expect(busy).toHaveLength(1);
    expect(busy[0]?.start).toBe("2026-08-05T08:00:00Z");
    // Corps de la requête FreeBusy bien formé.
    const body = JSON.parse((calls[0]?.init?.body as string) ?? "{}");
    expect(body.items).toEqual([{ id: "primary" }]);
  });

  it("queryFreeBusy signale un calendrier inaccessible", async () => {
    stubFetch(() =>
      fakeResponse(200, { calendars: { primary: { errors: [{ reason: "notFound" }] } } }),
    );
    await expect(queryFreeBusy("tok", "primary", "a", "b")).rejects.toBeInstanceOf(GoogleApiError);
  });

  it("insertEvent envoie sendUpdates=all, l'invité et les propriétés privées", async () => {
    stubFetch(() => fakeResponse(200, { id: "evt-1", htmlLink: "https://cal/evt-1", status: "confirmed" }));
    const res = await insertEvent(
      "tok",
      "primary",
      {
        summary: "Estimation Prodigio — Lyon — M. Test",
        description: "Rendez-vous d'estimation avec Prodigio.",
        location: "1 rue de Test",
        start: "2026-08-05T12:00:00Z",
        end: "2026-08-05T13:30:00Z",
        timeZone: "Europe/Paris",
        attendees: [{ email: "owner@ex.fr", displayName: "M. Test" }],
        privateProperties: { prodigio_crm_url: "https://go.prodigio.fr/crm/mandats/x" },
      },
      "all",
    );
    expect(res.id).toBe("evt-1");
    expect(res.htmlLink).toBe("https://cal/evt-1");

    expect(calls[0]?.url).toContain("/calendars/primary/events");
    expect(calls[0]?.url).toContain("sendUpdates=all");
    const body = JSON.parse((calls[0]?.init?.body as string) ?? "{}");
    expect(body.attendees).toEqual([{ email: "owner@ex.fr", displayName: "M. Test" }]);
    // Le lien CRM est en propriété PRIVÉE, jamais dans la description partagée.
    expect(body.extendedProperties.private.prodigio_crm_url).toContain("/crm/mandats/");
    expect(body.description).not.toContain("/crm/mandats/");
  });

  it("deleteEvent est idempotent si l'événement est déjà supprimé (404)", async () => {
    stubFetch(() => fakeResponse(404, { error: "not found" }));
    await expect(deleteEvent("tok", "primary", "evt-x", "all")).resolves.toBeUndefined();
  });

  it("un 401 remonte une GoogleApiError « unauthorized »", async () => {
    stubFetch(() => fakeResponse(401, { error: "invalid token" }));
    await expect(getUserInfo("tok")).rejects.toMatchObject({ kind: "unauthorized", status: 401 });
  });
});
