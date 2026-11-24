import { describe, expect, it } from "vitest";
import {
  centimesDepuisTexte,
  entierDepuisTexte,
  leadsDepuisActions,
  versDepenseCompte,
  versLigneInsight,
  versPub,
} from "./lecture";

describe("les montants de Meta, en centimes exacts", () => {
  it("convertit le texte sans virgule flottante", () => {
    expect(centimesDepuisTexte("12.34")).toBe(1234);
    expect(centimesDepuisTexte("12.3")).toBe(1230);
    expect(centimesDepuisTexte("12")).toBe(1200);
    expect(centimesDepuisTexte("0.07")).toBe(7);
    // 0,1 + 0,2 en flottant vaut 0,30000000000000004 : ici, rien de tel.
    expect(centimesDepuisTexte("1234567.89")).toBe(123_456_789);
  });

  it("arrondit au centime au-delà de deux décimales, demi vers le haut", () => {
    expect(centimesDepuisTexte("12.345")).toBe(1235);
    expect(centimesDepuisTexte("12.344")).toBe(1234);
  });

  it("une valeur absente vaut 0, une valeur illisible est refusée", () => {
    expect(centimesDepuisTexte(undefined)).toBe(0);
    expect(() => centimesDepuisTexte("12,34")).toThrow(RangeError);
    expect(() => entierDepuisTexte("12.5")).toThrow(RangeError);
    expect(entierDepuisTexte("1500")).toBe(1500);
  });
});

describe("les leads : l'action « lead » seule", () => {
  it("ne compte pas les doublons que Meta renvoie sous d'autres noms", () => {
    const actions = [
      { action_type: "lead", value: "3" },
      { action_type: "onsite_web_lead", value: "3" },
      { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
      { action_type: "offsite_lead_add_20_s_calls", value: "3" },
      { action_type: "link_click", value: "40" },
    ];
    expect(leadsDepuisActions(actions)).toBe(3);
    expect(leadsDepuisActions(undefined)).toBe(0);
  });
});

describe("une ligne d'insights, vérifiée à la frontière", () => {
  const brute = {
    date_start: "2026-11-01",
    date_stop: "2026-11-01",
    campaign_id: "120200000000000001",
    campaign_name: "PRODIGIO | VERDUN | LEADS",
    adset_id: "120200000000000002",
    adset_name: "Large",
    ad_id: "120200000000000003",
    ad_name: "VERDUN | TERRASSE | VIDEO | V1",
    spend: "45.67",
    impressions: "3200",
    reach: "2100",
    frequency: "1.523810",
    clicks: "61",
    inline_link_clicks: "38",
    ctr: "1.906250",
    cpm: "14.271875",
    actions: [
      { action_type: "lead", value: "2" },
      { action_type: "onsite_web_lead", value: "2" },
    ],
    cost_per_action_type: [{ action_type: "lead", value: "22.835" }],
  };

  it("donne une ligne prête pour la base", () => {
    const l = versLigneInsight(brute);
    expect(l).toMatchObject({
      jour: "2026-11-01",
      ad_id: "120200000000000003",
      depense_cents: 4567,
      impressions: 3200,
      couverture: 2100,
      clics: 61,
      clics_lien: 38,
      leads: 2,
      campaign_name: "PRODIGIO | VERDUN | LEADS",
    });
    expect(l.actions).toHaveLength(2);
  });

  it("refuse une ligne illisible plutôt que de la deviner", () => {
    expect(() => versLigneInsight({ ...brute, ad_id: "pas-un-id" })).toThrow();
    expect(() => versLigneInsight({ ...brute, spend: "45,67" })).toThrow();
    expect(() => versLigneInsight({ ...brute, date_start: "01/11/2026" })).toThrow();
  });

  it("la dépense du compte, et les pubs (lien d'aperçu en https seulement)", () => {
    expect(versDepenseCompte({ date_start: "2026-11-01", date_stop: "2026-11-01", spend: "100.01" })).toEqual({
      jour: "2026-11-01",
      depense_compte_cents: 10001,
    });
    expect(versPub({ id: "123456", name: "A", preview_shareable_link: "https://fb.me/x" }).lien_apercu).toBe("https://fb.me/x");
    expect(versPub({ id: "123456", preview_shareable_link: "http://fb.me/x" }).lien_apercu).toBeNull();
  });
});
