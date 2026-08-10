import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { env } from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { PropertyExperience } from "@/components/public/property/property-experience";
import type { PublicPropertyContent } from "@/modules/buyers/public/snapshot";

/**
 * Prévisualisation PRIVÉE de l'expérience publique d'un bien (avant publication).
 * Route de premier niveau (hors coquille CRM) pour un rendu plein cadre identique
 * à la page publiée. Authentifiée : garde de session + RLS/rôle re-vérifiés en
 * base par `crm_property_public_preview`. Le contenu est IDENTIQUE au futur
 * snapshot (même assembleur en base) : aucune divergence. Toujours `noindex`.
 */

export const metadata: Metadata = {
  title: "Prévisualisation publique",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyPreviewPage({ params }: PageProps) {
  const { id } = await params;
  await requireCrmSession(`/apercu-bien/${id}`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_public_preview", {
    p_property_id: id,
  });
  if (error || !data || typeof data !== "object") notFound();
  const content = data as unknown as PublicPropertyContent;

  return (
    <div className="relative">
      <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 bg-wood-black px-4 py-2 text-xs text-ivory">
        <span>Prévisualisation privée — non publiée, non indexée.</span>
        <Link href={`/crm/biens/${id}`} className="underline underline-offset-2">
          ← Retour au cockpit
        </Link>
      </div>
      <PropertyExperience
        content={content}
        slug={content.slug ?? id}
        supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL}
        preview
      />
    </div>
  );
}
