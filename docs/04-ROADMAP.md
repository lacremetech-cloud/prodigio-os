# 04 — Feuille de route

Découpage **recommandé**, par phases. Chaque phase précise son objectif, ses
livrables, ses dépendances, ses risques et ses critères de validation. Les
phases sont séquentielles quant aux dépendances, mais leur calendrier n'est pas
figé ici.

> Priorité absolue : livrer la **tranche verticale Mandats** décrite dans
> [02-MVP-SCOPE.md](02-MVP-SCOPE.md).

---

## Phase 0 — Fondations

**Objectif** : mettre en place les fondations techniques et conceptuelles sans
surdimensionner.

**Livrables**
- Initialisation de l'application web unique (Next.js, App Router, TypeScript
  strict) — sans figer de version.
- Structure en monolithe modulaire (modules métier séparés).
- Base PostgreSQL (Supabase envisagé) avec **migrations versionnées**.
- Authentification et gestion des **rôles / organisations** (multi-organisations
  prête).
- Fondations du **design system** (variables CSS, composants accessibles).
- Validation des données (Zod ou équivalent) posée comme convention.
- **Journal d'activité** de base.
- Séparation des environnements **dev / preview / production** ; secrets hors
  dépôt.
- Complétion des **commandes de validation** dans [CLAUDE.md](../CLAUDE.md).

**Dépendances** : décision technique ([adr/001-TECHNICAL-FOUNDATION.md](adr/001-TECHNICAL-FOUNDATION.md)).

**Risques** : sur-ingénierie précoce ; choix d'outils non validés ; dette si le
modèle de domaine évolue.

**Critères de validation** : l'application démarre dans les trois environnements ;
un utilisateur peut s'authentifier avec un rôle et une organisation ; une
migration peut être appliquée ; les permissions de base fonctionnent.

---

## Phase 1 — Funnel Mandats

**Objectif** : capter des leads propriétaires depuis la publicité et les
enregistrer dans la base centrale.

**Livrables**
- **Landing** Mandats (emplacement VSL) fidèle à la direction artistique.
- **Quiz** propriétaire structuré.
- **Collecte des coordonnées et consentements** (RGPD, horodatés).
- **Attribution publicitaire** (capture source/campagne).
- **Enregistrement du lead** en base : création d'une **personne** et d'une
  **opportunité** distinctes.

**Dépendances** : Phase 0.

**Risques** : qualité/fiabilité de l'attribution ; conformité RGPD des
consentements ; abus/spam du formulaire.

**Critères de validation** : un lead soumis via le funnel crée une personne et
une opportunité reliées, avec sa source et ses consentements, **sans passer par
Systeme.io ou Google Sheets comme source de vérité**.

---

## Phase 2 — CRM Mandats

**Objectif** : permettre le setting, la qualification et le suivi jusqu'à la
décision de segment.

**Livrables**
- Liste et fiche des **opportunités**.
- **Pipeline** (stades) et **Segment** **séparés**.
- **Activités**, **notes**, **tâches**, **rendez-vous**.
- **Qualification** (champs distincts du pipeline).
- **Segmentation** selon le seuil premium **configurable**.
- **Permissions** par rôle/organisation ; **journal d'activité** exploitable.

**Dépendances** : Phases 0 et 1.

**Risques** : confusion stade/segment dans l'UI ; complexité des permissions ;
ergonomie du setter.

**Critères de validation** : ceux du MVP (voir
[02-MVP-SCOPE.md](02-MVP-SCOPE.md)). **Fin du périmètre MVP.**

---

## Phase 3 — Moteur Biens & Acquéreurs

**Objectif** : commercialiser le bien et acquérir des acheteurs (post-MVP).

**Livrables**
- **Fiche bien** commercialisable, **landing** dédiée, **brochure
  confidentielle**.
- **Campagnes publicitaires** acheteurs et **acquisition** d'acheteurs.
- **Qualification** budget/projet acheteur, **setting**, **visites**, **offres**,
  **vente**.

**Dépendances** : Phase 2 (mandats signés à commercialiser).

**Risques** : coordination avec l'agence partenaire (visites) ; financement des
campagnes acheteurs ; volumétrie des acheteurs.

**Critères de validation** : un bien peut être commercialisé de la fiche jusqu'à
l'offre/vente, avec acquisition d'acheteurs pilotée par Prodigio.

---

## Phase 4 — Portail Propriétaire

**Objectif** : offrir de la transparence au vendeur.

**Livrables**
- Présentation de la **stratégie** ; **statistiques publicitaires** ; demandes
  générées ; profils qualifiés ; visites planifiées/réalisées ; offres ;
  progression ; **documents et comptes rendus**.

**Dépendances** : Phases 2 et 3 (données à restituer).

**Risques** : exposition de données sensibles ; permissions propriétaire ;
attentes de fraîcheur des statistiques.

**Critères de validation** : un propriétaire authentifié consulte, en lecture,
la stratégie et les résultats de son bien, sans accès aux données d'autres
organisations/biens.

---

## Phase 5 — Automatisations & Analytics

**Objectif** : industrialiser et mesurer.

**Livrables**
- Automatisations (relances, tâches, notifications).
- Tableaux de bord et **analytics** (acquisition, conversion, segmentation).
- Éventuel **export secondaire** Google Sheets (jamais source de vérité).

**Dépendances** : phases précédentes selon les données mesurées.

**Risques** : automatisations mal calibrées ; qualité des données ; RGPD sur les
communications automatisées.

**Critères de validation** : les indicateurs clés (voir
[01-PRODUCT-VISION.md](01-PRODUCT-VISION.md)) sont disponibles et fiables ; les
automatisations réduisent le travail manuel sans dégrader la conformité.

---

## Phase 6 — Évolution multi-partenaires

**Objectif** : exploiter réellement plusieurs agences partenaires.

**Livrables**
- Gestion opérationnelle de **plusieurs organisations partenaires**.
- Paramétrage par partenaire (seuil, partages, périmètre).
- Cloisonnement et permissions à l'échelle multi-partenaires.

**Dépendances** : architecture multi-organisations posée en Phase 0.

**Risques** : cloisonnement des données ; complexité de configuration ;
équité/cohérence des règles entre partenaires.

**Critères de validation** : deux partenaires (ou plus) opèrent en parallèle avec
des paramètres distincts, sans fuite de données entre organisations.
