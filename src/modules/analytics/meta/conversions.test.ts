import { describe, expect, it } from "vitest";
import { conversionInscriptionTerminee, conversionRendezVous, dejaEnvoyee, donneesDuBien } from "./conversions";

/**
 * Le bien envoyé à Meta. C'est lui qui permet de ventiler les conversions par
 * bien dans le Gestionnaire de publicités, sans dépendre du nom donné aux
 * campagnes.
 */
describe("donneesDuBien", () => {
  it("envoie le nom ET l’identifiant du bien", () => {
    // L'identifiant accompagne le libellé : un nom commercial peut changer en
    // cours de campagne, pas lui — sinon la série se coupe en deux.
    expect(donneesDuBien("Villa Verdun", "prop-1")).toEqual({
      content_name: "Villa Verdun",
      content_ids: ["prop-1"],
      content_category: "bien_immobilier",
    });
  });

  it("se contente de l’identifiant quand le bien n’a pas de nom", () => {
    expect(donneesDuBien(null, "prop-1")).toEqual({
      content_ids: ["prop-1"],
      content_category: "bien_immobilier",
    });
  });

  it("n’envoie rien plutôt qu’un bloc vide", () => {
    // Meta refuse les champs vides, et un `custom_data` sans contenu n'apprend
    // rien : mieux vaut l'omettre.
    expect(donneesDuBien(null, null)).toBeUndefined();
    expect(donneesDuBien("", "")).toBeUndefined();
  });
});

describe("une conversion déjà partie ne repart pas", () => {
  /** Un client Supabase réduit à ce que lisent les conversions : des RPC et une relecture. */
  function client(dejaPartie: boolean) {
    const appels: { fn: string; args: Record<string, unknown> }[] = [];
    const supabase = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        appels.push({ fn, args });
        if (fn === "crm_meta_conversion_deja_envoyee") return { data: dejaPartie, error: null };
        return { data: null, error: null };
      },
      from: () => {
        throw new Error("relecture inattendue : rien ne devait être préparé");
      },
    };
    return { supabase: supabase as unknown as Parameters<typeof conversionInscriptionTerminee>[0], appels };
  }

  it("« inscription terminée » déjà partie : rien n'est préparé, le journal dit pourquoi", async () => {
    const { supabase, appels } = client(true);
    const res = await conversionInscriptionTerminee(supabase, "i-1");
    expect(res).toEqual({ sent: false, reason: "deja_envoyee" });
    expect(appels.map((a) => a.fn)).toEqual(["crm_meta_conversion_deja_envoyee", "crm_meta_conversion_log"]);
    expect(appels[0]!.args).toEqual({ p_event_id: "qualifie-i-1" });
    expect(appels[1]!.args).toMatchObject({ p_event_name: "CompleteRegistration", p_resultat: "deja_envoyee", p_event_id: "qualifie-i-1" });
  });

  it("« rendez-vous programmé » : le même jour, une seule fois", async () => {
    const { supabase, appels } = client(true);
    const res = await conversionRendezVous(supabase, "i-1", new Date("2026-11-28T15:00:00Z"));
    expect(res).toEqual({ sent: false, reason: "deja_envoyee" });
    expect(appels[0]!.args).toEqual({ p_event_id: "visite-i-1-2026-11-28" });
  });

  it("une vérification impossible n'empêche pas l'envoi : mieux vaut un doublon qu'une perte", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { code: "PGRST202" } }),
    } as unknown as Parameters<typeof dejaEnvoyee>[0];
    expect(await dejaEnvoyee(supabase, "qualifie-i-1")).toBe(false);
  });
});
