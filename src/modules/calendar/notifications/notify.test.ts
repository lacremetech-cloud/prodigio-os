import { describe, expect, it, vi } from "vitest";
import { sendEstimationSlackAlert } from "./notify";
import type { EstimationAlertData } from "./types";
import type { Env } from "@/config";

const data: EstimationAlertData = {
  kind: "created",
  opportunityId: "opp-1",
  crmBaseUrl: "https://go.prodigio.fr",
  startsAt: "2026-08-05T12:00:00.000Z",
  endsAt: "2026-08-05T13:30:00.000Z",
  timezone: "Europe/Paris",
  oldStartsAt: null,
  oldEndsAt: null,
  agentName: "agent",
  actorName: "manager",
  ownerName: "Marie",
  ownerPhone: "+33612345678",
  ownerEmail: "marie@example.com",
  propertyType: "Villa",
  city: "Annecy",
  address: "3 rue du Lac",
  valueBand: "Plus de 2 M€",
  reason: null,
  googleHtmlLink: null,
};

const WEBHOOK = "https://hooks.slack.com/services/T/B/xxx";
const envWith = (url?: string): Env =>
  ({ SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL: url }) as unknown as Env;

function fetchReturning(status: number): typeof fetch {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status }) as Response) as unknown as typeof fetch;
}

describe("sendEstimationSlackAlert", () => {
  it("webhook absent → skipped, aucun appel réseau", async () => {
    const fetchImpl = vi.fn();
    const res = await sendEstimationSlackAlert(data, {
      env: envWith(undefined),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe("skipped");
    expect(res.attempts).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("succès (200) → sent en une tentative", async () => {
    const fetchImpl = fetchReturning(200);
    const res = await sendEstimationSlackAlert(data, { env: envWith(WEBHOOK), fetchImpl });
    expect(res.status).toBe("sent");
    expect(res.attempts).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("erreur 500 → réessais bornés (1 + 2 = 3 tentatives)", async () => {
    const fetchImpl = fetchReturning(500);
    const res = await sendEstimationSlackAlert(data, { env: envWith(WEBHOOK), fetchImpl });
    expect(res.status).toBe("failed");
    expect(res.attempts).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("erreur 400 → aucun réessai (une seule tentative)", async () => {
    const fetchImpl = fetchReturning(400);
    const res = await sendEstimationSlackAlert(data, { env: envWith(WEBHOOK), fetchImpl });
    expect(res.status).toBe("failed");
    expect(res.attempts).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("timeout / erreur réseau → best-effort (jamais d'exception), réessais bornés", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const res = await sendEstimationSlackAlert(data, { env: envWith(WEBHOOK), fetchImpl });
    expect(res.status).toBe("failed");
    expect(res.attempts).toBe(3);
  });

  it("5xx puis 200 → sent après réessai", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      return { ok: n >= 2, status: n >= 2 ? 200 : 503 } as Response;
    }) as unknown as typeof fetch;
    const res = await sendEstimationSlackAlert(data, { env: envWith(WEBHOOK), fetchImpl });
    expect(res.status).toBe("sent");
    expect(res.attempts).toBe(2);
  });
});
