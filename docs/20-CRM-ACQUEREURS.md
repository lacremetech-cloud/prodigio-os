# 20 — CRM Acquéreurs V1

CRM opérationnel permettant à l'équipe Prodigio de **centraliser, qualifier,
affecter et suivre** tous les acquéreurs générés par les expériences publiques
des biens.

Cette tranche transforme les `buyer_interests` déjà capturés par le Funnel
Acquéreur ([19-PUBLIC-PROPERTY-EXPERIENCE.md](19-PUBLIC-PROPERTY-EXPERIENCE.md))
en **dossiers acquéreurs** exploitables, **sans dupliquer** les contacts, tâches,
activités, utilisateurs, propriétés, systèmes d'audit ni composants CRM
existants.

> **Statut.** Migration `20260803120000_buyers_crm_v1.sql` **écrite et validée
> localement** (rejeu complet des 14 migrations sur PostgreSQL 16, tests
> fonctionnels et de sécurité). **Non appliquée** au projet distant : voir §9.

---

## 1. Principe fondamental — une personne, un dossier

| Objet | Rôle | Réutilisé ? |
|---|---|---|
| `contacts` | **La personne**. Un vendeur peut aussi devenir acquéreur. | ✅ existant |
| `buyer_profiles` | **Le dossier acquéreur global** de cette personne (1-1 avec le contact). | 🆕 |
| `buyer_search_criteria` | **Ses critères de recherche** (1-1 avec le dossier). | 🆕 |
| `buyer_interests` | **Ses intérêts ponctuels**, un par bien. | ✅ existant, rattaché |
| `buyer_assignments` | **Son affectation** (N-N dossier ↔ utilisateur). | 🆕 |
| `tasks` / `activities` | **Son suivi opérationnel**. | ✅ existantes, **élargies** |
| `audit_events` | **Son historique audité**, immuable. | ✅ existante, étendue |

Règles non négociables :

- **Jamais de doublon de contact.** Le dédoublonnage reste **conservateur** :
  rapprochement sur l'**e-mail normalisé uniquement**, jamais sur un signal
  faible (nom, téléphone approchant, ville). Deux personnes ne sont jamais
  fusionnées automatiquement.
- **Jamais d'écrasement des données vendeur.** Quand un contact existant est
  réutilisé, `submit_buyer_interest` ne fait **aucun `UPDATE` sur `contacts`**.
  Les données issues du parcours vendeur restent intactes.
- **Un intérêt ponctuel n'est pas le dossier global.** Un acquéreur peut
  manifester plusieurs intérêts sur plusieurs biens : les intérêts s'accumulent,
  le dossier reste unique (contrainte `buyer_profiles_contact_unique`).
- **La soumission d'origine est conservée telle quelle.** `buyer_interests`
  n'est jamais remplacée par le dossier ; on lui ajoute seulement un lien.

### Pas de tables en double

`tasks` et `activities` sont **élargies**, pas dupliquées : `opportunity_id`
devient nullable, `buyer_profile_id` est ajouté, et une contrainte impose
**exactement un** rattachement :

```sql
check ((opportunity_id is not null and buyer_profile_id is null)
    or (opportunity_id is null and buyer_profile_id is not null))
```

Toutes les lignes existantes portent `opportunity_id` : **aucune donnée
invalidée**. Les requêtes du CRM Mandats excluent explicitement les lignes
acquéreur, et l'écran « Tâches » affiche les deux types en indiquant le dossier
d'origine.

---

## 2. Quatre notions à ne jamais confondre

C'est la distinction structurante de cette tranche. Elles vivent dans des
colonnes séparées, avec des cycles de vie indépendants :

| Notion | Où | Qui la produit |
|---|---|---|
| **Score automatique** | `buyer_interests.overall_score` (+ dimensions) | Calculé **en base** à la soumission (`compute_buyer_scores`, `buyer-scoring-v1`) |
| **Recommandation opérationnelle** | `buyer_profiles.recommended_priority` | **Dérivée** des scores des intérêts, recalculée en base |
| **Qualification humaine** | `buyer_profiles.qualification_status` | **Décidée par une personne** (`crm_buyer_qualify`), jamais déduite d'un score |
| **Étape commerciale** | `buyer_profiles.pipeline_stage` | Progression dans le pipeline acquéreur |

Un dossier peut parfaitement afficher un score de 62, une recommandation
« à qualifier », une qualification humaine « qualifié » et une étape « suivi
après visite » : ce sont quatre informations différentes.

> **Le navigateur ne peut jamais injecter ni modifier un score.** Le scoring du
> funnel est recalculé côté serveur avec la valeur de référence **interne** du
> bien, inconnue du client. Les actions serveur n'acceptent aucun score en
> entrée.

---

## 3. Pipeline Acquéreurs

Distinct du pipeline Mandats. Onze étapes :

| Étape | Libellé |
|---|---|
| `nouveau` | Nouveau |
| `a_contacter` | À contacter |
| `contact_en_cours` | Contact en cours |
| `qualifie` | Qualifié |
| `bien_a_proposer` | Bien à proposer |
| `visite_a_planifier` | Visite à planifier |
| `visite_planifiee` | Visite planifiée |
| `suivi_apres_visite` | Suivi après visite |
| `offre_en_cours` | Offre en cours 🔒 |
| `acquereur_gagne` | Acquéreur gagné 🔒 |
| `perdu` | Perdu 🔒 |

### Étapes protégées (🔒)

« Offre en cours », « Acquéreur gagné » et « Perdu » **ne s'atteignent jamais
par un simple changement de colonne**. Elles exigent une action métier dédiée,
avec confirmation, motif et audit :

- `crm_buyer_record_offer` — bien concerné, montant facultatif, commentaire ;
- `crm_buyer_record_outcome` — **motif obligatoire si « perdu »**, réservé
  administrateur / manager ;
- `crm_buyer_reopen` — réouverture d'un dossier clos, **motif obligatoire**,
  réservé administrateur / manager.

La garde est appliquée **en base** (`crm_buyer_set_stage` rejette ces étapes) et
répliquée côté interface pour expliquer le refus et orienter vers la bonne
action — jamais l'inverse.

### Standards du Kanban (identiques au CRM Mandats)

- glisser-déposer desktop ;
- alternative accessible « Déplacer vers… » ;
- déplacement au clavier (Entrée pour saisir, flèches, Entrée/Échap) ;
- annonces `aria-live` à chaque étape ;
- optimisme avec **rollback** en cas de refus serveur ;
- **verrou anti-double-envoi** (un seul déplacement à la fois) ;
- **aucune carte dupliquée** (une carte = une colonne) ;
- **filtres conservés** après déplacement (ils ne dépendent pas de la position) ;
- colonnes protégées signalées et non « droppables ».

---

## 4. Interfaces

| Route | Rôle |
|---|---|
| `/crm/acquereurs` | Boîte de réception : recherche (nom, e-mail, téléphone, ville), filtres (statut, priorité, budget, horizon, responsable, bien), compteurs réels, tri par urgence / arrivée / dernière activité |
| `/crm/acquereurs/pipeline` | Kanban Acquéreurs complet |
| `/crm/acquereurs/[id]` | Fiche acquéreur consolidée |
| `/crm/biens/[id]` | Section « Dossiers acquéreurs » — **autre vue des mêmes dossiers**, filtrée sur le bien |

Une entrée principale « Acquéreurs » est ajoutée à la navigation CRM.

### Signaux visuels de la boîte de réception

Nouvel acquéreur non traité · rappel en retard · fort potentiel · absence de
prochaine action · nouvel intérêt sur un dossier existant · non affecté.

Comme partout dans le CRM, **la couleur n'est jamais le seul signal** : chaque
signal porte une icône et un libellé, et les couleurs passent par des variables
CSS thème-adaptatives (clair / sombre / système).

### Fiche acquéreur

Identité et coordonnées (avec boutons copier) · qualification globale · critères
de recherche · financement et horizon · intérêts par bien · réponses détaillées
aux funnels · scores et facteurs explicatifs · attribution marketing ·
affectation · prochaine action · tâches · activités · notes internes ·
historique audité · actions de qualification et de changement d'étape · points
d'extension (visite, offre, e-mail, SMS) explicitement signalés comme **non
développés** en V1.

---

## 5. Critères de recherche — amorçage puis verrou humain

`buyer_search_criteria.source` distingue deux régimes :

- **`funnel`** — critères amorcés automatiquement depuis les réponses et le bien
  concerné (type et localisation viennent du **bien qui a suscité l'intérêt** :
  `residence_area` indique où la personne *habite*, jamais où elle veut
  acheter). À chaque nouvel intérêt, types et localisations s'**unionnent** et le
  budget s'**élargit**.
- **`humain`** — dès la première modification par l'équipe, les critères sont
  **verrouillés** : plus aucun intérêt ne les écrase.

Les bornes de budget par tranche sont un **miroir exact** entre
`public.buyer_band_bounds` (SQL) et `src/modules/buyers/crm/criteria.ts` (TS),
et reprennent celles déjà utilisées par `compute_buyer_scores` — **aucune
nouvelle valeur économique n'est introduite**. Une borne absente signifie « non
bornée » et le reste : l'élargissement ne resserre jamais une fourchette à tort.

---

## 6. Matching biens ↔ acquéreurs — fondation V1

`crm_buyer_property_matches(buyer_profile_id, limit)` — versionné
**`buyer-matching-v1`**.

Propriétés garanties :

- **distinct du scoring du funnel** — le scoring qualifie la *demande*, le
  matching compare des *critères explicites* à des *biens réels* ;
- **calculé côté serveur**, jamais dans le navigateur ;
- **versionné** — le numéro accompagne chaque résultat ;
- **critères explicites uniquement**, aucune boîte noire, **aucune IA** ;
- **explicable** — trois listes distinctes : facteurs positifs,
  incompatibilités, données manquantes ;
- **recommandation, jamais décision** — aucune campagne, aucun envoi automatique.

| Critère | Poids |
|---|---|
| Budget (valeur de référence interne du bien vs fourchette) | 40 |
| Type de bien | 25 |
| Localisation | 25 |
| Disponibilité commerciale (statut de publication) | 10 |

**Pas de fausse précision.** Un critère sans donnée est **exclu du
dénominateur** : le score est calculé sur les seuls critères réellement
évaluables, et `evaluable_weight` permet d'afficher un niveau de confiance
(« Évaluation complète / partielle / Peu de critères évaluables »). Les biens
dont aucun critère n'est évaluable sont écartés.

Le cloisonnement s'applique : seuls les biens **réellement accessibles** à
l'utilisateur (`crm_property_access`) entrent dans le calcul.

L'architecture permet qu'un même acquéreur reçoive **plusieurs suggestions** ;
aucune campagne automatique n'est construite dans cette mission.

---

## 7. Permissions et sécurité

### Matrice appliquée

| Rôle | Accès aux dossiers acquéreurs |
|---|---|
| `administrateur` | Complet, y compris résultat commercial et réouverture |
| `manager` | Complet opérationnel, y compris résultat et réouverture |
| `setter` | Traitement, qualification, affectation, étapes non sensibles |
| `agent_immobilier` | **Uniquement** les dossiers qui lui sont affectés, ou liés à un bien auquel il a accès |
| `partenaire_lecture` | **Aucun accès en V1** — voir ci-dessous |

> **`partenaire_lecture`.** Aucun mécanisme de partage de *dossier acquéreur*
> n'existe encore (l'équivalent d'`OpportunityOrganization` côté acquéreurs
> reste à décider — [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)). Plutôt que
> d'accorder une visibilité par défaut, le rôle est **exclu** : c'est la lecture
> conservatrice de « lecture strictement limitée ». Le rôle reste par ailleurs
> non attribuable en V1 ([12-USERS-AND-ACCESS.md](12-USERS-AND-ACCESS.md)).

### Garanties vérifiées

- **RLS active** sur `buyer_profiles`, `buyer_search_criteria`,
  `buyer_assignments`, `buyer_interests`, `tasks`, `activities`.
- **Aucune lecture directe pour `anon`** : aucun privilège, aucune politique.
- **Aucune fonction du CRM Acquéreurs exécutable par `anon` ou `PUBLIC`**
  (17 fonctions vérifiées : `EXECUTE` = false pour les deux).
- **Écritures via fonctions `SECURITY DEFINER` auditées** — seul chemin
  d'écriture ; chaque fonction re-vérifie le rôle.
- **`search_path` figé** sur les 17 fonctions.
- **Audit immuable** — trigger `audit_events_immutable` conservé (ni `UPDATE`
  ni `DELETE`).
- **Coordonnées masquées côté serveur** selon le rôle (`maskContactValue`) : une
  valeur non autorisée ne quitte jamais le serveur, et n'est donc pas
  interrogeable par la recherche.
- **Aucune donnée propriétaire altérée** lors du dédoublonnage.
- **Aucune note interne, PII ou donnée privée dans les bundles publics** —
  vérifié sur le build : 0 occurrence de `crm_buyer_`, `qualification_reason`,
  `outcome_reason`, `buyer_search_criteria`, `raw_answers`, `score_breakdown`,
  `SLACK_BUYER` dans les chunks client ; les pages publiques prérendues ne
  référencent aucun code du CRM Acquéreurs.

### Comportement du CRM Mandats — inchangé

La politique RLS de `tasks` / `activities` a été réécrite pour couvrir les deux
cas, en conservant **à l'identique** la branche mandat :

```sql
case when buyer_profile_id is not null
     then public.crm_buyer_profile_access(buyer_profile_id)
     else public.crm_has_access() end
```

---

## 8. Slack et événements métier

L'alerte Slack Acquéreurs existante est **réutilisée** (webhook dédié
`SLACK_BUYER_LEADS_WEBHOOK_URL`, canal `#alertes-acquereurs`). Sa valeur n'est
**jamais lue, affichée ni journalisée**, et **aucun message réel n'est envoyé
pendant les tests automatisés** (les tests injectent un `fetch` factice).

Le **deep link du bouton** pointe désormais vers la fiche exacte :

```
https://go.prodigio.fr/crm/acquereurs/{buyerProfileId}
```

`buyer_profile_id` est résolu **en base** par `submit_buyer_interest` et renvoyé
au serveur uniquement (jamais au navigateur). Si aucun dossier n'a pu être résolu
(cas limite : contact non résolu), le lien retombe sur la réception du bien —
**jamais de lien mort**. Les deux comportements sont couverts par des tests.

---

## 9. Application de la migration

`supabase/migrations/20260803120000_buyers_crm_v1.sql` est **strictement
additive** et **n'a pas été appliquée** au projet distant : elle est fournie pour
revue et application contrôlée (voir
[07-SUPABASE-SETUP.md](07-SUPABASE-SETUP.md)).

Validation réalisée **localement** sur PostgreSQL 16, avec un harnais reproduisant
l'environnement Supabase (`auth.users`, `auth.uid()`, `storage.buckets`, rôles
`anon` / `authenticated` / `service_role`) :

1. **Rejeu intégral** des 14 migrations dans l'ordre — toutes appliquées sans
   erreur.
2. **Tests fonctionnels** (transactions annulées) :
   - premier dépôt → 1 contact, 1 dossier, 1 intérêt, priorité dérivée ;
   - rejeu de la même clé d'idempotence → **aucun doublon** ;
   - même personne sur un **autre bien** → **1 contact, 1 dossier, 2 intérêts**,
     critères unionnés (2 types, 2 localisations) ;
   - données du contact **intactes** après réutilisation ;
   - matching explicable retourné avec facteurs et poids.
3. **Tests de règles métier** : étapes protégées refusées ; « perdu » sans motif
   refusé ; dossier clos non déplaçable ; réouverture tracée ; contrainte de
   rattachement exclusif des tâches vérifiée dans les deux sens.
4. **Tests d'isolation RLS** : agent non affecté → **0 dossier** ; setter
   (opérateur) → dossier visible.
5. **Tests de posture de sécurité** : `anon`/`PUBLIC` sans `EXECUTE` sur les
   17 fonctions ; aucun privilège table pour `anon` ; RLS active partout ;
   `search_path` figé partout ; audit immuable.

**Backfill.** La migration rattache les intérêts déjà enregistrés à un dossier
(idempotent, aucun doublon possible grâce à l'unicité par contact). Le projet
distant ne contient aucune donnée acquéreur à ce jour (`buyer_interests` : 0
ligne), donc le backfill est un no-op — il reste néanmoins correct si des
données apparaissent avant l'application.

---

## 10. Points d'extension (hors périmètre V1)

Préparés par l'architecture, **non développés** ici — et l'interface le dit
explicitement plutôt que de laisser croire à une fonction disponible :

- planification de visite rattachée à l'Agenda existant ;
- suivi structuré des offres et contre-offres ;
- envoi d'e-mails et de SMS depuis la fiche ;
- proposition de biens suggérés à l'acquéreur (aucune campagne automatique) ;
- partage d'un dossier acquéreur avec une organisation partenaire (préalable à
  l'ouverture du rôle `partenaire_lecture`).

---

## 11. Réserves et questions ouvertes

- **RGPD.** Les intérêts acquéreurs portent un `PrivacyRecord` dont la base
  légale reste `a_valider_juridiquement`. Le dossier acquéreur consolide des
  données personnelles sur une durée potentiellement longue : **durée de
  conservation, information de la personne et base légale doivent être validées
  juridiquement avant mise en production**. Aucune conformité n'est présumée
  ([05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)).
- **Fusion de dossiers.** Aucune fusion manuelle de deux dossiers n'est
  proposée en V1 : le dédoublonnage conservateur par e-mail peut laisser deux
  dossiers distincts pour une même personne ayant utilisé deux adresses. C'est
  un choix assumé — mieux vaut deux dossiers qu'une fusion erronée. Une action
  de fusion **tracée et réversible** reste à concevoir.
- **Matching.** La compatibilité budgétaire dépend de
  `property_public_config.reference_value_cents`, saisie par un opérateur. Sans
  cette valeur, le critère budget est neutre et signalé comme « donnée
  manquante » — jamais deviné.
