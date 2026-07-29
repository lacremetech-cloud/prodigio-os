/**
 * Clé d'idempotence : protège contre les doubles soumissions (double clic,
 * rejeu réseau). Générée une fois côté client au démarrage de l'analyse, puis
 * envoyée avec la soumission. La contrainte d'unicité SQL et la fonction
 * `submit_mandate_funnel` garantissent qu'un rejeu renvoie la même soumission.
 */

/**
 * Génère une clé d'idempotence aléatoire. Utilise `crypto.randomUUID` lorsqu'il
 * est disponible (navigateurs modernes, Node ≥ 19), avec un repli robuste.
 */
export function generateIdempotencyKey(): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Dernier repli (environnements sans WebCrypto) : non cryptographique, mais
  // suffisant pour distinguer deux soumissions humaines distinctes.
  return `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Valide grossièrement la forme d'une clé d'idempotence reçue. */
export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 200;
}
