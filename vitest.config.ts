import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Plugin React : transforme le JSX/TSX des tests de composants (runtime auto).
  plugins: [react()],
  // Alias `@/…` → `src/…`, aligné sur `tsconfig.json` (paths). Nécessaire pour
  // tester les modules qui importent des dépendances via l'alias (ex. l'action
  // serveur du funnel, qui importe `@/config` et `@/lib/supabase/server`).
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Tests unitaires de la logique métier / configuration + tests de composants
    // (rendu jsdom au cas par cas via `// @vitest-environment jsdom`).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
