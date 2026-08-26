import { Reveal } from "@/components/ui/reveal";
import { engagement } from "./copy";

/**
 * Skin in the game — la réponse économique à la vraie peur du propriétaire :
 * « une fois le mandat signé, allez-vous réellement investir sur mon bien ? »
 *
 * Rupture visuelle : noir profond, typographie large, révélation en deux temps
 * (la phrase d'appel, puis l'engagement) au passage dans le viewport.
 */
export function EngagementSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-wood-black px-6 py-28 text-ivory sm:px-10 sm:py-36 lg:px-16">
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

        <Reveal variant="rise" delayMs={280}>
          <p className="mt-5 font-display text-[2.4rem] leading-[1.06] text-ivory sm:text-5xl md:text-6xl">
            {engagement.reveal}
          </p>
        </Reveal>

        <Reveal delayMs={420}>
          <ul className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {engagement.items.map((item) => (
              <li
                key={item}
                className="font-signature text-xs uppercase tracking-[0.24em] text-gold-soft"
              >
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delayMs={480}>
          <p className="mx-auto mt-12 max-w-xl text-pretty leading-relaxed text-text-on-dark-muted">
            {engagement.body}
          </p>
          <p className="mt-8 font-display text-2xl leading-snug text-gold-soft sm:text-3xl">
            {engagement.punch}
          </p>
          <p className="mt-8 text-[0.78rem] leading-relaxed text-ivory/45">
            {engagement.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
