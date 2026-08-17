# 20 — CRM Acquéreurs V1

CRM opérationnel permettant à l'équipe Prodigio de **centraliser, qualifier,
affecter et suivre** tous les acquéreurs générés par les expériences publiques
des biens.

Cette tranche transforme les `buyer_interests` déjà capturés par le Funnel
Acquéreur ([19-PUBLIC-PROPERTY-EXPERIENCE.md](19-PUBLIC-PROPERTY-EXPERIENCE.md))
en **dossiers acquéreurs** exploitables, **sans dupliquer** les contacts, tâches,
activités, utilisateurs, propriétés, systèmes d'audit ni composants CRM
existants.

> **Statut.** Migration **APPLIQUÉE** au projet `wmhrpweefutwldbhllhg` le
> 2026-08-16 (version distante `20260816172831`, nom `buyers_crm_v1`,
> enregistrée **exactement une fois**). Recette contrôlée exécutée sur données
> **entièrement fictives** en transaction annulée, retour à la baseline vérifié.
> Voir §9 pour le détail, les contrôles et les écarts constatés.

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

> **`partenaire_lecture` — exigence définitive V1.** Ce rôle **n'a aucun accès**
> aux dossiers acquéreurs **tant qu'aucun partage explicite et précisément
> limité n'existe**. Aucun mécanisme de partage de *dossier acquéreur* n'est
> conçu à ce jour (l'équivalent d'`OpportunityOrganization` côté acquéreurs
> reste à décider — [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)). Accorder une
> visibilité par défaut ouvrirait *tous* les dossiers : c'est exclu. Le rôle
> reste par ailleurs non attribuable en V1
> ([12-USERS-AND-ACCESS.md](12-USERS-AND-ACCESS.md)).

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

### Comportement du CRM Mandats — strictement inchangé

La politique RLS de `tasks` / `activities` est réécrite pour couvrir les deux
cas, en reproduisant **mot pour mot** la branche mandat en vigueur :

```sql
case when buyer_profile_id is not null
     then public.crm_buyer_profile_access(buyer_profile_id)
     else (
       public.crm_is_operator()
       or (public.crm_has_role('agent_immobilier')
           and opportunity_id in (select public.crm_assigned_opportunity_ids()))
     ) end
```

> ⚠️ **Piège identifié et corrigé pendant l'audit.** La politique en vigueur est
> celle posée par `20260730190000_users_and_access_v1` (isolation *role-aware*),
> qui avait **déjà remplacé** la version initiale plus permissive de
> `20260730120000_crm_internal_v1` (`crm_has_access()`). Reprendre cette version
> initiale aurait rouvert **toutes** les tâches et activités Mandats aux agents
> **non affectés** et à `partenaire_lecture` — pour qui `crm_has_access()`
> renvoie `true`. Vérifié en base : agent affecté 1/1, agent non affecté 0/0,
> `partenaire_lecture` 0/0, administrateur 1/1.

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
additive**. Elle a été **appliquée une seule fois** au projet
`wmhrpweefutwldbhllhg` via l'outil officiel Supabase (`apply_migration`).

| Élément | Valeur |
|---|---|
| Project ref | `wmhrpweefutwldbhllhg` |
| Nom de migration | `buyers_crm_v1` |
| Version distante | `20260816172831` |
| Occurrences enregistrées | **1** (total : 14 migrations) |
| Migrations historiques rejouées | **aucune** |

### Baseline distante avant application (agrégats, aucune PII)

`contacts` 2 · `privacy_records` 2 · `audit_events` 60 · `opportunities` 2 ·
`funnel_submissions` 2 · `estimation_appointments` 7 · `activities` 10 ·
`opportunity_assignments` 2 · `opportunity_contacts` 2 ·
`opportunity_organizations` 2 · `organization_invitations` 1 ·
`organization_memberships` 1 · `organizations` 1 · `tasks` 0 · `mandates` 0 ·
`properties` 0 · `property_public_config` 0 · `buyer_interests` 0.

Le backfill est donc un **no-op** (aucun intérêt acquéreur préexistant), tout en
restant correct si des données apparaissent.

### Contrôles post-application (mesurés sur le projet distant)

| Contrôle | Résultat |
|---|---|
| Fonctions CRM Acquéreurs exécutables par `anon`/`PUBLIC` | **0 sur 17** |
| Privilèges table directs `anon`/`PUBLIC` | **0** |
| RLS active | `buyer_profiles`, `buyer_search_criteria`, `buyer_assignments`, `buyer_interests`, `tasks`, `activities` = toutes `true` |
| `search_path` figé | **17 sur 17** |
| Audit immuable | trigger `audit_events_immutable` présent |
| Unicité 1-1 profil/contact | `buyer_profiles_contact_unique` présente |
| Rattachement exclusif | `tasks_owner_exactly_one`, `activities_owner_exactly_one` présentes |
| Funnels publics | `submit_mandate_funnel` et `submit_buyer_interest` toujours exécutables par `anon` |
| Branche Mandats des politiques RLS | empreinte `aea0beab…` — **identique avant et après**, et identique à la référence locale |
| Advisors sécurité Supabase | **0 ERROR** ; uniquement des `WARN` attendus (fonctions `SECURITY DEFINER` exécutables par `authenticated` = architecture d'écriture) |

### Recette contrôlée (données fictives, transaction annulée)

Exécutée sur le domaine réservé `.invalid`, dans un bloc terminé par `RAISE` —
**rollback atomique garanti**. Aucun vrai webhook Slack, aucun contournement de
Turnstile (le dépôt SQL direct ne passe pas par la couche applicative).

| # | Preuve | Résultat |
|---|---|---|
| 1 | Même e-mail sur deux biens | 1 contact, 1 dossier, 2 intérêts |
| 2 | Contact vendeur réutilisé | `RecetteVendeur/Fictif/+33000000001/qualifie` **inchangé** |
| 3 | Deux e-mails différents | **deux dossiers distincts, aucune fusion** |
| 4 | Rattachement exclusif | 1 tâche Mandat + 1 tâche Acquéreur, cloisonnées |
| 5 | Quatre notions distinctes | score `88` / reco `prioritaire` / qualification `qualifie` / étape `visite_planifiee` |
| 6 | Matching | `buyer-matching-v1`, deux appels identiques ⇒ résultat identique ; sans budget ni localisation, poids évaluable **60/100** et `missing = ["budget"]` |
| 7 | Non-membre | **0 dossier** |
| 8 | `partenaire_lecture` | **0 dossier, 0 critère** |
| 9 | Matrice opérateurs | agent non affecté 0 / agent affecté 2 ; setter 2 / admin 2 |
| 9c | **Non-régression Mandats** | tâches Mandats : agent non affecté **0**, agent affecté **1** |
| 10 | Mutations interdites | étape protégée refusée ; perte sans motif refusée ; setter ne peut pas clore — **refus en base**, pas seulement dans l'interface |
| 11 | Audit | 6 événements, **0** contenant e-mail, téléphone, nom ou texte libre |
| 12 | Accès anonyme | lecture dossiers refusée (`permission denied for table buyer_profiles`) ; matching refusé |

**Retour à la baseline vérifié** après la recette : tous les compteurs sont
identiques à l'avant-application, et **0** utilisateur fictif subsiste.

### Réconciliation dépôt ↔ production (post-application)

Le fichier de migration versionné a été **réconcilié** pour qu'une installation
neuve reproduise **exactement** les définitions présentes en production. Seuls
**48 lignes de commentaires** ont été retirées de **9 corps de fonctions** —
aucune sémantique, politique, permission, contrainte ni signature modifiée, et
**aucune écriture distante** n'a été effectuée.

Fonctions réconciliées : `buyer_attach_interest`, `crm_buyer_assign`,
`crm_buyer_property_matches`, `crm_buyer_qualify`, `crm_buyer_record_offer`,
`crm_buyer_record_outcome`, `crm_buyer_set_stage`, `crm_buyer_upsert_criteria`,
`submit_buyer_interest`.

Vérification après rejeu des 14 migrations sur PostgreSQL vierge : les **17
fonctions** sont identiques à la production sur `prosrc` (**commentaires
inclus**), arguments, `SECURITY DEFINER`, volatilité et `search_path`. Les
empreintes des politiques Mandats restent `aea0beab…`, inchangées.

### Écart de privilège constaté (à traiter séparément)

`buyer_attach_interest` est **exécutable par `authenticated` en production**
(`acl = postgres=X authenticated=X service_role=X`) alors que la migration ne
révoque que sur `public, anon`. Cause : Supabase applique des
`ALTER DEFAULT PRIVILEGES` accordant `EXECUTE` à `anon`/`authenticated`/
`service_role` sur les nouvelles fonctions du schéma `public` ; la révocation
sur `anon` a bien pris effet, mais **pas** sur `authenticated`.

Portée réelle : la fonction est un **helper interne** appelé par
`submit_buyer_interest`. Elle ne renvoie qu'un identifiant, ne lit ni ne modifie
aucune coordonnée, et n'expose aucune donnée personnelle. Un utilisateur
authentifié connaissant un identifiant d'intérêt valide pourrait toutefois
déclencher un rattachement et un événement d'audit. **Ce n'est pas une fuite de
données, mais un durcissement manquant.**

Non corrigé ici : la consigne de réconciliation interdit de modifier les
permissions, et le corriger ferait diverger le dépôt de la production. À traiter
par une **migration de durcissement dédiée** (`revoke all on function
public.buyer_attach_interest(uuid) from authenticated;`).

### Écarts historiques constatés et assumés

1. **Commentaires non transmis à l'application (mon erreur, désormais réconciliée).** Le corps déployé
   de 9 fonctions ne contient pas tous les commentaires `--` du fichier
   versionné : ils ont été condensés lors de la composition de l'appel
   d'application. **Les sémantiques sont prouvées identiques** : en retirant les
   commentaires des deux côtés, les 17 fonctions de cette migration ont des
   empreintes **strictement égales** à la référence locale construite depuis le
   fichier réel (dont `submit_buyer_interest`, `e3f72f73…`, 7392 caractères des
   deux côtés). Aucune correction n'a été appliquée en production pour ce seul
   écart cosmétique : une réécriture supplémentaire ferait courir un risque
   sémantique là où il n'y en a aucun. **Écart désormais résolu par la
   réconciliation ci-dessus : le fichier versionné reproduit exactement la
   production.**
2. **Dérive préexistante, hors périmètre.** `crm_buyer_interest_set_status`
   (posée par `20260802120000_public_property_experience_v1`) diffère entre le
   dépôt et la base : le message d'erreur déployé est `'interet introuvable'`
   au lieu de `'intérêt introuvable'` (accents retirés). Écart **cosmétique**,
   **antérieur** à cette PR, non corrigé ici — corriger reviendrait à rejouer
   une migration historique.
3. **Observation préexistante.** `crm_can_decide` et
   `crm_can_report_estimation` sont exécutables par `anon` (héritage de
   `estimation_to_mandate_v1`). Elles ne renvoient qu'un booléen et valent
   `false` pour `anon` (`auth.uid()` nul). Aucune fonction du CRM Acquéreurs
   n'est dans ce cas. À traiter séparément si souhaité.

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

## 11. Garde RGPD — périmètre des traitements et bloquants

> **Aucune conformité n'est affirmée.** Le CRM Acquéreurs **n'est pas déclaré
> juridiquement conforme**. La base légale des `privacy_records` acquéreurs reste
> `a_valider_juridiquement`, et cette valeur **ne doit pas être changée** sans
> validation juridique écrite.

### Trois finalités à ne jamais confondre

| # | Finalité | Nature |
|---|---|---|
| 1 | **Réponse et suivi de la demande explicite** relative à **un bien précis** | La personne a sollicité Prodigio sur ce bien : le traitement sert à traiter *sa* demande. |
| 2 | **Communications nécessaires au service demandé** | Organisation d'une visite, échanges sur ce bien, informations indispensables au suivi. |
| 3 | **Prospection ultérieure** — autres biens, campagnes, e-mails et SMS marketing | Finalité **distincte**, qui ne découle **pas** de la demande initiale. |

Les finalités 1 et 2 relèvent du traitement de la demande. **La finalité 3 est
une autre chose** : elle ne peut pas être déduite du simple fait qu'une personne
a manifesté un intérêt pour un bien.

En principe, les **communications marketing électroniques B2C** (e-mail, SMS)
nécessitent un **consentement distinct, spécifique et prouvable**, recueilli
séparément de la demande initiale. Le consentement enregistré aujourd'hui par le
funnel porte sur la demande, **pas** sur de la prospection.

### Bloquants avant toute activation marketing

Aucune campagne, aucun envoi d'e-mail ou de SMS marketing ne doit être activé
tant que **tous** les points suivants ne sont pas traités et validés :

1. **validation de la base légale** de chaque finalité (par un conseil qualifié) ;
2. **texte d'information** présenté à la personne, versionné ;
3. **durée de conservation** définie par finalité ;
4. **mécanisme d'opposition / désinscription** effectif et documenté ;
5. **exercice des droits** (accès, rectification, effacement, opposition,
   portabilité) : procédure et responsable identifiés ;
6. **suppression ou anonymisation** au terme de la durée retenue ;
7. **liste d'opposition** (« ne plus contacter ») respectée par tous les canaux.

### Référence de durée — indicative, non implémentée

La **CNIL retient une référence de trois ans** à compter du dernier contact pour
les données de **prospects** utilisées à des fins de **prospection**. Cette
référence est mentionnée ici **à titre indicatif** : elle **n'est pas
implémentée** comme règle juridique définitive et **ne doit pas l'être** avant
validation. Aucune purge automatique n'existe dans cette version.

### Hors périmètre de cette PR

Ne sont **pas** construits ici, volontairement : moteur d'e-mailing, workflows
automatisés, campagnes, purge automatique, calcul de fin de conservation. Le
modèle conserve les preuves et l'historique nécessaires pour les concevoir plus
tard, sans préjuger de leur régime juridique.

---

## 12. Réserves et questions ouvertes

- **RGPD.** Les intérêts acquéreurs portent un `PrivacyRecord` dont la base
  légale reste `a_valider_juridiquement`. Le dossier acquéreur consolide des
  données personnelles sur une durée potentiellement longue : **durée de
  conservation, information de la personne et base légale doivent être validées
  juridiquement avant mise en production**. Aucune conformité n'est présumée
  ([05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)).
- **Aucune fusion automatique de dossiers — exigence définitive V1.** Deux
  e-mails différents produisent **deux dossiers distincts**. Aucune fusion
  automatique n'existe et aucune ne doit être introduite. Une éventuelle fusion
  future devra être **manuelle**, **réservée aux administrateurs**, **auditée**,
  et conçue dans une **mission séparée**.
- **Matching.** La compatibilité budgétaire dépend de
  `property_public_config.reference_value_cents`, saisie par un opérateur. Sans
  cette valeur, le critère budget est neutre et signalé comme « donnée
  manquante » — jamais deviné.
