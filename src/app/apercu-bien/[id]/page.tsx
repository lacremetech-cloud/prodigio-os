import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { env, isSupabaseAdminConfigured } from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { PropertyExperience } from "@/components/public/property/property-experience";
import type { PublicMediaNode, PublicPropertyContent } from "@/modules/buyers/public/snapshot";
import { createMasterSignedUrl } from "@/modules/buyers/public/storage";

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

  // Prévisualisation : les médias pointent le MASTER privé. On génère des URL
  // signées COURTES (jamais stockées) et on les injecte dans chaque nœud média.
  if (isSupabaseAdminConfigured()) {
    const signCache = new Map<string, string | null>();
    const sign = async (node: PublicMediaNode | null): Promise<void> => {
      if (!node || !node.storage_path) return;
      if (!signCache.has(node.storage_path)) {
        signCache.set(node.storage_path, await createMasterSignedUrl(node.storage_path));
      }
      node.url = signCache.get(node.storage_path) ?? null;
    };
    await sign(content.hero);
    await sign(content.main_media);
    for (const g of content.gallery ?? []) await sign(g);
  }

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
