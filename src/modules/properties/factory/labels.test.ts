import { describe, expect, it } from "vitest";
import {
  PRODUCTION_KIND_ORDER,
  PROPERTY_STATUS_ORDER,
  READINESS_CHECK_ORDER,
  documentCategoryLabels,
  mediaKindLabels,
  mediaRightsLabels,
  productionKindLabels,
  productionStatusLabels,
  productionStatusVisual,
  propertyStatusLabels,
  propertyStatusVisual,
  readinessCheckLabels,
} from "./labels";
import type {
  PropertyDocumentCategory,
  PropertyMediaKind,
  PropertyMediaRightsStatus,
  PropertyProductionKind,
  PropertyProductionStatus,
  PropertyStatus,
} from "@/lib/supabase/types";

const STATUSES: PropertyStatus[] = [
  "preparation_a_lancer",
  "collecte_en_cours",
  "strategie_en_cours",
  "production_en_cours",
  "validation_avant_lancement",
  "pret_a_lancer",
  "en_diffusion",
  "suspendu",
  "archive",
];

const MEDIA_KINDS: PropertyMediaKind[] = [
  "photo",
  "video",
  "drone",
  "plan",
  "rendu",
  "couverture",
  "autre",
];

const RIGHTS: PropertyMediaRightsStatus[] = ["a_verifier", "libre", "sous_licence", "restreint"];

const DOC_CATEGORIES: PropertyDocumentCategory[] = [
  "mandat",
  "diagnostic",
  "plan",
  "titre",
  "legal",
  "copropriete",
  "autorisation",
  "libre",
];

const PROD_KINDS: PropertyProductionKind[] = [
  "photographie",
  "video",
  "drone",
  "redaction",
  "positionnement",
  "identite_visuelle",
  "site_dedie",
  "brochure",
  "publicites",
  "funnel_acquereur",
  "validation_finale",
];

const PROD_STATUSES: PropertyProductionStatus[] = [
  "a_faire",
  "en_cours",
  "en_revue",
  "termine",
  "valide",
  "bloque",
];

describe("labels — couverture complète", () => {
  it("chaque statut de bien a un libellé et une couleur+icône (couleur jamais seule)", () => {
    for (const s of STATUSES) {
      expect(propertyStatusLabels[s]).toBeTruthy();
      expect(propertyStatusVisual[s].cssVar).toMatch(/^--crm-/);
      expect(propertyStatusVisual[s].icon).toBeTruthy();
    }
    expect(PROPERTY_STATUS_ORDER).toEqual(STATUSES);
  });

  it("chaque type de média et statut de droits a un libellé", () => {
    for (const k of MEDIA_KINDS) expect(mediaKindLabels[k]).toBeTruthy();
    for (const r of RIGHTS) expect(mediaRightsLabels[r]).toBeTruthy();
  });

  it("chaque catégorie de document a un libellé", () => {
    for (const c of DOC_CATEGORIES) expect(documentCategoryLabels[c]).toBeTruthy();
  });

  it("chaque type et statut de production a libellé + couleur/icône", () => {
    for (const k of PROD_KINDS) expect(productionKindLabels[k]).toBeTruthy();
    for (const s of PROD_STATUSES) {
      expect(productionStatusLabels[s]).toBeTruthy();
      expect(productionStatusVisual[s].cssVar).toMatch(/^--crm-/);
      expect(productionStatusVisual[s].icon).toBeTruthy();
    }
    expect(PRODUCTION_KIND_ORDER).toEqual(PROD_KINDS);
  });

  it("les 7 critères de readiness ont un libellé et couvrent l'ordre attendu", () => {
    expect(READINESS_CHECK_ORDER).toHaveLength(7);
    for (const k of READINESS_CHECK_ORDER) {
      expect(readinessCheckLabels[k]).toBeTruthy();
    }
  });
});
