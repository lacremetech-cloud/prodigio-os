import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests unitaires de la logique métier / configuration (parcours d'intégration
    // à venir avec le développement des modules).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
