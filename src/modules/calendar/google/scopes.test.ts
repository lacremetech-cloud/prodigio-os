import { describe, expect, it } from "vitest";
import { GOOGLE_OAUTH_SCOPES, GOOGLE_OAUTH_SCOPE_STRING } from "./scopes";

describe("scopes OAuth Google (moindre privilège)", () => {
  it("demande la lecture (FreeBusy/calendriers) et l'écriture d'événements, sans scope large", () => {
    expect(GOOGLE_OAUTH_SCOPES).toContain("https://www.googleapis.com/auth/calendar.readonly");
    expect(GOOGLE_OAUTH_SCOPES).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(GOOGLE_OAUTH_SCOPES).toContain("email");
    // Jamais le scope « calendar » complet (droits trop larges).
    expect(GOOGLE_OAUTH_SCOPES).not.toContain("https://www.googleapis.com/auth/calendar");
  });

  it("expose une chaîne de scopes séparée par des espaces", () => {
    expect(GOOGLE_OAUTH_SCOPE_STRING.split(" ")).toEqual([...GOOGLE_OAUTH_SCOPES]);
  });
});
