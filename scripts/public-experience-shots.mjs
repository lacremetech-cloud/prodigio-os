// Génère des captures réelles de l'Expérience publique du bien & du Funnel
// Acquéreur, à partir des VRAIS tokens de design (globals.css + crm.css). Rendu
// hors ligne avec des DONNÉES FICTIVES uniquement (bien fictif « Villa Aurelia »,
// personnes fictives) — n'accède à AUCUNE donnée réelle et ne fait pas partie du
// bundle applicatif. Sert de preuve visuelle pour la PR.
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const globals = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const crmCss = readFileSync(path.join(root, "src/app/crm/crm.css"), "utf8");
const outDir = path.join(root, "docs/assets/public-experience");
mkdirSync(outDir, { recursive: true });

// --- Images fictives embarquées (base64) -------------------------------------
const img = (rel) => {
  const p = path.join(root, "public/images", rel);
  const b64 = readFileSync(p).toString("base64");
  return `data:image/webp;base64,${b64}`;
};
const HERO = img("mandate/hero.webp");
const G1 = img("mandate/cat-villa.webp");
const G2 = img("mandate/ambiance-1.webp");
const G3 = img("mandate/cat-domaine.webp");
const G4 = img("mandate/ambiance-2.webp");
const G5 = img("mandate/cat-chalet.webp");

// Isole uniquement le bloc :root (tokens) + keyframes du design public : les
// utilitaires Tailwind ne sont pas générés hors build, on style donc en inline
// avec les variables --color-*.
const publicTokens = globals;

const serif = `Georgia, "Times New Roman", serif`;
const sans = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

// ---------------------------------------------------------------- Page publique
const heroSection = (mobile) => `
<section style="position:relative;min-height:${mobile ? "620px" : "760px"};display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;background:var(--color-onyx);color:var(--color-text-on-dark)">
  <img src="${HERO}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.1)"/>
  <div style="position:absolute;inset:0;background:var(--overlay-hero)"></div>
  <div style="position:relative;z-index:2;max-width:960px;margin:0 auto;width:100%;padding:${mobile ? "80px 24px 56px" : "96px 40px 88px"}">
    <p style="text-transform:uppercase;letter-spacing:.22em;font-size:12px;font-weight:600;color:var(--color-gold-soft);font-family:${sans}">Presqu’île de Saint-Tropez</p>
    <h1 style="font-family:${serif};font-weight:500;line-height:1.05;font-size:${mobile ? "38px" : "60px"};margin:12px 0 0;max-width:640px">Villa Aurelia</h1>
    <p style="font-size:${mobile ? "17px" : "20px"};color:var(--color-text-on-dark-muted);margin:16px 0 0;max-width:560px">Une ode à la lumière méditerranéenne, suspendue au-dessus de la baie.</p>
    <ul style="list-style:none;padding:0;margin:24px 0 0;display:flex;flex-wrap:wrap;gap:8px 24px;font-size:14px;color:var(--color-text-on-dark-muted)">
      <li>— 420 m² habitables</li><li>— 5 chambres</li><li>— Piscine à débordement</li><li>— Vue mer panoramique</li>
    </ul>
    <div style="margin-top:36px">
      <span style="display:inline-flex;align-items:center;gap:8px;background:var(--color-ivory);color:var(--color-wood-black);border-radius:9999px;padding:16px 32px;font-size:14px;font-weight:600;font-family:${sans}">Manifester mon intérêt →</span>
    </div>
  </div>
</section>`;

const pillars = `
<section style="background:var(--color-ivory-muted);padding:64px 24px">
  <ul style="list-style:none;max-width:960px;margin:0 auto;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:32px">
    ${[
      ["01", "Une architecture signée, pensée pour la lumière du couchant."],
      ["02", "Un jardin méditerranéen en restanques, oliviers centenaires."],
      ["03", "Un accès privatif à la crique, à quelques pas du salon."],
    ]
      .map(
        ([n, t]) =>
          `<li><span style="font-family:${sans};font-style:italic;font-size:26px;color:var(--color-gold)">${n}</span><p style="font-size:16px;color:var(--color-wood-black);margin:8px 0 0">${t}</p></li>`,
      )
      .join("")}
  </ul>
</section>`;

const editorial = (tone, kicker, title, body) => {
  const dark = tone === "dark";
  return `<section style="padding:80px 24px;background:${dark ? "var(--color-onyx)" : "var(--color-ivory)"};color:${dark ? "var(--color-text-on-dark)" : "var(--color-wood-black)"}">
    <div style="max-width:720px;margin:0 auto">
      <p style="text-transform:uppercase;letter-spacing:.22em;font-size:12px;font-weight:600;font-family:${sans};color:${dark ? "var(--color-gold-soft)" : "var(--color-text-secondary)"}">${kicker}</p>
      <h2 style="font-family:${serif};font-weight:500;font-size:34px;margin:12px 0 0">${title}</h2>
      <p style="font-size:18px;line-height:1.7;margin:24px 0 0;color:${dark ? "var(--color-text-on-dark-muted)" : "var(--color-text-secondary)"}">${body}</p>
    </div>
  </section>`;
};

const gallery = `
<section style="padding:80px 24px;background:var(--color-ivory)">
  <div style="max-width:1100px;margin:0 auto">
    <p style="text-transform:uppercase;letter-spacing:.22em;font-size:12px;font-weight:600;font-family:${sans};color:var(--color-text-secondary)">Galerie immersive</p>
    <h2 style="font-family:${serif};font-weight:500;font-size:34px;margin:12px 0 24px">Regarder de plus près</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <img src="${G1}" alt="" style="grid-column:span 2;width:100%;height:340px;object-fit:cover;border-radius:8px"/>
      <img src="${G2}" alt="" style="width:100%;height:340px;object-fit:cover;border-radius:8px"/>
      <img src="${G3}" alt="" style="width:100%;height:300px;object-fit:cover;border-radius:8px"/>
      <img src="${G4}" alt="" style="width:100%;height:300px;object-fit:cover;border-radius:8px"/>
      <img src="${G5}" alt="" style="width:100%;height:300px;object-fit:cover;border-radius:8px"/>
    </div>
  </div>
</section>`;

const finalCta = `
<section style="position:relative;padding:96px 24px;text-align:center;background:var(--color-onyx);color:var(--color-text-on-dark);overflow:hidden">
  <div style="position:absolute;inset:0;background:var(--overlay-immersive)"></div>
  <div style="position:relative;z-index:2;max-width:640px;margin:0 auto">
    <p style="text-transform:uppercase;letter-spacing:.22em;font-size:12px;font-weight:600;font-family:${sans};color:var(--color-gold-soft)">Une propriété, une rencontre</p>
    <h2 style="font-family:${serif};font-weight:500;font-size:36px;margin:12px 0 0">Vous vous reconnaissez dans ce lieu ?</h2>
    <p style="color:var(--color-text-on-dark-muted);margin:16px 0 0">Partagez-nous votre projet en quelques instants.</p>
    <div style="margin-top:32px"><span style="display:inline-flex;gap:8px;background:var(--color-ivory);color:var(--color-wood-black);border-radius:9999px;padding:16px 32px;font-size:14px;font-weight:600;font-family:${sans}">Manifester mon intérêt →</span></div>
  </div>
</section>`;

const publicPage = (mobile) => `
${heroSection(mobile)}
${pillars}
${editorial("light", "Le bien en quelques mots", "Villa Aurelia", "Posée sur les hauteurs, la Villa Aurelia dialogue avec la mer du lever au coucher du soleil. Ses volumes généreux et ses baies toute hauteur effacent la frontière entre intérieur et paysage.")}
${editorial("dark", "L’histoire", "Un lieu, un récit", "Conçue par un architecte de renom au tournant des années 2000, la villa a été entièrement repensée pour magnifier la lumière et l’horizon marin.")}
${gallery}
${editorial("light", "Environnement & art de vivre", "Autour du bien", "À dix minutes des plages et des tables étoilées, dans un écrin de pins parasols et d’oliviers, à l’abri des regards.")}
${finalCta}
<footer style="background:var(--color-wood-black);color:rgba(255,255,255,.5);text-align:center;padding:40px 24px;font-size:12px;font-family:${sans}">Propriété présentée par Prodigio — mise en marché confidentielle.</footer>`;

const heroOnly = (video) => `
<section style="position:relative;min-height:720px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;background:var(--color-onyx);color:var(--color-text-on-dark)">
  <img src="${HERO}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.05)"/>
  <div style="position:absolute;inset:0;background:var(--overlay-hero)"></div>
  ${
    video
      ? `<div style="position:absolute;top:20px;right:24px;z-index:3;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.25);border-radius:9999px;padding:8px 14px;font-size:12px;font-family:${sans};color:var(--color-text-on-dark)"><span>▣</span> Vidéo muette · lecture auto</div>
         <div style="position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center"><span style="width:76px;height:76px;border-radius:9999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff">▶</span></div>`
      : ""
  }
  <div style="position:relative;z-index:2;max-width:960px;margin:0 auto;width:100%;padding:96px 40px 88px">
    <p style="text-transform:uppercase;letter-spacing:.22em;font-size:12px;font-weight:600;color:var(--color-gold-soft);font-family:${sans}">Presqu’île de Saint-Tropez</p>
    <h1 style="font-family:${serif};font-weight:500;line-height:1.05;font-size:60px;margin:12px 0 0">Villa Aurelia</h1>
    <p style="font-size:20px;color:var(--color-text-on-dark-muted);margin:16px 0 0">Une ode à la lumière méditerranéenne.</p>
  </div>
</section>`;

// ------------------------------------------------------------------- Funnel
const funnelStep = (mobile) => `
<main style="position:relative;min-height:${mobile ? "760px" : "760px"};background:var(--color-onyx);color:var(--color-text-on-dark);font-family:${sans}">
  <div style="position:absolute;inset:0;background:var(--overlay-immersive)"></div>
  <div style="position:relative;z-index:2;max-width:640px;margin:0 auto;padding:40px 24px;display:flex;flex-direction:column;min-height:${mobile ? "760px" : "760px"}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div><p style="text-transform:uppercase;letter-spacing:.22em;font-size:12px;font-weight:600;color:var(--color-gold-soft)">Manifester mon intérêt</p><p style="font-size:14px;color:var(--color-text-on-dark-muted);margin:2px 0 0">Villa Aurelia</p></div>
      <span style="font-size:12px;color:var(--color-text-on-dark-muted)">Retour au bien</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:24px"><div style="flex:1;height:1px;background:rgba(255,255,255,.15)"><div style="width:29%;height:1px;background:var(--color-gold-soft)"></div></div><span style="font-size:11px;color:var(--color-text-on-dark-muted)">2 / 7</span></div>
    <div style="margin-top:32px;flex:1">
      <h2 style="font-family:${serif};font-weight:500;font-size:30px;margin:0">Quel budget envisagez-vous ?</h2>
      <p style="font-size:14px;color:var(--color-text-on-dark-muted);margin:8px 0 0">Une fourchette suffit — elle nous aide à vous orienter.</p>
      <div style="display:grid;grid-template-columns:${mobile ? "1fr" : "1fr 1fr"};gap:8px;margin-top:20px">
        ${[
          ["Moins de 800 000 €", false],
          ["800 000 € – 1,2 M€", false],
          ["1,2 M€ – 2 M€", false],
          ["2 M€ – 3 M€", true],
          ["Plus de 3 M€", false],
          ["À définir ensemble", false],
        ]
          .map(
            ([l, sel]) =>
              `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid ${sel ? "var(--color-gold-soft)" : "var(--color-border-dark)"};background:${sel ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.03)"};color:${sel ? "var(--color-text-on-dark)" : "var(--color-text-on-dark-muted)"};border-radius:8px;padding:14px 16px;font-size:14px">${l}<span style="color:var(--color-gold-soft);opacity:${sel ? 1 : 0}">✓</span></div>`,
          )
          .join("")}
      </div>
    </div>
    <div style="margin-top:32px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:14px;color:var(--color-text-on-dark-muted)">Retour</span>
      <span style="display:inline-flex;gap:8px;background:var(--color-ivory);color:var(--color-wood-black);border-radius:9999px;padding:14px 32px;font-size:14px;font-weight:600">Continuer →</span>
    </div>
    <p style="text-align:center;font-size:11px;color:rgba(255,255,255,.45);margin-top:12px">Formulaire protégé contre les soumissions automatisées.</p>
  </div>
</main>`;

const confirmation = `
<main style="position:relative;min-height:720px;background:var(--color-onyx);color:var(--color-text-on-dark);font-family:${sans};display:flex;align-items:center;justify-content:center;text-align:center">
  <div style="position:absolute;inset:0;background:var(--overlay-immersive)"></div>
  <div style="position:relative;z-index:2;max-width:480px;padding:24px">
    <span style="font-size:44px;color:var(--color-gold-soft)">✓</span>
    <h2 style="font-family:${serif};font-weight:500;font-size:32px;margin:20px 0 0">Votre intérêt a bien été transmis</h2>
    <p style="color:var(--color-text-on-dark-muted);margin:16px 0 0">Un conseiller dédié à cette propriété reviendra vers vous pour échanger sur votre projet et, le cas échéant, organiser la suite.</p>
    <p style="font-size:11px;color:rgba(255,255,255,.5);margin-top:24px">Chaque demande est étudiée avec attention et confidentialité.</p>
  </div>
</main>`;

// -------------------------------------------------------- CRM (config + intérêts)
const crmConfig = `
<div style="max-width:820px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:18px">
  <div><p class="crm-eyebrow">Cockpit de production · Villa Aurelia</p><h1 style="font-size:22px;font-weight:600;margin-top:4px;color:var(--crm-text)">Expérience publique</h1></div>
  <section class="crm-panel" style="padding:20px">
    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--crm-text-dim);margin:0 0 14px">Configuration publique</h2>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><span class="crm-label">Contenu public :</span><span class="crm-chip crm-chip--ok">✔ Validé</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><p class="crm-label">Slug public</p><input class="crm-input" value="villa-aurelia"/></div>
      <div><p class="crm-label">Nom public du bien</p><input class="crm-input" value="Villa Aurelia"/></div>
    </div>
    <div style="margin-top:12px"><p class="crm-label">Signature / accroche</p><input class="crm-input" value="Une ode à la lumière méditerranéenne"/></div>
    <div style="margin-top:12px"><p class="crm-label">Introduction</p><textarea class="crm-textarea" rows="2">Posée sur les hauteurs, la Villa Aurelia dialogue avec la mer.</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
      <div><p class="crm-label">Texte du CTA acquéreur</p><input class="crm-input" value="Manifester mon intérêt"/></div>
      <div><p class="crm-label">Localisation publique</p><input class="crm-input" value="Presqu’île de Saint-Tropez"/></div>
    </div>
    <div style="margin-top:14px"><button class="crm-btn crm-btn--gold crm-btn--sm">Enregistrer l’expérience publique</button></div>
  </section>
  <section class="crm-panel" style="padding:20px">
    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--crm-text-dim);margin:0 0 14px">Publication</h2>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="crm-chip crm-chip--accent" style="--chip-accent:var(--crm-st-signe)"><span>★</span>Publié</span><span style="font-weight:600;color:var(--crm-text)">10/10 · 100%</span></div>
    <div class="crm-meter" role="meter"><span style="width:100%"></span></div>
    <ul style="list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:6px">
      ${[
        "Readiness interne du bien satisfaite",
        "Positionnement (Fabrique) validé",
        "Titre public renseigné",
        "Contenu public validé",
        "Image principale publique approuvée",
        "Confidentialité définie (localisation approx.)",
        "CTA acquéreur configuré",
      ]
        .map(
          (l) =>
            `<li style="display:flex;gap:8px;font-size:13px"><span style="color:var(--crm-success)">✔</span><span style="color:var(--crm-text)">${l}</span></li>`,
        )
        .join("")}
    </ul>
    <div style="margin-top:14px;display:flex;gap:8px"><button class="crm-btn crm-btn--sm">Republier (nouvelle version)</button><button class="crm-btn crm-btn--sm crm-btn--danger">Dépublier</button></div>
  </section>
</div>`;

const interestChip = (v, icon, label) =>
  `<span class="crm-chip crm-chip--accent" style="--chip-accent:var(${v})"><span>${icon}</span>${label}</span>`;

const crmInterests = `
<div style="max-width:820px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:18px">
  <div><p class="crm-eyebrow">Cockpit de production · Villa Aurelia</p><h1 style="font-size:22px;font-weight:600;margin-top:4px;color:var(--crm-text)">Intérêts acquéreurs</h1></div>
  <section class="crm-panel" style="padding:20px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        ["Total", "3"],
        ["Nouveaux", "2"],
        ["Prioritaires", "1"],
      ]
        .map(
          ([l, v]) =>
            `<div class="crm-panel-2" style="padding:10px 12px;border-radius:10px"><div style="font-size:18px;font-weight:600;color:var(--crm-text)">${v}</div><div style="font-size:11px;color:var(--crm-text-faint)">${l}</div></div>`,
        )
        .join("")}
    </div>
    ${[
      ["Éléonore Vasseur", "Résidence secondaire · 2 M€ – 3 M€", "prioritaire", "--crm-st-signe", "★", "Prioritaire", "nouveau", "--crm-st-nouveau", "●", "Nouveau"],
      ["Marc Delaunay", "Investissement · 1,2 M€ – 2 M€", "a_qualifier", "--crm-st-qualifie", "◐", "À qualifier", "consulte", "--crm-st-qualifie", "◎", "Consulté"],
      ["Sofia Ricci", "Résidence principale · À définir", "a_suivre", "--crm-st-neutre", "○", "À suivre", "traite", "--crm-st-signe", "✔", "Traité"],
    ]
      .map(
        ([name, sub, , pv, pi, pl, , sv, si, sl]) =>
          `<div class="crm-panel-2" style="padding:12px;border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
             <div style="min-width:0"><p style="font-size:14px;font-weight:500;color:var(--crm-text);margin:0">${name}</p><p style="font-size:11px;color:var(--crm-text-faint);margin:2px 0 0">${sub}</p></div>
             <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${interestChip(pv, pi, pl)}${interestChip(sv, si, sl)}</div>
           </div>`,
      )
      .join("")}
    <p style="font-size:11px;color:var(--crm-text-faint);margin-top:6px">Réception opérationnelle minimale (préparation du futur CRM Acquéreurs). Le score exact est interne.</p>
  </section>
</div>`;

// ------------------------------------------------------------------- Rendu
const publicHtml = (inner) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${publicTokens}
   body{margin:0;background:var(--color-ivory);font-family:${sans}}
   img{display:block}</style></head><body>${inner}</body></html>`;

const crmHtml = (theme, inner) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${crmCss}
   body{margin:0}.crm-root{font-family:${sans}}</style></head>
   <body><div class="crm-root" data-crm-theme="${theme}" style="min-height:100vh">${inner}</div></body></html>`;

function findChrome() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const dir = readdirSync(base).find((d) => d.startsWith("chromium-") && !d.includes("headless"));
  if (dir) {
    const p = path.join(base, dir, "chrome-linux", "chrome");
    if (existsSync(p)) return p;
  }
  return undefined;
}

const shots = [
  { kind: "public", vp: { width: 1200, height: 900 }, inner: publicPage(false), name: "public-desktop" },
  { kind: "public", vp: { width: 390, height: 844 }, inner: publicPage(true), name: "public-mobile" },
  { kind: "public", vp: { width: 1200, height: 760 }, inner: heroOnly(false), name: "hero-image" },
  { kind: "public", vp: { width: 1200, height: 760 }, inner: heroOnly(true), name: "hero-video-fallback" },
  { kind: "public", vp: { width: 1200, height: 760 }, inner: `<div style="background:var(--color-ivory)">${gallery}</div>`, name: "gallery" },
  { kind: "public", vp: { width: 1200, height: 780 }, inner: funnelStep(false), name: "funnel-desktop" },
  { kind: "public", vp: { width: 390, height: 844 }, inner: funnelStep(true), name: "funnel-mobile" },
  { kind: "public", vp: { width: 1200, height: 720 }, inner: confirmation, name: "confirmation" },
  { kind: "crm", theme: "dark", vp: { width: 900, height: 1100 }, inner: crmConfig, name: "crm-config-dark" },
  { kind: "crm", theme: "light", vp: { width: 900, height: 1100 }, inner: crmConfig, name: "crm-config-light" },
  { kind: "crm", theme: "dark", vp: { width: 900, height: 640 }, inner: crmInterests, name: "interests-dark" },
];

const browser = await chromium.launch({ executablePath: findChrome() });
for (const s of shots) {
  const page = await browser.newPage({ viewport: s.vp, deviceScaleFactor: 2 });
  const html = s.kind === "crm" ? crmHtml(s.theme, s.inner) : publicHtml(s.inner);
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, `${s.name}.png`), fullPage: true });
  await page.close();
  console.log("saved", s.name);
}
await browser.close();
console.log("done ->", outDir);
