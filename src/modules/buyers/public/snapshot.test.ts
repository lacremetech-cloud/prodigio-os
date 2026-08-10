import { describe, expect, it } from "vitest";
import { publicMediaUrl, publicPathUrl } from "./snapshot";

describe("publicMediaUrl / publicPathUrl", () => {
  const supabase = "https://abcd.supabase.co";

  it("construit une URL publique directe (bucket public, aucune signature)", () => {
    const url = publicMediaUrl(
      { bucket: "property-public", storage_path: "prop-1/public/uuid.jpg" },
      supabase,
    );
    expect(url).toBe(
      "https://abcd.supabase.co/storage/v1/object/public/property-public/prop-1/public/uuid.jpg",
    );
  });

  it("supporte un slash final sur l'hôte Supabase", () => {
    const url = publicPathUrl("prop-1/public/x.png", "https://abcd.supabase.co/");
    expect(url).toContain("/storage/v1/object/public/property-public/prop-1/public/x.png");
  });

  it("renvoie null sans hôte Supabase (aucune image cassée)", () => {
    expect(publicMediaUrl({ bucket: "property-public", storage_path: "x.jpg" }, undefined)).toBeNull();
    expect(publicPathUrl("x.jpg", "")).toBeNull();
  });

  it("renvoie null pour un média absent", () => {
    expect(publicMediaUrl(null, supabase)).toBeNull();
    expect(publicPathUrl(null, supabase)).toBeNull();
  });
});
