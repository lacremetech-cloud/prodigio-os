// Génère des captures réelles de la Fabrique de biens (portfolio + cockpit,
// thèmes clair/sombre, desktop/mobile) à partir du VRAI crm.css. Rendu hors
// ligne avec des DONNÉES FICTIVES uniquement — ne fait pas partie du bundle
// applicatif et n'accède à aucune donnée réelle. Sert de preuve visuelle.
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const css = readFileSync(path.join(root, "src/app/crm/crm.css"), "utf8");
const outDir = path.join(root, "docs/assets/crm/property-factory");
mkdirSync(outDir, { recursive: true });

const statusChip = (v, icon, label) =>
  `<span class="crm-chip crm-chip--accent" style="--chip-accent:var(${v})"><span>${icon}</span>${label}</span>`;

const meter = (pct) =>
  `<div class="crm-meter" role="meter"><span style="width:${pct}%"></span></div>`;

const card = (name, sub, v, icon, status, done, pct, extra) =>
  `<li class="crm-panel" style="display:flex;flex-direction:column;gap:12px;padding:16px">
     <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
       <div style="min-width:0">
         <p style="font-size:16px;font-weight:600;color:var(--crm-text)">${name}</p>
         <p style="font-size:12px;color:var(--crm-text-faint)">${sub}</p>
       </div>
       ${statusChip(v, icon, status)}
     </div>
     <div style="display:flex;flex-direction:column;gap:6px">
       <div style="display:flex;justify-content:space-between;font-size:12px">
         <span style="color:var(--crm-text-dim)">Préparation</span>
         <span style="font-weight:600;color:var(--crm-text)">${done}/7 · ${pct}%</span>
       </div>
       ${meter(pct)}
     </div>
     <p style="font-size:11px;color:var(--crm-text-faint)">Responsable : ${extra}</p>
   </li>`;

const check = (ok, label) =>
  `<li style="display:flex;gap:8px;font-size:13px;align-items:flex-start">
     <span style="color:${ok ? "var(--crm-success)" : "var(--crm-text-faint)"}">${ok ? "✔" : "○"}</span>
     <span style="color:${ok ? "var(--crm-text)" : "var(--crm-text-dim)"}">${label}</span>
   </li>`;

const prodItem = (icon, v, kind, status) =>
  `<div class="crm-panel-2" style="display:flex;align-items:center;gap:8px;padding:10px 12px">
     <span style="color:var(${v})">${icon}</span>
     <span style="font-size:13px;font-weight:500;color:var(--crm-text);flex:1">${kind}</span>
     ${statusChip(v, icon, status)}
   </div>`;

const portfolio = `
<div style="max-width:1100px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:18px">
  <div><p class="crm-eyebrow">Fabrique de biens</p><h1 style="font-size:22px;font-weight:600;margin-top:4px;color:var(--crm-text)">Portefeuille des biens</h1></div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">
    <div style="flex:1;min-width:180px"><p class="crm-label">Rechercher</p><input class="crm-input" placeholder="Nom, type, ville…"/></div>
    <div><p class="crm-label">Statut</p><select class="crm-select"><option>Tous</option></select></div>
    <div><p class="crm-label">Avancement</p><select class="crm-select"><option>Tous</option></select></div>
  </div>
  <ul class="pf-grid" style="list-style:none;margin:0;padding:0">
    ${card("Villa Belvédère", "villa · Annecy", "--crm-st-rdv_planifie", "⚙", "Production en cours", 5, 71, "Julie D.")}
    ${card("Mas des Oliviers", "mas · Aix-en-Provence", "--crm-st-signe", "✔", "Prêt à lancer", 7, 100, "Karim B.")}
    ${card("Duplex Rivage", "appartement · Annecy", "--crm-st-qualifie", "◎", "Stratégie en cours", 3, 43, "non désigné")}
    ${card("Chalet Aravis", "chalet · La Clusaz", "--crm-st-neutre", "○", "À configurer", 1, 14, "Julie D.")}
    ${card("Loft Confluence", "loft · Lyon", "--crm-st-eligibilite", "★", "En diffusion", 7, 100, "Karim B.")}
    ${card("Bastide Sud", "bastide · Uzès", "--crm-st-a_contacter", "‖", "Suspendu", 4, 57, "Julie D.")}
  </ul>
</div>`;

const cockpit = `
<div style="max-width:1100px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:18px">
  <p style="font-size:12px;color:var(--crm-text-dim)">← Portefeuille des biens</p>
  <div class="crm-panel" style="overflow:hidden">
    <div style="height:130px;background:linear-gradient(135deg,var(--crm-panel-2),var(--crm-elevated))"></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <p class="crm-eyebrow">Cockpit de production</p>
          <h1 style="font-size:24px;font-weight:600;color:var(--crm-text);margin-top:2px">Villa Belvédère</h1>
          <p style="font-size:14px;color:var(--crm-text-dim)">Une signature contemporaine sur les hauteurs du lac</p>
          <p style="font-size:12px;color:var(--crm-text-faint);margin-top:2px">villa · Annecy</p>
        </div>
        ${statusChip("--crm-st-rdv_planifie", "⚙", "Production en cours")}
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:var(--crm-text-dim)">
        <span>Responsable : Julie D.</span><span>Créé le 28 juil. 2026</span><span>Préparation : 71%</span>
      </div>
    </div>
  </div>

  <div class="ck-grid" style="display:grid;grid-template-columns:1fr 340px;gap:18px">
    <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
      <div class="crm-panel" style="padding:20px">
        <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--crm-text-dim);margin-bottom:14px">Plan de production</h2>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${prodItem("✔", "--crm-st-signe", "Photographie", "Validé")}
          ${prodItem("◐", "--crm-st-rdv_planifie", "Vidéo", "En cours")}
          ${prodItem("✔", "--crm-st-signe", "Rédaction commerciale", "Validé")}
          ${prodItem("◎", "--crm-st-qualifie", "Identité visuelle", "En revue")}
          ${prodItem("⚠", "--crm-st-perdu", "Brochure", "Bloqué")}
          ${prodItem("○", "--crm-st-neutre", "Publicités", "À faire")}
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
      <div class="crm-panel" style="padding:20px">
        <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--crm-text-dim);margin-bottom:14px">Préparation au lancement</h2>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
          <span style="color:var(--crm-text-dim)">Progression</span><span style="font-weight:600;color:var(--crm-text)">5/7 · 71%</span>
        </div>
        ${meter(71)}
        <ul style="list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px">
          ${check(true, "Identité complète")}
          ${check(true, "Positionnement validé")}
          ${check(true, "Image principale définie")}
          ${check(true, "Au moins une photo")}
          ${check(true, "Document de mandat présent")}
          ${check(false, "Livrables clés validés")}
          ${check(false, "Responsable désigné")}
        </ul>
      </div>
    </div>
  </div>
</div>`;

const html = (theme, inner) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}
  body{margin:0}
  .crm-root{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .pf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  @media (max-width:900px){.pf-grid{grid-template-columns:1fr}.ck-grid{grid-template-columns:1fr!important}}
</style></head>
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
  { theme: "dark", vp: { width: 1160, height: 940 }, inner: portfolio, name: "portfolio-dark" },
  { theme: "light", vp: { width: 1160, height: 940 }, inner: portfolio, name: "portfolio-light" },
  { theme: "dark", vp: { width: 1160, height: 900 }, inner: cockpit, name: "cockpit-dark" },
  { theme: "light", vp: { width: 1160, height: 900 }, inner: cockpit, name: "cockpit-light" },
  { theme: "dark", vp: { width: 390, height: 900 }, inner: cockpit, name: "mobile-dark" },
  { theme: "light", vp: { width: 390, height: 900 }, inner: cockpit, name: "mobile-light" },
];

const browser = await chromium.launch({ executablePath: findChrome() });
for (const s of shots) {
  const page = await browser.newPage({ viewport: s.vp, deviceScaleFactor: 2 });
  await page.setContent(html(s.theme, s.inner), { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, `${s.name}.png`), fullPage: true });
  await page.close();
  console.log("saved", s.name);
}
await browser.close();
console.log("done ->", outDir);
