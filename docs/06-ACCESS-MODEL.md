# 06 — Modèle d'accès

Ce document définit le **modèle conceptuel d'accès** de Prodigio OS : comment les
utilisateurs, organisations et dossiers se combinent pour décider **qui voit et
modifie quoi**. Il complète le [modèle de domaine](03-DOMAIN-MODEL.md) et la
[constitution](../CLAUDE.md).

> **Principe du moindre privilège.** Par défaut, un utilisateur ne voit et ne
> modifie que ce que son rôle et son organisation exigent. Toute règle non encore
> tranchée figure dans les **décisions ouvertes** ci-dessous et dans
> [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md) — elle n'est pas présumée.

---

## 1. Concepts d'accès

- **Utilisateur** — compte authentifié.
- **Organisation** — entité interne (opérateur Prodigio, agence partenaire).
- **OrganizationMembership** — lien Utilisateur ↔ Organisation, porteur d'un
  **rôle**. Un utilisateur peut, si nécessaire, appartenir à plusieurs
  organisations (extension future ; au MVP, une appartenance active suffit).
- **OpportunityOrganization** — organisations **participant à un dossier**, avec
  une **fonction** (`opérateur Prodigio`, `agence porteuse du mandat`,
  `partenaire commercial`).
- **OpportunityAssignment** — utilisateurs **affectés à un dossier**, avec une
  **responsabilité** (`setter`, `manager`, `agent immobilier`, `responsable
  marketing`).

La visibilité d'un dossier se calcule à partir de **deux niveaux** :

1. **Frontière organisationnelle** — l'organisation de l'utilisateur
   participe-t-elle au dossier (via OpportunityOrganization) ?
2. **Affectation / rôle** — au sein de cette organisation, le rôle et
   l'éventuelle affectation autorisent-ils l'action demandée ?

Un dossier peut être **opéré par Prodigio** tout en ayant son **mandat porté par
une agence partenaire** : plusieurs organisations participent, chacune avec sa
fonction et sa visibilité propre.

---

## 2. Matrice provisoire des rôles

> **Provisoire.** À affiner ; les cases marquées « à décider » renvoient aux
> décisions ouvertes. `✔` = autorisé, `—` = non autorisé, `∂` = limité au
> périmètre partagé/affecté.

| Capacité | Admin Prodigio | Manager | Setter | Agent partenaire | Lecture seule | Propriétaire (futur) |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Voir tous les dossiers Prodigio | ✔ | ✔ | ∂ | — | ∂ | — |
| Voir les dossiers d'un **autre** partenaire | — | — | — | — | — | — |
| Voir les dossiers partagés avec **son** organisation | ✔ | ✔ | ∂ | ∂ | ∂ | — |
| Voir **son propre** dossier (bien) | — | — | — | — | — | ✔ |
| Créer / éditer une opportunité | ✔ | ✔ | ✔ | ∂ | — | — |
| Setting (appels, notes, tâches, RDV) | ✔ | ✔ | ✔ | ∂ | — | — |
| Modifier le **segment** validé | ✔ | ✔ | ∂ | — | — | — |
| Enregistrer le **résultat commercial / mandat** | ✔ | ✔ | ∂ | ∂ | — | — |
| Modifier les **paramètres économiques** (règles, seuil, partages) | ✔ | — | — | — | — | — |
| Gérer utilisateurs / memberships / permissions | ✔ | ∂ | — | — | — | — |
| Consulter le **journal d'audit** | ✔ | ∂ | — | — | ∂ | — |

Le **propriétaire** n'accède qu'à son propre dossier, et uniquement via le
**Portail Propriétaire** (hors MVP).

---

## 3. Frontières organisationnelles (règles retenues)

- Un **partenaire ne voit jamais** les dossiers d'un **autre partenaire**.
- Un **setter** peut opérer les dossiers de son périmètre mais **ne modifie pas**
  les **paramètres économiques**.
- Un **agent partenaire** ne voit **que** les dossiers **explicitement partagés**
  avec **son** organisation (via OpportunityOrganization).
- Les **données propres et non partagées** d'une organisation restent
  **cloisonnées**. **Seules** les données d'un **dossier explicitement partagé**
  via `OpportunityOrganization` deviennent accessibles à l'autre organisation, et
  cet accès dépend de la **fonction**, du **rôle** et de l'**affectation**.
- Le **partage d'un dossier** (p. ex. entre Prodigio opérateur et l'agence
  porteuse du mandat) **ne donne jamais** accès aux **autres dossiers** ni aux
  **données internes** de l'organisation.
- Chaque changement de **permission**, d'**affectation**, de **stade** ou de
  **segment** génère un **AuditEvent** retraçable.

---

## 4. Décisions encore ouvertes

Ces règles ne sont **pas** tranchées et **ne doivent pas** être codées en dur —
elles figurent aussi dans [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md) :

- Granularité exacte de la **visibilité setter** (tous les dossiers Prodigio vs
  uniquement les dossiers affectés).
- Ce qu'un **agent partenaire** peut **modifier** (au-delà de consulter) sur un
  dossier partagé.
- Portée du rôle **manager** sur la gestion des utilisateurs.
- Règles de **partage** d'un dossier entre Prodigio et l'agence porteuse (à quel
  stade le dossier devient-il visible côté partenaire ?).
- **Propriété et attribution des leads** entre Prodigio et l'agence.
- Étendue exacte du rôle **lecture seule**.
- Conditions d'appartenance d'un utilisateur à **plusieurs organisations**.

---

## 5. Implémentation V1 (RLS PostgreSQL)

Le modèle d'accès est appliqué **en base** (défense en profondeur avec les
contrôles applicatifs) :

- **Lecture** : RLS active sur toutes les tables métier ; politique `SELECT` pour
  `authenticated` conditionnée par des helpers `SECURITY DEFINER`
  (`crm_has_access`, `crm_has_role`) lisant les memberships sans récursion. `anon`
  n'a **aucun** privilège.
- **Écriture** : aucun `INSERT/UPDATE/DELETE` direct pour `authenticated` ; toute
  mutation passe par des fonctions `SECURITY DEFINER` (`crm_change_stage`,
  `crm_assign_opportunity`, `crm_decide_segment`, `crm_record_outcome`, …) qui
  **revérifient le rôle** du·de la caller·euse et écrivent un **AuditEvent**.
- **Frontière organisationnelle** : la V1 accorde la visibilité au niveau de
  l'**organisation opérateur Prodigio** (seule organisation active). La table
  `opportunity_organizations` et le rattachement automatique (trigger + backfill)
  **préparent** l'isolation par partenaire, activable sans refonte lorsque les
  décisions ouvertes (§4) seront tranchées.
- **Coordonnées sensibles** : masquées côté application pour les rôles non
  autorisés (`partenaire_lecture`).
- **Isolation `agent_immobilier` (V1)** : la RLS role-aware restreint ce rôle aux
  **seules opportunités affectées** (et à leurs contacts / activités / tâches /
  soumissions) ; les rôles opérateur (admin/manager/setter) conservent la
  visibilité complète. `partenaire_lecture` reste **préparé mais non attribuable**
  (aucun partage activé en V1). Détail : [12-USERS-AND-ACCESS.md](12-USERS-AND-ACCESS.md).
- **Journal d'audit** : consultable par admin/manager, **non modifiable**
  (déclencheur bloquant UPDATE/DELETE).

Détails et guide : [09-CRM-GUIDE.md](09-CRM-GUIDE.md).

---

## 6. Accès aux dossiers acquéreurs (CRM Acquéreurs V1)

Le CRM Acquéreurs introduit une **frontière d'accès dédiée**, portée par
`crm_buyer_profile_access(buyer_profile_id)`. Elle est **plus restrictive** que
`crm_has_access()` : la visibilité d'un lead Mandats n'ouvre pas celle d'un
dossier acquéreur.

| Capacité | Admin Prodigio | Manager | Setter | Agent immobilier | Partenaire lecture |
|---|:--:|:--:|:--:|:--:|:--:|
| Voir les dossiers acquéreurs | ✔ | ✔ | ✔ | ∂ | — |
| Traiter / qualifier un dossier | ✔ | ✔ | ✔ | ∂ | — |
| Affecter un responsable | ✔ | ✔ | ✔ | — | — |
| Modifier les critères de recherche | ✔ | ✔ | ✔ | ∂ | — |
| Changer d'étape (hors étapes protégées) | ✔ | ✔ | ✔ | ∂ | — |
| Enregistrer une **offre** | ✔ | ✔ | ✔ | ∂ | — |
| Enregistrer le **résultat commercial** (gagné / perdu) | ✔ | ✔ | — | — | — |
| **Rouvrir** un dossier clos | ✔ | ✔ | — | — | — |
| Voir les coordonnées non masquées | ✔ | ✔ | ✔ | ✔ | — |
| Consulter l'historique audité | ✔ | ✔ | — | — | — |

`∂` (agent immobilier) = **uniquement** les dossiers qui lui sont **affectés**
(`buyer_assignments`) **ou** liés à un bien auquel il a accès via ses
opportunités affectées.

### Pourquoi `partenaire_lecture` est exclu en V1

Aucun mécanisme de **partage de dossier acquéreur** n'existe encore :
l'équivalent d'`OpportunityOrganization` côté acquéreurs reste à décider (§4).
Accorder une visibilité par défaut reviendrait à ouvrir **tous** les dossiers à
ce rôle, ce que la règle « lecture strictement limitée aux dossiers explicitement
partagés » interdit. Le rôle est donc **exclu** tant que le partage n'est pas
conçu — et il reste par ailleurs **non attribuable** en V1.

### Règles structurelles

- **Écriture** : aucun `INSERT/UPDATE/DELETE` direct ; toute mutation passe par
  une fonction `SECURITY DEFINER` (`crm_buyer_*`) qui **revérifie le rôle**,
  applique la règle métier et écrit un **AuditEvent**. `search_path` figé.
- **Étapes protégées** : « offre en cours », « acquéreur gagné » et « perdu » ne
  sont **jamais** atteignables par un simple changement d'étape — elles exigent
  une action métier dédiée (confirmation, motif, audit).
- **Tâches et activités partagées** : la politique RLS distingue les deux cas
  sans changer le comportement Mandats — branche `opportunity_id` inchangée
  (`crm_has_access()`), branche `buyer_profile_id` soumise à
  `crm_buyer_profile_access()`.
- **`anon`** : aucun privilège table, aucune politique, **aucune fonction du CRM
  Acquéreurs exécutable**. Seul `submit_buyer_interest` (dépôt public contrôlé)
  reste accessible, et ne renvoie qu'un accusé neutre.

Détail complet : [20-CRM-ACQUEREURS.md](20-CRM-ACQUEREURS.md).

---

## Communications V1 — accès aux messages, modèles et oppositions

Détail complet : [21-COMMUNICATIONS.md](21-COMMUNICATIONS.md).

### Matrice

| Rôle | Historique des messages | Modèles | Oppositions | Automatisations | File d'attente |
|---|---|---|---|---|---|
| administrateur | ✅ tout | ✅ créer / activer | ✅ créer **et lever** | ✅ | ✅ |
| manager | ✅ tout | ✅ créer / activer | ✅ créer | 👁 lecture | ✅ |
| setter | ✅ dossiers accessibles | 👁 lecture | 👁 lecture | 👁 lecture | ✅ |
| agent immobilier | ∂ **ses** dossiers, biens et rendez-vous | 👁 lecture | 👁 lecture | ⛔ | ⛔ |
| partenaire_lecture | ⛔ **aucun accès** | ⛔ | ⛔ | ⛔ | ⛔ |

`∂` = restreint en base par `comm_message_access()`, qui **réutilise** les règles
d'accès existantes (`crm_assigned_opportunity_ids`, `crm_buyer_profile_access`,
`crm_property_access`) plutôt que d'en inventer de nouvelles.

`partenaire_lecture` est **exclu** pour la même raison que côté acquéreurs :
aucun mécanisme de partage explicite de communication n'existe en V1, et une
visibilité par défaut ouvrirait **tous** les messages.

### Règles structurelles

- **Écriture** : aucun `INSERT/UPDATE/DELETE` direct sur les six tables ; toute
  mutation passe par une fonction `SECURITY DEFINER` (`crm_comm_*`) qui
  revérifie le rôle, applique la politique et écrit un **AuditEvent**.
  `search_path` figé sur chaque fonction.
- **Décisions sensibles** : la **levée d'une opposition** est réservée à
  l'administrateur et exige un **motif obligatoire**, tracé. L'annulation d'un
  message exige également un motif.
- **Politique d'envoi côté serveur** : `crm_comm_eligibility` fait autorité. Le
  navigateur ne peut ni injecter un statut, ni contourner une opposition, ni
  décider qu'un message est éligible.
- **Helpers internes** (`comm_operator_org`, `comm_can_manage`,
  `comm_google_covers_appointment`, `comm_enqueue`, les trois déclencheurs) :
  aucun `EXECUTE` pour `public`, `anon` ni `authenticated`.
  `comm_message_access` conserve `authenticated` car il est appelé
  **directement** par les politiques RLS.
- **`anon`** : aucun privilège table, aucune politique, **aucune fonction du
  module exécutable**.
- **Masquage** : les coordonnées suivent les règles existantes
  (`crm_can_view_contact_details` / `maskContactValue`), appliquées **côté
  serveur**. La recherche ne porte jamais sur une coordonnée masquée.
