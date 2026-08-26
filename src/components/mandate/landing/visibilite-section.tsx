import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { visibilite } from "./copy";

/**
 * Visibilité ≠ Acquisition — l'un des moments forts de la page.
 *
 * Deux logiques opposées, montrées plutôt qu'expliquées :
 *  - la publication organique : un pic d'attention puis une décroissance ;
 *  - la campagne Prodigio : une boucle qui revient sur elle-même et apprend.
 *
 * Les deux schémas sont dessinés en SVG (aucune dépendance, aucun reflow) et se
 * tracent à la révélation. La différence doit se comprendre sans lire.
 */

/** Courbe organique : montée brutale, pic, décroissance longue. */
function CourbeOrganique() {
  return (
    <svg
      viewBox="0 0 320 120"
      className="h-auto w-full"
      role="img"
      aria-label="Une publication organique : un pic d'attention, puis une portée qui décroît."
    >
      <line x1="0" y1="110" x2="320" y2="110" stroke="currentColor" strokeOpacity="0.2" />
      <path
        className="pg-draw"
        d="M0 108 C 30 106, 48 100, 62 62 C 70 40, 76 18, 86 18 C 98 18, 104 44, 116 66 C 134 96, 170 104, 220 107 C 260 109, 292 110, 320 110"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Campagne Prodigio : quatre vagues successives, chacune plus haute que la
 * précédente.
 *
 * Le schéma est volontairement tracé sur la MÊME ligne de base et au même
 * format que la courbe organique : la comparaison se fait d'un seul regard. Un
 * pic qui retombe, contre des vagues qui recommencent en montant.
 */
function VaguesProdigio() {
  return (
    <svg
      viewBox="0 0 320 120"
      className="h-auto w-full"
      role="img"
      aria-label="Une campagne Prodigio : chaque diffusion est mesurée puis optimisée, et la vague suivante porte plus haut que la précédente."
    >
      <line x1="0" y1="110" x2="320" y2="110" stroke="currentColor" strokeOpacity="0.2" />
      <path
        className="pg-draw"
        d="M0 108 C 18 108, 28 92, 44 92 C 60 92, 70 108, 86 108
           C 100 108, 110 76, 126 76 C 142 76, 152 108, 166 108
           C 180 108, 190 54, 206 54 C 222 54, 232 108, 246 108
           C 258 108, 268 24, 284 24 C 300 24, 310 108, 320 108"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Etapes({ steps, tone }: { steps: readonly string[]; tone: "muted" | "accent" }) {
  const color = tone === "accent" ? "text-ivory" : "text-text-on-dark-muted";
  const mark = tone === "accent" ? "bg-gold-soft" : "bg-text-on-dark-muted/50";
  return (
    <ol className={`mt-8 space-y-3 ${color}`}>
      {steps.map((step, i) => (
        <li key={step} className="flex items-baseline gap-3 text-[0.95rem] leading-relaxed">
          <span aria-hidden="true" className={`mt-2 h-px w-4 shrink-0 ${mark}`} />
          <span>{step}</span>
          {i === steps.length - 1 && tone === "accent" ? (
            <span aria-hidden="true" className="font-signature text-[0.7rem] tracking-[0.2em] text-gold-soft">
              ↻
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function VisibiliteSection() {
  return (
    <section className="bg-onyx px-5 py-24 text-ivory sm:px-10 sm:py-32 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <Reveal>
          <SectionLabel tone="dark">{visibilite.eyebrow}</SectionLabel>
        </Reveal>
        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12">
          <Reveal variant="rise" delayMs={70} className="lg:col-span-7">
            <h2 className="text-balance text-[1.95rem] leading-[1.1] text-ivory sm:text-4xl lg:text-[3.4rem]">
              {visibilite.title}
            </h2>
          </Reveal>
          <Reveal delayMs={140} className="lg:col-span-4 lg:col-start-9 lg:pt-3">
            <p className="text-pretty leading-relaxed text-text-on-dark-muted">
              {visibilite.body}
            </p>
            <p className="mt-5 text-pretty leading-relaxed text-text-on-dark-muted">
              {visibilite.body2}
            </p>
          </Reveal>
        </div>

        {/* Les deux logiques, côte à côte. */}
        <div className="mt-20 grid gap-14 md:grid-cols-2 md:gap-12">
          <Reveal variant="blur">
            <p className="font-signature text-[0.72rem] uppercase tracking-[0.24em] text-text-on-dark-muted">
              {visibilite.organique.label}
            </p>
            <div className="mt-8 text-text-on-dark-muted">
              <CourbeOrganique />
            </div>
            <Etapes steps={visibilite.organique.steps} tone="muted" />
          </Reveal>

          <Reveal variant="blur" delayMs={160} className="md:border-l md:border-border-dark md:pl-12">
            <p className="font-signature text-[0.72rem] uppercase tracking-[0.24em] text-gold-soft">
              {visibilite.campagne.label}
            </p>
            <div className="mt-8 text-gold-soft">
              <VaguesProdigio />
            </div>
            <Etapes steps={visibilite.campagne.steps} tone="accent" />
          </Reveal>
        </div>

        {/* La phrase qui résume les deux schémas. */}
        <Reveal variant="rise" delayMs={80} className="mt-20 border-t border-border-dark pt-12 sm:mt-24">
          <p className="font-display text-[1.7rem] leading-[1.15] text-text-on-dark-muted sm:text-3xl lg:text-[2.6rem]">
            {visibilite.statementA}
          </p>
          <p className="mt-2 font-display text-[1.7rem] leading-[1.15] text-ivory sm:text-3xl lg:text-[2.6rem]">
            {visibilite.statementB}
          </p>
          <p className="mt-10 max-w-2xl text-pretty leading-relaxed text-text-on-dark-muted">
            {visibilite.closing}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
