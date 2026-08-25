import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { VslSection } from "@/components/mandate/landing/vsl-section";
import { Marquee } from "@/components/mandate/landing/marquee";
import { StatementSection } from "@/components/mandate/landing/statement-section";
import { ConstatSection } from "@/components/mandate/landing/constat-section";
import { SystemSection } from "@/components/mandate/landing/system-section";
import { ModeleSection } from "@/components/mandate/landing/modele-section";
import { ProofSection } from "@/components/mandate/landing/proof-section";
import { FinalCtaSection } from "@/components/mandate/landing/final-cta-section";
import { SiteFooter } from "@/components/mandate/landing/site-footer";
import { StickyCta } from "@/components/mandate/landing/sticky-cta";
import { marqueeItems } from "@/components/mandate/landing/copy";

export const metadata: Metadata = {
  title: "Votre propriété mérite plus qu'une annonce — Prodigio",
  description:
    "Prodigio ne met pas votre bien en vente, Prodigio le vend : chaque bien " +
    "d'exception devient une marque et bénéficie d'une stratégie de mise en " +
    "marché active. Voyez confidentiellement si votre bien est éligible.",
  alternates: { canonical: "/proprietaire" },
};

/**
 * Landing propriétaire (funnel Mandats).
 *
 * Une idée par écran, dans cet ordre : la promesse (hero) → le film → la phrase
 * signature → la preuve visuelle de l'écrin → le système → le modèle
 * économique → la preuve chiffrée → l'appel à l'action.
 *
 * Les sections « Avant / Avec Prodigio » et « Sélection & confidentialité » ont
 * été retirées : la première répétait le constat de l'écrin, la seconde disait
 * déjà ce que porte le CTA final, qui les absorbe.
 */
export default function ProprietairePage() {
  return (
    <main className="bg-ivory">
      <AttributionCapture />
      <Hero />
      <VslSection />
      <StatementSection />
      <Marquee items={marqueeItems} tone="light" />
      <ConstatSection />
      <SystemSection />
      <ModeleSection />
      <ProofSection />
      <FinalCtaSection />
      <SiteFooter />
      <StickyCta />
    </main>
  );
}
