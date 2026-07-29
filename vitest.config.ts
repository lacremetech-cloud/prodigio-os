import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Alias `@/…` → `src/…`, aligné sur `tsconfig.json` (paths). Nécessaire pour
  // tester les modules qui importent des dépendances via l'alias (ex. l'action
  // serveur du funnel, qui importe `@/config` et `@/lib/supabase/server`).
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Tests unitaires de la logique métier / configuration (parcours d'intégration
    // à venir avec le développement des modules).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
