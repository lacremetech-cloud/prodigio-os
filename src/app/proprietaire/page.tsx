import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { ProofStripSection } from "@/components/mandate/landing/proof-strip-section";
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
  title:
    "Et si, au lieu d'attendre votre acheteur, nous allions le chercher ? — Prodigio",
  description:
    "Le Système Prodigio va chercher activement les bons acheteurs au lieu " +
    "d'attendre qu'ils trouvent votre bien : mieux le présenter, toucher ceux " +
    "qui ne cherchent pas encore, qualifier les profils. Vérifiez " +
    "l'éligibilité de votre bien.",
  alternates: { canonical: "/proprietaire" },
};

/**
 * Landing propriétaire (funnel Mandats).
 *
 * **Big Idea : le Système Prodigio va chercher l'acheteur.** L'enchaînement est
 * conçu pour être compris en trente secondes, par les seuls grands titres :
 *
 *   Et si, au lieu d'attendre votre acheteur, nous allions le chercher ?
 *   → 14 jours de campagne : 312 demandes · 23 budgets > 1 M€ · 6 visites · 1 vente
 *   → Votre bien est visible par ceux qui le cherchent. Et tous les autres ?
 *   → Votre propriété mérite mieux qu'une annonce.
 *   → Nous investissons dans sa réussite.
 *   → Nous ne remplaçons pas ce qui fonctionne. Nous ajoutons ce qui manque.
 *   → Toutes les propriétés n'intègrent pas le Système Prodigio.
 *   → Vérifier l'éligibilité de mon bien.
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
