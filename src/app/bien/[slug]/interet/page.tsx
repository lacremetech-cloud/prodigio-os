import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { getPublishedProperty } from "@/modules/buyers/public/public-queries";
import { BuyerFunnel } from "@/components/public/buyer/buyer-funnel";

/**
 * Funnel Acquéreur : `/bien/[slug]/interet`. N'est accessible que pour un bien
 * PUBLIÉ (sinon 404 propre). **Jamais indexé** (noindex, follow off) : les pages
 * de dépôt acquéreur ne doivent pas apparaître dans les moteurs.
 */

export const metadata: Metadata = {
  title: "Manifester mon intérêt",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BuyerInterestPage({ params }: PageProps) {
  const { slug } = await params;
  const snapshot = await getPublishedProperty(slug);
  if (!snapshot) notFound();

  const propertyName = snapshot.content.public_name?.trim() || "Cette propriété";

  return (
    <>
      <AttributionCapture />
      <BuyerFunnel slug={snapshot.slug} propertyName={propertyName} />
    </>
  );
}
