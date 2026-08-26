import { Reveal } from "@/components/ui/reveal";
import { SHOWCASE } from "@/config/showcase";
import { SectionMarker } from "./section-marker";
import { vitrine } from "./copy";

interface LivePreviewProps {
  src: string;
  label: string;
  hint: string;
  openLabel: string;
  title: string;
}

/**
 * Aperçu **vivant** d'un écrin : la page réelle est intégrée, pas capturée.
 * Le visiteur peut la parcourir sur place, ou l'ouvrir en grand.
 *
 * L'iframe est chargée paresseusement (`loading="lazy"`) : elle ne coûte rien
 * tant que la section n'est pas atteinte.
 */
function LivePreview({ src, label, hint, openLabel, title }: LivePreviewProps) {
  return (
    <figure className="flex flex-col overflow-hidden border border-border bg-surface shadow-[var(--shadow-md)]">
      {/* Barre d'écrin, façon fenêtre de navigateur — situe l'aperçu. */}
      <div className="flex items-center gap-2 border-b border-border bg-ivory-muted px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2 rounded-full bg-border-strong/50" />
          <span className="size-2 rounded-full bg-border-strong/50" />
          <span className="size-2 rounded-full bg-border-strong/50" />
        </span>
        <span className="ml-1 truncate font-signature text-[0.62rem] uppercase tracking-[0.2em] text-text-secondary">
          {label}
        </span>
      </div>

      {/* L'écrin est rendu dans une fenêtre deux fois plus large que le cadre,
          puis réduit de moitié : on voit la vraie mise en page **bureau**, pas
          la version mobile — et l'aperçu reste interactif (défilement, pages de
          la brochure). */}
      <div className="relative h-[26rem] w-full overflow-hidden bg-ivory sm:h-[32rem]">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50 border-0"
        />
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-sm text-text-secondary">{hint}</span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-2 font-medium text-[color:var(--color-gold)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
        >
          {openLabel}
          <span
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </a>
      </figcaption>
    </figure>
  );
}

/**
 * Section vitrine — l'écrin d'un bien réel, ouvert en direct dans la page.
 *
 * C'est la preuve la plus difficile à contester : le site dédié et la brochure
 * confidentielle ne sont pas décrits ni mis en scène, ils sont là, parcourables.
 */
export function VitrineSection() {
  return (
    <section className="bg-ivory-muted px-6 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMarker index={vitrine.index} label={vitrine.kicker} />
        </Reveal>
        <Reveal variant="rise" delayMs={80}>
          <h2 className="mt-7 max-w-2xl text-balance text-3xl leading-[1.12] sm:text-4xl lg:text-[2.75rem]">
            {vitrine.title}
          </h2>
        </Reveal>
        <Reveal delayMs={180}>
          <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-text-secondary">
            {vitrine.body}
          </p>
          <p className="mt-3 font-signature text-xs uppercase tracking-[0.24em] text-[color:var(--color-gold)]">
            {SHOWCASE.name} · {SHOWCASE.place}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <Reveal variant="rise">
            <LivePreview
              src={SHOWCASE.siteUrl}
              label={vitrine.site.label}
              hint={vitrine.site.hint}
              openLabel={vitrine.site.open}
              title={`Site dédié — ${SHOWCASE.name}`}
            />
          </Reveal>
          <Reveal variant="rise" delayMs={120}>
            <LivePreview
              src={SHOWCASE.brochureUrl}
              label={vitrine.brochure.label}
              hint={vitrine.brochure.hint}
              openLabel={vitrine.brochure.open}
              title={`Brochure confidentielle — ${SHOWCASE.name}`}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
