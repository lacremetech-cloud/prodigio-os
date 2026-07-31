// Génère des captures réelles du design system CRM (thèmes clair/sombre,
// desktop/mobile) à partir du VRAI crm.css. Rendu hors ligne : composants
// représentatifs (KPI, Kanban, Agenda, timeline corrigée, badges, sélecteur de
// thème). Sert de preuve visuelle — ne fait pas partie du bundle applicatif.
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const css = readFileSync(path.join(root, "src/app/crm/crm.css"), "utf8");
const outDir = path.join(root, "docs/assets/crm/v1-2");
mkdirSync(outDir, { recursive: true });

const chip = (v, icon, label) =>
  `<span class="crm-chip crm-chip--accent" style="--chip-accent:var(${v})"><span>${icon}</span>${label}</span>`;

const kpi = (accent, icon, label, val) =>
  `<div class="crm-panel crm-kpi" style="--kpi-accent:var(${accent});padding:16px;display:flex;flex-direction:column;gap:4px">
     <span style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--crm-text-dim)"><span class="crm-kpi__icon">${icon}</span>${label}</span>
     <span style="font-size:24px;font-weight:600">${val}</span>
   </div>`;

const kcol = (accent, icon, label, n) =>
  `<div style="flex:0 0 210px">
     <div class="crm-kanban-head" style="--col-accent:var(${accent});display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
       <span style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--crm-text-dim)"><span style="color:var(${accent})">${icon}</span>${label}</span>
       <span class="crm-chip">${n}</span>
     </div>
     <div class="crm-panel-2" style="padding:10px;min-height:70px">
       <p style="font-size:13px;color:var(--crm-text)">Marie Dupont</p>
       <p style="font-size:12px;color:var(--crm-text-faint)">Villa · Annecy</p>
     </div>
   </div>`;

const tlItem = (v, icon, title, body, date, last) =>
  `<li class="crm-tl-item"${last ? ' style="padding-bottom:0"' : ""}>
     <div class="crm-tl-rail"><span class="crm-tl-dot" style="--tl-accent:var(${v})">${icon}</span></div>
     <div class="crm-tl-body">
       <div class="crm-tl-head"><span class="crm-tl-title">${title}</span><time class="crm-tl-date">${date}</time></div>
       ${body ? `<p class="crm-tl-text">${body}</p>` : ""}
     </div>
   </li>`;

const agendaChip = (v, icon, time, who) =>
  `<span class="crm-agenda-chip" style="--chip-accent:var(${v});display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border:1px solid var(--crm-line-soft);border-radius:7px;background:var(--crm-panel-2);font-size:12px;color:var(--crm-text)"><span>${icon}</span><span>${time}</span><span>${who}</span></span>`;

const body = `
<div style="max-width:1080px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:22px">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
    <div><p class="crm-eyebrow">Tableau de bord</p><h1 style="font-size:22px;font-weight:600;margin-top:4px">Vue d’ensemble</h1></div>
    <div class="crm-segmented" role="radiogroup">
      <label class="crm-segment"><span>🌙</span><span>Sombre</span></label>
      <label class="crm-segment crm-segment--active"><span>☀️</span><span>Clair</span></label>
      <label class="crm-segment"><span>🖥️</span><span>Système</span></label>
    </div>
  </div>

  <div class="demo-kpis">
    ${kpi("--crm-st-nouveau", "✦", "Nouveaux aujourd’hui", 3)}
    ${kpi("--crm-danger", "!", "Tâches en retard", 2)}
    ${kpi("--crm-st-eligibilite", "⚖", "En attente d’éligibilité", 1)}
    ${kpi("--crm-st-signe", "✔", "Mandats signés", 5)}
  </div>

  <div>
    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--crm-text-dim);margin-bottom:10px">Pipeline</h2>
    <div style="display:flex;gap:12px;overflow:auto">
      ${kcol("--crm-st-nouveau", "✦", "Nouveau", 4)}
      ${kcol("--crm-st-qualifie", "◎", "Qualifié", 2)}
      ${kcol("--crm-st-proposition", "✎", "Mandat proposé", 1)}
      ${kcol("--crm-st-signe", "✔", "Mandat signé", 3)}
    </div>
  </div>

  <div class="demo-two">
    <div class="crm-panel" style="padding:18px">
      <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--crm-text-dim);margin-bottom:12px">Agenda — statuts</h2>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${agendaChip("--crm-st-rdv_planifie", "◷", "14:00", "M. Dupont")}
        ${agendaChip("--crm-st-signe", "✓", "16:30", "L. Martin")}
        ${agendaChip("--crm-st-rdv_realise", "◆", "09:15", "P. Bernard")}
        ${agendaChip("--crm-st-perdu", "✕", "11:00", "annulé")}
      </div>
      <div style="display:flex;gap:8px">${chip("--crm-st-eligibilite","★","Premium")} ${chip("--crm-st-perdu","✕","Perdu")} ${chip("--crm-st-contact","◗","Contacté")}</div>
    </div>

    <div class="crm-panel" style="padding:18px">
      <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--crm-text-dim);margin-bottom:12px">Activité &amp; historique</h2>
      <ol class="crm-tl">
        ${tlItem("--crm-st-proposition","✒","Mandat proposé","Barème premium · HT","31 juil. 14:20 · Julie")}
        ${tlItem("--crm-st-qualifie","⇄","Changement de stade","Qualifié → Rendez-vous planifié","31 juil. 11:05 · Julie")}
        ${tlItem("--crm-st-contact","☎","Appel — Contact établi","Rappel programmé pour lundi","30 juil. 16:40 · Karim")}
        ${tlItem("--crm-st-rdv_planifie","◷","Rendez-vous","Estimation planifiée","30 juil. 10:00 · Karim", true)}
      </ol>
    </div>
  </div>
</div>`;

const html = (theme) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}
  body{margin:0}
  .crm-root{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  /* Grilles responsive (miroir des classes Tailwind réelles de l'app). */
  .demo-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .demo-two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media (max-width:640px){
    .demo-kpis{grid-template-columns:repeat(2,1fr)}
    .demo-two{grid-template-columns:1fr}
  }
</style></head>
<body><div class="crm-root" data-crm-theme="${theme}" style="min-height:100vh;padding:0">${body}</div></body></html>`;

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
  { theme: "dark", vp: { width: 1120, height: 900 }, name: "dashboard-dark" },
  { theme: "light", vp: { width: 1120, height: 900 }, name: "dashboard-light" },
  { theme: "dark", vp: { width: 390, height: 844 }, name: "mobile-dark" },
  { theme: "light", vp: { width: 390, height: 844 }, name: "mobile-light" },
];

const browser = await chromium.launch({ executablePath: findChrome() });
for (const s of shots) {
  const page = await browser.newPage({ viewport: s.vp, deviceScaleFactor: 2 });
  await page.setContent(html(s.theme), { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, `${s.name}.png`), fullPage: true });
  await page.close();
  console.log("saved", s.name);
}
await browser.close();
console.log("done ->", outDir);
