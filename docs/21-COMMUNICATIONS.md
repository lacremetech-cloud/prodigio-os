# 21 — Centre de communications (V1)

> **Statut : fondation technique en place, ENVOI DÉSACTIVÉ.**
> Aucun e-mail, aucun SMS n'est émis. Aucun contact n'est importé chez un
> fournisseur. Aucune campagne, aucune séquence commerciale n'est active.
> La base légale des traitements reste **`a_valider_juridiquement`** :
> **aucune conformité RGPD n'est acquise ni présumée** (voir §10 et
> [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)).

Décision d'architecture : [adr/002-COMMUNICATIONS-LAYER.md](adr/002-COMMUNICATIONS-LAYER.md).

---

## 1. Ce que fait cette tranche

Prodigio OS devient l'**interface centrale** des communications adressées aux
contacts. L'équipe n'a plus à suivre ses leads dans ActiveCampaign, Systeme.io,
Lumail ou Twilio.

Prodigio conserve : les **contacts**, les **consentements et oppositions**, les
**dossiers**, les **modèles**, l'**historique**, les **événements métier**, les
**automatisations**, les **statuts de livraison**, les **permissions** et
l'**audit**.

Les prestataires externes restent de simples **infrastructures d'envoi**.

## 2. Source de vérité

| Donnée | Où elle vit | Ce qui n'est PAS la source de vérité |
|---|---|---|
| La personne et ses coordonnées | `contacts` | Le « subscriber » Lumail |
| Le consentement, la base légale, les canaux autorisés | `privacy_records` | Les préférences d'un fournisseur |
| Les oppositions bloquantes | `communication_suppressions` | La liste de suppression d'un fournisseur |
| Le contenu | `communication_templates` (versionné) | Les modèles Lumail |
| L'historique | `communication_messages` | Les journaux d'un fournisseur |
| L'événement métier | `communication_outbox` | Un webhook externe |

`provider` et `provider_message_id` sont des **traces**, jamais des clés métier.
Supprimer Lumail demain n'invalide aucun dossier, aucun consentement, aucun modèle.

## 3. Le modèle d'outbox

```
Événement métier → règle d'éligibilité → outbox → fournisseur → retour → historique
```

Un déclencheur SQL écrit dans `communication_outbox` **dans la même transaction**
que l'événement métier. Conséquences :

| Garantie | Mécanisme |
|---|---|
| **Double clic → un seul message** | Réservation atomique `for update skip locked` + verrou UI |
| **Rejeu d'événement → aucun doublon** | `communication_outbox.event_key` unique + `communication_messages.idempotency_key` unique |
| **Panne fournisseur → dossier valide** | L'outbox est écrite en base ; l'échec d'envoi n'annule rien |
| **Retries bornés** | `attempt_count < max_attempts` (max 10), une tentative par passage |
| **Aucune boucle infinie** | Pas de réessai automatique récursif ; le compteur est la borne |
| **Aucune perte silencieuse** | Tout `ignore` porte un `skip_reason` (contrainte CHECK) |

**Aucune PII** dans les clés d'idempotence ni dans la charge utile d'outbox :
uniquement des identifiants techniques et des horodatages, vérifié par test.

### Idempotence portée par Prodigio

Ni Lumail ni Twilio n'exposent d'en-tête d'idempotence sur l'envoi. C'est donc
**Prodigio** qui la garantit, par index unique en base.

## 4. Événements couverts (V1)

Six événements, **tous transactionnels**. Aucun marketing.

| Événement | Destinataire | Canal | Idempotence | Aucun message si… |
|---|---|---|---|---|
| Demande de mandat enregistrée | Propriétaire déposant | e-mail | `…:<submission_id>` | pas de contact / pas d'e-mail / opposition / modèle inactif |
| Intérêt acquéreur enregistré | Acquéreur | e-mail | `…:<interest_id>` | idem |
| Estimation planifiée | Propriétaire | e-mail | `…:<appointment_id>` | **Google couvre déjà l'envoi** ; créneau abandonné avant confirmation |
| Estimation reportée | Propriétaire | e-mail | `…:<appointment_id>:<nouvel horodatage>` | **Google couvre déjà l'envoi** ; RDV non confirmé |
| Estimation annulée | Propriétaire | e-mail | `…:<appointment_id>` | **Google couvre déjà l'envoi** |
| Rappel de rendez-vous | Propriétaire | e-mail | `…:<appointment_id>:<horodatage du créneau>` | RDV annulé/passé ; opposition |

## 5. Google Calendar vs Prodigio — responsabilités

`booking.ts` appelle Google avec `sendUpdates=all` **et** `attendees` renseigné
**si et seulement si** `owner_email` existe.

| Événement | Google envoie | Prodigio envoie |
|---|---|---|
| Confirmation de rendez-vous | ✅ invitation | ❌ bloqué en `google_couvre_l_envoi` |
| Report | ✅ mise à jour | ❌ idem |
| Annulation | ✅ annulation | ❌ idem |
| **Rappel** | ⚠️ dépend des réglages de l'invité, **non garanti** | ✅ **responsabilité Prodigio** |

La règle est évaluée **sur la donnée** (`google_event_id` présent **et**
`owner_email` renseigné), jamais supposée. Sans invité Google, le message
Prodigio redevient éligible.

## 6. Modèles versionnés

Une **clé stable** + une **version entière**. Les variables sont **déclarées** :

- une variable utilisée mais non déclarée ⇒ **rendu refusé** ;
- une variable déclarée mais sans valeur ⇒ **rendu refusé** (mieux vaut ne pas
  envoyer qu'envoyer « Bonjour {{prenom}} ») ;
- en `html`, les valeurs sont **échappées** : une donnée saisie par un tiers ne
  peut pas injecter de balise.

Un index unique partiel garantit **une seule version active** par clé et canal.
Les six modèles amorcés sont en **`brouillon`** : rien ne peut partir.

## 7. Politique d'éligibilité — autorité serveur

`crm_comm_eligibility(contact, canal, catégorie)` est la **seule autorité**. Le
miroir TypeScript (`policy.ts`) ne sert qu'à **expliquer** dans l'interface : le
navigateur ne peut rien contourner.

Ordre des vérifications, du plus absolu au plus contextuel :

1. coordonnée exploitable pour le canal → sinon `coordonnee_absente` ;
2. `privacy_records.do_not_contact` → `ne_plus_contacter` (**prime sur tout**) ;
3. opposition active couvrant canal + catégorie → `opposition_active` ;
4. si marketing : consentement `accorde`, base légale **≠**
   `a_valider_juridiquement`, canal explicitement autorisé → sinon
   `base_legale_insuffisante` ;
5. Google couvre déjà l'envoi → `google_couvre_l_envoi` ;
6. modèle absent / non actif → `modele_absent` / `modele_inactif` ;
7. envoi réel désactivé → `envoi_desactive`.

### Deux notions distinctes, jamais confondues

| | `privacy_records` | `communication_suppressions` |
|---|---|---|
| Nature | **Choix** de la personne + base légale | **Fait** bloquant |
| Exemples | consentement accordé/refusé/retiré, canaux autorisés | rebond définitif, plainte, désinscription |
| Effet | conditionne la base légale | **bloque** le canal |

Les deux sont consultées ensemble. **Aucune ne peut autoriser un envoi** : elles
ne font que restreindre.

## 8. Fournisseurs

### Lumail (e-mail)

**REST, pas de SDK** — la surface utile est d'un endpoint, et un `fetchImpl`
injectable permet de tester sans jamais appeler l'API réelle (voir ADR §2.4).

| | |
|---|---|
| Endpoint | `POST https://lumail.io/api/v1/emails` |
| Authentification | `Authorization: Bearer lum_…` |
| Corps | `to`, `from`, `subject`, `content`, `contentType`, `preview`, `replyTo`, `tracking` |
| Réponse | `{ success, message, qstashMessageId }` |
| Débit | 40 e-mails/s par voie ; voie prioritaire pour le transactionnel |
| Idempotence | **aucune** côté fournisseur ⇒ portée par Prodigio |
| Webhook signé | **non documenté** ⇒ rapprochement par sondage |

Réglages retenus : `tracking: { links: false, open: false }` — un lien
transactionnel doit rester lisible et vérifiable par le destinataire.

> ⚠️ **Effet de bord documenté** : `POST /emails` **crée le destinataire comme
> « subscriber »** s'il n'existe pas. Envoyer un transactionnel a donc une
> conséquence côté fournisseur. Raison supplémentaire de ne rien activer avant
> validation juridique, et de **ne jamais importer la base de contacts**.

### Twilio (SMS) — préparé, non activé

| | |
|---|---|
| Endpoint | `POST …/Accounts/{Sid}/Messages.json` |
| Authentification | `Basic base64(Sid:Token)` |
| Corps | `To`, `Body`, `From` ou `MessagingServiceSid` (form-encoded) |
| Réponse | `{ sid, status, error_code }` |
| Normalisation | **E.164 conservatrice** : un numéro non exploitable est refusé **avant** tout appel réseau, jamais « tenté pour voir » |

Aucun SMS n'est envoyé en V1.

### Codes d'erreur normalisés

Chaque adaptateur traduit ses codes propriétaires vers un vocabulaire unique
(`limite_debit`, `indisponible`, `destinataire_invalide`, `rejet_permanent`…).
Le CRM n'affiche jamais un code brut de fournisseur. Seuls `limite_debit`,
`indisponible` et `delai_depasse` sont considérés comme **transitoires**.

## 9. Permissions

| Rôle | Historique | Modèles | Oppositions | Automatisations | File |
|---|---|---|---|---|---|
| **administrateur** | ✅ tout | ✅ créer / activer | ✅ créer **et lever** | ✅ | ✅ |
| **manager** | ✅ tout | ✅ créer / activer | ✅ créer | ⛔ lecture | ✅ |
| **setter** | ✅ dossiers accessibles | 👁 lecture | 👁 lecture | 👁 lecture | ✅ |
| **agent immobilier** | ✅ **ses** dossiers, biens et RDV | 👁 lecture | 👁 lecture | ⛔ | ⛔ |
| **partenaire_lecture** | ⛔ **aucun accès** | ⛔ | ⛔ | ⛔ | ⛔ |

`partenaire_lecture` n'a **aucun accès** aux communications : aucun mécanisme de
partage de communication n'existe en V1, conformément à la décision produit prise
pour le CRM Acquéreurs.

Les coordonnées sont **masquées côté serveur** selon le rôle, via les règles
existantes (`maskContactValue`). La recherche ne porte jamais sur une coordonnée
masquée : filtrer dessus la révélerait par déduction.

## 10. Limites RGPD — NON levées

- La base légale reste **`a_valider_juridiquement`**. Ce n'est **pas** un
  consentement : c'est une question **non tranchée**.
- Le marketing est **structurellement refusé** tant que ce point n'est pas résolu
  — c'est un **refus prudent**, pas une conformité.
- **Aucune durée de conservation n'est inventée** ni implémentée. Aucune purge
  automatique n'est construite.
- Aucun contact n'est importé chez un fournisseur. Aucune campagne, aucune
  séquence commerciale n'est active.
- **Une validation juridique est requise avant toute mise en production** des
  traitements marketing.

Ce que le système garantit techniquement, et qui ne vaut pas conformité :
traçabilité du choix et de sa preuve, opposition bloquante, séparation
transactionnel/marketing, audit immuable sans contenu ni coordonnée.

## 11. Sécurité

- **RLS active** sur les six tables ; **aucun accès `anon`**, aucune politique
  `anon`, aucun droit d'écriture directe : toute écriture passe par une fonction
  `SECURITY DEFINER` à `search_path` figé.
- **Helpers internes** (`comm_operator_org`, `comm_can_manage`,
  `comm_google_covers_appointment`, `comm_enqueue`, les trois fonctions de
  déclencheur) : **aucun `EXECUTE`** pour `public`, `anon` ni `authenticated`.
  `comm_message_access` conserve `authenticated` car il est appelé **directement
  par les politiques RLS** (une politique est évaluée avec les privilèges du rôle
  appelant — voir la convention posée par `20260817120000`).
- **Aucun secret** dans le dépôt, le navigateur, les journaux ou l'audit. Aucune
  variable préfixée `NEXT_PUBLIC_`. Vérifié par test **et** par inspection du
  bundle de production.
- L'audit ne contient **jamais** le contenu d'un message ni une coordonnée :
  uniquement des identifiants, statuts et codes.
- **Aucun envoi autonome par une IA.** L'IA pourra plus tard proposer un
  brouillon, une segmentation ou un résumé ; elle ne décide jamais d'envoyer.

## 12. Configuration

| Variable | Rôle | Absente ⇒ |
|---|---|---|
| `LUMAIL_API_KEY` | Jeton d'API (`lum_…`) | Transport e-mail désactivé |
| `LUMAIL_FROM_EMAIL` | Expéditeur (domaine vérifié chez Lumail) | Transport e-mail désactivé |
| `LUMAIL_REPLY_TO` | Adresse de réponse | Réponses vers l'expéditeur |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | Transport SMS | SMS désactivé |
| `COMMUNICATIONS_DISPATCH_ENABLED` | Interrupteur d'**envoi réel** | **Simulation** |

L'interrupteur exige la valeur **exactement** `true`. `1`, `yes`, `TRUE` ne
l'activent pas : un envoi réel ne doit jamais résulter d'une valeur ambiguë. Il
est volontairement **distinct** de la présence des clés.

### Rotation des secrets

1. Créer un **nouveau** jeton chez le fournisseur (Lumail : Settings → API
   Tokens → Generate Token ; Twilio : Auth Tokens).
2. Mettre à jour la variable dans Vercel, **environnement par environnement**
   (production, preview, développement ont des secrets distincts).
3. Redéployer, puis vérifier l'état « Configuré » dans `/crm/communications`.
4. **Révoquer** l'ancien jeton chez le fournisseur.
5. Ne jamais faire transiter un jeton par un canal non chiffré, un commit, un
   ticket ou un message. Aucune valeur n'est lisible depuis l'application.

En cas de suspicion de fuite : révoquer d'abord, régénérer ensuite.

## 13. Application de la migration

`supabase/migrations/20260818120000_communications_v1.sql` — strictement
additive. **Ne pas exécuter automatiquement** : voir
[07-SUPABASE-SETUP.md](07-SUPABASE-SETUP.md).

Elle ne supprime aucune table, colonne, contrainte, politique ni fonction. Les
seuls objets existants touchés sont `privacy_records` (deux colonnes de
rattachement **ajoutées**) et `audit_events` (CHECK **étendus**, aucune valeur
retirée). Vérifié localement par empreintes : politiques et fonctions
préexistantes strictement identiques avant/après.

## 14. Limites de la V1

- Le traitement de la file est **déclenché manuellement** depuis l'interface :
  aucun cron n'est créé.
- Le rapprochement des statuts de livraison est **par sondage** : Lumail
  n'expose pas de webhook signé documenté.
- Les automatisations disposent d'une **définition versionnée et d'un journal
  d'exécution**, mais **aucun moteur d'exécution autonome** n'est activé.
- Aucun **éditeur graphique** de workflows.
- Pas de gestion des rebonds en réception : les oppositions se saisissent à la
  main tant qu'aucun webhook n'est disponible.

## 15. Plan V1.1

1. **Webhooks fournisseur signés** (si Lumail les publie) : rebonds, plaintes et
   désinscriptions alimenteraient automatiquement `communication_suppressions`.
2. **Déclenchement planifié** de la file et des rappels.
3. **Moteur d'automatisations** : évaluation des conditions et règles de sortie
   déclaratives déjà modélisées, avec pause et annulation.
4. **SMS activé** une fois le cadre juridique tranché et Twilio configuré.
5. **Assistance IA au brouillon** : proposition de contenu soumise à validation
   humaine — jamais d'envoi autonome.
6. **Durées de conservation** et purge, **après** validation juridique.
