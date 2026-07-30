# 10 — Alerte Slack « Nouvelle demande de mandat »

Notification Slack **fiable, sans doublon et non bloquante** lorsqu'une **vraie**
nouvelle demande de mandat est enregistrée dans Prodigio OS. Slack **signale** le
lead et **accélère sa prise en charge** ; il n'est **pas** un second CRM :
Prodigio OS reste l'unique source de vérité et l'unique outil de gestion.

---

## 1. Architecture retenue (la plus simple et fiable)

**Envoi serveur déterministe après une insertion réellement confirmée.**

```
Propriétaire → funnel → action serveur submitMandateFunnelAction
  → Turnstile vérifié (siteverify)
  → RPC submit_mandate_funnel (dépôt Supabase atomique + scoring serveur)
      → renvoie { accepted:true, created, opportunity_id }   (SERVEUR uniquement)
  → si created === true : after(() => notifyNewMandateSubmission(...))
      → webhook Slack (Block Kit) — best-effort, hors du chemin de réponse
```

Aucune outbox/dispatcher/cron : la fiabilité anti-doublon vient de la base
(l'insertion `on conflict do nothing` désigne **un seul** gagnant), et
`after()` (Next.js) exécute l'envoi **après** la réponse au propriétaire (le
platform maintient la fonction vivante) — donc **latence nulle** côté funnel.

> **Pourquoi pas d'outbox transactionnelle complète ?** Elle garantirait la
> délivrance même en cas de crash serveur entre l'insertion et l'envoi, mais
> exigerait un **dispatcher + cron** (nouvelle autorité, secret ou fonction
> planifiée). Pour la V1, la mission demande la solution la plus simple
> garantissant : alerte pour une seule nouvelle demande, pas de doublon, pas de
> régression, panne Slack non bloquante, traçabilité minimale. L'unique cas non
> couvert (crash du process entre le commit DB et l'envoi Slack) est rare sur
> serverless et laissé à une éventuelle V1.1 (outbox + dispatcher).

---

## 2. Moment exact du déclenchement

L'alerte part **uniquement** si, dans l'ordre :

1. la validation Zod serveur **réussit** (sinon : aucune alerte) ;
2. le honeypot est vide (sinon : aucune alerte) ;
3. Supabase **et** Turnstile sont configurés (sinon : aucune alerte) ;
4. le jeton **Turnstile est vérifié** côté serveur (sinon : aucune alerte) ;
5. la RPC `submit_mandate_funnel` renvoie `accepted:true` **et**
   `created === true` **et** un `opportunity_id` (sinon : aucune alerte).

Un simple chargement de page, une soumission refusée, un échec Turnstile ou un
**rejeu idempotent** ne déclenchent **jamais** d'alerte.

---

## 3. Mécanisme anti-doublon

La fonction `submit_mandate_funnel` insère la soumission avec
`insert … on conflict (idempotency_key) do nothing`. **Seul** l'appel qui insère
réellement obtient la ligne → la fonction renvoie `created = true`. Tout autre
appel portant la **même clé d'idempotence** (double-clic, rejeu, retry réseau,
appels concurrents) obtient `created = false` et **aucun** `opportunity_id`.

L'action serveur n'envoie l'alerte **que** si `created === true`. Conséquence :
**une seule** notification par demande, quels que soient les rejeux — garanti par
la base (migration additive `20260730180000_mandate_funnel_return_ids`).

`created` reflète la **fraîcheur de la clé d'idempotence**, jamais l'existence
d'un contact : la **neutralité** de la réponse publique (pas d'oracle
d'énumération e-mail/téléphone) est **préservée**.

---

## 4. Comportement en cas de panne Slack

- L'alerte est **best-effort** : `notifyNewMandateSubmission` ne **lève jamais**.
- La soumission est **déjà enregistrée** avant l'envoi : une panne Slack ne
  bloque, ne ralentit et n'annule **jamais** la demande du propriétaire.
- **Timeout** (`AbortController`, 4 s par défaut) : la requête est abandonnée,
  l'envoi est marqué en échec, la demande reste enregistrée.
- **Réessai** : jusqu'à 2 tentatives sur erreur réseau / `5xx` ; **pas** de
  réessai sur `4xx` (payload invalide).
- **Webhook absent** (preview/dev) : Slack **désactivé** proprement — aucun
  appel, aucune erreur.
- **Traçabilité** : un log technique **nettoyé** (type d'événement,
  `opportunity_id` interne, statut `sent/skipped/failed`, nombre de tentatives,
  code technique). **Jamais** de coordonnées, de message complet, ni de webhook.

---

## 5. Deep link CRM

Bouton Block Kit **« Ouvrir le dossier dans Prodigio CRM »** →
`{BASE}/crm/mandats/{opportunityId}` (fiche **exacte**).

- `BASE` = `NEXT_PUBLIC_SITE_URL` s'il est défini, sinon `https://go.prodigio.fr`
  en production (`http://localhost:3000` hors production).
- `opportunityId` provient de la RPC (**serveur uniquement**) — jamais exposé au
  navigateur.
- Le lien **n'accorde aucun accès** sans authentification : `/crm/*` reste
  protégé par le middleware **et** la RLS (fiche introuvable/masquée si le rôle
  ne l'autorise pas). Le repli `/crm/mandats` n'est utilisé qu'à défaut d'`id`.

---

## 6. Données incluses / exclues

**Incluses** (canal privé, coordonnées volontairement autorisées) :

- en-tête `Nouvelle demande de mandat` ; appréciation · priorité · `Non affecté`
  · heure de réception (Europe/Paris) ;
- prénom, nom, **téléphone international complet** (ex. `+33 6 25 77 35 92`,
  jamais tronqué), e-mail ;
- bien : type, ville, valeur estimée, horizon de vente, situation du mandat ;
- qualification : compatibilité /100, maturité /100, appréciation, priorité,
  version de scoring (discrète) ;
- préférence : canal de contact, moment de rappel ;
- attribution (si présente) : source, campagne, ensemble de pubs, publicité,
  landing — **champs vides omis** ;
- bouton vers la fiche.

Tous les **libellés sont humains** (jamais `fort_potentiel`/`rappel_prioritaire`).

**Exclues (jamais envoyées à Slack)** : jeton Turnstile, webhook, secrets /
variables d'environnement, adresse IP, user agent, preuve technique de
consentement, JSON brut, événements d'audit, erreurs techniques détaillées,
`fbclid`/`gclid`, clé d'idempotence, URL d'origine, referrer.

**Sécurité du message** : toutes les valeurs utilisateur sont **échappées**
(`&`, `<`, `>`) pour empêcher mentions indésirables (`<!channel>`), injections de
lien et de mise en forme, et payloads Block Kit invalides.

---

## 7. Comportement par environnement

| Env | `SLACK_MANDATES_WEBHOOK_URL` | Comportement |
|---|---|---|
| **Production** | présente | Alertes actives ; liens CRM en `https://go.prodigio.fr`. |
| **Preview / Dev** | absente | Aucun appel Slack ; funnel normal ; log « disabled ». |
| **Tests** | — | Transport Slack **mocké** ; aucun webhook réel appelé. |

L'absence de la variable ne peut **jamais** empêcher le build, le démarrage, ni
la soumission du funnel (`SLACK_MANDATES_WEBHOOK_URL` est `optional`).

---

## 8. Migration de base

`supabase/migrations/20260730180000_mandate_funnel_return_ids.sql` — **additive**,
`CREATE OR REPLACE` de `submit_mandate_funnel` avec un **corps identique** à la
version déployée : **seules** les deux instructions `return` changent pour
renvoyer `created` + `opportunity_id`. RLS, GRANT (anon/authenticated conservés),
scoring, dédoublonnage, preuve RGPD et idempotence **inchangés**. Aucune migration
antérieure modifiée ni réappliquée. Vérifiée en base (nouvelle demande →
`created:true` + id + 5 objets créés ; rejeu → `created:false`).

---

## 9. Hors périmètre (V1.1)

Boutons Slack interactifs (application Slack complète), et les alertes de suivi :
lead non affecté après 5 min, lead affecté non contacté, tâche échue, escalade
manager. Les actions (affecter, appeler, changer de stade, activité, tâche,
disqualifier, audit…) restent **dans Prodigio OS** ; Slack y conduit en un clic.
