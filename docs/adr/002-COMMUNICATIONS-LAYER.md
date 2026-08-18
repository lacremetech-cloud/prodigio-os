# ADR 002 — Couche Communications (e-mails, SMS, automatisations)

- **Statut** : **Acceptée pour la V1, réévaluable**.
- **Portée** : centre de communications de Prodigio OS, e-mails transactionnels
  et fondation des automatisations.
- **Date** : voir historique Git.

> ⚠️ Cette ADR décrit une **fondation technique désactivée**. Aucun envoi réel
> n'est activé. La base légale des traitements reste `a_valider_juridiquement`
> (voir [../05-OPEN-QUESTIONS.md](../05-OPEN-QUESTIONS.md)) : **aucune
> conformité RGPD n'est acquise ni présumée**.

---

## 1. Contexte — ce qui existe déjà (audit)

L'audit a porté sur le schéma distant (projet `wmhrpweefutwldbhllhg`, lecture
seule) et sur le code du dépôt au commit `51260da`.

### 1.1 Objets métier déjà en place — à RÉUTILISER, jamais à dupliquer

| Objet | Table | Ce qu'il apporte à la couche Communications |
|---|---|---|
| **La personne** | `contacts` (11 colonnes) | `email`, `phone`, `preferred_channel` (`telephone`/`email`/`indifferent`). **Seul** porteur des coordonnées. |
| **Traçabilité RGPD** | `privacy_records` (17 colonnes) | `purpose`, `legal_basis` (défaut `a_valider_juridiquement`), `notice_version`, `authorized_channels text[]`, `choice` (`accorde`/`refuse`/`retire`), `choice_source`, `proof jsonb`, **`do_not_contact boolean`**, rattachement `contact_id` / `submission_id` / `buyer_interest_id`. |
| **Dossier vendeur** | `opportunities` | Rattachement d'un message au dossier Mandat. |
| **Dossier acquéreur** | `buyer_profiles` | Rattachement d'un message au dossier Acquéreur. |
| **Bien** | `properties` | Rattachement facultatif. |
| **Rendez-vous** | `estimation_appointments` | `starts_at`, `owner_email`, `owner_contact_id`, `google_event_id`, `status`, `idempotency_key`. |
| **Suivi opérationnel** | `tasks`, `activities` | Déjà élargies au CRM Acquéreurs. **Une communication n'est pas une tâche.** |
| **Audit immuable** | `audit_events` | 14 `entity_type`, 61 `event_type`. À **étendre**, jamais à dupliquer. |

### 1.2 Canaux sortants qui existent déjà

| Canal existant | Destinataire | Statut vis-à-vis de cette couche |
|---|---|---|
| **Slack Mandats** (`SLACK_MANDATES_WEBHOOK_URL`) | **Équipe interne** | Hors périmètre : alerte interne, pas une communication au contact. |
| **Slack Estimations** (`SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL`) | **Équipe interne** | Idem. |
| **Slack Acquéreurs** (`SLACK_BUYER_LEADS_WEBHOOK_URL`) | **Équipe interne** | Idem. |
| **Supabase Auth** (invitations, magic links) | **Utilisateurs internes** | Hors périmètre : ce sont des e-mails d'authentification d'un **Utilisateur**, pas d'un **Contact**. |
| **Google Calendar** (`sendUpdates=all`) | **Contact propriétaire** | **DANS le périmètre — risque de doublon.** Voir §5. |

### 1.3 Trois constats déterminants

1. **`privacy_records` est déjà la source de vérité des oppositions** :
   `do_not_contact`, `choice`, `authorized_channels`. Créer une seconde table de
   préférences serait une **deuxième source de vérité** — interdit. On l'étend
   plutôt que de la doubler.
2. **Google Calendar envoie déjà** l'invitation, la mise à jour et l'annulation
   au propriétaire — **mais uniquement si `owner_email` est renseigné**
   (`attendees` conditionnel dans `booking.ts`). La responsabilité doit être
   tranchée événement par événement.
3. **Le transport Slack existant est le bon modèle** : `server-only`, `fetchImpl`
   injectable, timeout `AbortController`, retries bornés, aucun secret journalisé,
   désactivation propre si la variable est absente. La couche Communications
   **reprend ce modèle** plutôt que d'en inventer un autre.

---

## 2. Décision

### 2.1 Le domaine ne connaît aucun fournisseur

Le flux est **strictement** :

```
Événement métier → règle d'éligibilité → outbox → fournisseur → retour → historique CRM
```

Cinq interfaces serveur, définies par Prodigio, implémentées par des adaptateurs
remplaçables :

| Interface | Rôle | Ne fait PAS |
|---|---|---|
| `CommunicationPolicy` | Décide si un message **peut** exister (catégorie, opposition, canal autorisé, base légale). | N'envoie rien. |
| `TemplateRenderer` | Rend un modèle **versionné** avec des variables **déclarées**. | N'invente aucune variable. |
| `CommunicationDispatcher` | Prend un lot d'outbox, applique la politique, appelle le fournisseur, réconcilie. | Ne décide pas seul d'envoyer : `dryRun` par défaut. |
| `EmailProvider` | Transport e-mail. | Ne connaît ni contact, ni dossier, ni consentement. |
| `SmsProvider` | Transport SMS. | Idem. |

**Aucun identifiant Lumail ou Twilio n'entre dans le modèle de domaine.** Les
identifiants fournisseur vivent dans deux colonnes de `communication_messages`
(`provider`, `provider_message_id`) qui sont des **traces**, jamais des clés
métier. Supprimer Lumail demain n'invalide aucun dossier, aucun consentement,
aucun modèle.

### 2.2 L'outbox est la seule frontière d'envoi

Aucun code métier n'appelle un fournisseur. Un événement métier écrit une ligne
d'`communication_outbox` (charge utile **minimale**, sans PII) ; un `dispatcher`
serveur la consomme. Conséquences retenues :

- **Panne fournisseur ⇒ le dossier métier reste valide** (l'outbox est écrite en
  base, dans la même transaction que l'événement métier lorsque c'est possible) ;
- **rejeu d'événement ⇒ aucun doublon** (clé d'idempotence unique) ;
- **retries bornés** (`attempt_count` + `max_attempts`, pas de boucle infinie) ;
- **aucune perte silencieuse** (statut `echec` visible dans l'interface).

### 2.3 Idempotence : portée par Prodigio, pas par le fournisseur

La documentation Lumail **ne décrit aucun en-tête d'idempotence**. Twilio n'en
offre pas non plus sur `Messages.json`. L'idempotence est donc garantie **en
base**, à deux niveaux, par des index uniques :

```
communication_outbox.event_key    = <event_type>:<id d'entité>[:<horodatage>]
communication_messages.idempotency_key = <event_key>:<canal>
```

Ces clés ne contiennent que des **identifiants techniques et des horodatages** —
jamais une adresse e-mail, un téléphone ou un nom. Un rejeu du même événement
n'insère rien (`on conflict do nothing`) et ne peut donc pas produire un second
message.

### 2.4 REST plutôt que SDK, pour les deux fournisseurs

**Décision : appels REST via `fetch`, transport `server-only`, `fetchImpl`
injectable.** Motifs :

1. la constitution interdit les **dépendances flottantes** ; ajouter deux SDK
   propriétaires pour deux endpoints est disproportionné ;
2. la surface utile est minuscule — Lumail : `POST /api/v1/emails` ; Twilio :
   `POST …/Messages.json` ;
3. un `fetchImpl` injectable permet de **tester sans jamais appeler l'API réelle**
   (déjà éprouvé sur Slack) ;
4. un SDK importerait son propre modèle de données dans notre domaine — ce que
   cette ADR interdit explicitement.

### 2.5 Ce que la V1 ne construit pas

- ❌ aucun **envoi réel** (le `dispatcher` est en `dryRun` tant que
  `COMMUNICATIONS_DISPATCH_ENABLED` n'est pas explicitement à `true`) ;
- ❌ aucun **import de contacts** vers Lumail ;
- ❌ aucune **campagne marketing**, aucune séquence commerciale ;
- ❌ aucun **éditeur graphique** de workflows ;
- ❌ aucune **purge automatique** ni durée de conservation inventée ;
- ❌ aucun **agent IA autonome** : l'IA pourra proposer un brouillon, jamais
  décider d'envoyer.

---

## 3. Modèle de données retenu (additif)

Cinq objets, aucun doublon d'un objet existant :

| Table | Raison d'exister | Pourquoi pas une table existante |
|---|---|---|
| `communication_templates` | Modèle **versionné** (clé stable + version), variables **déclarées**, catégorie, statut. | Aucune table de modèles n'existe. |
| `communication_messages` | **Historique** d'un message : à qui, pourquoi, quand, par quel canal, livré ou non. | `activities` = interaction commerciale saisie par un humain ; un message automatique n'en est pas une. |
| `communication_outbox` | File d'attente d'**événements métier** à traiter. | Aucune file n'existe ; `tasks` = action humaine. |
| `communication_suppressions` | Liste d'**opposition centralisée** (bounce dur, plainte, désinscription, demande). | `privacy_records` porte le **choix éclairé** de la personne ; la suppression porte un **fait technique de délivrabilité**. Les deux sont consultés ensemble (§4). |
| `communication_automations` + `communication_automation_runs` | Définition **versionnée** (déclencheur, conditions, délai, action) et son **exécution** (pause, annulation, sortie, idempotence). | Rien d'équivalent. |

`privacy_records` est **étendue** de deux colonnes (`opportunity_id`,
`buyer_profile_id`) pour rattacher une preuve à un dossier — elle **reste** la
source de vérité du consentement.

---

## 4. Deux notions distinctes, jamais confondues

| | `privacy_records` | `communication_suppressions` |
|---|---|---|
| Nature | **Choix** de la personne + base légale | **Fait technique** ou **opposition** |
| Exemples | consentement accordé/refusé/retiré, canaux autorisés, `do_not_contact` | bounce définitif, plainte pour spam, désinscription, demande explicite |
| Origine | funnel, formulaire, preuve conservée | retour fournisseur, action humaine |
| Effet | conditionne la **base légale** | **bloque** le canal, quelle que soit la base légale |

**La politique interroge les deux.** Un blocage de l'une **suffit** à empêcher un
message. Aucune ne prime sur l'autre pour « débloquer » : elles ne peuvent que
restreindre.

---

## 5. Google Calendar vs Prodigio — responsabilités tranchées

`booking.ts` appelle `insertEvent` / `patchEvent` / `deleteEvent` avec
`sendUpdates=all`, **et** `attendees` renseigné **si et seulement si**
`owner_email` existe.

| Événement | Google envoie ? | Prodigio envoie ? | Règle appliquée |
|---|---|---|---|
| Estimation planifiée | ✅ invitation, si `owner_email` | ❌ **jamais** si un `google_event_id` existe **et** que le propriétaire est invité | Anti-doublon `google_couvre_l_envoi` |
| Estimation reportée | ✅ mise à jour | ❌ même règle | Idem |
| Estimation annulée | ✅ annulation | ❌ même règle | Idem |
| **Rappel** de rendez-vous | ⚠️ rappels **du calendrier de l'invité**, configurés par l'invité, non garantis | ✅ **oui** — responsabilité Prodigio | Aucun doublon : Google ne garantit aucun rappel côté destinataire |
| Demande de mandat enregistrée | ❌ | ✅ | Accusé de réception |
| Intérêt acquéreur enregistré | ❌ | ✅ | Accusé de réception |

Lorsque `owner_email` est **absent**, Google n'invite personne : le message
Prodigio redevient éligible. La règle est donc évaluée **sur la donnée**, jamais
supposée.

---

## 6. Conséquences

**Positives** — les dossiers, consentements et modèles survivent à un changement
de fournisseur ; l'historique est lisible dans le CRM ; l'idempotence est
démontrable ; une panne fournisseur n'altère aucun dossier.

**Négatives assumées** — un `dispatcher` doit être déclenché (aucun cron n'est
créé dans cette V1 : le déclenchement reste manuel/serveur, documenté) ; le
rapprochement des statuts est **par sondage** tant qu'aucun webhook signé n'est
disponible côté Lumail. En conséquence, la plupart des messages resteront
durablement en **`en_file_fournisseur`** : c'est volontaire. Une réponse HTTP 200
n'accuse qu'une **mise en file**, et le système refuse d'afficher `livre` sans
preuve fournisseur — mieux vaut un statut honnêtement incertain qu'une livraison
affirmée à tort.

**Risque documenté** — `POST /api/v1/emails` de Lumail **crée le destinataire
comme « subscriber »** s'il n'existe pas. Envoyer un transactionnel a donc un
**effet de bord côté fournisseur**. C'est une raison supplémentaire de ne rien
activer avant validation juridique, et de ne **jamais** importer la base de
contacts.

---

## 7. Réévaluation

Cette décision est révisée si : Lumail publie des webhooks signés (le
rapprochement passerait en réception d'événements) ; le volume dépasse la
capacité d'un `dispatcher` synchrone (file dédiée) ; ou la validation juridique
impose un modèle de consentement différent.
