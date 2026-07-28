# 03 — Modèle de domaine (conceptuel)

Modèle **conceptuel**, sans SQL ni choix d'implémentation. Il définit les objets
métier, leurs attributs principaux et leurs relations. Le schéma de base de
données concret et les migrations viendront lors de la phase Fondations.

> **Principe directeur** : la base de données centrale est l'**unique source de
> vérité**. Systeme.io et Google Sheets ne sont pas le CRM.

---

## Distinction fondamentale : Stade ≠ Segment

- Le **Stade** décrit la **progression commerciale** de l'opportunité dans le
  pipeline (ex. « à contacter », « rendez-vous planifié »).
- Le **Segment** décrit la **catégorie du bien** au regard du modèle Prodigio
  (ex. « cible Prodigio premium », « agence partenaire classique »).
- **Un lead peut changer de stade sans changer de segment**, et inversement. Ce
  sont deux dimensions **indépendantes**, stockées séparément.

De même : **Personne ≠ Opportunité de mandat**. Une personne du monde réel peut
porter plusieurs opportunités ; l'opportunité est le projet de vente.

---

## Objets

### Organisation
Entité participant au système (Prodigio, agence partenaire).
- Nom, type (interne Prodigio / agence partenaire), statut.
- **Multi-organisations dès la conception.** Le MVP n'exploite qu'un partenaire,
  mais rien n'est mono-organisation en dur.
- Sert de frontière de cloisonnement des données et des permissions.

### Utilisateur
Personne disposant d'un accès à Prodigio OS.
- Identité, e-mail, statut.
- Rattaché à **une organisation** et porteur d'un ou plusieurs **rôles** (voir
  ci-dessous).
- **≠ Personne / Contact** : un utilisateur opère le système ; une personne est
  un prospect/propriétaire.

### Rôle
Définit les droits d'accès. Rôles initiaux (conceptuels) :
- administrateur Prodigio ;
- manager ;
- setter ;
- agent immobilier partenaire ;
- propriétaire (plus tard, pour le portail) ;
- accès lecture seule (éventuel).
Les **permissions dépendent du rôle et de l'organisation**.

### Personne / Contact
Un individu réel, typiquement un propriétaire vendeur.
- Identité, coordonnées (téléphone, e-mail), statut.
- Peut être reliée à plusieurs **opportunités de mandat**.
- Reliée à ses **consentements**.

### Opportunité de mandat
Le projet de vente d'un bien par une personne. Objet central du CRM Mandats.
- Reliée à **une personne** (propriétaire) et à **un bien candidat**.
- Porte un **Stade** (pipeline) et un **Segment** — **séparés**.
- Rattachée à l'**organisation** responsable et, le cas échéant, à un
  utilisateur assigné (setter/agent).
- Reliée à ses **qualifications**, **activités**, **notes**, **tâches**,
  **rendez-vous**, **documents**, et **source/attribution**.

### Bien candidat
Le bien immobilier rattaché à une opportunité, **avant** signature du mandat.
- Localisation, type, caractéristiques principales, estimation indicative.
- Reçoit un **Segment** (via l'opportunité) selon le seuil premium configurable.
- (À terme, un bien commercialisé relèvera du moteur Biens & Acquéreurs ; hors
  MVP.)

### Source / Attribution
Origine marketing d'un lead.
- Canal, campagne, contenu/annonce, identifiants de suivi.
- Reliée à l'**opportunité** (et/ou à la personne) au moment de la capture du
  lead depuis le funnel.

### Qualification
Ensemble d'informations recueillies pour évaluer le bien et le projet.
- Informations sur le bien, le projet de vente, la motivation, le calendrier,
  l'estimation.
- **Distincte du pipeline** : la qualification décrit *ce que l'on sait*, pas
  *où en est* l'opportunité.
- Reliée à l'**opportunité**.

### Activité
Événement horodaté et **retraçable**.
- Type (appel, e-mail, changement de stade, changement de segment, création…),
  auteur (utilisateur), horodatage, détails.
- Reliée à l'**opportunité** et/ou à la **personne**.
- Constitue la matière du **journal d'activité**.

### Note
Commentaire libre rédigé par un utilisateur.
- Auteur, horodatage, contenu.
- Rattachée à une **personne** ou une **opportunité**.

### Tâche
Action à réaliser.
- Intitulé, échéance, statut, responsable (utilisateur).
- Rattachée à une **opportunité** (et/ou personne).

### Rendez-vous
Événement planifié avec le propriétaire.
- Date/heure, lieu ou modalité (physique/visio), participants, statut
  (planifié / réalisé / annulé).
- Rattaché à une **opportunité** et à une **personne**.

### Consentement
Autorisation RGPD explicite.
- Type de consentement (contact, communications marketing…), base légale,
  horodatage, source, statut (accordé / retiré).
- Rattaché à une **personne**.
- Sert la conformité RGPD (traçabilité, retrait).

### Document
Fichier rattaché au dossier.
- Type, nom, référence de stockage, auteur, horodatage.
- Rattaché à une **personne**, une **opportunité** ou un **bien candidat**.

---

## Relations principales

- **Organisation** 1 — N **Utilisateurs**.
- **Utilisateur** N — N **Rôles** (ou 1 rôle principal), dans le cadre de son
  organisation.
- **Personne** 1 — N **Opportunités de mandat**.
- **Opportunité** 1 — 1 **Bien candidat** (au stade mandat).
- **Opportunité** N — 1 **Organisation** responsable (et assignation optionnelle
  à un utilisateur).
- **Opportunité** 1 — 1 **Stade** courant ; 1 — 1 **Segment** courant
  (**dimensions séparées**).
- **Opportunité** 1 — 1 **Source / Attribution** (à la capture).
- **Opportunité** 1 — N **Qualifications** (ou 1 enregistrement évolutif).
- **Opportunité** 1 — N **Activités**, **Notes**, **Tâches**, **Rendez-vous**,
  **Documents**.
- **Personne** 1 — N **Consentements**, **Notes**, **Documents**.

---

## Énumérations métier (valeurs configurables / évolutives)

### Stades du pipeline mandat (exemples)
`nouveau` · `à contacter` · `tentative de contact` · `contact établi` ·
`qualification en cours` · `rendez-vous planifié` · `estimation en cours` ·
`proposition de mandat` · `mandat à signer` · `mandat signé` · `nurturing` ·
`perdu`.

### Segments (exemples, **séparés** des stades)
`non déterminé` · `cible Prodigio premium` · `agence partenaire classique` ·
`hors périmètre` · `à réévaluer`.

> Les libellés et l'ordre des stades comme des segments doivent rester
> **configurables** et non figés dans le code. Le rattachement d'un segment
> premium dépend du **seuil configurable** (hypothèse 800 000 €), dont la base
> (estimation / prix de mandat / prix de vente, HT / TTC) est **à confirmer**
> (voir [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)).
