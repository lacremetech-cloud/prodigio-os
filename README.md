# Prodigio OS

Système technologique et opérationnel dédié à la **commercialisation active de
biens immobiliers d'exception** — acquisition et qualification de propriétaires
vendeurs, commercialisation des biens et acquisition d'acheteurs, avec les
mandats portés par une agence partenaire habilitée.

## Statut actuel

**Fondation technique initialisée — tunnel non développé.** Le socle applicatif
(Next.js App Router, TypeScript strict, Tailwind CSS, ESLint, Vitest, Zod) est en
place et validé. Le **funnel Mandats**, le **CRM** et les modules métier ne sont
**pas** encore développés.

**Aucun service externe n'est encore connecté** : ni **Supabase** (base, auth,
stockage) ni **Vercel** (hébergement/previews). L'application fonctionne **sans
aucune variable d'environnement** à ce stade.

## Prérequis

- **Node.js** : version indiquée dans [`.nvmrc`](.nvmrc) (`nvm use`).
- **npm** (gestionnaire de paquets du projet ; dépendances verrouillées dans
  `package-lock.json`).

## Installation

```bash
npm install
cp .env.example .env.local   # optionnel : aucune variable n'est requise pour l'instant
```

## Commandes disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement (http://localhost:3000). |
| `npm run build` | Build de production. |
| `npm run start` | Démarre le build de production. |
| `npm run lint` | Analyse ESLint. |
| `npm run typecheck` | Vérification TypeScript stricte (`tsc --noEmit`). |
| `npm run test` | Tests unitaires (Vitest, mode watch). |
| `npm run test:run` | Tests unitaires (exécution unique, CI). |

Point de contrôle de disponibilité : `GET /api/health` →
`{ "status": "ok", "service": "prodigio-os" }`.

## Structure générale

Monolithe modulaire (modules métier séparés, sans surdimensionnement) :

```
src/
  app/                # App Router (pages, layout, route /api/health)
  components/ui/      # composants d'interface accessibles
  config/             # validation de configuration (Zod), extensible
  lib/                # utilitaires transverses
  modules/
    mandates/         # moteur Mandats (en construction)
    shared/           # éléments partagés entre modules
docs/                 # documentation fondatrice (voir ci-dessous)
```

Design system minimal : variables CSS (palette ivoire / noir bois / or vieilli,
espacements, rayons, transitions) dans `src/app/globals.css` ; polices Cinzel
(titres) et Josefin Sans (textes) auto-hébergées via `next/font`.

## Documentation fondatrice

- [CLAUDE.md](CLAUDE.md) — Constitution permanente du projet.
- [docs/01-PRODUCT-VISION.md](docs/01-PRODUCT-VISION.md) — Vision produit.
- [docs/02-MVP-SCOPE.md](docs/02-MVP-SCOPE.md) — Périmètre du MVP.
- [docs/03-DOMAIN-MODEL.md](docs/03-DOMAIN-MODEL.md) — Modèle de domaine.
- [docs/04-ROADMAP.md](docs/04-ROADMAP.md) — Feuille de route.
- [docs/05-OPEN-QUESTIONS.md](docs/05-OPEN-QUESTIONS.md) — Questions ouvertes.
- [docs/06-ACCESS-MODEL.md](docs/06-ACCESS-MODEL.md) — Modèle d'accès (rôles,
  organisations, frontières).
- [docs/adr/001-TECHNICAL-FOUNDATION.md](docs/adr/001-TECHNICAL-FOUNDATION.md) —
  Décision de fondation technique (acceptée pour le MVP, réévaluable).

Le MVP couvre une **tranche verticale Mandats jusqu'au résultat du mandat**
(signé, refusé ou perdu) — voir [docs/02-MVP-SCOPE.md](docs/02-MVP-SCOPE.md).

## Portage

**INDESCALE** porte actuellement le **développement et l'exploitation** du
système Prodigio, dans l'attente de la création de l'entité Prodigio. **INDESCALE
ne porte pas les mandats immobiliers** : ceux-ci sont portés par une **entité
immobilière habilitée**, à confirmer contractuellement (Héritage Patrimoine
envisagé). Les éléments juridiques et contractuels ne sont pas tous validés et
**aucune conformité n'est présumée** — voir
[docs/05-OPEN-QUESTIONS.md](docs/05-OPEN-QUESTIONS.md).
