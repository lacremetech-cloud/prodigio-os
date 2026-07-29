import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("fonctionne sans aucune variable et applique les valeurs par défaut", () => {
    const result = parseEnv({});
    expect(result.NODE_ENV).toBe("development");
  });

  it("accepte les environnements Node connus", () => {
    expect(parseEnv({ NODE_ENV: "production" }).NODE_ENV).toBe("production");
    expect(parseEnv({ NODE_ENV: "test" }).NODE_ENV).toBe("test");
  });

  it("rejette une valeur NODE_ENV inconnue", () => {
    expect(() => parseEnv({ NODE_ENV: "staging" })).toThrow();
  });
});
