import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { ProofStripSection } from "@/components/mandate/landing/proof-strip-section";
import { BigIdeaSection } from "@/components/mandate/landing/big-idea-section";
import { AudienceSection } from "@/components/mandate/landing/audience-section";
import { CreationSection } from "@/components/mandate/landing/creation-section";
import { VitrineSection } from "@/components/mandate/landing/vitrine-section";
import { SystemSection } from "@/components/mandate/landing/system-section";
import { EngagementSection } from "@/components/mandate/landing/engagement-section";
import { TransparenceSection } from "@/components/mandate/landing/transparence-section";
import { CaseStudySection } from "@/components/mandate/landing/case-study-section";
import { ComparaisonSection } from "@/components/mandate/landing/comparaison-section";
import { SelectionSection } from "@/components/mandate/landing/selection-section";
import { FaqSection } from "@/components/mandate/landing/faq-section";
import { FinalCtaSection } from "@/components/mandate/landing/final-cta-section";
import { SiteFooter } from "@/components/mandate/landing/site-footer";
import { StickyCta } from "@/components/mandate/landing/sticky-cta";

export const metadata: Metadata = {
  title: "Et si votre futur acheteur ne cherchait pas encore votre propriété ? — Prodigio",
  description:
    "Prodigio ajoute l'acquisition active à la commercialisation immobilière : " +
    "au lieu d'attendre un acquéreur déjà en recherche, nous allons chercher " +
    "l'attention de nouveaux acheteurs potentiels. Vérifiez l'éligibilité de " +
    "votre propriété.",
  alternates: { canonical: "/proprietaire" },
};

/**
 * Landing propriétaire (funnel Mandats).
 *
 * **Big Idea : l'acquisition active.** L'enchaînement est conçu pour être
 * compris en trente secondes, par les seuls grands titres :
 *
 *   Et si votre futur acheteur ne cherchait pas encore votre propriété ?
 *   → 312 demandes · 23 budgets > 1 M€ · 6 visites · 1 vente
 *   → Votre propriété est visible par ceux qui la cherchent. Et tous les autres ?
 *   → Votre acheteur est peut-être déjà devant nous.
 *   → Votre propriété mérite mieux qu'une annonce.
 *   → Nous investissons nous-mêmes dans sa commercialisation.
 *   → Nous ne remplaçons pas ce qui fonctionne. Nous ajoutons ce qui manque.
 *   → Toutes les propriétés n'intègrent pas Prodigio.
 *   → Vérifier l'éligibilité de ma propriété.
 *
 * Comprendre → Désirer → Croire → Être rassuré → Cliquer. Toute section qui ne
 * sert pas cet enchaînement n'a pas sa place ici.
 */
export default function ProprietairePage() {
  return (
    <main className="bg-ivory">
      <AttributionCapture />
      <Hero />
      <ProofStripSection />
      <BigIdeaSection />
      <AudienceSection />
      <CreationSection />
      <VitrineSection />
      <SystemSection />
      <EngagementSection />
      <TransparenceSection />
      <CaseStudySection />
      <ComparaisonSection />
      <SelectionSection />
      <FaqSection />
      <FinalCtaSection />
      <SiteFooter />
      <StickyCta />
    </main>
  );
}
