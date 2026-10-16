import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { construireCharge, envoyerAccuseDepot } = await import("./accuse-depot");

const CONFIG = {
  webhookUrl: "https://hook.eu2.make.test/abc",
  brochureUrl: "https://villa-verdun-cassis.vercel.app/dossier/",
  slug: "villa-verdun",
  brochureSlug: "verdun" as string | null,
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

  it("porte le budget EN CLAIR a cote du code technique", () => {
    // Une automatisation qui compose un e-mail doit pouvoir ecrire le budget
    // sans recopier une table de correspondance qui divergera.
    const c = construireCharge(BASE);
    expect(c.budget_choice).toBe("500k_1m");
    expect(c.budget_libelle).toBe("500 000 € – 1 M€");
  });

  it("connait la tranche « plus d'1 M€ », la plus recente", () => {
    expect(construireCharge({ ...BASE, budgetChoice: "plus_1m" }).budget_libelle).toBe(
      "Plus d'1 M€",
    );
  });

  it("rend null, jamais le code brut, pour un budget inconnu", () => {
    expect(construireCharge({ ...BASE, budgetChoice: "inexistant" }).budget_libelle).toBeNull();
    expect(construireCharge({ ...BASE, budgetChoice: null }).budget_libelle).toBeNull();
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

const { composerMessage, pourSms, sansAccents, tientEnGsm7 } = await import(
  "./accuse-depot"
);

describe("alphabet GSM-7", () => {
  it("accepte les accents qui ne coutent rien", () => {
    /* Ceux-la sont DANS l'alphabet : les retirer serait appauvrir le message
       sans economiser un centime. */
    expect(tientEnGsm7("brochure détaillée")).toBe(true);
    expect(tientEnGsm7("très vite")).toBe(true);
    expect(tientEnGsm7("Cécile")).toBe(true);
    expect(tientEnGsm7("à")).toBe(true);
  });

  it("refuse ceux qui font basculer en UCS-2", () => {
    expect(tientEnGsm7("François")).toBe(false); // ç
    expect(tientEnGsm7("Jérôme")).toBe(false); // ô
    expect(tientEnGsm7("Benoît")).toBe(false); // î
    expect(tientEnGsm7("Gaëlle")).toBe(false); // ë
    expect(tientEnGsm7("À très vite")).toBe(false); // majuscule accentuee
    expect(tientEnGsm7("tiret — long")).toBe(false); // cadratin
  });

  it("pourSms ne touche au champ que s'il coute quelque chose", () => {
    expect(pourSms("Cécile")).toBe("Cécile");
    expect(pourSms("Chloé")).toBe("Chloé");
    expect(pourSms("François")).toBe("Francois");
    /* Tous les accents du champ partent, pas seulement le fautif : « Jérome »
       serait une faute, « Jerome » une graphie admise. */
    expect(pourSms("Jérôme")).toBe("Jerome");
  });

  it("sansAccents ne touche qu'aux accents", () => {
    expect(sansAccents("Cécile Jaurès")).toBe("Cecile Jaures");
  });
});

describe("texte de l'accusé", () => {
  const LIEN = "https://brochure.prodigio.fr/verdun";

  it("nomme la personne et donne le lien", () => {
    expect(composerMessage({ firstName: "Rayyan", brochureUrl: LIEN })).toBe(
      "Bonjour Rayyan, voici votre brochure : " +
        LIEN +
        "\n\nNous vous appelons très vite.\nJC & Antoine",
    );
  });

  it("ne répète pas le nom du bien, que le lien porte déjà", () => {
    /* « votre brochure Villa Verdun : …/verdun » le disait deux fois en cent
       trente caractères, ce qui sonne comme un publipostage. */
    const t = composerMessage({ firstName: "Rayyan", brochureUrl: LIEN })!;
    expect(t).not.toMatch(/villa/i);
    expect(t).toContain("/verdun");
  });

  it("est signé par des personnes, pas par une marque", () => {
    const t = composerMessage({ firstName: "Rayyan", brochureUrl: LIEN })!;
    expect(t).toContain("JC & Antoine");
    expect(t).not.toContain("PRODIGIO");
  });

  it("ne promet plus de délai de rappel", () => {
    /* L'engagement « sous 24h ouvrées » a été retiré de la page : le SMS ne
       doit pas le réintroduire tout seul. */
    const t = composerMessage({ firstName: "Rayyan", brochureUrl: LIEN })!;
    expect(t).not.toMatch(/24\s*h/i);
    expect(t).not.toMatch(/ouvr/i);
  });

  it("tient en un seul SMS sur le bien au lien le plus long", () => {
    const t = composerMessage({
      firstName: "Rayyan",
      brochureUrl: "https://brochure.prodigio.fr/jean-jaures",
    })!;
    expect(tientEnGsm7(t)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(160);
  });

  it("reste en GSM-7 même avec un prénom qui en sortirait", () => {
    /* C'est le vrai piège : un seul « ç » triplerait le coût du message
       entier, et le prénom n'est pas écrit par nous. */
    const t = composerMessage({
      firstName: "François",
      brochureUrl: "https://brochure.prodigio.fr/jean-jaures",
    })!;
    expect(t).toContain("Francois");
    expect(tientEnGsm7(t)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(160);
  });

  it("garde les accents du texte fixe, qui ne coûtent rien", () => {
    const t = composerMessage({ firstName: "Rayyan", brochureUrl: LIEN })!;
    expect(t).toContain("très vite");
  });

  it("reste correct sans prénom", () => {
    expect(composerMessage({ brochureUrl: LIEN })).toBe(
      "Bonjour, voici votre brochure : " +
        LIEN +
        "\n\nNous vous appelons très vite.\nJC & Antoine",
    );
  });

  it("n'envoie rien sans lien : un accusé qui ne dit pas où est la brochure n'a pas d'objet", () => {
    expect(composerMessage({ firstName: "Rayyan" })).toBeNull();
    expect(composerMessage({ brochureUrl: "   " })).toBeNull();
  });
});
