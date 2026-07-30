import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware Next.js : rafraîchit la session Supabase et protège `/crm/*`.
 * Voir `src/lib/supabase/middleware.ts`.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Exécute le middleware partout SAUF les assets statiques et l'API interne.
  // `/crm` et `/connexion` sont bien couverts.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff2?)$).*)",
  ],
};
