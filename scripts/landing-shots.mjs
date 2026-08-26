// Captures RÉELLES de la landing propriétaire servie par le serveur de dev.
//
// Contrairement aux autres scripts de `scripts/` (qui rendent des maquettes
// HTML), celui-ci photographie la VRAIE page : mêmes composants, mêmes tokens,
// mêmes animations. Il sert la boucle de revue visuelle obligatoire —
// implémenter → regarder → critiquer → corriger → regarder à nouveau.
//
//   npm run dev            (dans un terminal, PORT au choix)
//   node scripts/landing-shots.mjs [url] [dossier] [étiquette]
//
// Les révélations au scroll sont déclenchées par un défilement complet avant la
// capture : on photographie donc la page telle qu'un visiteur la voit, pas une
// page figée à l'état initial.
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:3210/proprietaire";
const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.join(root, process.argv[3] ?? "docs/assets/landing-shots");
const label = process.argv[4] ?? "";
mkdirSync(outDir, { recursive: true });

function findChrome() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const dir = readdirSync(base).find((d) => d.startsWith("chromium-") && !d.includes("headless"));
  if (dir) {
    const p = path.join(base, dir, "chrome-linux", "chrome");
    if (existsSync(p)) return p;
  }
  return undefined;
}

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];

/** Fait défiler toute la page pour déclencher les révélations, puis revient. */
async function primeReveals(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await wait(90);
    }
    window.scrollTo(0, document.body.scrollHeight);
    await wait(500);
    window.scrollTo(0, 0);
    await wait(400);
  });
}

const browser = await chromium.launch({ executablePath: findChrome() });
const suffix = label ? `-${label}` : "";

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });

  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(url, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(1200);

  // 1) Première impression : ce que l'on voit sans avoir défilé.
  await page.screenshot({ path: path.join(outDir, `${vp.name}${suffix}-01-fold.png`) });

  // 2) Page entière, révélations déclenchées.
  await primeReveals(page);
  await page.screenshot({
    path: path.join(outDir, `${vp.name}${suffix}-full.png`),
    fullPage: true,
  });

  // 3) Écran par écran : le rythme réel du défilement.
  const height = await page.evaluate(() => document.body.scrollHeight);
  const screens = Math.min(14, Math.ceil(height / vp.height));
  for (let i = 1; i < screens; i += 1) {
    await page.evaluate((y) => window.scrollTo(0, y), i * vp.height);
    await page.waitForTimeout(420);
    const n = String(i + 1).padStart(2, "0");
    await page.screenshot({ path: path.join(outDir, `${vp.name}${suffix}-${n}-ecran.png`) });
  }

  // 4) Débordement horizontal : défaut mobile le plus fréquent.
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const guilty = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > docWidth + 1 || r.left < -1)) {
        guilty.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
      }
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: docWidth,
      guilty: guilty.slice(0, 6),
    };
  });

  console.log(
    `[${vp.name}] hauteur=${height}px écrans=${screens} ` +
      `débordement=${overflow.scrollWidth > overflow.clientWidth ? `OUI (${overflow.scrollWidth}>${overflow.clientWidth})` : "non"} ` +
      `erreursConsole=${consoleErrors.length}`,
  );
  if (overflow.guilty.length) console.log(`  → éléments hors cadre : ${overflow.guilty.join(" | ")}`);
  for (const e of consoleErrors.slice(0, 5)) console.log(`  → console: ${e.slice(0, 160)}`);

  await page.close();
}

await browser.close();
console.log("captures →", outDir);
