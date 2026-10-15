// Mesure la géométrie MOBILE de la file d'appels acquéreurs, hors ligne, avec
// le VRAI CSS produit par le build (Tailwind + crm.css) et des données
// fictives. Ne touche aucune donnée réelle et ne fait pas partie du bundle.
//
// Trois questions, trois mesures :
//   1. À quelle hauteur arrive le PREMIER dossier ? (doit être au-dessus de la
//      ligne de flottaison : on ouvre la file et on voit un nom.)
//   2. Le panneau occupe-t-il toute la hauteur utile ?
//   3. « Enregistrer et suivant » reste-t-il visible CLAVIER OUVERT ?
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const chunks = path.join(root, ".next/static/chunks");
const css = readdirSync(chunks)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(path.join(chunks, f), "utf8"))
  .join("\n");
if (!css.includes("crm-compteurs-file")) {
  throw new Error("CSS du build introuvable ou périmé : relancer `npm run build`.");
}
mkdirSync(path.join(root, "docs/assets/crm/mobile-acquereurs"), { recursive: true });

const compteur = (label, valeur) =>
  `<button class="crm-compteur" type="button"><span class="crm-compteur__label">${label}</span><span class="crm-compteur__valeur">${valeur}</span></button>`;

const ligne = (nom, ville) =>
  `<li class="crm-ligne" data-ligne><div style="min-width:0"><p style="font-weight:600;font-size:14px">${nom}</p>
     <p style="font-size:12px;color:var(--crm-text-dim)">${ville}</p></div></li>`;

// Les classes sont recopiées TELLES QUELLES depuis buyer-inbox.tsx : c'est ce
// qui fait de cette mesure une mesure, et non une maquette.
const liste = (filtresDeplies) => `
<div class="crm-shell" style="padding:16px">
 <div class="flex flex-col gap-5">
  <header>
    <p class="crm-eyebrow">CRM Acquéreurs</p>
    <h1 class="mt-1 text-2xl font-semibold">Boîte de réception acquéreurs</h1>
    <p class="mt-1 hidden max-w-2xl text-sm sm:block">Une ligne par personne. Quelqu'un qui s'intéresse à deux
      projets apparaît une seule fois, avec les deux biens en repère.</p>
  </header>
  <p class="crm-bandeau-file"><strong>14 personnes dans le pipeline actif</strong> — <a class="crm-bandeau-file__lien" href="#">2 non qualifiées hors traitement</a></p>
  <div class="flex flex-col gap-4">
   <div class="crm-compteurs-file">
     ${compteur("Dossiers", 16)}${compteur("À contacter", 7)}${compteur("En retard", 2)}
     ${compteur("Sans action", 3)}${compteur("Non affectés", 1)}
   </div>
   <div class="flex flex-col gap-2 rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-3">
     <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
       <label class="min-w-0 sm:flex-1"><input class="crm-input" type="search" placeholder="Rechercher (nom, e-mail, téléphone, ville…)"></label>
       <button type="button" class="crm-replier sm:hidden">Filtrer et trier</button>
       <label class="${filtresDeplies ? "flex" : "hidden sm:flex"} w-full min-w-0 items-center gap-1.5 sm:w-auto">
         <span class="crm-label shrink-0">Trier par</span><select class="crm-select text-xs"><option>Urgence</option></select>
       </label>
     </div>
     <div class="${filtresDeplies ? "grid" : "hidden sm:grid"} grid-cols-1 gap-2 sm:flex sm:flex-wrap">
       <select class="crm-select"><option>Toutes les étapes</option></select>
       <select class="crm-select"><option>Tous les budgets</option></select>
       <select class="crm-select"><option>Tous les responsables</option></select>
     </div>
   </div>
   <div class="crm-rapides" role="group"><button class="crm-rapide">Tous</button><button class="crm-rapide">À contacter</button><button class="crm-rapide">À rappeler</button></div>
   <ul class="crm-lignes">${ligne("Sabah Matez", "Marseille")}${ligne("Éric Tommasi", "Aix")}${ligne("Gilles Teboul", "Nîmes")}</ul>
  </div>
 </div>
</div>`;

// Le panneau, avec son pied : la question est de savoir où tombe le bouton.
const panneau = `
<aside class="crm-panneau">
  <div class="crm-panneau__tete" style="padding:12px 18px">
    <div><p class="crm-panneau__rang">Dossier 1 sur 14</p><p class="crm-panneau__nom">Sabah Matez</p></div>
  </div>
  <div class="crm-panneau__corps">
    <section class="crm-bloc"><h3 class="crm-bloc__titre">Ajouter une activité</h3>
      <div class="crm-grille crm-grille--2">
        <button class="crm-gros-choix">Appel — sans réponse</button>
        <button class="crm-gros-choix">Appel — échange effectué</button>
        <button class="crm-gros-choix">Message vocal laissé</button>
        <button class="crm-gros-choix">Message WhatsApp envoyé</button>
        <button class="crm-gros-choix">SMS / iMessage envoyé</button>
        <button class="crm-gros-choix">E-mail envoyé</button>
        <button class="crm-gros-choix">Note libre</button>
      </div>
      <textarea class="crm-input" style="min-height:72px"></textarea>
    </section>
    <section class="crm-bloc"><h3 class="crm-bloc__titre">Étape</h3>
      <div class="crm-grille crm-grille--2">
        <button class="crm-gros-choix">À contacter</button><button class="crm-gros-choix">À rappeler</button>
        <button class="crm-gros-choix">En discussion</button><button class="crm-gros-choix">Visite planifiée</button>
        <button class="crm-gros-choix">Vivier</button><button class="crm-gros-choix">Pas intéressé</button>
        <button class="crm-gros-choix">Mauvais numéro</button>
      </div>
    </section>
    <section class="crm-bloc"><h3 class="crm-bloc__titre">Qualification</h3>
      <div class="crm-grille crm-grille--3">
        <button class="crm-gros-choix">À qualifier</button><button class="crm-gros-choix">Qualifié</button>
        <button class="crm-gros-choix">Gros potentiel</button><button class="crm-gros-choix">Non qualifié</button>
      </div>
    </section>
    <section class="crm-bloc"><h3 class="crm-bloc__titre">Prochaine action</h3>
      <div class="crm-grille crm-grille--2">
        <button class="crm-gros-choix">Aucune</button><button class="crm-gros-choix">Rappeler</button>
        <button class="crm-gros-choix">Visite</button><button class="crm-gros-choix">Tâche</button>
      </div>
    </section>
  </div>
  <footer class="crm-panneau__pied">
    <div class="flex gap-2">
      <button class="crm-btn crm-btn--primaire" data-enregistrer>Enregistrer et suivant</button>
      <button class="crm-btn crm-btn--secondaire">Enregistrer</button>
    </div>
  </footer>
</aside>`;

const page = (corps) =>
  `<!doctype html><html lang="fr" data-theme="light"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>
   <style>body{margin:0;background:var(--crm-bg)}
     .crm-ligne{display:flex;gap:8px;padding:12px;border-bottom:1px solid var(--crm-line-soft)}
     .crm-lignes{list-style:none;margin:0;padding:0}</style>
   </head><body class="crm-root">${corps}</body></html>`;

const APPAREILS = [
  { nom: "iPhone 13/14 (390x844)", width: 390, height: 844, clavier: 336 },
  { nom: "iPhone SE (375x667)", width: 375, height: 667, clavier: 300 },
  { nom: "Android compact (360x740)", width: 360, height: 740, clavier: 300 },
];

/* Chromium est préinstallé dans l'environnement ; la version épinglée par le
   paquet n'y est pas, d'où le chemin explicite. */
const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
let echecs = 0;
const dis = (ok, texte) => {
  if (!ok) echecs += 1;
  console.log(`${ok ? "  OK  " : " ÉCHEC"} ${texte}`);
};

for (const appareil of APPAREILS) {
  console.log(`\n=== ${appareil.nom} ===`);
  const ctx = await navigateur.newContext({
    viewport: { width: appareil.width, height: appareil.height },
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();

  // --- 1. Le premier dossier -----------------------------------------------
  await p.setContent(page(liste(false)));
  const premier = await p.locator("[data-ligne]").first().boundingBox();
  const deplie = page(liste(true));
  await p.setContent(deplie);
  const premierDeplie = await p.locator("[data-ligne]").first().boundingBox();
  console.log(`  premier dossier : ${Math.round(premier.y)} px (filtres dépliés : ${Math.round(premierDeplie.y)} px)`);
  // Il doit tenir dans le PREMIER écran : on ouvre la file d'appels et on voit
  // un nom, sans avoir traversé l'appareil de filtrage.
  dis(premier.y < appareil.height, `premier dossier dans le premier écran (${Math.round(premier.y)} < ${appareil.height})`);
  dis(premier.y < premierDeplie.y, "replier les filtres remonte bien le premier dossier");

  // --- 2. Le panneau, plein écran ------------------------------------------
  await p.setContent(page(panneau));
  const boite = await p.locator(".crm-panneau").boundingBox();
  console.log(`  panneau : ${Math.round(boite.width)} × ${Math.round(boite.height)} px`);
  dis(Math.round(boite.width) === appareil.width, "panneau sur toute la largeur");
  dis(Math.abs(boite.height - appareil.height) <= 1, "panneau sur toute la hauteur");

  // --- 3. « Enregistrer » clavier OUVERT -----------------------------------
  // Le clavier ne redimensionne pas la page sur iOS : on reproduit donc
  // exactement ce que fait `useHauteurVisible`, en posant `--crm-vh`.
  const visible = appareil.height - appareil.clavier;
  await p.evaluate((h) => document.documentElement.style.setProperty("--crm-vh", `${h}px`), visible);
  const bouton = await p.locator("[data-enregistrer]").boundingBox();
  console.log(`  clavier ouvert (${visible} px utiles) : bas du bouton à ${Math.round(bouton.y + bouton.height)} px`);
  dis(bouton.y + bouton.height <= visible, `« Enregistrer et suivant » au-dessus du clavier (${Math.round(bouton.y + bouton.height)} ≤ ${visible})`);
  dis(bouton.height >= 40, `bouton d'au moins 40 px de haut (${Math.round(bouton.height)})`);

  await p.screenshot({
    path: path.join(root, `docs/assets/crm/mobile-acquereurs/panneau-clavier-${appareil.width}.png`),
  });
  await ctx.close();
}

await navigateur.close();
console.log(`\n${echecs === 0 ? "Toutes les mesures passent." : `${echecs} mesure(s) en échec.`}`);
process.exit(echecs === 0 ? 0 : 1);
