import { describe, expect, it } from "vitest";
import { buildVslEmbedUrl, VSL_EMBED_HOST, VSL_YOUTUBE_ID } from "./vsl";

describe("configuration VSL", () => {
  it("utilise l'identifiant YouTube provisoire attendu", () => {
    expect(VSL_YOUTUBE_ID).toBe("rgH1uqNdvHs");
  });

  it("intègre via le domaine nocookie (vie privée)", () => {
    expect(VSL_EMBED_HOST).toBe("https://www.youtube-nocookie.com");
    const url = buildVslEmbedUrl();
    expect(url.startsWith("https://www.youtube-nocookie.com/embed/rgH1uqNdvHs")).toBe(true);
  });

  it("active l'autoplay muet et playsinline par défaut", () => {
    const params = new URL(buildVslEmbedUrl()).searchParams;
    expect(params.get("autoplay")).toBe("1");
    expect(params.get("mute")).toBe("1");
    expect(params.get("playsinline")).toBe("1");
  });

  it("retire l'habillage YouTube (pas de contrôles ni de suggestions)", () => {
    const params = new URL(buildVslEmbedUrl()).searchParams;
    expect(params.get("controls")).toBe("0");
    expect(params.get("rel")).toBe("0");
    expect(params.get("modestbranding")).toBe("1");
    expect(params.get("fs")).toBe("0");
    // Pilotage du son / redémarrage via l'API IFrame.
    expect(params.get("enablejsapi")).toBe("1");
  });

  it("permet d'activer le son (mute=0) pour le repli sans API", () => {
    const params = new URL(buildVslEmbedUrl(VSL_YOUTUBE_ID, { mute: false })).searchParams;
    expect(params.get("mute")).toBe("0");
    expect(params.get("autoplay")).toBe("1");
  });

  it("boucle sur la même vidéo (playlist = id)", () => {
    const params = new URL(buildVslEmbedUrl()).searchParams;
    expect(params.get("loop")).toBe("1");
    expect(params.get("playlist")).toBe("rgH1uqNdvHs");
  });
});
