import { describe, expect, it } from "vitest";
import {
  generateIdempotencyKey,
  isValidIdempotencyKey,
} from "./idempotency";

describe("generateIdempotencyKey", () => {
  it("génère une clé suffisamment longue", () => {
    const key = generateIdempotencyKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThanOrEqual(8);
  });

  it("génère des clés distinctes", () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => generateIdempotencyKey()),
    );
    expect(keys.size).toBe(50);
  });
});

describe("isValidIdempotencyKey", () => {
  it("accepte une clé plausible", () => {
    expect(isValidIdempotencyKey("550e8400-e29b-41d4-a716-446655440000")).toBe(
      true,
    );
  });

  it("rejette les valeurs invalides", () => {
    expect(isValidIdempotencyKey("court")).toBe(false);
    expect(isValidIdempotencyKey(123)).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
  });
});
