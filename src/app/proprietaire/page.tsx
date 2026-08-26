import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { Marquee } from "@/components/mandate/landing/marquee";
import { StatementSection } from "@/components/mandate/landing/statement-section";
import { ConstatSection } from "@/components/mandate/landing/constat-section";
import { VitrineSection } from "@/components/mandate/landing/vitrine-section";
import { SystemSection } from "@/components/mandate/landing/system-section";
import { ModeleSection } from "@/components/mandate/landing/modele-section";
import { ProofSection } from "@/components/mandate/landing/proof-section";
import { FaqSection } from "@/components/mandate/landing/faq-section";
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
 * Une idée par écran, dans cet ordre : la promesse et le film (hero) → la phrase
 * signature → la preuve visuelle de l'écrin → l'écrin **ouvert en direct** → le
 * système → le modèle économique → la preuve chiffrée → les objections → l'appel
 * à l'action.
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
      <StatementSection />
      <Marquee items={marqueeItems} tone="light" />
      <ConstatSection />
      <VitrineSection />
      <SystemSection />
      <ModeleSection />
      <ProofSection />
      <FaqSection />
      <FinalCtaSection />
      <SiteFooter />
      <StickyCta />
    </main>
  );
}
