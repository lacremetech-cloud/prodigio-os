import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { getBuyerFormContext } from "@/modules/buyers/public/public-queries";
import { UniversalBuyerForm } from "@/components/public/buyer/universal-form";

/**
 * Formulaire acquéreur universel : `/bien/[slug]/interet`.
 *
 * La route répond dès que le **formulaire est actif**, que la vitrine Prodigio
 * soit publiée ou non : une annonce peut vivre ailleurs et devoir collecter des
 * demandes sans que la page Prodigio existe. Sinon, 404 propre.
 *
 * Tant que la vitrine n'est pas publiée, la page ne révèle **rien du bien** :
 * ni nom, ni prix, ni adresse, ni contenu non validé. Elle n'affiche que le
 * formulaire. Le visiteur arrive d'une annonce qui, elle, présente déjà le bien.
 *
 * **Jamais indexée** : une page de dépôt n'a rien à faire dans un moteur.
 */

export const metadata: Metadata = {
  title: "Demander la brochure",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BuyerInterestPage({ params }: PageProps) {
  const { slug } = await params;
  const context = await getBuyerFormContext(slug);
  if (!context) notFound();

  return (
    <>
      <AttributionCapture />
      <UniversalBuyerForm
        slug={context.slug}
        propertyName={context.publicName}
        brochureAvailable={context.brochureAvailable}
      />
    </>
  );
}
