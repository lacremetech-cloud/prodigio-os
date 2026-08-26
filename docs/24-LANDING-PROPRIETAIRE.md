# 24 — Landing propriétaire (`/proprietaire`)

Refonte éditoriale, artistique et rédactionnelle de la landing du funnel Mandats.
Ce document fixe la **doctrine** de la page : ce qui peut évoluer librement, ce
qui est verrouillé, et ce qui reste à confirmer.

## 1. Positionnement — source de vérité

> **Traditionnel + Système Prodigio™.**

Prodigio **ne dévalorise pas** les agences de prestige. Elles disposent déjà d'un
réseau, d'un fichier acquéreurs, de portails spécialisés, d'off-market, de
diffusion internationale et d'une véritable expertise transactionnelle. Prodigio
conserve ces leviers et **ajoute** une couche d'acquisition active appliquée à un
seul bien : positionnement, création, budget média financé, data, optimisation,
qualification.

### Interdits de ton (ne jamais réintroduire)

- « les agences prennent des photos, publient une annonce et attendent » ;
- « la même fiche partout », « annonce ordinaire », « partout ailleurs » ;
- « Instagram ne sert à rien » — la visibilité organique est utile, elle n'est
  simplement **pas** de l'acquisition ;
- toute promesse de délai ou de prix (« vend deux fois plus vite ») tant qu'elle
  n'est pas statistiquement démontrée.

Un test automatisé garde cette règle
(`landing-dynamic.test.tsx` → « Positionnement — interdits de ton »).

## 2. Narration

Chaque section répond à la précédente ; le rythme alterne volontairement densité
et silence, clair et sombre, texte et image.

| # | Section | Rôle |
|---|---|---|
| 1 | `Hero` | La question : « et si nous allions le chercher ? » |
| 2 | `PreuveFlash` | Des chiffres, tout de suite → « comment ont-ils fait ? » |
| 3 | `ForcesSection` | Reconnaître les forces de l'immobilier d'exception |
| 4 | `VisibiliteSection` | Visibilité ≠ acquisition (schémas comparés) |
| 5 | `MarcheSection` | Au-delà des fichiers — respiration cinématographique |
| 6 | `CreationSection` | Annonce → expérience (rupture d'échelle) |
| 7 | `EcrinReelSection` | La preuve de création, livrables réels |
| 8 | `SystemeSection` | Les six temps du système |
| 9 | `EngagementSection` | L'investissement, puis le climax « budget média » |
| 10 | `DataSection` | Le tableau de bord propriétaire |
| 11 | `CaseStudySection` | Font-Romeu, révélation progressive → « 1 vente » |
| 12 | `ManifesteSection` | L'équation : expertise + système = commercialisation augmentée |
| 13 | `SelectivitySection` | Sélectif par nature + appel à l'action |
| 14 | `FaqSection` | Questions fréquentes (repliables natifs) |
| 15 | `FinalCtaSection` | Un seul geste possible |

## 3. Ce qui est VERROUILLÉ

### Le parcours d'analyse (« quiz ») est un contrat de données

Le quiz alimente le CRM Prodigio. **Aucune** modification de sa logique n'est
autorisée depuis la landing : ni question, ni ordre, ni libellé de réponse, ni
`name`, ni clé, ni valeur envoyée, ni endpoint, ni scoring, ni mapping CRM.

La refonte ne touche donc **aucun** fichier de
`src/components/mandate/analyse/`, `src/modules/mandates/`,
`src/app/proprietaire/analyse/`, `src/app/api/` ni `supabase/`.

Tous les appels à l'action pointent vers `ANALYSE_ROUTE` (`src/lib/routes.ts`),
comme auparavant — y compris le CTA collant mobile, qui **réutilise** cette route
et n'introduit aucune logique d'ouverture parallèle.

### Aucun fait non validé n'est affiché

- **Volumétrie d'audience** (« 51,5 M », « 5,79 Md ») : `marche.chiffres` est
  **vide**. La section s'affiche correctement sans ces chiffres et ne les
  inventera jamais. Les renseigner uniquement avec leur source.
- **Liens de l'écrin réel** : `ecrinReel.pieces[].href` est **vide**. Un lien
  n'est rendu que s'il est renseigné — jamais de lien mort.
- **Durée de la VSL** : aucune durée n'est annoncée.
- **Étude de cas** : présentée comme une preuve, jamais comme une garantie ; le
  disclaimer est solidaire des chiffres.
- **FAQ** : aucune condition contractuelle chiffrée (taux, durée, exclusivité).
  Le mandat est porté par une agence habilitée et ses conditions sont présentées
  avant signature.

### Valeurs à confirmer

`EXPERIENCE_ANNEES` (« plus de 25 ans ») est isolée en tête de `copy.ts` pour
être modifiable en un seul endroit tant que la donnée n'est pas définitive.

## 4. Direction artistique

Prodigio se situe à l'intersection **immobilier patrimonial × maison éditoriale ×
technologie invisible × cinéma** — pas SaaS, pas agence marketing, pas template,
pas infoproduit.

**Supprimés de la page** (luxe cliché / signaux « template ») : cartouche
« premium » à reflet, halo doré pulsé derrière le CTA, annotation manuscrite et
flèche dessinée, faux repères de tournage (« SCENE 01 », « 4K », « 00:00 »),
séparateurs en étoile, défilement horizontal capturé.

**Règles tenues** :

- l'or reste un **accent** (filets, intitulés, chiffre climax) — jamais un
  aplat, jamais un dégradé, jamais un halo ;
- pas de carte à ombre et coins arrondis : filets, espace et échelle ;
- compositions **variées** — masthead asymétrique, bandeau horizontal, bandes
  typographiques, photographie pleine largeur, équation, tableau de bord ;
- mouvement **fonctionnel** uniquement : `transform` / `opacity` / tracé SVG,
  easing `cubic-bezier(0.22, 1, 0.36, 1)`, `prefers-reduced-motion` respecté
  (les schémas s'affichent alors complets — le sens ne dépend jamais de
  l'animation).

## 5. La VSL — un seul geste

Toute la zone est un `button`. Au **premier** clic, le film s'ouvre en
expérience agrandie (quasi plein écran sur ordinateur, plein écran sur mobile),
avec le son et les contrôles natifs. Jamais de « lecture → chercher le plein
écran → recliquer ».

Aucune lecture automatique : l'iframe YouTube n'est montée qu'à l'ouverture —
c'est aussi ce qui supprime toute requête tierce au chargement de la page.

À la fermeture, la position de défilement est restaurée **exactement** (le corps
est figé à son offset puis restauré), et le focus revient sur l'écrin. `Échap`
ferme ; le focus est piégé dans la boîte de dialogue.

## 6. Boucle de revue visuelle

La page ne se juge pas sur un build vert.

```bash
npm run dev                                   # dans un terminal
node scripts/landing-shots.mjs http://localhost:3000/proprietaire
```

Le script photographie la **vraie** page (mêmes composants, mêmes jetons, mêmes
animations) : première impression, page entière, écran par écran, en 1440×900 et
390×844. Il signale en plus les débordements horizontaux et les erreurs console.

Regarder les captures, critiquer, corriger, **regarder à nouveau** — au moins
deux passes après la première implémentation.

## 7. Vérifications

```bash
npm run typecheck && npm run lint && npm run test:run && npm run build
```
