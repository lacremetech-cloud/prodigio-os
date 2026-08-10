import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/config";
import { getPublishedProperty } from "@/modules/buyers/public/public-queries";
import { publicPathUrl } from "@/modules/buyers/public/snapshot";
import { PropertyExperience } from "@/components/public/property/property-experience";

/**
 * Page publique canonique d'un bien : `/bien/[slug]`. Ne sert QUE le snapshot
 * publié (via `public_property_by_slug`) — jamais un brouillon, une
 * prévisualisation ou un bien dépublié (→ 404 propre). Indexation contrôlée par
 * bien (index/noindex). Aucune donnée privée n'est exposée.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const snapshot = await getPublishedProperty(slug);
  if (!snapshot) {
    return { title: "Bien introuvable", robots: { index: false, follow: false } };
  }
  const c = snapshot.content;
  const indexable = snapshot.seo_index && (c.seo?.index ?? false);
  const title = c.seo?.title?.trim() || c.public_name?.trim() || "Propriété d’exception";
  const description =
    c.seo?.description?.trim() ||
    c.tagline?.trim() ||
    c.intro?.trim()?.slice(0, 200) ||
    "Une propriété d’exception, présentée par Prodigio.";
  const canonical = `/bien/${snapshot.slug}`;
  const socialUrl = publicPathUrl(c.seo?.social_path ?? null, env.NEXT_PUBLIC_SUPABASE_URL);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      locale: "fr_FR",
      images: socialUrl ? [{ url: socialUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: socialUrl ? [socialUrl] : undefined,
    },
  };
}

export default async function PublicPropertyPage({ params }: PageProps) {
  const { slug } = await params;
  const snapshot = await getPublishedProperty(slug);
  if (!snapshot) notFound();

  return (
    <PropertyExperience
      content={snapshot.content}
      slug={snapshot.slug}
      supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL}
    />
  );
}
