import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { forces } from "./copy";

/**
 * Reconnaître les forces de l'immobilier d'exception.
 *
 * Section fondatrice du positionnement : Prodigio ne dévalorise PAS les agences
 * de prestige. Les leviers existants sont énoncés comme une liste typographique
 * pleine largeur — pas comme six cartes à icônes.
 */
export function ForcesSection() {
  return (
    <section className="bg-ivory px-5 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <Reveal>
          <SectionLabel>{forces.eyebrow}</SectionLabel>
        </Reveal>

        {/* Les leviers, en grand : ils occupent la place qu'ils méritent. */}
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-8 max-w-[16ch] text-balance text-[2.1rem] leading-[1.06] sm:text-5xl lg:max-w-[20ch] lg:text-[4rem]">
            {forces.title}
          </h2>
        </Reveal>

        {/* Décalage à droite : le commentaire répond au titre, il ne le répète pas. */}
        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal delayMs={120} className="lg:col-span-5 lg:col-start-7">
            <p className="text-pretty text-lg leading-relaxed text-wood-black">
              {forces.body}
            </p>
            <p className="mt-6 text-pretty text-lg leading-relaxed text-text-secondary">
              {forces.body2}
            </p>
          </Reveal>
        </div>

        {/* Le point de bascule — une phrase, seule, très grande. */}
        <Reveal variant="rise" delayMs={100} className="mt-20 border-t border-border pt-12 sm:mt-28">
          <p className="max-w-[18ch] text-balance font-display text-[1.9rem] leading-[1.12] text-wood-black sm:text-4xl lg:max-w-[22ch] lg:text-[3.2rem]">
            {forces.statement}
          </p>
          <p className="mt-8 max-w-2xl text-pretty leading-relaxed text-text-secondary">
            {forces.closing}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
