import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { VslSection } from "@/components/mandate/landing/vsl-section";
import { ConstatSection } from "@/components/mandate/landing/constat-section";
import { DifferenceSection } from "@/components/mandate/landing/difference-section";
import { ProofSection } from "@/components/mandate/landing/proof-section";
import { SelectivitySection } from "@/components/mandate/landing/selectivity-section";
import { SiteFooter } from "@/components/mandate/landing/site-footer";

export const metadata: Metadata = {
  title: "Votre propriété mérite mieux qu'une annonce",
  description:
    "Le Système Prodigio transforme chaque propriété d'exception en une mise en " +
    "marché à part entière. Vérifiez la confidentialité de l'éligibilité de votre propriété.",
  alternates: { canonical: "/proprietaire" },
};

/**
 * Landing propriétaire (funnel Mandats). Composition de sections éditoriales
 * premium ; capture discrète de l'attribution marketing dès l'arrivée.
 */
export default function ProprietairePage() {
  return (
    <main className="bg-ivory">
      <AttributionCapture />
      <Hero />
      <VslSection />
      <ConstatSection />
      <DifferenceSection />
      <ProofSection />
      <SelectivitySection />
      <SiteFooter />
    </main>
  );
}
