import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { ConstatSection } from "@/components/mandate/landing/constat-section";
import { SystemeSection } from "@/components/mandate/landing/systeme-section";
import { ProofSection } from "@/components/mandate/landing/proof-section";
import { ComparaisonSection } from "@/components/mandate/landing/comparaison-section";
import { SelectivitySection } from "@/components/mandate/landing/selectivity-section";
import { FinalCtaSection } from "@/components/mandate/landing/final-cta-section";
import { SiteFooter } from "@/components/mandate/landing/site-footer";
import { StickyCta } from "@/components/mandate/landing/sticky-cta";

export const metadata: Metadata = {
  title: "Votre propriété mérite plus qu'une annonce — Prodigio",
  description:
    "Prodigio transforme chaque bien d'exception en une marque singulière et " +
    "déploie une stratégie active pour aller chercher ses futurs acquéreurs. " +
    "Testez confidentiellement l'éligibilité de votre propriété.",
  alternates: { canonical: "/proprietaire" },
};

/**
 * Landing propriétaire (funnel Mandats) — refonte cinématographique centrée sur
 * la VSL. Alternance noir profond / vidéo / images / sections éditoriales.
 * Capture discrète de l'attribution marketing dès l'arrivée.
 */
export default function ProprietairePage() {
  return (
    <main className="bg-ivory">
      <AttributionCapture />
      <Hero />
      <ConstatSection />
      <SystemeSection />
      <ProofSection />
      <ComparaisonSection />
      <SelectivitySection />
      <FinalCtaSection />
      <SiteFooter />
      <StickyCta />
    </main>
  );
}
