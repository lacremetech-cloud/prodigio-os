# CLAUDE.md — Constitution de Prodigio OS

Ce fichier est la **constitution permanente** du projet. Il s'adresse à toutes les
futures sessions Claude Code travaillant sur ce dépôt. Lis-le intégralement avant
toute action et respecte-le à la lettre. En cas de conflit entre une demande
ponctuelle et ce document, signale la contradiction avant d'agir.

> **Statut actuel du dépôt : documentation / fondations.**
> Aucune application n'est encore développée, aucune dépendance installée, aucun
> service externe configuré, aucune base de données créée. Voir le
> [README](README.md) et la [feuille de route](docs/04-ROADMAP.md).

---

## 1. Vision du produit

Prodigio n'est **pas** (à ce stade) une agence immobilière. C'est un **système
technologique et opérationnel** spécialisé dans la **commercialisation active de
biens immobiliers d'exception**.

- Le système est actuellement **porté par INDESCALE**, dans l'attente de la
  création de l'entité Prodigio.
- Les **mandats immobiliers** sont juridiquement portés par une **agence
  partenaire** disposant des autorisations nécessaires. Le premier partenaire
  envisagé est **Héritage Patrimoine**, dirigé par **Cyril Gallon**.
- Les informations juridiques et contractuelles ne sont **pas toutes validées**.
  Elles ne doivent **jamais être codées en dur** (voir §5 et
  [docs/05-OPEN-QUESTIONS.md](docs/05-OPEN-QUESTIONS.md)).

Le produit complet comprendra à terme **trois moteurs** :

1. **Moteur Mandats** — acquérir et qualifier des propriétaires vendeurs.
2. **Moteur Biens & Acquéreurs** — commercialiser le bien et trouver l'acheteur.
3. **Portail Propriétaire** — donner de la visibilité au vendeur sur la stratégie.

Détails : [docs/01-PRODUCT-VISION.md](docs/01-PRODUCT-VISION.md).

### Modèle économique (configurable, non codé en dur)

Deux segments sont actuellement envisagés à partir d'un **seuil premium**
(hypothèse de travail : 800 000 €) :

- **Cible Prodigio premium** (valeur ≥ seuil) : Prodigio pilote la stratégie
  marketing, finance les publicités d'acquisition d'acheteurs, l'agence
  partenaire réalise notamment les visites. Partage envisagé **70 % Prodigio /
  30 % partenaire**.
- **Hors cible premium** (valeur < seuil) : l'agence vend par ses canaux
  traditionnels, aucune campagne financée par Prodigio. Partage envisagé
  **40 % Prodigio / 60 % partenaire**.

> Le seuil, les pourcentages, et la base de calcul (HT / TTC — **à confirmer**)
> sont des **paramètres de configuration**, jamais des constantes du code.

---

## 2. Vocabulaire métier

Emploie ce vocabulaire de manière cohérente dans le code, les commentaires, la
base de données et l'interface.

| Terme | Définition |
|---|---|
| **Organisation** | Entité (Prodigio, agence partenaire…). L'architecture est multi-organisations. |
| **Utilisateur** | Personne disposant d'un accès à Prodigio OS, rattachée à une organisation avec un rôle. |
| **Personne / Contact** | Un individu du monde réel (typiquement un propriétaire vendeur). **Objet distinct** de l'opportunité. |
| **Opportunité de mandat** | Le projet de vente d'un bien par une personne. Une personne peut porter plusieurs opportunités. |
| **Bien candidat** | Le bien immobilier rattaché à une opportunité, avant signature du mandat. |
| **Source / Attribution** | Origine publicitaire ou marketing d'un lead (campagne, canal, contenu). |
| **Qualification** | Ensemble d'informations recueillies pour évaluer le bien et le projet. **Distincte du stade.** |
| **Stade (pipeline)** | Position commerciale de l'opportunité dans le pipeline mandat (ex. « à contacter »). |
| **Segment** | Catégorie du bien (ex. « cible Prodigio premium »). **Distinct du stade.** |
| **Setter** | Personne qui rappelle et qualifie les leads entrants. |
| **Activité** | Événement horodaté (appel, e-mail, changement de stade…). |
| **Note** | Commentaire libre rédigé par un utilisateur. |
| **Tâche** | Action à réaliser, avec échéance et responsable. |
| **Rendez-vous** | Événement planifié avec le propriétaire (physique ou visio). |
| **Consentement** | Autorisation RGPD explicite (contact, communications…) horodatée. |
| **Document** | Fichier rattaché à une personne, une opportunité ou un bien. |

### Distinctions fondamentales (à ne jamais confondre)

- **Personne ≠ Opportunité de mandat.** Deux objets différents.
- **Stade ≠ Segment.** Le stade est la progression commerciale ; le segment est
  la catégorie du bien. **Un lead peut changer de stade sans changer de
  segment**, et inversement.
- **Qualification ≠ Pipeline.** Ne mélange jamais les champs de qualification
  avec les stades du pipeline.

Modèle conceptuel complet : [docs/03-DOMAIN-MODEL.md](docs/03-DOMAIN-MODEL.md).

---

## 3. Règles d'architecture

- **Une base de données centrale (PostgreSQL) est l'unique source de vérité.**
- **Systeme.io et Google Sheets ne sont PAS le CRM.** Google Sheets pourra
  seulement servir d'**export secondaire**.
- Application web **unique** sous **Next.js (App Router)** en **TypeScript
  strict**.
- Architecture en **monolithe modulaire** : modules métier clairement séparés
  (mandats, biens & acquéreurs, portail), sans microservices tant que ce n'est
  pas justifié. **Ne pas surdimensionner.**
- **PostgreSQL** comme base ; **Supabase** envisagé pour base, authentification
  et stockage.
- **Vercel** pour l'hébergement et les previews.
- Validation des données avec **Zod** (ou équivalent) à toutes les frontières
  (formulaires, API, webhooks).
- **Design system** fondé sur des **variables CSS** et des composants
  **accessibles**.
- **Permissions par rôle et organisation** partout où une donnée est lue ou
  écrite.
- **Journal d'activité** : chaque changement significatif doit être **retraçable**.
- **Migrations de base de données versionnées**.
- **Multi-organisations dès la conception**, même si le MVP n'utilise qu'un
  partenaire. Architecture **prête mais non surdimensionnée**.
- **Internationalisation préparée** : interface **française** au lancement, mais
  textes externalisés et structure prête pour d'autres langues.
- Aucun **numéro de version** figé dans la documentation : utiliser
  « dernière version stable au moment de l'installation ».

Décision technique formalisée :
[docs/adr/001-TECHNICAL-FOUNDATION.md](docs/adr/001-TECHNICAL-FOUNDATION.md).

---

## 4. Règles de sécurité

- **Aucun secret dans le dépôt.** Clés, jetons, mots de passe et identifiants
  passent exclusivement par des variables d'environnement / gestionnaires de
  secrets. Un fichier `.env.example` documentera les variables attendues (sans
  valeurs réelles).
- **Environnements séparés** : développement, preview et production, avec des
  secrets distincts.
- **Contrôle d'accès systématique** par rôle et organisation. Ne jamais exposer
  les données d'une organisation à une autre.
- **RGPD** : les données personnelles et les consentements sont traités selon les
  principes du RGPD (base légale, minimisation, consentement horodaté, droit à
  l'effacement, durée de conservation — voir les questions ouvertes).
- **Validation et assainissement** de toute entrée externe (funnel, webhooks,
  imports).
- **Principe du moindre privilège** pour les accès techniques et humains.

---

## 5. Qualité attendue

- **TypeScript strict**, sans `any` implicite.
- **Validation Zod** systématique aux frontières.
- **Tests** : tests unitaires sur la logique métier et **tests des parcours
  critiques** (funnel → lead → CRM → rendez-vous).
- Code **lisible**, cohérent avec le style environnant, sans jargon inutile.
- **Cohérence documentaire** : toute évolution du modèle ou du périmètre doit
  être répercutée dans les documents `docs/`.
- **Accessibilité** des composants d'interface (sémantique, contrastes, clavier).

---

## 6. Processus de développement

1. Lire ce fichier et les documents `docs/` pertinents avant toute tâche.
2. Toujours partir du **modèle de domaine** documenté ; ne pas improviser de
   nouveaux objets sans mettre à jour [docs/03-DOMAIN-MODEL.md](docs/03-DOMAIN-MODEL.md).
3. Suivre la **feuille de route** ([docs/04-ROADMAP.md](docs/04-ROADMAP.md)) : la
   priorité MVP est une **tranche verticale Mandats** (voir
   [docs/02-MVP-SCOPE.md](docs/02-MVP-SCOPE.md)).
4. Développer sur des branches dédiées, avec des commits clairs et descriptifs.
5. Ajouter/mettre à jour les **migrations versionnées** pour tout changement de
   schéma.
6. Écrire ou mettre à jour les **tests** correspondants.
7. Mettre à jour la documentation impactée dans le même changement.
8. Ne rien coder en dur qui relève d'un **paramètre configurable** (seuils,
   partages, base HT/TTC).

---

## 7. Interdictions importantes

- ❌ **Ne pas** coder en dur le seuil premium, les partages économiques, ou la
  base HT/TTC.
- ❌ **Ne pas** traiter Systeme.io ou Google Sheets comme la source de vérité.
- ❌ **Ne pas** mélanger stade et segment, ni personne et opportunité.
- ❌ **Ne pas** committer de secrets.
- ❌ **Ne pas** inventer d'obligations juridiques ou de faits contractuels non
  validés.
- ❌ **Ne pas** surdimensionner l'architecture (pas de microservices, pas
  d'abstractions prématurées).
- ❌ **Ne pas** figer de numéros de version dans la documentation.
- ❌ **Ne pas** réutiliser l'architecture HTML / Systeme.io / Google Sheets du
  projet Chalet Mitja comme fondation technique (référence **visuelle et
  éditoriale** uniquement).

---

## 8. Commandes de validation

> À compléter une fois le projet initialisé. Aucun outil n'est installé à ce
> stade — n'exécute pas ces commandes tant que le projet n'existe pas.

```
# Installation des dépendances
# TODO: à définir (ex. installation via le gestionnaire de paquets retenu)

# Lint
# TODO: à définir

# Vérification des types (TypeScript strict)
# TODO: à définir

# Tests unitaires
# TODO: à définir

# Tests de parcours critiques
# TODO: à définir

# Build
# TODO: à définir
```

Lorsque le projet sera initialisé, remplace chaque `TODO` par la commande réelle
et supprime cet avertissement.
