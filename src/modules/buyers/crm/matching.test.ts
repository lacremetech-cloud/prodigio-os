import { describe, expect, it } from "vitest";
import {
  BUYER_MATCHING_VERSION,
  explainMatch,
  matchConfidence,
  parseMatchResult,
} from "./matching";
import type { BuyerMatchItem } from "@/lib/supabase/types";

const item = (over: Partial<BuyerMatchItem> = {}): BuyerMatchItem => ({
  property_id: "prop-1",
  name: "Villa Belvédère",
  slug: "villa-belvedere",
  property_type: "villa_architecte",
  city: "Megève",
  publication_status: "publie",
  score: 100,
  evaluable_weight: 100,
  positives: ["budget", "type_de_bien", "localisation", "disponibilite"],
  incompatibilities: [],
  missing: [],
  ...over,
});

describe("parseMatchResult — robustesse de la frontière", () => {
  it("dégrade proprement une charge absente", () => {
    const r = parseMatchResult(null);
    expect(r.items).toEqual([]);
    expect(r.version).toBe(BUYER_MATCHING_VERSION);
    expect(r.criteria_source).toBe("absent");
  });

  it("dégrade proprement une charge malformée", () => {
    expect(parseMatchResult("pas un objet").items).toEqual([]);
    expect(parseMatchResult({ items: "pas un tableau" }).items).toEqual([]);
  });

  it("ignore une entrée sans identifiant de bien", () => {
    const r = parseMatchResult({ items: [{ name: "Sans id" }, { property_id: "p", name: "Ok" }] });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.property_id).toBe("p");
  });

  it("filtre les facteurs inconnus (aucun token non prévu ne passe)", () => {
    const r = parseMatchResult({
      items: [{ property_id: "p", positives: ["budget", "facteur_inconnu", 42] }],
    });
    expect(r.items[0]!.positives).toEqual(["budget"]);
  });

  it("conserve la version et la source des critères renvoyées par la base", () => {
    const r = parseMatchResult({
      version: "buyer-matching-v1",
      criteria_source: "humain",
      items: [],
    });
    expect(r.version).toBe("buyer-matching-v1");
    expect(r.criteria_source).toBe("humain");
  });

  it("réduit une source de critères inattendue à « absent »", () => {
    expect(parseMatchResult({ criteria_source: "magie" }).criteria_source).toBe("absent");
  });
});

describe("explainMatch — explicabilité", () => {
  it("énumère les facteurs positifs", () => {
    expect(explainMatch(item())).toContain("Compatible sur");
    expect(explainMatch(item())).toContain("budget");
  });

  it("distingue incompatibilités et données manquantes", () => {
    const text = explainMatch(
      item({ positives: ["budget"], incompatibilities: ["localisation"], missing: ["type_de_bien"] }),
    );
    expect(text).toContain("Compatible sur budget");
    expect(text).toContain("Incompatible sur localisation");
    expect(text).toContain("Donnée manquante : type de bien");
  });

  it("ne prétend rien quand aucun critère n'est évaluable", () => {
    const text = explainMatch(
      item({ positives: [], incompatibilities: [], missing: [], evaluable_weight: 0, score: null }),
    );
    expect(text).toBe("Aucun critère évaluable.");
  });
});

describe("matchConfidence — pas de fausse précision", () => {
  it("qualifie d'élevée une évaluation quasi complète", () => {
    expect(matchConfidence(item({ evaluable_weight: 100 }))).toBe("elevee");
  });

  it("qualifie de partielle une évaluation à mi-poids", () => {
    expect(matchConfidence(item({ evaluable_weight: 65 }))).toBe("partielle");
  });

  it("qualifie de faible une évaluation reposant sur peu de critères", () => {
    expect(matchConfidence(item({ evaluable_weight: 10 }))).toBe("faible");
  });
});
