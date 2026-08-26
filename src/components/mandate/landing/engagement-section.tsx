import { Reveal } from "@/components/ui/reveal";
import { engagement } from "./copy";

/**
 * Skin in the game — la réponse économique à la vraie peur du propriétaire :
 * « une fois le mandat signé, allez-vous réellement investir sur mon bien ? »
 *
 * Rupture visuelle : noir profond, typographie large, révélation en deux temps
 * (la phrase d'appel, puis l'engagement).
 *
 * Puis les postes engagés apparaissent l'un après l'autre — et **la diffusion
 * ferme la liste avec un poids visuel supérieur**. C'est le poste que le
 * propriétaire ne voit jamais et le seul qui décide si son bien est vu : il doit
 * peser à l'écran ce qu'il pèse dans le budget.
 *
 * Vocabulaire de commercialisation immobilière, jamais d'achat média.
 */
export function EngagementSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-wood-black px-6 py-20 text-ivory sm:px-10 sm:py-28 lg:px-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(55% 50% at 50% 40%, rgba(203,180,136,0.13) 0%, rgba(12,12,14,0) 70%)",
        }}
      />
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <p className="eyebrow text-gold-soft">{engagement.eyebrow}</p>
        </Reveal>

        <Reveal variant="blur" delayMs={80}>
          <h2 className="mt-8 font-display text-2xl leading-tight text-ivory/60 sm:text-3xl md:text-4xl">
            {engagement.title}
          </h2>
        </Reveal>

        <Reveal variant="rise" delayMs={220}>
          <p className="mt-5 font-display text-[2.4rem] leading-[1.06] text-ivory sm:text-5xl md:text-6xl">
            {engagement.reveal}
          </p>
        </Reveal>

        {/* Les postes engagés, l'un après l'autre. */}
        <ul className="mx-auto mt-16 max-w-md">
          {engagement.items.map((item, i) => (
            <Reveal
              as="li"
              key={item}
              delayMs={i * 70}
              className="border-b border-ivory/10 py-3.5 text-[0.95rem] text-ivory/75"
            >
              {item}
            </Reveal>
          ))}

          {/* La diffusion — dernière, et de loin la plus lourde. */}
          <Reveal as="li" variant="rise" delayMs={140} className="pt-10">
            <span className="block font-display text-[2.2rem] leading-none text-gold-soft sm:text-5xl">
              {engagement.climax.label}
            </span>
            <span className="mx-auto mt-4 block max-w-sm text-balance text-sm leading-relaxed text-ivory/70">
              {engagement.climax.text}
            </span>
          </Reveal>
        </ul>

        <Reveal delayMs={120}>
          <p className="mt-16 font-display text-2xl leading-snug text-gold-soft sm:text-3xl">
            {engagement.punch}
          </p>
          <p className="mt-6 text-[0.78rem] leading-relaxed text-ivory/45">
            {engagement.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
