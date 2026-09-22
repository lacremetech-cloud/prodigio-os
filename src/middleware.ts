import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { applyBuyerFormEmbedHeaders } from "@/lib/security/buyer-form-headers";

/**
 * Middleware Next.js : rafraîchit la session Supabase, protège `/crm/*`, et
 * pose la politique d'intégration du formulaire acquéreur.
 *
 * `frame-ancestors` dépend du bien : il ne peut donc pas être statique, et une
 * page ne peut pas poser ses propres en-têtes de réponse. C'est ici, ou nulle
 * part. Voir `src/lib/supabase/middleware.ts` et `buyer-form-headers.ts`.
 */
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  await applyBuyerFormEmbedHeaders(request, response);
  return response;
}

export const config = {
  // Exécute le middleware partout SAUF les assets statiques et l'API interne.
  // `/crm` et `/connexion` sont bien couverts.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff2?)$).*)",
  ],
};
