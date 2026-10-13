import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ configure: true }));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      META_CAPI_PIXEL_ID: "123",
      META_CAPI_ACCESS_TOKEN: "jeton",
      META_CAPI_TEST_EVENT_CODE: undefined,
    },
    isMetaCapiConfigured: () => h.configure,
  };
});

const { buildEventPayload, buildUserData, envoyerConversionMeta, hasMatchSignal, peutEtreRattache } =
  await import("./capi");

const IDENTITE = {
  email: "camille@example.test",
  phone: "+33612345678",
  firstName: "Camille",
  lastName: "Durand",
  country: "FR",
};

beforeEach(() => {
  h.configure = true;
  vi.restoreAllMocks();
});

describe("buildUserData", () => {
  it("n'emporte jamais une valeur en clair", () => {
    const data = buildUserData({ ...IDENTITE, clientUserAgent: "Mozilla/5.0" });
    const serialise = JSON.stringify(data);
    expect(serialise).not.toContain("camille");
    expect(serialise).not.toContain("612345678");
    expect(serialise).not.toContain("Durand");
  });

  it("présente les champs hachés en tableaux, comme Meta les attend", () => {
    const data = buildUserData(IDENTITE);
    expect(Array.isArray(data.em)).toBe(true);
    expect(Array.isArray(data.ph)).toBe(true);
  });

  it("laisse en clair ce qui n'identifie personne", () => {
    const data = buildUserData({
      ...IDENTITE,
      fbclid: "IwAR1",
      clickedAt: "2026-10-12T10:00:00.000Z",
      clientUserAgent: "Mozilla/5.0",
      clientIpAddress: "203.0.113.4",
    });
    expect(data.fbc).toMatch(/^fb\.1\.\d+\.IwAR1$/);
    expect(data.client_user_agent).toBe("Mozilla/5.0");
    expect(data.client_ip_address).toBe("203.0.113.4");
  });

  it("omet un champ plutôt que d'envoyer l'empreinte d'un vide", () => {
    const data = buildUserData({ email: null, phone: null, firstName: "  " });
    expect(data).toEqual({});
  });
});

describe("hasMatchSignal", () => {
  it("un e-mail, un téléphone ou un fbclid suffisent", () => {
    expect(hasMatchSignal({ em: ["x"] })).toBe(true);
    expect(hasMatchSignal({ ph: ["x"] })).toBe(true);
    expect(hasMatchSignal({ fbc: "fb.1.1.x" })).toBe(true);
  });

  it("un prénom seul ne rattache rien", () => {
    expect(hasMatchSignal({ fn: ["x"] })).toBe(false);
  });
});

describe("buildEventPayload", () => {
  it("porte le nom, l'identifiant de dédoublonnage et la source", () => {
    const payload = buildEventPayload({
      eventName: "Lead",
      eventId: "lead-i-1",
      eventTime: new Date("2026-10-12T10:00:00.000Z"),
      eventSourceUrl: "https://villa-verdun-cassis.vercel.app/",
      identity: IDENTITE,
    });
    expect(payload.event_name).toBe("Lead");
    expect(payload.event_id).toBe("lead-i-1");
    expect(payload.action_source).toBe("website");
    // Meta attend des secondes, pas des millisecondes.
    expect(payload.event_time).toBe(Date.parse("2026-10-12T10:00:00.000Z") / 1000);
  });
});

describe("envoyerConversionMeta", () => {
  it("n'appelle rien tant que le pixel n'est pas configuré", async () => {
    h.configure = false;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await envoyerConversionMeta({
      eventName: "Lead",
      eventId: "lead-1",
      identity: IDENTITE,
    });
    expect(res).toEqual({ sent: false, reason: "non_configure" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renonce plutôt que d'émettre une conversion que Meta ne saurait rattacher", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await envoyerConversionMeta({
      eventName: "Schedule",
      eventId: "visite-1",
      identity: { firstName: "Camille" },
    });
    expect(res).toEqual({ sent: false, reason: "sans_correspondance" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("envoie le jeton en en-tête, jamais dans l'URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await envoyerConversionMeta({
      eventName: "Lead",
      eventId: "lead-1",
      identity: IDENTITE,
    });
    expect(res).toEqual({ sent: true });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("jeton");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jeton");
  });

  it("un refus de Meta ne remonte jamais en exception", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 400 }));
    await expect(
      envoyerConversionMeta({ eventName: "Lead", eventId: "l", identity: IDENTITE }),
    ).resolves.toEqual({ sent: false, reason: "refus" });
  });

  it("un réseau coupé ne remonte jamais en exception", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      envoyerConversionMeta({ eventName: "Lead", eventId: "l", identity: IDENTITE }),
    ).resolves.toEqual({ sent: false, reason: "erreur" });
  });
});

describe("peutEtreRattache", () => {
  const anonyme = { client_ip_address: "81.2.3.4", client_user_agent: "Mozilla/5.0" };

  it("accepte une visite anonyme : IP et navigateur lui suffisent", () => {
    expect(peutEtreRattache("PageView", anonyme)).toBe(true);
  });

  it("refuse la meme visite si elle n a ni IP ni navigateur", () => {
    expect(peutEtreRattache("PageView", {})).toBe(false);
    expect(peutEtreRattache("PageView", { client_ip_address: "81.2.3.4" })).toBe(false);
  });

  it("garde l exigence stricte pour les conversions commerciales", () => {
    expect(peutEtreRattache("Lead", anonyme)).toBe(false);
    expect(peutEtreRattache("CompleteRegistration", anonyme)).toBe(false);
    expect(peutEtreRattache("Schedule", anonyme)).toBe(false);
  });

  it("accepte une conversion commerciale des qu elle porte une vraie cle", () => {
    expect(peutEtreRattache("Lead", { ...anonyme, em: ["abc"] })).toBe(true);
    expect(peutEtreRattache("Lead", { fbc: "fb.1.2.3" })).toBe(true);
  });
});
