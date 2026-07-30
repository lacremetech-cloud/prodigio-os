import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { Marquee } from "@/components/mandate/landing/marquee";
import { StatementSection } from "@/components/mandate/landing/statement-section";
import { ConstatSection } from "@/components/mandate/landing/constat-section";
import { SystemeSection } from "@/components/mandate/landing/systeme-section";
import { ModeleSection } from "@/components/mandate/landing/modele-section";
import { ProofSection } from "@/components/mandate/landing/proof-section";
import { ComparaisonSection } from "@/components/mandate/landing/comparaison-section";
import { SelectivitySection } from "@/components/mandate/landing/selectivity-section";
import { FinalCtaSection } from "@/components/mandate/landing/final-cta-section";
import { SiteFooter } from "@/components/mandate/landing/site-footer";
import { StickyCta } from "@/components/mandate/landing/sticky-cta";
import { marqueeItems } from "@/components/mandate/landing/copy";

export const metadata: Metadata = {
  title: "Votre propriété mérite plus qu'une annonce — Prodigio",
  description:
    "Prodigio ne met pas votre bien en vente, Prodigio le vend : chaque bien " +
    "d'exception devient une marque et bénéficie d'une stratégie de mise en " +
    "marché active. Testez confidentiellement l'éligibilité de votre propriété.",
  alternates: { canonical: "/proprietaire" },
};

/**
 * Landing propriétaire (funnel Mandats) — refonte cinématographique dynamique.
 * Alternance noir / vidéo / images / sections éditoriales, animations au scroll,
 * chiffres animés, moment signature. Capture d'attribution dès l'arrivée.
 */
export default function ProprietairePage() {
  return (
    <main className="bg-ivory">
      <AttributionCapture />
      <Hero />
      <StatementSection />
      <Marquee items={marqueeItems} tone="light" />
      <ConstatSection />
      <SystemeSection />
      <ModeleSection />
      <ProofSection />
      <ComparaisonSection />
      <SelectivitySection />
      <FinalCtaSection />
      <SiteFooter />
      <StickyCta />
    </main>
  );
}
