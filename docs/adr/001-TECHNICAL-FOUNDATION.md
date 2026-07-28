# ADR 001 — Fondation technique

- **Statut** : Provisoire (accepté à titre de décision fondatrice, révisable).
- **Date** : hypothèse fondatrice — voir historique Git pour la date effective.
- **Portée** : orientation technique du projet Prodigio OS avant tout
  développement.

> Cette ADR **documente une orientation**. Aucun outil n'est installé, aucune
> version n'est figée : utiliser « dernière version stable au moment de
> l'installation ».

## Contexte

Prodigio OS est un système technologique et opérationnel pour la
commercialisation active de biens d'exception (voir
[../01-PRODUCT-VISION.md](../01-PRODUCT-VISION.md)). Le projet démarre par une
**tranche verticale Mandats** (voir [../02-MVP-SCOPE.md](../02-MVP-SCOPE.md)),
avec une base de données centrale comme **unique source de vérité**. Le précédent
projet (Chalet Mitja / Le Cambre d'Aze) sert de **référence visuelle et
éditoriale uniquement** ; son architecture HTML / Systeme.io / Google Sheets **ne
doit pas** servir de fondation technique.

## Décision

1. **Nouveau dépôt indépendant** (`prodigio-os`), sans héritage technique du
   projet précédent.
2. **Architecture en monolithe modulaire** : une seule application, des modules
   métier clairement séparés (mandats, biens & acquéreurs, portail). Pas de
   microservices tant que ce n'est pas justifié.
3. **Application web unique** sous **Next.js (App Router)** en **TypeScript
   strict**.
4. **PostgreSQL** comme base de données ; **Supabase** envisagé pour la base,
   l'authentification et le stockage.
5. **Vercel** pour l'hébergement et les previews.
6. **Architecture multi-organisations prête** dès la conception, **mais non
   surdimensionnée** (le MVP n'exploite qu'un partenaire).
7. **Validation** des données avec **Zod** (ou équivalent).
8. **Design system** fondé sur des **variables CSS** et des composants
   **accessibles**.
9. **Permissions** par rôle et organisation ; **journal d'activité** ;
   **migrations versionnées**.
10. **Environnements séparés** dev / preview / production ; **secrets hors
    dépôt**.
11. Aucune **version** figée : « dernière version stable au moment de
    l'installation ».

## Raisons du choix

- **Monolithe modulaire** : simplicité opérationnelle et vélocité pour un MVP,
  tout en gardant des frontières de modules qui permettront d'extraire des
  services plus tard si nécessaire. Évite la sur-ingénierie.
- **Next.js + TypeScript strict** : un seul socle pour les landings immersives
  (funnel, VSL, brochure) et l'application interne (CRM), avec typage fort pour
  la fiabilité.
- **PostgreSQL / Supabase** : base relationnelle robuste adaptée à un modèle de
  domaine relationnel (personnes, opportunités, activités…) ; Supabase apporte
  base + auth + stockage cohérents, réduisant le nombre de services à câbler pour
  le MVP.
- **Vercel** : previews par branche et déploiement natif de Next.js, alignés sur
  la séparation dev/preview/prod.
- **Multi-organisations prête** : le modèle prévoit plusieurs partenaires ; poser
  la frontière d'organisation tôt évite une refonte, sans complexité inutile
  côté MVP.
- **Zod, variables CSS, permissions, journal, migrations** : garanties de
  qualité, de sécurité et de traçabilité exigées par la constitution
  ([../../CLAUDE.md](../../CLAUDE.md)).

## Alternatives non retenues

- **Microservices dès le départ** : complexité et coût d'exploitation
  injustifiés pour un MVP ; contraires au principe « ne pas surdimensionner ».
- **Poursuivre sur Systeme.io + Google Sheets** : ne peuvent pas être la source
  de vérité ; verrouillage, absence de modèle relationnel et de traçabilité.
  Google Sheets reste au mieux un **export secondaire**.
- **Back-end séparé + SPA** (deux dépôts/app distincts) : surcoût
  d'intégration ; Next.js couvre front et back dans un seul socle pour ce
  périmètre.
- **Autre base (NoSQL)** : le domaine est fortement relationnel ; une base
  documentaire compliquerait l'intégrité et les requêtes transverses.
- **Figer des versions d'outils** : contraire à la règle « dernière version
  stable au moment de l'installation ».

## Risques et conditions de réévaluation

**Risques**
- Dépendance à un fournisseur (Supabase / Vercel) — verrouillage potentiel.
- Un monolithe mal modularisé pourrait se rigidifier.
- Choix d'outils non encore éprouvés dans le contexte Prodigio.
- Évolution du modèle de domaine pouvant impacter le schéma.

**Conditions de réévaluation** (déclencheurs de révision de cette ADR)
- Contraintes juridiques/contractuelles validées incompatibles avec
  l'architecture (voir [../05-OPEN-QUESTIONS.md](../05-OPEN-QUESTIONS.md)).
- Passage à un usage **multi-partenaires réel** exigeant plus de cloisonnement.
- Limites de performance, de coût ou de conformité rencontrées avec Supabase /
  Vercel.
- Besoin avéré d'extraire un module en service séparé.

Toute réévaluation donnera lieu à une **nouvelle ADR** référençant celle-ci.
