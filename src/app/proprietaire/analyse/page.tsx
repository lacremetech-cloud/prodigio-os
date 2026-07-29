import type { Metadata } from "next";
import { AnalyseExperience } from "@/components/mandate/analyse/analyse-experience";

export const metadata: Metadata = {
  title: "Analyse confidentielle d'éligibilité",
  description:
    "Étude confidentielle d'éligibilité de votre propriété au Système Prodigio. " +
    "Chaque demande est étudiée individuellement.",
  // Parcours interactif : non indexé.
  robots: { index: false, follow: false },
};

/**
 * Route de l'analyse confidentielle d'éligibilité (expérience immersive
 * plein écran). L'orchestration et l'état vivent côté client.
 */
export default function AnalysePage() {
  return <AnalyseExperience />;
}
