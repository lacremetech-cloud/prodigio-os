# 03 — Modèle de domaine (conceptuel)

Modèle **conceptuel**, sans SQL ni choix d'implémentation. Il définit les objets
métier, leurs attributs principaux et leurs relations. Le schéma de base de
données concret et les migrations viendront lors de la phase Fondations.

> **Principe directeur** : la base de données centrale est l'**unique source de
> vérité**. Systeme.io et Google Sheets ne sont pas le CRM.

> **Convention de lecture.** Pour chaque objet, la **décision MVP** fixe la
> cardinalité et les relations retenues maintenant ; les **extensions futures**
> signalent l'évolution prévue. Aucune relation n'est laissée sous forme
> ambiguë (« N-N ou rôle principal », « et/ou »).

---

## Distinctions fondamentales

- **Stade ≠ Segment.** Le **Stade** décrit la **progression commerciale** de
  l'opportunité dans le pipeline (ex. « qualification en cours »). Le **Segment**
  décrit la **catégorie du bien** au regard du modèle Prodigio (ex. « cible
  Prodigio premium »). **Un lead peut changer de stade sans changer de segment**,
  et inversement. Deux dimensions **indépendantes**.
- **Personne / Contact ≠ Opportunité de mandat.** Un contact du monde réel peut
  porter plusieurs opportunités ; l'opportunité est le projet de vente. Une
  opportunité peut réunir **plusieurs contacts**.
- **Opportunité de mandat ≠ Mandat.** L'opportunité est le *dossier commercial* ;
  le **Mandat** est l'*acte contractuel* qui en résulte (signé, refusé ou perdu).
- **Contact ≠ Organisation ≠ Utilisateur.** Un **Contact** est une partie
  externe (personne physique ou morale) ; une **Organisation** est une entité
  interne au fonctionnement de Prodigio OS (Prodigio, agence partenaire) ; un
  **Utilisateur** est un compte authentifié opérant le système.
- **Activité métier ≠ AuditEvent.** L'**Activité** trace les interactions
  commerciales (appel, e-mail, rendez-vous…) ; l'**AuditEvent** trace les
  changements techniques sensibles (création, changement de stade, d'affectation,
  de permission…) et n'est **pas** modifiable par les utilisateurs ordinaires.
  L'Activité n'est **pas** l'unique journal d'audit.

---

## Objets

### Organisation
Entité **interne** au fonctionnement de Prodigio OS (Prodigio, agence
partenaire). **Ce n'est pas un contact externe.**
- Nom, type (opérateur Prodigio / agence partenaire), statut.
- **Multi-organisations dès la conception.** Le MVP n'exploite qu'un partenaire,
  mais rien n'est mono-organisation en dur.
- Frontière de cloisonnement des données et des permissions.
- **Décision MVP** : plusieurs organisations existent ; une opportunité peut en
  réunir plusieurs (voir **OpportunityOrganization**).

### Utilisateur
Compte **authentifié** opérant Prodigio OS.
- Identité, e-mail, statut.
- Rattaché à une ou plusieurs organisations via **OrganizationMembership**.
- **≠ Contact** (un utilisateur opère le système ; un contact est une partie
  externe).
- **Décision MVP** : un utilisateur appartient à **au moins une** organisation.
  **Extension future** : appartenance à plusieurs organisations si nécessaire.

### OrganizationMembership
Relation **Utilisateur ↔ Organisation**, porteuse d'un **rôle**.
- Utilisateur, organisation, rôle (voir la matrice dans
  [06-ACCESS-MODEL.md](06-ACCESS-MODEL.md)), statut, dates.
- **Décision MVP** : relation N-N explicite ; en pratique un utilisateur a un
  seul membership actif au lancement, mais le modèle en autorise plusieurs.

### Contact
Partie **externe** au projet de vente : **personne physique ou personne morale**
(ex. SCI, indivision représentée). Objet du monde réel.
- Type (personne physique / personne morale), identité ou raison sociale,
  coordonnées normalisées (téléphone, e-mail), statut.
- **Distinct** d'une **Organisation** interne et d'un **Utilisateur**.
- Relié à ses **PrivacyRecord** (RGPD), **Notes**, **Documents**.
- **Décision MVP** : un même contact peut être relié à **plusieurs
  opportunités** ; une opportunité peut réunir **plusieurs contacts** (via
  **OpportunityContact**).

### OpportunityContact
Relation **N-N Opportunité ↔ Contact**, porteuse d'un **rôle** et d'un marqueur
**contact principal**.
- Opportunité, contact, rôle, indicateur « contact principal », dates.
- **Rôles** (exemples) : `propriétaire`, `copropriétaire`, `conjoint`,
  `représentant`, `intermédiaire`, `décisionnaire`.
- Couvre les cas d'**indivision** et de **détention par une personne morale**.
- **Décision MVP** : **exactement un** contact principal par opportunité ;
  plusieurs contacts secondaires autorisés. Pas de propriétaire unique imposé.

### Opportunité de mandat
Le **projet de vente** d'un bien. Objet central du CRM Mandats.
- Reliée à **un bien candidat** et à **un ou plusieurs contacts** (via
  OpportunityContact).
- Porte un **Stade** (pipeline) et un **Segment** — **séparés**.
- Reliée à ses **organisations participantes** (OpportunityOrganization) et à ses
  **affectations** d'utilisateurs (OpportunityAssignment).
- Reliée à : **FunnelSubmission** d'origine, **Attributions**, **Qualification**,
  **Activités**, **AuditEvents**, **Notes**, **Tâches**, **Rendez-vous**,
  **Documents**, et le cas échéant un **Mandat**.
- **Raisons de perte / disqualification** enregistrables (voir énumérations).
- **Décision MVP** : une opportunité **n'est pas** rattachée à une organisation
  unique exclusive — elle peut être **opérée par Prodigio** tout en ayant son
  **mandat porté par une agence partenaire**.

### OpportunityOrganization
Relation **N-N Opportunité ↔ Organisation**, porteuse d'une **fonction**.
- Opportunité, organisation, fonction, dates.
- **Fonctions** (exemples) : `opérateur Prodigio`, `agence porteuse du mandat`,
  `partenaire commercial`.
- **Décision MVP** : au moins l'organisation **opérateur Prodigio** ; l'agence
  porteuse est ajoutée lorsqu'elle est connue.

### OpportunityAssignment
Relation **N-N Opportunité ↔ Utilisateur**, porteuse d'une **responsabilité**.
- Opportunité, utilisateur, responsabilité, dates.
- **Responsabilités** (exemples) : `setter`, `manager`, `agent immobilier`,
  `responsable marketing`.
- **Décision MVP** : au moins un **setter** affecté après capture du lead.

### Bien candidat
Le bien immobilier rattaché à une opportunité, **avant** signature du mandat.
- Localisation, type, caractéristiques principales, estimation indicative.
- Reçoit un **Segment** (via l'opportunité) selon les règles de segmentation.
- **Décision MVP** : **un** bien candidat par opportunité. **Extension future** :
  un bien commercialisé relèvera du moteur Biens & Acquéreurs (hors MVP).

### FunnelSubmission
La **soumission originale** issue du funnel. **Conservée telle quelle** ;
**jamais** remplacée par la seule création de contact/opportunité.
- **Identifiant unique** et **clé d'idempotence**.
- Date et heure ; **version du formulaire** ; **landing** et **variante**.
- **Réponses originales** (brutes) et **données normalisées** (e-mail/téléphone).
- **Paramètres UTM** ; **source**, **campagne**, **ad set**, **annonce** si
  disponibles ; **identifiants de clic** (ex. `fbclid`) si disponibles.
- **URL d'origine** et **referrer**.
- **Preuves d'information** et **choix de contact** (alimentent le PrivacyRecord).
- **Résultat du traitement** : `nouveau contact` / `contact existant` /
  `nouvelle opportunité` / `doublon`.
- **Décision MVP** : **toutes** les soumissions sont conservées ; **aucune** n'est
  supprimée silencieusement ; le rattachement à un contact existant et la
  **résolution des doublons** sont **retraçables** (via AuditEvent).

### Source / Attribution
Modèle d'attribution **multi-points de contact** (plus « une source unique »).
- Un ou plusieurs **événements d'attribution** par opportunité : `premier
  contact`, `dernier contact avant conversion`, plus points intermédiaires.
- Chaque événement : canal, **campagne**, **ad set**, **annonce**, **contenu**,
  UTM, identifiants de clic, horodatage.
- **Rattachée à la FunnelSubmission** d'origine.
- **Historique conservé** même si une campagne est renommée (les valeurs
  capturées ne sont pas réécrites).
- **Décision MVP** : capter et conserver les données nécessaires à l'attribution
  (premier/dernier contact au minimum). **Extension future** : import des
  **dépenses** publicitaires et modèles d'attribution avancés (hors MVP).

### Qualification
Informations recueillies pour évaluer le bien et le projet.
- Informations bien / projet / motivation / calendrier / estimation indicative.
- **Distincte du pipeline** (décrit *ce que l'on sait*, pas *où en est* le
  dossier) et **distincte du segment**.
- **Décision MVP** : **un** enregistrement de qualification **évolutif** par
  opportunité (mis à jour dans le temps) ; les modifications sensibles génèrent
  des **AuditEvents**. (Choix explicite : pas de multiplicité d'enregistrements
  au MVP.)

### Activité (métier)
Interaction commerciale **horodatée**.
- **Types** : `appel`, `tentative d'appel`, `e-mail`, `SMS/WhatsApp`,
  `rendez-vous`, `commentaire d'interaction`, `résultat d'interaction`.
- Auteur (utilisateur), horodatage, détails, résultat éventuel.
- **Décision MVP** : rattachée à l'**opportunité** (le contact concerné est
  précisé en attribut). Le **nombre de tentatives** est **calculé** à partir des
  activités, ce n'est pas un stade.
- **N'est pas** le journal d'audit.

### AuditEvent
Événement technique **non modifiable** par les utilisateurs ordinaires.
- **Types** : `création`, `modification d'un champ sensible`, `changement de
  stade`, `changement de segment`, `changement d'affectation`, `changement de
  permission`, `résolution de doublon`.
- Auteur, date, **ancienne / nouvelle valeur** lorsque pertinent, objet visé.
- **Décision MVP** : rattaché à l'objet concerné (opportunité, contact, mandat,
  membership…) ; constitue le **journal d'audit** retraçable.

### Note
Commentaire libre rédigé par un utilisateur.
- Auteur, horodatage, contenu.
- **Décision MVP** : rattachée soit à un **Contact**, soit à une **Opportunité**
  (cible unique explicite, jamais « et/ou »).

### Tâche
Action à réaliser (prochaine action du setting).
- Intitulé, échéance, statut, responsable (utilisateur).
- **Décision MVP** : rattachée à une **Opportunité** ; sert la vue « à rappeler »
  et l'alerte des tâches **en retard**.

### Rendez-vous
Événement planifié avec le(s) contact(s).
- Date/heure, lieu ou modalité (physique/visio), participants, statut
  (`planifié` / `réalisé` / `annulé`) et **résultat de rendez-vous**.
- **Décision MVP** : rattaché à une **Opportunité** ; les participants contacts
  sont référencés en attributs.

### Mandat
**Acte contractuel** résultant d'une opportunité. **Distinct de l'opportunité.**
- **Issue** : `signé` / `refusé` / `perdu`.
- **Date de signature** (si signé).
- **Organisation porteuse** du mandat (référence à une Organisation).
- **Type de mandat** et **exclusivité**.
- **Document signé** téléversé/rattaché (référence à un Document).
- **Raison** de perte ou de refus (si applicable).
- **Photographie des conditions économiques** applicables au moment de la
  signature (référence à une version de **EconomicRuleSet**, voir ci-dessous).
- **Décision MVP** : saisie **manuelle** de l'issue et des attributs ci-dessus ;
  **pas** d'intégration de signature électronique (hors MVP).

### EconomicRuleSet (règles économiques versionnées)
Paramètres économiques **versionnés**, jamais de simples valeurs globales
réécrites.
- **Par organisation partenaire** et **par segment**.
- Seuil de valeur, base du seuil (à confirmer), partages, base HT/TTC des
  honoraires (à confirmer) — **toutes configurables**.
- **Date d'entrée en vigueur** ; **historique des versions**.
- **Décision MVP** : stockage et **versionnage** des règles + **snapshot** dans
  le Mandat à la signature ; **pas** de calcul financier automatique (hors MVP).
  Modifier une règle **ne réinterprète pas** les anciens dossiers.

### Décision de segment
Segmentation **traçable**, pas seulement dérivée de la valeur.
- **Segment recommandé** par les règles ; **segment validé** par un humain.
- **Raison de décision**, **auteur**, **date**.
- **Dérogation manuelle** possible et **tracée** (AuditEvent).
- **Décision MVP** : au minimum critère de **valeur estimée** vs seuil
  configurable + validation humaine. **Extension future** : localisation, type/
  qualité, motivation, délai, commercialisabilité, conditions du mandat.
- ⚠️ La **base du seuil de valeur du bien** et la **base HT/TTC des honoraires**
  sont **deux choses distinctes** : ne jamais associer HT/TTC à la valeur
  immobilière du bien.

### PrivacyRecord / ConsentRecord
Traçabilité **RGPD** — **ne présume pas** qu'un traitement équivaut à un
consentement explicite.
- **Finalité** ; **base légale retenue** ; **version de la notice d'information**.
- **Responsable(s) de traitement** ; **destinataires / partenaires** annoncés.
- **Canal autorisé** : `téléphone` / `e-mail` / `SMS` / `WhatsApp`.
- **Choix** : `accordé` / `refusé` / `retiré` ; date, heure, **source**.
- **Preuve** de l'action de l'utilisateur.
- Préférence **« ne plus contacter »** par canal.
- **Décision MVP** : rattaché à un **Contact** ; conserver la **preuve**
  nécessaire. La documentation **n'affirme pas** que cela suffit à garantir la
  conformité (voir [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)).

### Document
Fichier rattaché au dossier.
- Type, nom, référence de stockage, auteur, horodatage.
- **Décision MVP** : rattaché à **un** objet parmi Contact, Opportunité, Bien
  candidat ou Mandat (cible unique explicite ; le document de mandat signé est
  rattaché au **Mandat**).

---

## Relations principales (cardinalités décidées pour le MVP)

- **Organisation** 1 — N **OrganizationMembership** N — 1 **Utilisateur**
  (relation N-N Utilisateur↔Organisation via membership, avec rôle).
- **Opportunité** 1 — N **OpportunityContact** N — 1 **Contact**
  (N-N, avec rôle ; **un** contact principal par opportunité).
- **Opportunité** 1 — N **OpportunityOrganization** N — 1 **Organisation**
  (N-N, avec fonction).
- **Opportunité** 1 — N **OpportunityAssignment** N — 1 **Utilisateur**
  (N-N, avec responsabilité).
- **Opportunité** 1 — 1 **Bien candidat**.
- **Opportunité** 1 — 1 **Stade** courant ; 1 — 1 **Segment** courant
  (**dimensions séparées**) ; segmentation via **Décision de segment**.
- **FunnelSubmission** 1 — 0..1 **Opportunité** et 0..1 **Contact** (résultat de
  traitement ; une soumission peut aussi être un doublon rattaché à un contact
  existant sans nouvelle opportunité).
- **Opportunité** 1 — N **Attribution** (événements ; premier/dernier contact),
  chacune reliée à la **FunnelSubmission**.
- **Opportunité** 1 — 1 **Qualification** (enregistrement évolutif).
- **Opportunité** 1 — N **Activités**, **AuditEvents**, **Notes**, **Tâches**,
  **Rendez-vous**, **Documents**.
- **Opportunité** 1 — 0..1 **Mandat** ; **Mandat** 1 — 1 **Organisation
  porteuse** ; **Mandat** 1 — 0..1 **Document** signé ; **Mandat** 1 — 1
  **snapshot EconomicRuleSet**.
- **Contact** 1 — N **PrivacyRecord**, **Notes**, **Documents**.
- **EconomicRuleSet** : N versions **par organisation partenaire × segment**,
  avec date d'entrée en vigueur.

---

## Énumérations métier (valeurs configurables, historique préservé)

> Les libellés peuvent rester **configurables**, mais un changement de
> configuration **ne doit pas casser l'historique** (les valeurs passées restent
> lisibles).

### Stades du pipeline mandat (proposition cohérente)
`nouveau` · `prise de contact en cours` · `contact établi` ·
`qualification en cours` · `rendez-vous planifié` · `rendez-vous réalisé` ·
`estimation / étude du dossier` · `proposition de mandat` ·
`en attente de signature` · `mandat signé` · `perdu`.

> La **tentative de contact** n'est **pas** un stade : c'est une **activité
> répétable**, le nombre de tentatives est **calculé** depuis les activités. Le
> **nurturing** est un **état secondaire / file dédiée** (voir
> [02-MVP-SCOPE.md](02-MVP-SCOPE.md)), pas un stade linéaire.

### Segments (séparés des stades)
`non déterminé` · `cible Prodigio premium` · `agence partenaire classique` ·
`hors périmètre` · `à réévaluer`.

### Résultats et raisons (attributs, non stades)
- **Résultat de rendez-vous** : ex. `réalisé favorable`, `réalisé défavorable`,
  `reporté`, `absent`.
- **Raisons de perte** : ex. `sans réponse`, `vendu ailleurs`, `projet
  abandonné`, `honoraires refusés`, `hors périmètre`.
- **Raisons de disqualification** : ex. `bien hors zone`, `non vendeur`,
  `coordonnées invalides`, `doublon`.
- **Issue de mandat** : `signé` / `refusé` / `perdu`.

> Le rattachement d'un segment premium dépend d'un **seuil configurable**
> (hypothèse 800 000 €) dont la **base** (estimation / prix de mandat / prix de
> vente, et distinctement HT / TTC pour les honoraires) est **à confirmer** — voir
> [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md). Modèle d'accès et frontières
> organisationnelles : [06-ACCESS-MODEL.md](06-ACCESS-MODEL.md).
