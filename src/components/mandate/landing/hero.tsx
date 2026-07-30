import { CtaLink } from "@/components/ui/cta-link";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { HeroVsl } from "./hero-vsl";
import { LandingNav } from "./landing-nav";
import { CTA_PRIMARY, MICROCOPY, hero } from "./copy";

/**
 * Hero cinématographique, centrée sur la VSL — pièce maîtresse visible dès
 * l'arrivée. Fond noir profond, grande typographie éditoriale, respirations,
 * repères de production discrets. La vidéo domine la composition (elle n'est
 * jamais reléguée dans une colonne à côté d'un pavé de texte).
 */
export function Hero() {
  return (
    <section className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-onyx text-ivory">
      {/* Halos de lumière très subtils (aucune image chargée sous le texte). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 0%, rgba(203,180,136,0.10) 0%, rgba(12,12,14,0) 60%)," +
            "radial-gradient(80% 60% at 50% 120%, rgba(154,123,69,0.10) 0%, rgba(12,12,14,0) 60%)",
        }}
      />

      <LandingNav />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-10 pt-24 sm:px-10 sm:pt-28 lg:px-8">
        {/* Accroche + titre */}
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <p className="eyebrow text-gold-soft">{hero.eyebrow}</p>
          <h1 className="mt-5 text-balance text-4xl leading-[1.06] text-ivory sm:text-5xl lg:text-6xl">
            {hero.titleLine1}
            <br />
            {hero.titleLine2}
          </h1>
        </div>

        {/* Écrin VSL — pièce maîtresse */}
        <div className="mx-auto mt-8 w-full max-w-4xl animate-fade-up sm:mt-10">
          <HeroVsl />
        </div>

        {/* Sous-titre + CTA */}
        <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center text-center animate-fade-up">
          <p className="text-pretty text-base leading-relaxed text-ivory/85 sm:text-lg">
            {hero.subtitle}
          </p>
          <div className="mt-7 flex flex-col items-center gap-3">
            <CtaLink href={ANALYSE_ROUTE} variant="contrast">
              {CTA_PRIMARY}
            </CtaLink>
            <p className="text-sm text-ivory/70">{MICROCOPY}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
