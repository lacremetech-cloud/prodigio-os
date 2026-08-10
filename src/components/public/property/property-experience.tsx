import { Reveal } from "@/components/ui/reveal";
import { Parallax } from "@/components/ui/parallax";
import {
  DEFAULT_SECTION_ORDER,
  publicMediaUrl,
  type PublicMediaNode,
  type PublicPropertyContent,
  type PublicSectionKey,
} from "@/modules/buyers/public/snapshot";

/**
 * Page publique **cinématographique** dédiée à UN seul bien. Rendu éditorial
 * (jamais une fiche d'annonce classique) : aucune grille de biens similaires,
 * aucun moteur de recherche. Toutes les sections sont optionnelles — seules
 * celles réellement renseignées s'affichent (aucun faux texte, aucune donnée
 * inventée). Les animations respectent `prefers-reduced-motion` (voir
 * `Reveal`/`Parallax`). Composant serveur : aucun état, aucun JS superflu.
 */

interface Props {
  content: PublicPropertyContent;
  slug: string;
  supabaseUrl: string | undefined;
  /** Mode prévisualisation privée : bandeau + CTA neutralisé. */
  preview?: boolean;
}

function lines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function hasText(text: string | null | undefined): boolean {
  return typeof text === "string" && text.trim().length > 0;
}

function resolveOrder(content: PublicPropertyContent): PublicSectionKey[] {
  const cfg = content.sections;
  const order = cfg?.order && cfg.order.length > 0 ? cfg.order : DEFAULT_SECTION_ORDER;
  const visible = cfg?.visible ?? {};
  return order.filter((k) => visible[k] !== false);
}

export function PropertyExperience({ content, slug, supabaseUrl, preview = false }: Props) {
  const heroUrl = publicMediaUrl(content.hero, supabaseUrl);
  const heroIsVideo = content.hero?.mime_type?.startsWith("video/") ?? false;
  const name = content.public_name?.trim() || "Propriété d’exception";
  const featureList = lines(content.features);
  const essentialFeatures = featureList.slice(0, 4);
  const ctaLabel = content.cta_label?.trim() || "Manifester mon intérêt";

  const order = resolveOrder(content);
  const gallery = (content.gallery ?? []).filter((m) => m.mime_type?.startsWith("image/"));
  const videos = (content.gallery ?? []).filter((m) => m.mime_type?.startsWith("video/"));

  const sectionAvailable: Record<PublicSectionKey, boolean> = {
    apercu: hasText(content.intro),
    histoire: hasText(content.story),
    experience: hasText(content.experience),
    architecture: hasText(content.architecture),
    caracteristiques: featureList.length > 0,
    galerie: gallery.length > 0,
    video: videos.length > 0,
    environnement: hasText(content.environment),
    details: lines(content.emotional_details).length > 0,
  };
  const visibleSections = order.filter((k) => sectionAvailable[k]);

  let sectionIndex = 0;
  const nextTone = (): "light" | "dark" => (sectionIndex++ % 2 === 0 ? "light" : "dark");

  return (
    <main className="bg-ivory text-wood-black">
      {preview ? (
        <div className="sticky top-0 z-50 bg-wood-black px-4 py-2 text-center text-xs font-medium text-ivory">
          Prévisualisation privée — non publiée, non indexée.
        </div>
      ) : null}

      {/* HERO ------------------------------------------------------------- */}
      <section className="grain relative isolate flex min-h-dvh flex-col justify-end overflow-hidden bg-onyx text-ivory">
        {heroUrl ? (
          heroIsVideo ? (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden
              poster={publicMediaUrl(content.main_media, supabaseUrl) ?? undefined}
            >
              <source src={heroUrl} type={content.hero?.mime_type ?? "video/mp4"} />
            </video>
          ) : (
            <Parallax speed={0.12} className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroUrl}
                alt={content.hero?.alt ?? ""}
                className="h-full w-full scale-110 object-cover"
                aria-hidden={content.hero?.alt ? undefined : true}
              />
            </Parallax>
          )
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, #17181c, #0c0c0e)" }}
          />
        )}
        <div aria-hidden className="absolute inset-0" style={{ background: "var(--overlay-hero)" }} />

        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16 pt-24 sm:pb-24">
          {content.location ? (
            <p className="eyebrow text-gold-soft">{content.location}</p>
          ) : null}
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-medium leading-[1.05] sm:text-6xl">
            {name}
          </h1>
          {content.tagline ? (
            <p className="mt-4 max-w-2xl text-pretty text-lg text-text-on-dark-muted sm:text-xl">
              {content.tagline}
            </p>
          ) : null}

          {essentialFeatures.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-on-dark-muted">
              {essentialFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden className="text-gold-soft">
                    —
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-9">
            {preview ? (
              <span className="inline-flex items-center rounded-full bg-ivory/10 px-7 py-4 text-sm font-medium text-ivory">
                {ctaLabel} (désactivé en prévisualisation)
              </span>
            ) : (
              <a
                href={`/bien/${slug}/interet`}
                className="cta-shine inline-flex items-center gap-2 rounded-full bg-ivory px-8 py-4 text-sm font-semibold text-wood-black transition hover:-translate-y-0.5"
              >
                {ctaLabel}
                <span aria-hidden>→</span>
              </a>
            )}
          </div>
        </div>
        <span
          aria-hidden
          className="animate-scroll-cue absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-ivory/60"
        >
          ↓
        </span>
      </section>

      {content.pillars && lines(content.pillars).length > 0 ? (
        <PillarsBand pillars={lines(content.pillars)} />
      ) : null}

      {/* SECTIONS ÉDITORIALES --------------------------------------------- */}
      {visibleSections.map((key) => {
        switch (key) {
          case "apercu":
            return (
              <Editorial key={key} tone={nextTone()} kicker="Le bien en quelques mots" title={name} body={content.intro} />
            );
          case "histoire":
            return <Editorial key={key} tone={nextTone()} kicker="L’histoire" title="Un lieu, un récit" body={content.story} />;
          case "experience":
            return (
              <Editorial key={key} tone={nextTone()} kicker="L’expérience de vie" title="Habiter autrement" body={content.experience} />
            );
          case "architecture":
            return (
              <Editorial key={key} tone={nextTone()} kicker="Architecture & caractère" title="Le geste architectural" body={content.architecture} />
            );
          case "caracteristiques":
            return <FeaturesSection key={key} tone={nextTone()} features={featureList} />;
          case "galerie":
            return <Gallery key={key} tone={nextTone()} media={gallery} supabaseUrl={supabaseUrl} />;
          case "video":
            return <VideoSection key={key} tone={nextTone()} media={videos} supabaseUrl={supabaseUrl} />;
          case "environnement":
            return (
              <Editorial key={key} tone={nextTone()} kicker="Environnement & art de vivre" title="Autour du bien" body={content.environment} />
            );
          case "details":
            return <DetailsSection key={key} tone={nextTone()} details={lines(content.emotional_details)} />;
          default:
            return null;
        }
      })}

      {/* CTA FINAL -------------------------------------------------------- */}
      <section className="grain relative isolate overflow-hidden bg-onyx px-6 py-24 text-center text-ivory">
        <div aria-hidden className="absolute inset-0" style={{ background: "var(--overlay-immersive)" }} />
        <Reveal className="relative z-10 mx-auto max-w-2xl" variant="up">
          <p className="eyebrow text-gold-soft">Une propriété, une rencontre</p>
          <h2 className="mt-3 text-3xl font-medium sm:text-4xl">Vous vous reconnaissez dans ce lieu ?</h2>
          <p className="mt-4 text-text-on-dark-muted">
            Partagez-nous votre projet en quelques instants. Un conseiller dédié reviendra vers vous.
          </p>
          <div className="mt-8">
            {preview ? (
              <span className="inline-flex items-center rounded-full bg-ivory/10 px-7 py-4 text-sm font-medium text-ivory">
                {ctaLabel} (désactivé en prévisualisation)
              </span>
            ) : (
              <a
                href={`/bien/${slug}/interet`}
                className="cta-shine inline-flex items-center gap-2 rounded-full bg-ivory px-8 py-4 text-sm font-semibold text-wood-black transition hover:-translate-y-0.5"
              >
                {ctaLabel}
                <span aria-hidden>→</span>
              </a>
            )}
          </div>
          {content.show_price && content.price_label ? (
            <p className="mt-6 text-sm text-text-on-dark-muted">{content.price_label}</p>
          ) : null}
        </Reveal>
      </section>

      <footer className="bg-wood-black px-6 py-10 text-center text-xs text-ivory/50">
        <p>Propriété présentée par Prodigio — mise en marché confidentielle.</p>
      </footer>
    </main>
  );
}

function PillarsBand({ pillars }: { pillars: string[] }) {
  return (
    <section className="bg-ivory-muted px-6 py-16">
      <ul className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.slice(0, 6).map((p, i) => (
          <Reveal as="li" key={i} variant="up" delayMs={i * 70} className="flex flex-col gap-2">
            <span className="font-signature text-2xl italic text-gold">{String(i + 1).padStart(2, "0")}</span>
            <p className="text-pretty text-base text-wood-black">{p}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function Editorial({
  tone,
  kicker,
  title,
  body,
}: {
  tone: "light" | "dark";
  kicker: string;
  title: string;
  body: string | null | undefined;
}) {
  const paragraphs = lines(body);
  if (paragraphs.length === 0) return null;
  const dark = tone === "dark";
  return (
    <section className={`px-6 py-20 sm:py-28 ${dark ? "bg-onyx text-ivory" : "bg-ivory text-wood-black"}`}>
      <div className="mx-auto max-w-3xl">
        <Reveal variant="up">
          <p className={`eyebrow ${dark ? "text-gold-soft" : "text-text-secondary"}`}>{kicker}</p>
          <h2 className="mt-3 text-3xl font-medium sm:text-4xl">{title}</h2>
        </Reveal>
        <div className="mt-6 flex flex-col gap-4">
          {paragraphs.map((p, i) => (
            <Reveal key={i} variant="up" delayMs={60 + i * 40}>
              <p className={`text-pretty text-lg leading-relaxed ${dark ? "text-text-on-dark-muted" : "text-text-secondary"}`}>
                {p}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ tone, features }: { tone: "light" | "dark"; features: string[] }) {
  const dark = tone === "dark";
  return (
    <section className={`px-6 py-20 sm:py-28 ${dark ? "bg-onyx text-ivory" : "bg-ivory text-wood-black"}`}>
      <div className="mx-auto max-w-4xl">
        <Reveal variant="up">
          <p className={`eyebrow ${dark ? "text-gold-soft" : "text-text-secondary"}`}>Caractéristiques essentielles</p>
          <h2 className="mt-3 text-3xl font-medium sm:text-4xl">Ce qui définit le lieu</h2>
        </Reveal>
        <ul className="mt-8 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
          {features.map((f, i) => (
            <Reveal as="li" key={i} variant="up" delayMs={i * 40} className={`flex items-start gap-3 border-b pb-4 ${dark ? "border-border-dark" : "border-border"}`}>
              <span aria-hidden className="mt-1 text-gold">◆</span>
              <span className={`text-pretty ${dark ? "text-text-on-dark-muted" : "text-text-secondary"}`}>{f}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DetailsSection({ tone, details }: { tone: "light" | "dark"; details: string[] }) {
  const dark = tone === "dark";
  return (
    <section className={`px-6 py-20 sm:py-28 ${dark ? "bg-onyx text-ivory" : "bg-ivory-muted text-wood-black"}`}>
      <div className="mx-auto max-w-3xl">
        <Reveal variant="up">
          <p className={`eyebrow ${dark ? "text-gold-soft" : "text-text-secondary"}`}>Le coup de cœur</p>
          <h2 className="mt-3 text-3xl font-medium sm:text-4xl">Les détails qui font tout</h2>
        </Reveal>
        <ul className="mt-8 flex flex-col gap-5">
          {details.map((d, i) => (
            <Reveal as="li" key={i} variant="up" delayMs={i * 50} className="flex items-start gap-4">
              <span className="font-signature text-xl italic text-gold">{String(i + 1).padStart(2, "0")}</span>
              <span className={`text-pretty text-lg ${dark ? "text-text-on-dark-muted" : "text-text-secondary"}`}>{d}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Gallery({
  tone,
  media,
  supabaseUrl,
}: {
  tone: "light" | "dark";
  media: PublicMediaNode[];
  supabaseUrl: string | undefined;
}) {
  const dark = tone === "dark";
  return (
    <section className={`px-6 py-20 sm:py-28 ${dark ? "bg-onyx text-ivory" : "bg-ivory text-wood-black"}`}>
      <div className="mx-auto max-w-6xl">
        <Reveal variant="up">
          <p className={`eyebrow ${dark ? "text-gold-soft" : "text-text-secondary"}`}>Galerie immersive</p>
          <h2 className="mt-3 text-3xl font-medium sm:text-4xl">Regarder de plus près</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((m, i) => {
            const url = publicMediaUrl(m, supabaseUrl);
            if (!url) return null;
            // Rythme éditorial : la 1re image occupe deux colonnes sur grand écran.
            const wide = i % 5 === 0;
            return (
              <Reveal
                key={m.id}
                variant="scale"
                delayMs={(i % 3) * 60}
                className={`overflow-hidden rounded-lg ${wide ? "sm:col-span-2" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={m.alt ?? ""}
                  loading="lazy"
                  className="h-full max-h-[32rem] w-full object-cover transition duration-700 hover:scale-[1.03]"
                />
                {m.caption ? (
                  <p className={`mt-2 text-xs ${dark ? "text-text-on-dark-muted" : "text-text-secondary"}`}>{m.caption}</p>
                ) : null}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function VideoSection({
  tone,
  media,
  supabaseUrl,
}: {
  tone: "light" | "dark";
  media: PublicMediaNode[];
  supabaseUrl: string | undefined;
}) {
  const first = media[0];
  const url = publicMediaUrl(first, supabaseUrl);
  if (!url) return null;
  const dark = tone === "dark";
  return (
    <section className={`px-6 py-20 sm:py-28 ${dark ? "bg-onyx text-ivory" : "bg-ivory text-wood-black"}`}>
      <div className="mx-auto max-w-5xl">
        <Reveal variant="up">
          <p className={`eyebrow ${dark ? "text-gold-soft" : "text-text-secondary"}`}>Vidéo du bien</p>
          <h2 className="mt-3 text-3xl font-medium sm:text-4xl">En mouvement</h2>
        </Reveal>
        <Reveal variant="up" delayMs={80} className="mt-8 overflow-hidden rounded-lg">
          <video className="h-full w-full" controls playsInline preload="none">
            <source src={url} type={first?.mime_type ?? "video/mp4"} />
          </video>
        </Reveal>
      </div>
    </section>
  );
}
