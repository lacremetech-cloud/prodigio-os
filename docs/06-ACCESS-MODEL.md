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
