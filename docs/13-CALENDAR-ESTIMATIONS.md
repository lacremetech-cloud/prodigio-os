# 13 — Planification des estimations & Google Calendar (V1)

Ce document décrit l'intégration **Google Calendar par utilisateur** et la
**gestion CRM des rendez-vous d'estimation** : architecture, variables
d'environnement, création du projet Google Cloud, sécurité des jetons, matrice
des droits, calcul des disponibilités, limites de la V1 et procédure de recette.

> Périmètre V1 : **Google Calendar uniquement** + gestion CRM des rendez-vous.
> **Hors périmètre** (missions ultérieures) : Twilio / SMS / WhatsApp, Fabrique
> de biens, CRM acquéreurs, portail propriétaire, signature électronique,
> automatisations Make, synchronisation d'autres calendriers.

---

## 1. Vue d'ensemble

Un **setter, manager ou administrateur** planifie, depuis une fiche mandat
(`/crm/mandats/[id]`), un **rendez-vous physique d'estimation** avec un **agent
immobilier**, en s'appuyant sur les **disponibilités réelles** de l'agenda Google
de l'agent.

Parcours cible :

> Nouvelle demande → rappel du propriétaire → qualification → choix de l'agent →
> consultation des disponibilités (Google FreeBusy) → réservation d'un créneau →
> création de l'événement Google Calendar (invitation au propriétaire) →
> confirmation → suivi du rendez-vous dans le CRM.

---

## 2. Architecture

### 2.1 Composants

| Couche | Fichiers | Rôle |
|---|---|---|
| Migration | `supabase/migrations/20260731090000_estimation_calendar_v1.sql` | Tables `calendar_connections`, `calendar_credentials`, `estimation_appointments` + fonctions SECURITY DEFINER + RLS |
| Config | `src/config/env.ts` | Variables OAuth + clé de chiffrement, helpers `isGoogleCalendarConfigured` / `googleOAuthRedirectUri` |
| Chiffrement | `src/modules/calendar/google/crypto.ts` | AES-256-GCM des jetons |
| OAuth | `src/modules/calendar/google/oauth.ts` | URL de consentement, échange, refresh, révocation |
| API Google | `src/modules/calendar/google/client.ts` | FreeBusy, calendriers, événements, userinfo (REST via `fetch`) |
| Jetons | `src/modules/calendar/google/credentials.ts` | Dépôt chiffré + rafraîchissement transparent (client admin) |
| Disponibilités | `src/modules/calendar/availability.ts` + `config.ts` | Calcul **pur** des créneaux (fuseau, horaires, marges, délai) |
| Service connexion | `src/modules/calendar/service.ts` | Connexion / déconnexion / liste des calendriers |
| Réservation | `src/modules/calendar/booking.ts` | Réservation idempotente + création Google + compensation |
| Actions | `src/modules/calendar/actions.ts` | Server Actions (garde de rôle, validation Zod, revalidation) |
| Lecture | `src/modules/calendar/queries.ts` | Lectures sous RLS (agents réservables, rendez-vous) |
| Routes OAuth | `src/app/api/calendar/google/{connect,callback}/route.ts` | Démarrage + callback OAuth |
| UI | `src/app/crm/parametres/calendrier`, `src/app/crm/rendez-vous`, `src/components/crm/calendar/*` | Écrans et composants |
| Seam notifications | `src/modules/calendar/events.ts` | Point d'ancrage `estimation_appointment_created` (no-op en V1) |

### 2.2 Flux OAuth (par utilisateur)

1. L'utilisateur clique « Connecter Google Calendar » →
   `GET /api/calendar/google/connect`.
2. Le serveur vérifie la **session** et le **rôle**, dépose un cookie httpOnly
   `state` (anti-CSRF) et redirige vers l'écran de consentement Google
   (`access_type=offline`, `prompt=consent` → refresh token garanti).
3. Google redirige vers `GET /api/calendar/google/callback`. Le serveur
   **re-vérifie le `state`** (comparaison à temps constant), échange le code,
   identifie le compte (`userinfo`), choisit le calendrier principal par défaut,
   enregistre la connexion (`calendar_upsert_connection`) puis **stocke les
   jetons chiffrés** (`calendar_credentials`, client admin).
4. Redirection vers `/crm/parametres/calendrier?connected=1`.

Aucun écran Google brut n'est montré : toutes les issues reviennent sur l'écran
Prodigio avec un code d'erreur (`config`, `role`, `etat`, `refus`, `connexion`).

---

## 3. Variables d'environnement

Toutes **strictement serveur** (jamais `NEXT_PUBLIC_`), à ajouter dans **Vercel**
(dev / preview / production, avec des valeurs distinctes). Voir `.env.example`.

| Variable | Rôle | Secret |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Identifiant client OAuth | non (gardé serveur par cohérence) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Secret client OAuth | **oui** |
| `GOOGLE_OAUTH_REDIRECT_URI` | URI de redirection (optionnelle : dérivée sinon) | non |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Clé AES-256 (32 octets base64) de chiffrement des jetons | **oui** |
| `SUPABASE_SECRET_KEY` (déjà existant) | Client admin (lecture/écriture des jetons chiffrés) | **oui** |

Génération de la clé de chiffrement :

```bash
openssl rand -base64 32
```

> L'intégration n'est **active** que si `GOOGLE_OAUTH_CLIENT_ID`,
> `GOOGLE_OAUTH_CLIENT_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY` **et**
> `SUPABASE_SECRET_KEY` sont présents. Sinon l'écran l'indique proprement
> (aucun jeton stocké, aucun appel OAuth).

---

## 4. Création du projet Google Cloud

1. **Console** : <https://console.cloud.google.com> → créer (ou choisir) un projet.
2. **APIs & Services → Bibliothèque** : activer **Google Calendar API**.
3. **Écran de consentement OAuth** :
   - type **External** (ou Internal si Google Workspace de l'organisation) ;
   - renseigner nom, e-mail d'assistance, domaine autorisé (`prodigio.fr`) ;
   - **Scopes** à déclarer (moindre privilège) :
     - `openid`
     - `.../auth/userinfo.email`
     - `https://www.googleapis.com/auth/calendar.readonly` (FreeBusy + liste des calendriers)
     - `https://www.googleapis.com/auth/calendar.events` (création / modification / suppression d'événements)
   - en mode **Testing**, ajouter les utilisateurs autorisés (agents, managers,
     admin) comme **testeurs** ; passer en **Production** avant l'usage réel.
4. **Identifiants → Créer des identifiants → ID client OAuth** :
   - type **Application Web** ;
   - **Authorized redirect URIs** (à l'identique de l'app) :
     - `https://go.prodigio.fr/api/calendar/google/callback` (production)
     - l'URL de preview / dev correspondante si besoin
       (`http://localhost:3000/api/calendar/google/callback`).
   - récupérer **Client ID** et **Client secret** → variables Vercel.

> Les scopes `calendar.*` sont **sensibles** : Google peut exiger une
> **vérification** de l'application avant l'ouverture à un large public. Pour une
> équipe interne restreinte, le mode **Testing** (utilisateurs testeurs) suffit
> initialement.

---

## 5. Sécurité des jetons

- **Chiffrement au repos** : `access_token` et `refresh_token` sont chiffrés en
  **AES-256-GCM** (IV aléatoire + tag d'intégrité) avant stockage
  (`src/modules/calendar/google/crypto.ts`). Format : `v1:<iv>:<tag>:<ct>`.
- **Table verrouillée** : `calendar_credentials` n'accorde **aucun privilège** à
  `anon` / `authenticated` (RLS activée + `revoke all`). Seul le **rôle de
  service** (client admin serveur) y accède.
- **Jamais exposés** : les jetons ne transitent pas par le navigateur, ne sont
  pas journalisés, n'apparaissent ni dans Git, ni dans les réponses publiques,
  ni dans les `audit_events` (qui ne stockent que des métadonnées).
- **Rafraîchissement** transparent : un access token expiré est renouvelé via le
  refresh token, puis re-chiffré et stocké.
- **Déconnexion** : révocation du jeton chez Google (best-effort) + suppression
  des jetons stockés + statut `deconnecte`.
- **Rotation de `CALENDAR_TOKEN_ENCRYPTION_KEY`** : invalide les jetons existants
  (les utilisateurs devront se reconnecter). Prévoir une communication.

---

## 6. Matrice des droits

Appliquée **en base** (fonctions SECURITY DEFINER + RLS) et **reflétée** dans
l'UI (`src/modules/crm/auth/roles.ts`). La base fait autorité.

| Rôle | Connecter son calendrier | Planifier | Reporter / annuler | Résultat (réalisé/absent…) | Voir les rendez-vous |
|---|:--:|:--:|:--:|:--:|:--:|
| administrateur | ✅ | ✅ | ✅ | ✅ | tous |
| manager | ✅ | ✅ | ✅ | ✅ | tous |
| setter | — (facultatif) | ✅ | — | — | tous |
| agent_immobilier | ✅ | — | — | ✅ (ses RDV) | ses RDV / dossiers affectés |
| partenaire_lecture | — | — | — | — | aucun (aucune écriture) |

- Le **setter** consulte les disponibilités des agents sans avoir à connecter son
  propre calendrier.
- L'**agent** ne peut mettre à jour que **ses propres** rendez-vous (contrôlé en
  base : `agent_user_id = auth.uid()`).
- L'**isolation par organisation** s'applique (RLS : opérateur = dossiers de son
  organisation ; agent = ses RDV / dossiers affectés).

---

## 7. Disponibilités (paramètres configurables)

Définis dans `src/modules/calendar/config.ts` (`DEFAULT_ESTIMATION_CONFIG`) —
**non codés en dur de façon irréversible**, `resolveSchedulingConfig()` est prêt
pour une surcharge par organisation / agent.

| Paramètre | Défaut V1 |
|---|---|
| Fuseau | `Europe/Paris` |
| Durée par défaut | 90 min |
| Pas des créneaux | 30 min |
| Horaires de travail | 09:00 – 19:00 |
| Jours ouvrés | lun – sam |
| Délai minimum avant RDV | 120 min |
| Marge avant / après | 15 min / 15 min |
| Horizon de réservation | 60 jours |

Le calcul (`computeAvailableSlots`) interroge **Google FreeBusy** pour la journée,
retire les plages occupées **élargies des marges**, applique les horaires de
travail (conversion de fuseau gérée sans dépendance de dates, heure d'été
comprise) et le délai minimum. Juste avant la réservation, le créneau est
**re-vérifié** (`isSlotStillFree`) car il a pu être pris entre-temps.

---

## 8. Cohérence à deux enregistrements (Prodigio + Google)

Stratégie sûre implémentée dans `booking.ts` :

1. **Réservation idempotente** : `crm_reserve_estimation_appointment` insère une
   ligne avec une **clé d'idempotence unique** (`on conflict do nothing`). Un
   **double-clic** renvoie la ligne existante ; **seule l'insertion réelle**
   (`created = true`) déclenche la création de l'événement Google → jamais deux
   événements ni deux rendez-vous.
2. **Re-vérification** du créneau (FreeBusy). S'il est pris → la réservation sans
   effet externe est **abandonnée** (`crm_discard_pending_appointment`, clé
   libérée) et un message invite à choisir un autre créneau.
3. **Création Google** (`sendUpdates=all` → invitation e-mail au propriétaire).
   En cas d'échec → compensation : abandon de la réservation.
4. **Confirmation en base** (`crm_confirm_estimation_appointment`) : rattache
   l'`google_event_id`, **avance le stade** (`rendez_vous_planifie`, sans jamais
   rétrograder un stade plus avancé), crée une **activité** métier et un
   **AuditEvent**. Si la confirmation échoue **après** création Google →
   l'événement Google est **supprimé** (compensation).

> **Aucune confirmation** n'est affichée si Prodigio **et** Google n'ont pas
> réellement enregistré le rendez-vous.

Cas d'échec gérés explicitement : compte non connecté, calendrier inaccessible,
jeton expiré / révoqué, créneau devenu indisponible, échec de création Google,
double-clic, échec réseau, événement Google supprimé manuellement (report =
recréation ; suppression = idempotente), annulation / report.

L'**événement Google** porte un titre « **Estimation Prodigio — [Ville] — [Nom]** »,
l'adresse et une invitation au propriétaire. Le **lien vers la fiche CRM** est
placé en **propriété privée** de l'événement (`extendedProperties.private`),
**invisible pour le propriétaire** : aucune donnée interne ni accès CRM ne lui est
transmis.

---

## 9. Notifications (V1 et suite)

- **Propriétaire** : l'**invitation Google Calendar** sert de confirmation
  e-mail. Aucune intégration Twilio / SMS / WhatsApp.
- **Slack interne** : les alertes des rendez-vous (planifié / reporté / annulé)
  vers le canal `#alertes-rdv-estimations` sont livrées — voir
  [14-SLACK-ESTIMATION-ALERTS.md](14-SLACK-ESTIMATION-ALERTS.md).
- **Seam** : `emitEstimationAppointmentCreated()` (`events.ts`) reste le point
  d'ancrage pour brancher, dans une mission ultérieure, les canaux non encore
  développés (SMS de confirmation, rappels J-1 / H-2, WhatsApp) — **sans réécrire**
  le module de réservation.

---

## 10. Limites & risques de la V1

- Le **fuseau** de saisie du report (`datetime-local`) suit le navigateur de
  l'utilisateur (poste en France attendu). L'affichage des rendez-vous est
  toujours forcé en **Europe/Paris**.
- La **re-vérification** de créneau réduit fortement les collisions mais ne les
  élimine pas à 100 % en cas de réservations très simultanées (fenêtre de
  quelques centaines de ms). La clé d'idempotence empêche en revanche tout doublon
  côté Prodigio/Google.
- L'application dépend de la disponibilité de l'**API Google** ; les erreurs sont
  gérées et n'entraînent jamais d'enregistrement partiel affiché comme confirmé.
- Les scopes `calendar.*` peuvent nécessiter une **vérification Google** avant
  ouverture large (mode Testing suffisant pour une équipe interne).
- La configuration des disponibilités est globale en V1 (surcharge par
  organisation / agent **préparée** mais non exposée).

---

## 11. Procédure de recette réelle

> Les tests automatisés **mockent** Google : aucun rendez-vous réel n'y est créé.
> La recette ci-dessous se fait avec un vrai compte Google, **sur autorisation**.

1. **Appliquer la migration** `20260731090000_estimation_calendar_v1.sql` sur le
   projet Supabase (une seule fois, après audit du schéma distant).
2. **Renseigner les variables** Vercel (§3) et déclarer la **Redirect URL** (§4).
3. Se connecter au CRM en **administrateur** ; ouvrir
   `/crm/parametres/calendrier` → **Connecter Google Calendar** → autoriser →
   vérifier le retour `connected=1`, le compte affiché et la sélection du
   calendrier.
4. Répéter la connexion pour un **agent_immobilier** de test.
5. Sur une fiche mandat, cliquer **Planifier l'estimation** → choisir l'agent →
   une date → vérifier que les **créneaux occupés** de l'agent sont exclus →
   choisir un créneau → vérifier l'adresse / l'e-mail du propriétaire →
   **Confirmer**.
6. Vérifier : l'**événement** apparaît dans l'agenda de l'agent ; le
   **propriétaire** reçoit l'invitation ; la fiche affiche l'encart rendez-vous ;
   le **stade** est passé à « Rendez-vous planifié » ; une **activité** et un
   **AuditEvent** sont enregistrés ; `/crm/rendez-vous` liste le RDV.
7. Tester **reporter**, **annuler** (l'événement Google est mis à jour /
   supprimé), **marquer réalisé / absent**.
8. Tester la **déconnexion** puis la **reconnexion**.
9. Vérifier l'**isolation** : un `agent_immobilier` ne voit que ses RDV ; un
   `setter` planifie sans calendrier propre ; `partenaire_lecture` n'a aucune
   action.

---

## 12. Manipulations manuelles restantes

- Créer le **projet Google Cloud**, l'**écran de consentement**, l'**ID client
  OAuth** et les **Redirect URLs** (§4).
- Ajouter les **variables Vercel** (§3) sur dev / preview / production.
- **Générer et déposer** `CALENDAR_TOKEN_ENCRYPTION_KEY` (§3), la conserver de
  façon sûre (sa perte impose une reconnexion de tous les utilisateurs).
- **Appliquer la migration** Supabase (§11.1).
- Ajouter les utilisateurs concernés comme **testeurs** (ou passer l'écran de
  consentement en **Production**).
