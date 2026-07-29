import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { PreAnalysisScreen } from "@/components/mandate/analyse/pre-analysis-screen";
import { media } from "@/lib/media";
import type { AppreciationKey } from "@/modules/mandates/scoring";

export const metadata: Metadata = {
  title: "Aperçu — pré-analyse",
  robots: { index: false, follow: false },
};

/**
 * Aperçu de l'écran final de pré-analyse — outil de revue visuelle UNIQUEMENT.
 * Ne réalise AUCUNE soumission et ne touche à aucune base : il rend simplement
 * l'écran final pour chacune des trois appréciations possibles
 * (`?resultat=fort|confirmer|analyse`). Désactivé en production (404).
 */
const MAP: Record<string, AppreciationKey> = {
  fort: "fort_potentiel",
  confirmer: "a_confirmer",
  analyse: "analyse_personnalisee",
};

export default async function ApercuPage({
  searchParams,
}: {
  searchParams: Promise<{ resultat?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { resultat } = await searchParams;
  const appreciation: AppreciationKey = MAP[resultat ?? ""] ?? "a_confirmer";

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-onyx text-ivory">
      <Image
        src={media.confirmation.src}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(12,12,14,0.66) 0%, rgba(12,12,14,0.86) 100%)",
        }}
      />
      <div className="relative flex min-h-dvh flex-col">
        <header className="px-5 pt-5 sm:px-10 sm:pt-7 lg:px-14">
          <span className="font-signature text-sm font-semibold tracking-[0.28em] text-text-on-dark">
            PRODIGIO
          </span>
          <span className="ml-3 text-xs uppercase tracking-[0.18em] text-gold-soft">
            Aperçu (dev)
          </span>
        </header>
        <main className="flex flex-1 items-center px-6 py-12 sm:px-10 lg:px-14">
          <div className="w-full">
            <PreAnalysisScreen
              appreciation={appreciation}
              recallPreference="des_que_possible"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
