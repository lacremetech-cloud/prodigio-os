# Prodigio OS

Système technologique et opérationnel dédié à la **commercialisation active de
biens immobiliers d'exception** — acquisition et qualification de propriétaires
vendeurs, commercialisation des biens et acquisition d'acheteurs, avec les
mandats portés par une agence partenaire habilitée.

## Statut actuel

**Tranches verticales livrées : (1) capture des demandes de mandat, (2) CRM
interne Mandats V1, (3) alerte Slack « Nouvelle demande de mandat », (4) page
d'accueil publique.**

**Page d'accueil publique** (`/`) — porte d'entrée premium et courte vers
l'écosystème : signature cinématographique, positionnement en points courts,
puis aiguillage « Choisissez votre accès » (propriétaire / espace sécurisé).
Elle ne duplique pas la landing et n'expose aucune route interne. Voir
[docs/11-PUBLIC-HOME.md](docs/11-PUBLIC-HOME.md).

Parcours public complet — publicité → **accueil** (`/`) ou **landing
propriétaire** (`/proprietaire`) → présentation vidéo (emplacement VSL) →
**analyse confidentielle d'éligibilité** (`/proprietaire/analyse`) →
**soumission Supabase** → confirmation.

**CRM interne** (authentifié, `/connexion` + `/crm/*`) : les données du funnel
deviennent réellement exploitables par l'équipe — vue d'ensemble (indicateurs +
priorités du jour), boîte de réception filtrable, pipeline Kanban, fiche complète
d'un dossier, tâches et setting (affectation, activités, prochaines actions,
stade, segment, résultat commercial). Sécurisé par **Supabase Auth + RLS** ;
écritures via fonctions `SECURITY DEFINER` auditées ; **aucune** clé
`service_role` côté navigateur ni dans le dépôt. Guide :
[docs/09-CRM-GUIDE.md](docs/09-CRM-GUIDE.md).

Le socle (Next.js App Router, TypeScript strict, Tailwind CSS, ESLint, Vitest,
Zod) reste en place. Le **portail propriétaire**, le **CRM Acquéreurs** et les
autres modules métier ne sont **pas** encore développés (voir
[docs/02-MVP-SCOPE.md](docs/02-MVP-SCOPE.md)).

**Supabase est intégré et la migration est DÉPLOYÉE** sur le projet `prodigio-os`
(clients navigateur/serveur, clé publiable uniquement ; migration versionnée
`supabase/migrations/`). Le funnel est **fonctionnel de bout en bout** : une
soumission réelle crée FunnelSubmission + Contact + Opportunity +
OpportunityContact + PrivacyRecord et affiche la confirmation. Sécurité vérifiée
en base (RLS active, aucune lecture publique, réponse neutre `{ accepted: true }`,
idempotence). Voir [docs/07-SUPABASE-SETUP.md](docs/07-SUPABASE-SETUP.md).
**Vercel** n'est pas connecté. **Cloudflare Turnstile** (anti-abus) est
**implémenté** : le dépôt Supabase n'a lieu que si le jeton est **vérifié côté
serveur** (siteverify) — il reste à fournir de **vraies clés** en preview / prod
(voir [docs/07 §8](docs/07-SUPABASE-SETUP.md)). La **validation juridique RGPD**
reste un **prérequis de production non terminé**.

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
  middleware.ts       # protège /crm/* + rafraîchit la session (Supabase Auth)
  app/
    page.tsx          # accueil public premium (/) — aiguillage vers les parcours
    proprietaire/     # landing propriétaire + /analyse (parcours public)
    connexion/        # page de connexion interne
    crm/              # CRM interne : vue d'ensemble, mandats, pipeline, fiche, tâches
    api/health/       # sonde de disponibilité
  components/
    ui/               # primitives d'interface accessibles (CTA, reveal…)
    home/             # sections de la page d'accueil publique (hero, positionnement, accès)
    mandate/          # sections landing + expérience d'analyse immersive
    crm/              # interface CRM (shell, listes, fiche, actions)
  config/             # validation de configuration (Zod), extensible
  lib/
    media.ts          # manifeste des visuels (dimensions, alt, crédits)
    supabase/         # clients Supabase (navigateur / serveur / middleware) + types
  modules/
    mandates/funnel/  # domaine capture : schémas Zod, normalisation,
                      # attribution, idempotence, payload, action serveur
    crm/              # domaine CRM : auth/rôles, données, mutations, leads, timeline
    shared/           # éléments partagés entre modules
public/images/mandate/ # visuels premium optimisés (WebP)
supabase/migrations/   # migrations SQL versionnées (funnel + CRM)
docs/                  # documentation fondatrice (voir ci-dessous)
docs/assets/crm/       # captures desktop/mobile du CRM (PII réelle masquée)
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
- [docs/07-SUPABASE-SETUP.md](docs/07-SUPABASE-SETUP.md) — Application des
  migrations (funnel + CRM), variables, RLS, prérequis de production.
- [docs/09-CRM-GUIDE.md](docs/09-CRM-GUIDE.md) — CRM interne Mandats V1 : premier
  administrateur, invitation, usage, rôles, vérification de sécurité, reports.
- [docs/10-SLACK-ALERTS.md](docs/10-SLACK-ALERTS.md) — Alerte Slack « Nouvelle
  demande de mandat » : architecture, anti-doublon, panne non bloquante, deep
  link CRM, données incluses/exclues.
- [docs/11-PUBLIC-HOME.md](docs/11-PUBLIC-HOME.md) — Page d'accueil publique
  (`/`) : rôle, structure, réutilisation du design system, attribution, SEO,
  et note sur le futur lanceur privé dans `/crm`.
- [docs/12-USERS-AND-ACCESS.md](docs/12-USERS-AND-ACCESS.md) — Utilisateurs,
  invitations, rôles et accès V1.
- [docs/13-CALENDAR-ESTIMATIONS.md](docs/13-CALENDAR-ESTIMATIONS.md) —
  Planification des estimations & Google Calendar V1 : OAuth par utilisateur,
  chiffrement des jetons, disponibilités, cohérence à deux enregistrements,
  matrice des droits, recette réelle.
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
