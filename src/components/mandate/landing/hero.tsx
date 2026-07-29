import Image from "next/image";
import { CtaLink } from "@/components/ui/cta-link";
import { media } from "@/lib/media";
import { landing } from "@/modules/mandates/funnel";

/**
 * Hero immersif : photographie plein cadre, signature Prodigio, promesse et
 * appel à l'action vers l'analyse d'éligibilité.
 */
export function Hero() {
  return (
    <section className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      {/* Photographie de fond */}
      <Image
        src={media.hero.src}
        alt={media.hero.alt}
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      {/* Voile global (lisibilité de la signature en haut) */}
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0"
        style={{ backgroundImage: "var(--overlay-hero)" }}
      />
      {/* Socle sombre dédié sous le bloc de texte : garantit un contraste AA du
          titre ET du paragraphe quelle que soit la photographie (pas seulement
          une ombre portée). */}
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-x-0 bottom-0 h-[68%]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(12,12,14,0) 0%, rgba(12,12,14,0.55) 45%, rgba(12,12,14,0.9) 100%)",
        }}
      />

      {/* Signature (en-tête) */}
      <header className="flex items-center justify-between px-6 pt-8 sm:px-10 lg:px-16">
        <p className="font-signature text-sm tracking-[0.28em] text-ivory">
          PRODIGIO
        </p>
        <p className="hidden font-signature text-[0.72rem] font-semibold tracking-[0.28em] text-ivory/90 sm:block">
          IMMOBILIER D&apos;EXCEPTION
        </p>
      </header>

      {/* Contenu principal, ancré en bas */}
      <div className="mt-auto px-6 pb-16 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
        <div className="max-w-3xl animate-fade-up">
          <h1 className="text-balance text-4xl leading-[1.08] text-ivory sm:text-5xl md:text-6xl lg:text-[4.25rem]">
            {landing.hero.title}
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-ivory/90 sm:text-lg">
            {landing.hero.text}
          </p>
          <div className="mt-10 flex flex-col items-start gap-4">
            <CtaLink href="/proprietaire/analyse" variant="contrast">
              {landing.hero.ctaPrimary}
            </CtaLink>
            <p className="text-sm text-ivory/85">{landing.hero.ctaMicro}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
