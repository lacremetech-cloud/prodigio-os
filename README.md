# Prodigio OS

Système technologique et opérationnel dédié à la **commercialisation active de
biens immobiliers d'exception** — acquisition et qualification de propriétaires
vendeurs, commercialisation des biens et acquisition d'acheteurs, avec les
mandats portés par une agence partenaire habilitée.

## Statut actuel

**Première tranche verticale livrée : capture des demandes de mandat.**
Parcours public complet — publicité → **landing propriétaire** (`/proprietaire`)
→ présentation vidéo (emplacement VSL) → **analyse confidentielle d'éligibilité**
(`/proprietaire/analyse`) → **soumission Supabase** → confirmation.

Le socle (Next.js App Router, TypeScript strict, Tailwind CSS, ESLint, Vitest,
Zod) reste en place. Le **CRM**, l'**authentification** et les autres modules
métier ne sont **pas** encore développés (voir
[docs/02-MVP-SCOPE.md](docs/02-MVP-SCOPE.md)).

**Supabase est intégré et la migration est DÉPLOYÉE** sur le projet `prodigio-os`
(clients navigateur/serveur, clé publiable uniquement ; migration versionnée
`supabase/migrations/`). Le funnel est **fonctionnel de bout en bout** : une
soumission réelle crée FunnelSubmission + Contact + Opportunity +
OpportunityContact + PrivacyRecord et affiche la confirmation. Sécurité vérifiée
en base (RLS active, aucune lecture publique, réponse neutre `{ accepted: true }`,
idempotence). Voir [docs/07-SUPABASE-SETUP.md](docs/07-SUPABASE-SETUP.md).
**Vercel** n'est pas connecté. **Cloudflare Turnstile** (anti-abus) et la
**validation juridique RGPD** restent des **prérequis de production non
terminés**.

## Prérequis

- **Node.js** : version indiquée dans [`.nvmrc`](.nvmrc) (`nvm use`).
- **npm** (gestionnaire de paquets du projet ; dépendances verrouillées dans
  `package-lock.json`).

## Installation

```bash
npm install
cp .env.example .env.local   # renseignez les variables Supabase pour activer le dépôt
```

L'application démarre **sans** variable. Pour activer le dépôt réel des demandes,
renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(clé **publiable** uniquement — jamais `service_role`), puis appliquez la
migration : voir [docs/07-SUPABASE-SETUP.md](docs/07-SUPABASE-SETUP.md).

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
  app/
    proprietaire/     # landing propriétaire + /analyse (parcours public)
    api/health/       # sonde de disponibilité
  components/
    ui/               # primitives d'interface accessibles (CTA, reveal…)
    mandate/          # sections landing + expérience d'analyse immersive
  config/             # validation de configuration (Zod), extensible
  lib/
    media.ts          # manifeste des visuels (dimensions, alt, crédits)
    supabase/         # clients Supabase (navigateur / serveur) + types
  modules/
    mandates/funnel/  # domaine capture : schémas Zod, normalisation,
                      # attribution, idempotence, payload, action serveur
    shared/           # éléments partagés entre modules
public/images/mandate/ # visuels premium optimisés (WebP)
supabase/migrations/   # migrations SQL versionnées
docs/                  # documentation fondatrice (voir ci-dessous)
```

Design system : variables CSS (palette ivoire / noir bois / or vieilli, fond
onyx immersif, espacements, rayons, transitions) dans `src/app/globals.css` ;
polices auto-hébergées via `next/font` — **Cormorant Garamond** (titres
éditoriaux), **Cinzel** (signature/intertitres capitales), **Josefin Sans**
(textes et interface).

## Documentation fondatrice

- [CLAUDE.md](CLAUDE.md) — Constitution permanente du projet.
- [docs/01-PRODUCT-VISION.md](docs/01-PRODUCT-VISION.md) — Vision produit.
- [docs/02-MVP-SCOPE.md](docs/02-MVP-SCOPE.md) — Périmètre du MVP.
- [docs/03-DOMAIN-MODEL.md](docs/03-DOMAIN-MODEL.md) — Modèle de domaine.
- [docs/04-ROADMAP.md](docs/04-ROADMAP.md) — Feuille de route.
- [docs/05-OPEN-QUESTIONS.md](docs/05-OPEN-QUESTIONS.md) — Questions ouvertes.
- [docs/06-ACCESS-MODEL.md](docs/06-ACCESS-MODEL.md) — Modèle d'accès (rôles,
  organisations, frontières).
- [docs/07-SUPABASE-SETUP.md](docs/07-SUPABASE-SETUP.md) — Application de la
  migration, variables, RLS, prérequis de production.
- [docs/08-MEDIA-CREDITS.md](docs/08-MEDIA-CREDITS.md) — Crédits et licences des
  photographies (sélection éditoriale provisoire).
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
