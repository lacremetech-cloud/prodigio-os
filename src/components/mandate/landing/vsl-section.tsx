import { Reveal } from "@/components/ui/reveal";
import { HeroVsl } from "./hero-vsl";
import { vsl } from "./copy";

/**
 * Le film — sorti de la hero pour ne plus repousser le CTA sous la ligne de
 * flottaison. Un intitulé court, l'écrin vidéo, rien d'autre.
 */
export function VslSection() {
  return (
    <section className="grain relative bg-onyx px-6 pb-24 pt-16 text-ivory sm:px-10 sm:pb-28 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Reveal className="text-center">
          <p className="eyebrow text-gold-soft">{vsl.kicker}</p>
          <p className="mt-4 font-display text-2xl text-ivory/90 sm:text-3xl">
            {vsl.title}
          </p>
        </Reveal>
        <Reveal variant="scale" delayMs={120} className="mt-10">
          <HeroVsl />
        </Reveal>
      </div>
    </section>
  );
}
