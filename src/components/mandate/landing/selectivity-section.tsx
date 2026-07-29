import Image from "next/image";
import { CtaLink } from "@/components/ui/cta-link";
import { media } from "@/lib/media";
import { landing } from "@/modules/mandates/funnel";

/**
 * Sélectivité + appel à l'action final. Sur fond photographique sombre, sans
 * rareté artificielle ni faux quota.
 */
export function SelectivitySection() {
  const { selectivity } = landing;

  return (
    <section className="relative isolate overflow-hidden px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
      <Image
        src={media.ambiance2.src}
        alt={media.ambiance2.alt}
        fill
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0"
        style={{ backgroundImage: "var(--overlay-immersive)" }}
      />

      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow text-gold-soft">{selectivity.kicker}</p>
        <h2 className="mx-auto mt-6 max-w-2xl text-balance text-3xl leading-[1.15] text-ivory sm:text-4xl md:text-[2.75rem]">
          {selectivity.title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-relaxed text-ivory/85">
          {selectivity.text}
        </p>
        <div className="mt-11 flex flex-col items-center gap-4">
          <CtaLink href="/proprietaire/analyse" variant="gold">
            {selectivity.ctaPrimary}
          </CtaLink>
          <p className="text-xs tracking-wide text-ivory/70">
            {selectivity.ctaMicro}
          </p>
        </div>
      </div>
    </section>
  );
}
