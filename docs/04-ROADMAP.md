# 04 — Feuille de route

Découpage **recommandé**, par phases. Chaque phase précise son objectif, ses
livrables, ses dépendances, ses risques et ses critères de validation. Les
phases sont séquentielles quant aux dépendances, mais leur calendrier n'est pas
figé ici.

> Priorité absolue : livrer la **tranche verticale Mandats jusqu'au résultat du
> mandat** décrite dans [02-MVP-SCOPE.md](02-MVP-SCOPE.md). On conserve une
> **acquisition verticale** et on évite toute phase trop large impossible à
> valider.

---

## Phase 0 — Fondations

**Objectif** : mettre en place les fondations techniques et conceptuelles sans
surdimensionner.

**Livrables**
- Initialisation de l'application web unique (Next.js, App Router, TypeScript
  strict), avec **versions stables sélectionnées, verrouillées** (package.json +
  lockfile) et **documentées** dans l'ADR.
- Structure en monolithe modulaire (modules métier séparés).
- Base PostgreSQL (**Supabase retenu pour le MVP** — base, auth, stockage) avec
  **migrations versionnées** ; **Vercel retenu** pour l'hébergement et les
  previews.
- Authentification et **modèle d'accès** (organisations, memberships, rôles) —
  voir [06-ACCESS-MODEL.md](06-ACCESS-MODEL.md) ; multi-organisations prête.
- Fondations du **design system** (variables CSS, composants accessibles).
- Validation des données (Zod ou équivalent) posée comme convention.
- **Journal d'audit** (AuditEvent) de base, distinct des activités métier.
- Séparation des environnements **dev / preview / production** ; secrets hors
  dépôt.
- Complétion des **commandes de validation** dans [CLAUDE.md](../CLAUDE.md).

**Dépendances** : décision technique ([adr/001-TECHNICAL-FOUNDATION.md](adr/001-TECHNICAL-FOUNDATION.md)).

**Risques** : sur-ingénierie précoce ; choix d'outils non validés ; dette si le
modèle de domaine évolue.

**Critères de validation** : l'application démarre dans les trois environnements ;
un utilisateur s'authentifie avec un rôle et une organisation ; une migration
peut être appliquée ; les permissions de base et l'audit fonctionnent.

---

## Phase 1 — Funnel Mandats

**Objectif** : capter des leads propriétaires depuis la publicité et conserver la
**soumission originale** en base centrale.

**Livrables**
- **Landing** Mandats (emplacement VSL) fidèle à la direction artistique.
- **Quiz** propriétaire structuré.
- **FunnelSubmission** conservée (idempotence, version de formulaire, landing/
  variante, réponses brutes + normalisées, UTM, source/campagne/ad set/annonce,
  identifiants de clic, URL/referrer).
- **PrivacyRecord / ConsentRecord** (finalité, base légale, notice, canaux,
  preuve, choix).
- **Attribution multi-points** (premier / dernier contact) rattachée à la
  soumission.
- Résolution **contact / opportunité** avec **dédoublonnage retraçable** (aucune
  soumission supprimée **au seul motif d'un doublon** ; immuable pendant sa durée
  de conservation ; suppression/anonymisation possible et **tracée** selon
  rétention, obligation légale ou demande recevable).

**Dépendances** : Phase 0.

**Risques** : qualité/fiabilité de l'attribution ; conformité RGPD des
enregistrements ; abus/spam du formulaire ; qualité du dédoublonnage.

**Critères de validation** : une soumission crée/relie une personne et une
opportunité, conserve la soumission d'origine, capture l'attribution et les
enregistrements RGPD, **sans** traiter Systeme.io ou Google Sheets comme source
de vérité.

---

## Phase 2 — CRM Mandats (jusqu'au résultat du mandat) — **fin du MVP**

**Objectif** : setting, qualification, rendez-vous, estimation, décision de
segment, proposition de mandat puis **résultat commercial de l'opportunité**
(« résultat du mandat » en langage métier).

**Livrables**
- Liste et fiche des **opportunités** ; **contacts multiples** (OpportunityContact)
  et **organisations participantes** (OpportunityOrganization) ; **affectations**
  (OpportunityAssignment).
- **Pipeline** (stades) et **Segment** **séparés** ; **décision de segment**
  tracée (recommandé/validé, raison, auteur, date, dérogation tracée).
- **Activités** métier et **AuditEvent** distincts.
- **Notes**, **Tâches**, **Rendez-vous** (avec résultat), **Qualification**.
- **Résultat commercial** (`OpportunityOutcome`, distinct du Mandat) :
  signé/gagné, refusé après proposition, perdu/disqualifié avant signature ;
  raison de perte portée par l'opportunité.
- **Mandat** (entité distincte de l'opportunité et du résultat) : statut
  brouillon → proposé → en attente de signature → signé / refusé / expiré ou
  annulé ; organisation porteuse, type et exclusivité ; **document signé + date
  obligatoires si `signé`** ; **snapshot** des règles économiques versionnées
  **obligatoire dès `proposé`**.
- **Fonctions opérationnelles** : notification nouveau lead, affectation setter
  (automatique **ou** file « non affecté » avec alerte, aucun lead orphelin),
  prochaine action, alerte tâches en retard, vue « à rappeler », **tableau de
  bord minimal** (indicateurs de [02-MVP-SCOPE.md](02-MVP-SCOPE.md)).
- **Permissions** par rôle/organisation ; **journal d'audit** exploitable.

**Dépendances** : Phases 0 et 1.

**Risques** : confusion stade/segment ou activité/audit dans l'UI ; complexité
des permissions ; ergonomie du setter ; saisie manuelle de l'issue du mandat.

**Critères de validation** : ceux du MVP (voir
[02-MVP-SCOPE.md](02-MVP-SCOPE.md)) — le parcours va **jusqu'au résultat du
mandat**. **Fin du périmètre MVP.**

---

## Phase 3 — Fabrique de biens

**Objectif** : produire les actifs de commercialisation d'un bien (post-MVP).

**Livrables** : **fiche bien** commercialisable, **contenus**, **médias**,
**landing** dédiée et **brochure confidentielle**.

**Dépendances** : Phase 2 (mandats signés à commercialiser).

**Risques** : coût et délai de production des contenus ; cohérence de la
direction artistique ; financement des shootings (voir questions ouvertes).

**Critères de validation** : un bien sous mandat dispose d'une fiche, d'une
landing et d'une brochure prêtes à diffuser.

---

## Phase 4 — Acquisition et CRM Acquéreurs

**Objectif** : acquérir et convertir des acheteurs (post-MVP).

**Livrables** : campagnes acheteurs, **leads acheteurs**, **qualification**
budget/projet, **setting**, **visites**, **offres**, **vente**.

**Dépendances** : Phase 3 (actifs de commercialisation disponibles).

**Risques** : coordination avec l'agence partenaire (visites) ; volumétrie
acheteurs ; financement des campagnes acheteurs.

**Critères de validation** : un bien peut être commercialisé de l'acquisition
d'acheteurs jusqu'à l'offre/vente, avec setting et visites suivis dans le CRM.

---

## Phase 5 — Analytics de commercialisation et Portail Propriétaire

**Objectif** : mesurer la commercialisation et **restituer** au propriétaire.

> **Ordre corrigé** : le portail dépend des **statistiques du moteur acquéreurs**
> et des **campagnes publicitaires**. Les analytics de commercialisation
> nécessaires sont donc livrés **avec** le portail, pas après.

**Livrables**
- **Analytics de commercialisation** : statistiques publicitaires, demandes
  générées, profils qualifiés, visites planifiées/réalisées, offres,
  progression.
- **Portail Propriétaire** : présentation de la stratégie, restitution des
  statistiques et documents/comptes rendus, en **lecture** cloisonnée par
  propriétaire.

**Dépendances** : Phases 3 et 4 (données à mesurer et à restituer).

**Risques** : exposition de données sensibles ; permissions propriétaire ;
fraîcheur des statistiques.

**Critères de validation** : un propriétaire authentifié consulte la stratégie et
les résultats de **son** bien, sans accès aux données d'autres organisations ou
biens.

---

## Phase 6 — Automatisations avancées

**Objectif** : industrialiser les process (post-portail).

**Livrables** : séquences avancées, **nurturing automatisé**, relances,
notifications enrichies, éventuel **export secondaire** Google Sheets (jamais
source de vérité).

**Dépendances** : phases précédentes selon les process automatisés.

**Risques** : automatisations mal calibrées ; RGPD sur les communications
automatisées (canaux autorisés) ; qualité des données.

**Critères de validation** : les automatisations réduisent le travail manuel sans
dégrader la conformité ni la traçabilité.

---

## Phase 7 — Multi-partenaires à l'échelle

**Objectif** : exploiter réellement plusieurs agences partenaires.

**Livrables** : gestion opérationnelle de **plusieurs organisations
partenaires** ; paramétrage par partenaire (règles économiques versionnées,
seuil, partages, périmètre) ; cloisonnement et permissions à l'échelle.

**Dépendances** : architecture multi-organisations posée en Phase 0 ; modèle
d'accès ([06-ACCESS-MODEL.md](06-ACCESS-MODEL.md)).

**Risques** : cloisonnement des données ; complexité de configuration ; cohérence
des règles entre partenaires.

**Critères de validation** : deux partenaires (ou plus) opèrent en parallèle avec
des paramètres distincts, sans fuite de données entre organisations.
