# 14 — Alertes Slack des rendez-vous d'estimation (V1)

Notifications opérationnelles envoyées dans le canal Slack privé
`#alertes-rdv-estimations` lorsqu'un rendez-vous d'estimation est **planifié**,
**reporté** ou **annulé** depuis le CRM Prodigio.

> Périmètre strictement limité à ces alertes Slack. Ni Resend, ni Twilio, ni
> WhatsApp, ni Fabrique de biens. S'appuie sur la planification des estimations
> (voir [13-CALENDAR-ESTIMATIONS.md](13-CALENDAR-ESTIMATIONS.md)).

---

## 1. Architecture

| Couche | Fichier | Rôle |
|---|---|---|
| Déclenchement | `src/modules/calendar/booking.ts` | Émet l'alerte aux 3 points RÉELLEMENT confirmés, avec anti-doublon |
| Collecte | `src/modules/calendar/notifications/collect.ts` | Assemble les données (bien + contact + membres) EN REQUÊTE |
| Planification | `src/modules/calendar/notifications/schedule.ts` | Diffère l'envoi réseau après la réponse via `after()` (Next.js) |
| Orchestrateur | `src/modules/calendar/notifications/notify.ts` | Timeout, réessais bornés, best-effort, logs nettoyés |
| Message | `src/modules/calendar/notifications/message.ts` | Block Kit **pur**, échappement, omission des champs vides |
| Transport | `src/modules/mandates/notifications/slack.ts` (réutilisé) | POST webhook + timeout `AbortController` |
| Config | `src/config/env.ts` | `SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL` + `isEstimationSlackConfigured` |

Flux : mutation CRM + Google confirmée → collecte en requête (rapide) → `after()`
diffère l'envoi Slack → l'orchestrateur poste le message (best-effort). La réponse
utilisateur n'attend jamais l'appel réseau Slack.

---

## 2. Déclencheurs (moment exact)

Les alertes ne partent qu'**après confirmation complète** que la mutation CRM
**et** la mutation Google correspondante ont réussi, et qu'**aucune compensation**
n'a été nécessaire.

| Événement | Point exact | Titre Slack |
|---|---|---|
| **Planifié** | `bookEstimation` — après `crm_confirm_estimation_appointment` (événement Google créé, dossier avancé), sur le chemin `reserve.created = true` uniquement | `📅 Nouveau rendez-vous d'estimation` |
| **Reporté** | `rescheduleEstimation` — après le patch Google **et** `crm_reschedule_estimation_appointment`, uniquement si le créneau a **réellement changé** | `🔁 Rendez-vous d'estimation reporté` |
| **Annulé** | `cancelEstimation` — après `crm_cancel_estimation_appointment`, uniquement si le rendez-vous **n'était pas déjà annulé** | `❌ Rendez-vous d'estimation annulé` |

Aucune alerte n'est envoyée si : la validation échoue, un créneau est devenu
indisponible, l'appel Google échoue, l'écriture CRM échoue, l'opération est
compensée, l'utilisateur rejoue la même action, un double-clic déclenche un rejeu
idempotent, ou rien n'a réellement changé.

---

## 3. Anti-doublon (une seule alerte par transition métier)

Garanti au niveau du service, à partir des contrats déjà présents (aucune
migration) :

- **Créé** : la fonction SQL `crm_reserve_estimation_appointment` renvoie
  `created` (véritable insertion) grâce à la clé d'idempotence unique. Seul le
  chemin `created = true`, ET après confirmation, atteint le point d'alerte. Un
  double-clic / rejeu sort plus tôt (`created = false`) sans jamais alerter.
- **Reporté** : comparaison des instants (ancien vs nouveau créneau) ; un report
  au même horaire ne déclenche aucune alerte.
- **Annulé** : lecture du statut **avant** mutation ; une seconde annulation d'un
  rendez-vous déjà `annulé` ne déclenche aucune alerte.

---

## 4. Contenu des messages (Block Kit)

Toutes les valeurs utilisateur sont **échappées** (anti-mention `@channel/@here`,
anti-injection de lien/format) ; les champs vides sont **omis**.

- **Planifié** : créneau (début → fin, durée), fuseau Europe/Paris, statut
  `Planifié`, agent, personne ayant planifié, propriétaire (nom, téléphone
  international, e-mail), type de bien, ville, adresse, valeur estimée. Bouton
  principal **« Ouvrir le dossier dans Prodigio CRM »** → `{SITE_URL}/crm/mandats/{opportunityId}`.
  Bouton secondaire **« Voir dans Google Calendar »** si un lien non sensible est
  disponible.
- **Reporté** : ancien créneau, nouveau créneau, agent, propriétaire, téléphone,
  adresse, personne ayant reporté, bouton dossier.
- **Annulé** : créneau prévu, agent, propriétaire, téléphone, adresse, personne
  ayant annulé, **motif uniquement s'il existe** (colonne `cancel_reason`),
  bouton dossier.

`SITE_URL` = `NEXT_PUBLIC_SITE_URL` si défini, sinon `https://go.prodigio.fr`.

### Données JAMAIS envoyées

Jetons OAuth / access / refresh, secret de chiffrement, webhook Slack, variables
d'environnement, IP, user agent, JWT, clé d'idempotence, preuve de consentement,
payload JSON brut, journal d'audit brut, détails techniques d'erreurs. Les
coordonnées du propriétaire **sont** autorisées (canal privé, nécessaires au
traitement opérationnel).

---

## 5. Comportement en panne

- **Webhook absent** (preview/dev) : alertes désactivées proprement, aucun appel,
  le rendez-vous fonctionne normalement.
- **Timeout / erreur réseau / HTTP 5xx** : au plus **2 nouvelles tentatives**
  (3 au total), timeout **~4 s** par tentative. L'échec est journalisé (métadonnées
  nettoyées) sans jamais lever d'exception.
- **HTTP 4xx** : aucun réessai (payload/URL invalide — un réessai serait inutile).
- **L'échec de Slack n'annule ni ne ralentit** un rendez-vous déjà enregistré :
  l'envoi est **différé** après la réponse utilisateur (`after()`), et l'ensemble
  est best-effort.
- **Logs** : uniquement `event`, `status`, `attempts`, `code` HTTP,
  `opportunityId`. Jamais de coordonnées, de message complet ni de webhook.

---

## 6. Variable d'environnement (Vercel)

| Variable | Portée | Secret |
|---|---|---|
| `SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL` | **Serveur uniquement** (Production) | **oui** |

Règles : jamais préfixée `NEXT_PUBLIC_`, jamais dans le navigateur, les logs, Git,
le bundle ou les réponses. Ajoutée vide dans `.env.example`. Absente → alertes
désactivées proprement. À créer dans Slack (webhook entrant pointant vers le canal
privé `#alertes-rdv-estimations`) puis à déposer dans Vercel (Production).

---

## 7. Limite connue (honnête)

Une modification effectuée **directement dans Google Calendar** (déplacement ou
suppression de l'événement côté Google) **ne déclenche pas** encore d'alerte
Slack : aucune synchronisation entrante Google (webhooks/watch) n'est construite
dans cette V1. Seules les actions effectuées **depuis le CRM Prodigio** (planifier,
reporter, annuler) sont notifiées.

---

## 8. Procédure de recette réelle (post-fusion)

> Aucun message réel ne doit être envoyé dans Slack avant autorisation explicite.

1. Créer un **webhook entrant Slack** vers le canal privé `#alertes-rdv-estimations`.
2. Déposer `SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL` dans **Vercel → Production**
   (jamais `NEXT_PUBLIC_`).
3. Prérequis calendrier remplis (voir doc 13) : agent avec calendrier connecté.
4. Depuis une fiche mandat, **planifier** une estimation → vérifier l'arrivée
   d'**une** alerte `📅` avec créneau, coordonnées et bouton « Ouvrir le dossier ».
5. **Double-cliquer** / rejouer la même réservation → vérifier qu'**aucune**
   seconde alerte n'arrive.
6. **Reporter** le rendez-vous vers un autre créneau → **une** alerte `🔁` (ancien
   + nouveau créneau). Reporter au même horaire → **aucune** alerte.
7. **Annuler** → **une** alerte `❌`. Annuler à nouveau → **aucune** alerte.
8. Retirer temporairement la variable (preview) → vérifier que les rendez-vous
   fonctionnent toujours **sans** alerte et sans erreur.
9. Contrôler les logs serveur : aucune coordonnée, aucun webhook, aucun secret.
