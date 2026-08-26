import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { Hero } from "@/components/mandate/landing/hero";
import { PreuveFlash } from "@/components/mandate/landing/preuve-flash";
import { ForcesSection } from "@/components/mandate/landing/forces-section";
import { VisibiliteSection } from "@/components/mandate/landing/visibilite-section";
import { MarcheSection } from "@/components/mandate/landing/marche-section";
import { CreationSection } from "@/components/mandate/landing/creation-section";
import { EcrinReelSection } from "@/components/mandate/landing/ecrin-reel-section";
import { SystemeSection } from "@/components/mandate/landing/systeme-section";
import { EngagementSection } from "@/components/mandate/landing/engagement-section";
import { DataSection } from "@/components/mandate/landing/data-section";
import { CaseStudySection } from "@/components/mandate/landing/case-study-section";
import { ManifesteSection } from "@/components/mandate/landing/manifeste-section";
import { SelectivitySection } from "@/components/mandate/landing/selectivity-section";
import { FaqSection } from "@/components/mandate/landing/faq-section";
import { FinalCtaSection } from "@/components/mandate/landing/final-cta-section";
import { Marquee } from "@/components/mandate/landing/marquee";
import { SiteFooter } from "@/components/mandate/landing/site-footer";
import { StickyCta } from "@/components/mandate/landing/sticky-cta";
import { marqueeItems } from "@/components/mandate/landing/copy";

export const metadata: Metadata = {
  title: "Et si nous allions chercher votre acheteur ? — Prodigio",
  description:
    "Le Système Prodigio™ ajoute aux fondamentaux de l'immobilier de prestige " +
    "une couche d'acquisition active : positionnement, création, budget média " +
    "financé, data et optimisation — au service d'un seul bien : le vôtre.",
  alternates: { canonical: "/proprietaire" },
};

/**
 * Landing propriétaire (funnel Mandats).
 *
 * NARRATION — chaque section répond à la précédente, et le rythme alterne
 * volontairement densité et silence, clair et sombre, texte et image :
 *
 *   hero (question)            → preuve immédiate (« comment ? »)
 *   forces de l'immobilier     → visibilité ≠ acquisition
 *   au-delà des fichiers       → la création → l'écrin en vrai
 *   le système                 → notre engagement (climax budget média)
 *   la data                    → l'étude de cas (climax « 1 vente »)
 *   le manifeste               → la sélectivité → la FAQ → l'appel final
 *
 * Le parcours d'analyse (« quiz ») n'est PAS touché : tous les CTA pointent vers
 * `ANALYSE_ROUTE`, comme auparavant.
 */
export default function ProprietairePage() {
  return (
    <main className="bg-ivory">
      <AttributionCapture />

      <Hero />
      <PreuveFlash />

      <ForcesSection />
      <VisibiliteSection />
      <MarcheSection />

      <CreationSection />
      <EcrinReelSection />

      <SystemeSection />
      <EngagementSection />

      <DataSection />
      <CaseStudySection />

      <ManifesteSection />
      <Marquee items={marqueeItems} tone="light" />
      <SelectivitySection />

      <FaqSection />
      <FinalCtaSection />
      <SiteFooter />
      <StickyCta />
    </main>
  );
}
