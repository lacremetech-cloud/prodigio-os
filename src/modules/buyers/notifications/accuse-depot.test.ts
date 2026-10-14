import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { construireCharge, envoyerAccuseDepot } = await import("./accuse-depot");

const CONFIG = {
  webhookUrl: "https://hook.eu2.make.test/abc",
  brochureUrl: "https://villa-verdun-cassis.vercel.app/dossier/",
  slug: "villa-verdun",
  publicName: null as string | null,
};

const BASE = {
  interestId: "b3c86b1a-479d-4420-8965-dfd48af2ebac",
  config: CONFIG,
  propertyName: "Villa Verdun",
  firstName: "Eric",
  lastName: "Tommasi",
  phone: "+33749042773",
  email: "eric@example.test",
  budgetChoice: "500k_1m",
  submittedAt: new Date("2026-10-14T00:49:00.000Z"),
};

describe("charge de l'accusé de dépôt", () => {
  it("porte le lien du dossier et le nom du bien", () => {
    const c = construireCharge(BASE);
    expect(c.brochure_url).toBe("https://villa-verdun-cassis.vercel.app/dossier/");
    expect(c.property_name).toBe("Villa Verdun");
    expect(c.property_slug).toBe("villa-verdun");
    expect(c.phone).toBe("+33749042773");
    expect(c.submitted_at).toBe("2026-10-14T00:49:00.000Z");
  });

  it("prefere le nom public, celui que la personne a vu sur la page", () => {
    const c = construireCharge({
      ...BASE,
      config: { ...CONFIG, publicName: "Villa Verdun — Cassis" },
    });
    expect(c.property_name).toBe("Villa Verdun — Cassis");
  });

  it("ramene les valeurs vides a null, jamais a une chaine vide", () => {
    const c = construireCharge({ ...BASE, firstName: "   ", email: "" });
    expect(c.first_name).toBeNull();
    expect(c.email).toBeNull();
  });
});

describe("envoi de l'accusé", () => {
  const charge = construireCharge(BASE);

  it("appelle l'adresse du bien, en JSON", async () => {
    const appels: Array<[string, RequestInit]> = [];
    const faux = (async (url: string, init: RequestInit) => {
      appels.push([url, init]);
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const r = await envoyerAccuseDepot(charge, CONFIG.webhookUrl, { fetchImpl: faux });
    expect(r.envoye).toBe(true);
    expect(appels).toHaveLength(1);
    const [url, init] = appels[0]!;
    expect(url).toBe("https://hook.eu2.make.test/abc");
    expect(JSON.parse(String(init.body)).phone).toBe("+33749042773");
  });

  it("n'appelle rien sans telephone : l'automatisation n'aurait rien a composer", async () => {
    const faux = vi.fn();
    const r = await envoyerAccuseDepot({ ...charge, phone: null }, CONFIG.webhookUrl, {
      fetchImpl: faux as unknown as typeof fetch,
    });
    expect(r).toEqual({ envoye: false, raison: "sans_telephone" });
    expect(faux).not.toHaveBeenCalled();
  });

  it("n'appelle rien quand le bien n'a pas d'adresse configuree", async () => {
    const faux = vi.fn();
    const r = await envoyerAccuseDepot(charge, null, {
      fetchImpl: faux as unknown as typeof fetch,
    });
    expect(r).toEqual({ envoye: false, raison: "sans_adresse" });
    expect(faux).not.toHaveBeenCalled();
  });

  it("ne leve jamais : une automatisation injoignable reste un non-envoi", async () => {
    const faux = (async () => {
      throw new Error("reseau coupe");
    }) as unknown as typeof fetch;
    await expect(
      envoyerAccuseDepot(charge, CONFIG.webhookUrl, { fetchImpl: faux }),
    ).resolves.toEqual({ envoye: false, raison: "injoignable" });
  });

  it("rend le statut d'un refus, pour qu'un silence s'explique", async () => {
    const faux = (async () => new Response(null, { status: 410 })) as unknown as typeof fetch;
    const r = await envoyerAccuseDepot(charge, CONFIG.webhookUrl, { fetchImpl: faux });
    expect(r).toEqual({ envoye: false, raison: "refus", status: 410 });
  });
});
