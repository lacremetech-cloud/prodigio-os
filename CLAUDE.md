# CLAUDE.md — Constitution de Prodigio OS

Ce fichier est la **constitution permanente** du projet. Il s'adresse à toutes les
futures sessions Claude Code travaillant sur ce dépôt. Lis-le intégralement avant
toute action et respecte-le à la lettre. En cas de conflit entre une demande
ponctuelle et ce document, signale la contradiction avant d'agir.

> **Statut actuel du dépôt : fondation technique initialisée.**
> Le socle applicatif (Next.js App Router, TypeScript strict, Tailwind, ESLint,
> Vitest, Zod) est en place et validé (`lint`, `typecheck`, `test:run`, `build`).
> **Aucun service externe n'est encore connecté** : ni Supabase (base, auth,
> stockage), ni Vercel (hébergement). Le funnel Mandats et le CRM ne sont pas
> développés. Voir le [README](README.md) et la
> [feuille de route](docs/04-ROADMAP.md).

---

## 1. Vision du produit

Prodigio n'est **pas** (à ce stade) une agence immobilière. C'est un **système
technologique et opérationnel** spécialisé dans la **commercialisation active de
biens immobiliers d'exception**.

- **INDESCALE** porte actuellement le **développement et l'exploitation** du
  système Prodigio, dans l'attente de la création de l'entité Prodigio.
  **INDESCALE ne porte pas les mandats immobiliers.**
- Les **mandats immobiliers** sont juridiquement portés par une **entité
  immobilière habilitée**, **à confirmer contractuellement**. Le premier
  partenaire envisagé est **Héritage Patrimoine**, dirigé par **Cyril Gallon**,
  sous réserve de validation de son entité exacte et de ses habilitations.
- Les informations juridiques et contractuelles ne sont **pas toutes validées**.
  Elles ne doivent **jamais être codées en dur**, et **aucune conformité
  juridique ne doit être présumée** (voir §5 et
  [docs/05-OPEN-QUESTIONS.md](docs/05-OPEN-QUESTIONS.md)).

Le produit complet comprendra à terme **trois moteurs** :

1. **Moteur Mandats** — acquérir et qualifier des propriétaires vendeurs, et
   suivre le dossier **jusqu'au résultat du mandat** (signé, refusé ou perdu).
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
> sont des **paramètres de configuration versionnés**, jamais des constantes du
> code. Les règles économiques sont **par partenaire et par segment**, avec
> **date d'entrée en vigueur** et **historique** ; le **Mandat** conserve une
> **photographie** des conditions applicables à la signature. Un changement de
> règle **ne réinterprète pas** les anciens dossiers.
>
> ⚠️ Deux bases **distinctes** à ne jamais confondre : la **base du seuil de
> valeur du bien** (estimation / prix de mandat / prix de vente) et la **base
> HT/TTC des honoraires** servant au partage économique. Ne jamais associer
> automatiquement HT/TTC à la valeur immobilière du bien.

---

## 2. Vocabulaire métier

Emploie ce vocabulaire de manière cohérente dans le code, les commentaires, la
base de données et l'interface.

| Terme | Définition |
|---|---|
| **Organisation** | Entité **interne** au fonctionnement de Prodigio OS (Prodigio, agence partenaire). Architecture multi-organisations. **≠ Contact.** |
| **Utilisateur** | Compte **authentifié** opérant Prodigio OS, rattaché à une ou plusieurs organisations via un membership porteur d'un rôle. **≠ Contact.** |
| **OrganizationMembership** | Relation utilisateur ↔ organisation, avec rôle. |
| **Contact** | Partie **externe** : **personne physique ou personne morale** (SCI, indivision représentée…). **Distinct** d'une Organisation interne et d'un Utilisateur. |
| **Opportunité de mandat** | Le projet de vente d'un bien. Peut réunir **plusieurs contacts** ; un contact peut porter plusieurs opportunités. |
| **OpportunityContact** | Relation N-N opportunité ↔ contact, avec rôle (propriétaire, copropriétaire, conjoint, représentant, intermédiaire, décisionnaire) et un **contact principal**. |
| **OpportunityOrganization** | Organisations participant à un dossier, avec fonction (opérateur Prodigio, agence porteuse du mandat, partenaire commercial). |
| **OpportunityAssignment** | Utilisateurs affectés à un dossier, avec responsabilité (setter, manager, agent immobilier, responsable marketing). |
| **Mandat** | **Proposition puis contrat** de mandat (statut : brouillon / proposé / en attente de signature / signé / refusé / expiré ou annulé). Document signé et date de signature obligatoires **uniquement si `signé`** ; snapshot économique obligatoire **dès `proposé`**. **Distinct de l'opportunité et du résultat commercial.** |
| **OpportunityOutcome** | **Résultat commercial de l'opportunité** : `signé/gagné` / `refusé après proposition` / `perdu ou disqualifié avant signature`. La raison de perte appartient **principalement à l'opportunité**. |
| **Lead** | Une **soumission entrante** et le **dossier commercial** qui en résulte. **Pas nécessairement une table unique.** |
| **FunnelSubmission** | La **soumission originale** du funnel, **conservée telle quelle** (idempotence, UTM, source/campagne/annonce, `fbclid`, referrer, réponses brutes + normalisées, preuves d'information). |
| **Bien candidat** | Le bien immobilier rattaché à une opportunité, avant signature du mandat. |
| **Source / Attribution** | Modèle **multi-points de contact** (premier/dernier contact, campagne, ad set, annonce, contenu), rattaché à la soumission ; historique conservé. |
| **Qualification** | Informations recueillies pour évaluer le bien et le projet. **Distincte du stade et du segment.** |
| **Stade (pipeline)** | Position commerciale de l'opportunité (ex. « qualification en cours »). |
| **Segment** | Catégorie du bien (ex. « cible Prodigio premium »). **Distinct du stade.** |
| **Décision de segment** | Segment **recommandé** par les règles puis **validé** par un humain (raison, auteur, date, dérogation tracée). |
| **Setter** | Personne qui rappelle et qualifie les leads entrants. |
| **Activité (métier)** | Interaction commerciale horodatée (appel, tentative, e-mail, SMS/WhatsApp, RDV, commentaire, résultat). **N'est PAS le journal d'audit.** |
| **AuditEvent** | Événement technique **non modifiable** par les utilisateurs ordinaires (création, changement de stade/segment/affectation/permission, ancienne/nouvelle valeur). |
| **Note** | Commentaire libre rédigé par un utilisateur. |
| **Tâche** | Action à réaliser (prochaine action), avec échéance et responsable. |
| **Rendez-vous** | Événement planifié avec le(s) contact(s), avec un **résultat**. |
| **PrivacyRecord / ConsentRecord** | Traçabilité RGPD (finalité, base légale, notice, responsables, destinataires, canal autorisé, choix accordé/refusé/retiré, preuve, « ne plus contacter »). **Ne présume pas** la conformité. |
| **EconomicRuleSet** | Règles économiques **versionnées** (par partenaire/segment, date d'entrée en vigueur, historique). |
| **Document** | Fichier rattaché à un contact, une opportunité, un bien ou un mandat. |

### Distinctions fondamentales (à ne jamais confondre)

- **Contact ≠ Opportunité de mandat.** Deux objets différents ; une opportunité
  peut réunir plusieurs contacts, un contact peut porter plusieurs opportunités.
- **Opportunité ≠ Mandat ≠ Résultat commercial.** L'opportunité est le dossier
  commercial ; le **Mandat** est la proposition puis le contrat de mandat ; le
  **résultat commercial** (`OpportunityOutcome`) est l'issue du dossier
  (gagné / refusé après proposition / perdu avant signature). Une opportunité
  perdue **avant toute proposition** peut n'avoir **aucun Mandat**. L'expression
  métier « résultat du mandat » reste possible côté parcours utilisateur.
- **Contact ≠ Organisation ≠ Utilisateur.** Contact = partie externe ;
  Organisation = entité interne ; Utilisateur = compte authentifié.
- **Stade ≠ Segment.** Le stade est la progression commerciale ; le segment est
  la catégorie du bien. **Un lead peut changer de stade sans changer de
  segment**, et inversement.
- **Qualification ≠ Pipeline.** Ne mélange jamais les champs de qualification
  avec les stades du pipeline.
- **Activité métier ≠ AuditEvent.** L'activité trace les interactions
  commerciales ; l'AuditEvent trace les changements techniques sensibles. Une
  **tentative de contact** est une **activité répétable**, pas un stade.
- **FunnelSubmission ≠ Contact / Opportunité.** La soumission originale est
  conservée telle quelle ; elle n'est jamais remplacée par la seule création du
  contact ou de l'opportunité.

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
- **PostgreSQL** comme base ; **Supabase retenu pour le MVP** (base,
  authentification et stockage), réévaluable selon les déclencheurs documentés.
- **Vercel retenu pour le MVP** (hébergement et previews), réévaluable selon les
  déclencheurs documentés.
- Validation des données avec **Zod** (ou équivalent) à toutes les frontières
  (formulaires, API, webhooks).
- **Design system** fondé sur des **variables CSS** et des composants
  **accessibles**.
- **Permissions par rôle et organisation** partout où une donnée est lue ou
  écrite. Une opportunité peut réunir **plusieurs organisations** (opérateur
  Prodigio + agence porteuse) et **plusieurs contacts** — voir
  [docs/06-ACCESS-MODEL.md](docs/06-ACCESS-MODEL.md).
- **Journal d'audit (AuditEvent)** : chaque changement significatif doit être
  **retraçable** dans un journal **non modifiable** par les utilisateurs
  ordinaires, **distinct** des activités métier.
- **Règles économiques versionnées** : par partenaire et segment, avec date
  d'entrée en vigueur et snapshot à la signature du mandat.
- **Migrations de base de données versionnées**.
- **Multi-organisations dès la conception**, même si le MVP n'utilise qu'un
  partenaire. Architecture **prête mais non surdimensionnée**.
- **Internationalisation préparée** : interface **française** au lancement, mais
  textes externalisés et structure prête pour d'autres langues.
- **Gestion des versions de dépendances** : sélectionner des versions stables et
  compatibles au moment de l'initialisation ; **verrouiller** les dépendances
  (`package.json` + lockfile) ; documenter les versions majeures réellement
  testées (ADR/doc technique) ; **jamais de dépendances flottantes en
  production** ; toute mise à niveau majeure doit être **volontaire, testée et
  documentée**. (La documentation **peut** indiquer des versions ; ce qui est
  interdit, c'est la dépendance flottante non maîtrisée.)

Décision technique formalisée :
[docs/adr/001-TECHNICAL-FOUNDATION.md](docs/adr/001-TECHNICAL-FOUNDATION.md).
Modèle d'accès : [docs/06-ACCESS-MODEL.md](docs/06-ACCESS-MODEL.md).

---

## 4. Règles de sécurité

- **Aucun secret dans le dépôt.** Clés, jetons, mots de passe et identifiants
  passent exclusivement par des variables d'environnement / gestionnaires de
  secrets. Un fichier `.env.example` documentera les variables attendues (sans
  valeurs réelles).
- **Environnements séparés** : développement, preview et production, avec des
  secrets distincts.
- **Contrôle d'accès systématique** par rôle et organisation. Les données
  **propres et non partagées** d'une organisation restent **cloisonnées** ;
  seules les données d'un **dossier explicitement partagé** via
  `OpportunityOrganization` deviennent accessibles à l'autre organisation, selon
  sa **fonction**, son **rôle** et l'**affectation**. Le partage d'un dossier ne
  donne **jamais** accès aux autres dossiers ni aux données internes de
  l'organisation (voir [docs/06-ACCESS-MODEL.md](docs/06-ACCESS-MODEL.md)).
- **RGPD** : les données personnelles sont traitées selon les principes du RGPD
  (base légale, minimisation, information, droit à l'effacement, durée de
  conservation). La traçabilité passe par un modèle **PrivacyRecord /
  ConsentRecord** (finalité, base légale retenue, version de notice, responsables,
  destinataires, canal autorisé, choix accordé/refusé/retiré, preuve). **Tout
  traitement n'équivaut pas à un consentement explicite**, et **conserver une
  preuve ne suffit pas à garantir la conformité** : une **validation juridique
  est requise avant mise en production** (voir
  [docs/05-OPEN-QUESTIONS.md](docs/05-OPEN-QUESTIONS.md)).
- **Validation et assainissement** de toute entrée externe (funnel, webhooks,
  imports).
- **Principe du moindre privilège** pour les accès techniques et humains.

---

## 5. Qualité attendue

- **TypeScript strict**, sans `any` implicite.
- **Validation Zod** systématique aux frontières.
- **Tests** : tests unitaires sur la logique métier et **tests des parcours
  critiques** : funnel → soumission → résolution contact/opportunité → setting →
  qualification → rendez-vous → estimation → segmentation → proposition →
  résultat commercial signé/refusé/perdu.
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
- ❌ **Ne pas** mélanger stade et segment, ni contact et opportunité.
- ❌ **Ne pas** committer de secrets.
- ❌ **Ne pas** inventer d'obligations juridiques ou de faits contractuels non
  validés.
- ❌ **Ne pas** surdimensionner l'architecture (pas de microservices, pas
  d'abstractions prématurées).
- ❌ **Ne pas** utiliser de **dépendances flottantes** en production (verrouiller
  les versions ; documenter les majeures testées ; mises à niveau majeures
  volontaires et testées).
- ❌ **Ne pas** confondre **Activité métier** et **AuditEvent**, ni **Contact**,
  **Organisation** et **Utilisateur**, ni **Opportunité** et **Mandat**.
- ❌ **Ne pas** imposer un **propriétaire unique** par opportunité, ni rattacher
  une opportunité à une **organisation unique exclusive**.
- ❌ **Ne pas** supprimer une **FunnelSubmission** au seul motif qu'elle est un
  **doublon**, ni écraser l'historique d'attribution. (Une suppression /
  anonymisation reste possible selon les **règles de rétention**, une
  **obligation légale** ou une **demande recevable**, et doit être **tracée** ;
  ne pas affirmer une conservation **indéfinie**.)
- ❌ **Ne pas** affirmer une **conformité RGPD automatique** ni présumer qu'une
  preuve conservée suffit.
- ❌ **Ne pas** associer automatiquement la notion **HT/TTC des honoraires** à la
  **valeur immobilière** du bien.
- ❌ **Ne pas** réutiliser l'architecture HTML / Systeme.io / Google Sheets du
  projet Chalet Mitja comme fondation technique (référence **visuelle et
  éditoriale** uniquement).

---

## 8. Commandes de validation

> Gestionnaire de paquets : **npm**. Version Node : voir `.nvmrc`. Ces commandes
> doivent toutes passer avant de terminer une tâche touchant au code.

```bash
# Installation des dépendances (versions verrouillées par package-lock.json)
npm install

# Lint
npm run lint

# Vérification des types (TypeScript strict)
npm run typecheck

# Tests unitaires
npm run test:run        # exécution unique (CI)
npm run test            # mode watch (développement)

# Build de production
npm run build

# Serveur de développement
npm run dev
```

> **Tests de parcours critiques** : le parcours cible est funnel → soumission →
> résolution contact/opportunité → setting → qualification → rendez-vous →
> estimation → segmentation → proposition → résultat commercial signé/refusé/
> perdu. Ces tests seront ajoutés au fur et à mesure du développement du moteur
> Mandats (aucun parcours n'est encore implémenté à ce stade).
