import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { ProofStripSection } from "@/components/mandate/landing/proof-strip-section";
import { MarcheInvisibleSection } from "@/components/mandate/landing/marche-invisible-section";
import { MarchesSection } from "@/components/mandate/landing/marches-section";
import { AcquisitionSection } from "@/components/mandate/landing/acquisition-section";
import { SystemSection } from "@/components/mandate/landing/system-section";
import { CreationSection } from "@/components/mandate/landing/creation-section";
import { VitrineSection } from "@/components/mandate/landing/vitrine-section";
import { EngagementSection } from "@/components/mandate/landing/engagement-section";
import { TransparenceSection } from "@/components/mandate/landing/transparence-section";
import { CaseStudySection } from "@/components/mandate/landing/case-study-section";
import { SelectionSection } from "@/components/mandate/landing/selection-section";
import { FaqSection } from "@/components/mandate/landing/faq-section";
import { FinalCtaSection } from "@/components/mandate/landing/final-cta-section";
import { SiteFooter } from "@/components/mandate/landing/site-footer";
import { StickyCta } from "@/components/mandate/landing/sticky-cta";

export const metadata: Metadata = {
  title:
    "Et si, au lieu d'attendre votre acheteur, nous allions le chercher ? — Prodigio",
  description:
    "Le Système Prodigio ajoute à l'expertise immobilière une capacité " +
    "supplémentaire : aller chercher les acheteurs qui ne cherchent pas encore. " +
    "Positionnement, campagnes d'acquisition, données, qualification. Vérifiez " +
    "l'éligibilité de votre bien.",
  alternates: { canonical: "/proprietaire" },
};

/**
 * Landing propriétaire (funnel Mandats).
 *
 * **La doctrine :** expertise immobilière traditionnelle **plus** Système
 * Prodigio™. Jamais contre — en plus.
 *
 * L'enchaînement est conçu pour être compris en trente secondes, par les seuls
 * grands titres :
 *
 *   Et si, au lieu d'attendre votre acheteur, nous allions le chercher ?
 *   → 14 jours de campagne : 312 · 23 · 6 · 1
 *   → Et ceux qui pourraient acheter votre bien… sans encore le chercher ?
 *   → Les meilleures agences savent déjà très bien travailler le marché actif.
 *   → 50 000 vues. Mais combien d'acheteurs ?
 *   → Une stratégie construite autour d'un seul bien : le vôtre.
 *   → Nous cherchons l'angle qui le fera désirer.
 *   → Ne nous croyez pas sur parole. Ouvrez-le.
 *   → Nous investissons dans sa réussite.
 *   → Voyez votre marché réagir.
 *   → Nous n'avons pas attendu son acheteur.
 *   → Nous investissons dans chaque propriété — nous ne pouvons pas toutes les accepter.
 *   → Votre futur acheteur est peut-être déjà là.
 *
 * Le mouvement d'ensemble : **question → preuve → problème → positionnement →
 * mécanisme → démonstration → engagement → preuve → sélection → action.**
 *
 * La VSL du hero *explique*. La page *démontre et rassure*. Toute section qui
 * répéterait le film n'a pas sa place ici.
 */
export default function ProprietairePage() {
  return (
    <main className="bg-ivory">
      <AttributionCapture />
      <Hero />
      <ProofStripSection />
      <MarcheInvisibleSection />
      <MarchesSection />
      <AcquisitionSection />
      <SystemSection />
      <CreationSection />
      <VitrineSection />
      <EngagementSection />
      <TransparenceSection />
      <CaseStudySection />
      <SelectionSection />
      <FaqSection />
      <FinalCtaSection />
      <SiteFooter />
      <StickyCta />
    </main>
  );
}
