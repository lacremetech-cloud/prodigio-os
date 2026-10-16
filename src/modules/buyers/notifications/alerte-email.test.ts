import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  alerterEquipe,
  alerterEquipeParWebhook,
  chargeAlerteEquipe,
  alerterEquipeParEmail,
  corpsAlerte,
  destinatairesValides,
  objetAlerte,
  type FicheLead,
} from "./alerte-email";
import type { Env } from "@/config";

const LEAD: FicheLead = {
  nom: "Léa Bernard",
  telephone: "06 25 77 35 92",
  email: "lea.bernard@example.com",
  bien: "Villa Verdun",
  budget: "Plus d'1 M€",
  provenance: "meta · cpc",
  score: { overall: 82, priority: "Prioritaire" },
  buyerProfileId: "11111111-2222-3333-4444-555555555555",
  interestId: "aaaa-bbbb",
  recuLe: new Date("2026-10-16T09:30:00Z"),
};

function envWith(over: Partial<Record<string, string | undefined>> = {}): Env {
  return {
    NODE_ENV: "production",
    LUMAIL_API_KEY: "lum_test",
    LUMAIL_FROM_EMAIL: "alertes@prodigio.fr",
    ALERTES_LEADS_EMAILS: "antoine@exemple.fr, jc@exemple.fr",
    NEXT_PUBLIC_SITE_URL: "https://go.prodigio.fr",
    ...over,
  } as unknown as Env;
}

/** Fausse API Lumail. `echecs` : adresses qui doivent repondre en erreur. */
function faussetteLumail(echecs: string[] = []) {
  const appels: Array<{ to: string; subject: string; body: string; replyTo?: string }> = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const corps = JSON.parse(String(init.body));
    appels.push(corps);
    if (echecs.includes(corps.to)) {
      return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({ success: true }) } as unknown as Response;
  }) as unknown as typeof fetch;
  return { appels, fetchImpl };
}

describe("objet de l'alerte", () => {
  it("porte a lui seul de quoi decider de rappeler", () => {
    // Sur un telephone, la notification n'affiche QUE l'objet.
    const objet = objetAlerte(LEAD);
    expect(objet).toContain("Léa Bernard");
    expect(objet).toContain("Villa Verdun");
    expect(objet).toContain("Plus d'1 M€");
  });

  it("reste lisible quand le nom manque", () => {
    expect(objetAlerte({ ...LEAD, nom: null })).toContain("Acquéreur");
  });
});

describe("corps de l'alerte", () => {
  it("met le telephone en premier, cliquable", () => {
    const corps = corpsAlerte(LEAD, envWith());
    // Le lien ne garde que les chiffres et le « + » : « 06 25 77 35 92 » composable.
    expect(corps).toContain("[06 25 77 35 92](tel:0625773592)");
    const posTel = corps.indexOf("tel:");
    const posBien = corps.indexOf("Villa Verdun");
    expect(posTel).toBeLessThan(posBien);
  });

  it("dit explicitement qu'aucun telephone n'a ete transmis", () => {
    // Le silence serait pris pour un oubli d'affichage.
    expect(corpsAlerte({ ...LEAD, telephone: null }, envWith())).toContain(
      "Aucun téléphone transmis",
    );
  });

  it("porte le lien de la fiche, et l'e-mail en mailto", () => {
    const corps = corpsAlerte(LEAD, envWith());
    expect(corps).toContain("/crm/acquereurs/11111111-2222-3333-4444-555555555555");
    expect(corps).toContain("mailto:lea.bernard@example.com");
  });

  it("ne laisse pas un nom casser le Markdown", () => {
    const corps = corpsAlerte({ ...LEAD, nom: "A*B_C[D]" }, envWith());
    expect(corps).not.toContain("A*B_C[D]");
  });
});

describe("liste des destinataires", () => {
  it("accepte virgules, points-virgules et espaces", () => {
    expect(destinatairesValides("a@x.fr, b@x.fr; c@x.fr")).toEqual(["a@x.fr", "b@x.fr", "c@x.fr"]);
  });

  it("dedoublonne sans tenir compte de la casse", () => {
    expect(destinatairesValides("A@x.fr, a@x.fr")).toEqual(["A@x.fr"]);
  });

  it("ecarte l'adresse invalide SANS priver les autres", () => {
    // Une virgule en trop ne doit pas devenir une panne d'alerte silencieuse.
    expect(destinatairesValides("bon@x.fr, pas-une-adresse, autre@x.fr")).toEqual([
      "bon@x.fr",
      "autre@x.fr",
    ]);
  });

  it("rend vide plutot que de lever", () => {
    expect(destinatairesValides(null)).toEqual([]);
    expect(destinatairesValides("")).toEqual([]);
  });
});

describe("envoi", () => {
  it("n'appelle rien si le transport n'est pas configure", async () => {
    const { appels, fetchImpl } = faussetteLumail();
    const res = await alerterEquipeParEmail(LEAD, {
      env: envWith({ LUMAIL_API_KEY: undefined }),
      transport: { fetchImpl },
    });
    expect(res.status).toBe("skipped");
    expect(appels).toHaveLength(0);
  });

  it("n'appelle rien s'il n'y a aucun destinataire", async () => {
    const { appels, fetchImpl } = faussetteLumail();
    const res = await alerterEquipeParEmail(LEAD, {
      env: envWith({ ALERTES_LEADS_EMAILS: undefined }),
      transport: { fetchImpl },
    });
    expect(res.status).toBe("skipped");
    expect(appels).toHaveLength(0);
  });

  it("envoie UN message par destinataire", async () => {
    const { appels, fetchImpl } = faussetteLumail();
    const res = await alerterEquipeParEmail(LEAD, { env: envWith(), transport: { fetchImpl } });
    expect(res).toEqual({ status: "sent", envoyes: 2, total: 2 });
    expect(appels.map((a) => a.to)).toEqual(["antoine@exemple.fr", "jc@exemple.fr"]);
  });

  it("repond a l'acquereur, pas a l'expediteur technique", async () => {
    const { appels, fetchImpl } = faussetteLumail();
    await alerterEquipeParEmail(LEAD, { env: envWith(), transport: { fetchImpl } });
    expect(appels).toHaveLength(2);
    expect(appels[0]?.replyTo).toBe("lea.bernard@example.com");
  });

  it("une adresse en panne n'emporte pas l'alerte des autres", async () => {
    const { appels, fetchImpl } = faussetteLumail(["antoine@exemple.fr"]);
    const res = await alerterEquipeParEmail(LEAD, { env: envWith(), transport: { fetchImpl } });
    expect(res).toEqual({ status: "partial", envoyes: 1, total: 2 });
    expect(appels).toHaveLength(2);
  });

  it("ne leve JAMAIS, meme si le transport explose", async () => {
    // Une alerte qui leve ferait tomber le depot : c'est l'inverse du but.
    const fetchImpl = (() => {
      throw new Error("reseau");
    }) as unknown as typeof fetch;
    const res = await alerterEquipeParEmail(LEAD, { env: envWith(), transport: { fetchImpl } });
    expect(res.status).toBe("failed");
  });
});

describe("chemin webhook (Make)", () => {
  const WH = "https://hook.eu2.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  function faussetteWebhook(ok = true) {
    const appels: Array<{ url: string; charge: Record<string, unknown> }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      appels.push({ url, charge: JSON.parse(String(init.body)) });
      return { ok, status: ok ? 200 : 500 } as unknown as Response;
    }) as unknown as typeof fetch;
    return { appels, fetchImpl };
  }

  it("coupe le nom en prenom et nom, comme le scenario l'attend", () => {
    const c = chargeAlerteEquipe(LEAD, envWith());
    expect(c.first_name).toBe("Léa");
    expect(c.last_name).toBe("Bernard");
  });

  it("dit « Non transmise » plutot que de laisser la provenance vide", () => {
    // Un champ vide dans l'e-mail se lit comme un bug d'affichage.
    expect(chargeAlerteEquipe({ ...LEAD, provenance: null }, envWith()).provenance).toBe(
      "Non transmise",
    );
  });

  it("porte le lien de la fiche", () => {
    expect(chargeAlerteEquipe(LEAD, envWith()).fiche_url).toContain(
      "/crm/acquereurs/11111111-2222-3333-4444-555555555555",
    );
  });

  it("n'appelle rien sans adresse de webhook", async () => {
    const { appels, fetchImpl } = faussetteWebhook();
    const r = await alerterEquipeParWebhook(LEAD, { env: envWith(), fetchImpl });
    expect(r.status).toBe("skipped");
    expect(appels).toHaveLength(0);
  });

  it("poste la charge sur le webhook", async () => {
    const { appels, fetchImpl } = faussetteWebhook();
    const r = await alerterEquipeParWebhook(LEAD, {
      env: envWith({ ALERTE_LEAD_WEBHOOK_URL: WH }),
      fetchImpl,
    });
    expect(r.status).toBe("sent");
    expect(appels[0]?.url).toBe(WH);
    expect(appels[0]?.charge.phone).toBe("06 25 77 35 92");
  });

  it("ne leve jamais si le webhook est injoignable", async () => {
    const fetchImpl = (() => {
      throw new Error("reseau");
    }) as unknown as typeof fetch;
    const r = await alerterEquipeParWebhook(LEAD, {
      env: envWith({ ALERTE_LEAD_WEBHOOK_URL: WH }),
      fetchImpl,
    });
    expect(r.status).toBe("failed");
  });
});

describe("aiguillage : JAMAIS les deux canaux", () => {
  const WH = "https://hook.eu2.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  it("le webhook prime, et Lumail n'est PAS appele", async () => {
    // Deux canaux actifs = Antoine recoit deux fois la meme alerte.
    const lumail = faussetteLumail();
    const posts: string[] = [];
    const fetchImpl = (async (url: string) => {
      posts.push(String(url));
      return { ok: true, status: 200 } as unknown as Response;
    }) as unknown as typeof fetch;

    const r = await alerterEquipe(LEAD, {
      env: envWith({ ALERTE_LEAD_WEBHOOK_URL: WH }),
      fetchImpl,
      transport: { fetchImpl: lumail.fetchImpl },
    });
    expect(r).toEqual({ canal: "webhook", status: "sent" });
    expect(posts).toEqual([WH]);
    expect(lumail.appels).toHaveLength(0);
  });

  it("sans webhook, retombe sur l'envoi e-mail", async () => {
    const lumail = faussetteLumail();
    const r = await alerterEquipe(LEAD, {
      env: envWith(),
      transport: { fetchImpl: lumail.fetchImpl },
    });
    expect(r.canal).toBe("email");
    expect(lumail.appels).toHaveLength(2);
  });

  it("sans rien de configure, n'alerte pas et ne leve pas", async () => {
    const r = await alerterEquipe(LEAD, {
      env: envWith({ LUMAIL_API_KEY: undefined, ALERTE_LEAD_WEBHOOK_URL: undefined }),
    });
    expect(r.canal).toBe("aucun");
  });
});
