# 12 — Utilisateurs, invitations, rôles et accès — V1

Ce document décrit la **gestion des utilisateurs** de Prodigio OS : parcours
d'invitation, matrice réelle des permissions, modèle de données, sécurité,
variables et configuration Supabase Auth, révocation / désactivation, limites
restantes et préparation de la future connexion Google Calendar par utilisateur.

> **Nommage.** Le numéro `11` étant déjà pris par [11-PUBLIC-HOME.md](11-PUBLIC-HOME.md),
> ce document porte le numéro `12`. Il complète [06-ACCESS-MODEL.md](06-ACCESS-MODEL.md)
> (modèle d'accès), [09-CRM-GUIDE.md](09-CRM-GUIDE.md) (guide CRM) et
> [07-SUPABASE-SETUP.md](07-SUPABASE-SETUP.md) §11 (migrations).

> **Ne documente comme « opérationnel » que ce qui a été réellement testé.**
> Les vérifications RLS/ACL et de logique ont été exécutées sur le projet distant
> `wmhrpweefutwldbhllhg` en **transactions annulées** (aucune donnée de test
> persistée) — voir §8. Le **compte administrateur réel** (`agence@indescale.com`)
> et l'**unique dossier propriétaire réel** sont **intacts**.

---

## 1. Ce que permet la V1

Depuis **`/crm/parametres/equipe`**, un **administrateur** peut, sans jamais
ouvrir Supabase :

- voir les **membres** de son organisation (nom, e-mail, rôle, statut, date) ;
- voir les **invitations en attente** ;
- **inviter** une personne par e-mail, en choisissant son **rôle** ;
- **révoquer** une invitation non acceptée ;
- **renvoyer** une invitation ;
- **modifier le rôle** d'un membre ;
- **désactiver** puis **réactiver** un accès ;
- distinguer clairement qui est **Actif**, **Invité**, **Désactivé** ou **Expiré**.

La personne invitée peut :

1. recevoir une **invitation native Supabase Auth** (`inviteUserByEmail`) ;
2. ouvrir un lien vers `go.prodigio.fr` (`/invitation/callback`) ;
3. **définir son mot de passe** ;
4. **accepter** l'invitation ;
5. **rejoindre uniquement l'organisation** de l'invitation ;
6. être **redirigée** vers l'espace correspondant à son rôle.

> **Aucun compte n'est créé avec un mot de passe transmis manuellement.** La
> création d'accès passe exclusivement par l'invitation Supabase Auth ; le rôle
> est attribué à l'acceptation, à partir de l'invitation posée par un administrateur.

---

## 2. Parcours d'invitation (bout en bout)

```
Administrateur (/crm/parametres/equipe)
  └─ « Inviter un membre » : prénom, nom, e-mail, rôle
        │
        ▼
  crm_create_invitation(...)  ── enregistre l'invitation (status en_attente,
        │                          expires_at, invited_by) + AuditEvent
        ▼
  [si SUPABASE_SECRET_KEY présent] client Admin server-only
        └─ auth.admin.inviteUserByEmail(email, { redirectTo: /invitation/callback })
        └─ crm_mark_invitation_sent(id, auth_user_id)   (sent_at horodaté)
        │
        ▼
Personne invitée (e-mail Supabase)
  └─ lien → /invitation/callback ── exchangeCodeForSession | verifyOtp
        │                             (établit la session, cookies)
        ▼
  /invitation ── définit un mot de passe (facultatif si déjà défini)
        └─ crm_accept_invitation()  ── crée EXACTEMENT une membership (actif)
        │                              + AuditEvent (invitation_acceptee)
        ▼
  Redirection vers /crm (espace selon le rôle)
```

Points clés de sécurité du parcours :

- **Le rôle n'est jamais choisi par la personne invitée** : `crm_accept_invitation`
  ne prend **aucun** paramètre de rôle — il lit celui de l'invitation. Aucune
  auto-attribution ni auto-élévation possible.
- **L'e-mail authentifié doit correspondre** à l'invitation (rapprochement par
  `lower(email)` en base). Un e-mail différent → « aucune invitation valide ».
- **Acceptation unique et idempotente** : un rejeu ne crée **jamais** de seconde
  membership.
- **Neutralité** : l'existence préalable d'un compte n'est jamais révélée. Un
  compte déjà inscrit est traité de façon neutre (la personne accepte en se
  connectant).

Écrans encadrés (jamais d'écran Supabase brut) : lien invalide/expiré, session
expirée, invitation expirée, invitation révoquée, e-mail ne correspondant pas,
définition du mot de passe, acceptation réussie. Voir aussi `/acces` (« Accès non
autorisé ») pour un compte authentifié sans membership active.

---

## 3. Matrice réelle des permissions (V1)

Décidée **côté serveur et en base** (fonctions `SECURITY DEFINER` + RLS), jamais
seulement masquée dans l'interface.

| Capacité | Admin | Manager | Setter | Agent immobilier | Partenaire (lecture) |
|---|:--:|:--:|:--:|:--:|:--:|
| Voir les dossiers de l'organisation | ✔ | ✔ | ✔ | ∂ **affectés uniquement** | — (aucun partage en V1) |
| Voir les coordonnées (tél./e-mail) | ✔ | ✔ | ✔ | ✔ | — (masquées) |
| Setting (affecter, appeler, noter, stade) | ✔ | ✔ | ✔ | — (lecture seule) | — |
| Valider le **segment** | ✔ | ✔ | — | — | — |
| Résultat commercial | ✔ | ✔ | ✔ | — | — |
| Journal d'audit | ✔ | ✔ | — | — | — |
| **Inviter / gérer les membres, rôles, activation** | ✔ | — | — | — | — |

**Vérifié en base** (§8) :

- **Admin** seul peut inviter / changer un rôle / activer-désactiver. **Manager,
  setter, agent, partenaire : refusés** (`42501`). Un manager ne peut donc pas
  créer d'administrateur.
- **Agent immobilier** : la RLS ne lui montre **que** les opportunités qui lui
  sont **explicitement affectées** (et leurs contacts / activités / tâches /
  soumissions). Aucune visibilité sur les autres dossiers. **Lecture seule** en
  V1 (les mutations exigent un rôle opérateur).
- **Partenaire (lecture)** : aucune mutation possible ; en V1 il ne voit **aucun**
  dossier (le partage fin par organisation n'est pas activé). **Rôle non
  attribuable depuis l'interface** tant que son isolation n'est pas finalisée
  (voir §7).
- **Auto-élévation impossible** ; **auto-désactivation impossible** ; **dernier
  administrateur actif protégé** (ni rétrogradation, ni désactivation).
- Une **désactivation** retire **immédiatement** l'accès applicatif
  (`crm_has_access()` = faux), sans supprimer le compte `auth.users`.

---

## 4. Modèle de données

Table **`organization_invitations`** (additive) :

| Colonne | Rôle |
|---|---|
| `organization_id` | Organisation cible |
| `email` | E-mail **normalisé** (lower/trim) |
| `first_name`, `last_name` | Identité (affichage) |
| `role` | Rôle demandé (5 rôles ; `partenaire_lecture` non attribuable en V1) |
| `status` | `en_attente` / `acceptee` / `revoquee` (**`expiree`** dérivé de `expires_at`) |
| `invited_by` | Auteur de l'invitation |
| `expires_at` | Date d'expiration explicite (14 j par défaut, borné 1–30 j) |
| `sent_at` | Horodatage réel d'envoi (null si secret Admin absent) |
| `accepted_at`, `accepted_by` | Acceptation |
| `revoked_at`, `revoked_by` | Révocation tracée |
| `auth_user_id` | Compte Auth provisionné (rapprochement ; **jamais un token**) |
| `metadata` | Métadonnées strictement nécessaires |

Contraintes : **une seule invitation active** (`en_attente`) par
`(organisation, e-mail)` (index unique partiel) ; e-mail non vide ; rôle borné.
**Aucun token brut n'est stocké** — on s'appuie sur l'invitation native Supabase
Auth. RLS active : **lecture réservée aux administrateurs**, aucune écriture
directe (tout passe par les fonctions).

Fonctions `SECURITY DEFINER` (`search_path` figé, `EXECUTE` retiré à
`anon`/`public`) : `crm_create_invitation`, `crm_resend_invitation`,
`crm_mark_invitation_sent`, `crm_revoke_invitation`, `crm_accept_invitation`,
`crm_my_pending_invitation`, `crm_change_member_role`, `crm_set_member_status`,
`crm_list_team`, `crm_list_invitations`, plus les helpers d'isolation
`crm_is_operator`, `crm_assigned_opportunity_ids`, `crm_role_is_assignable`.

Chaque invitation, changement de rôle, activation/désactivation et révocation
produit un **AuditEvent** (types ajoutés : `invitation_creee`,
`invitation_renvoyee`, `invitation_revoquee`, `invitation_acceptee`,
`changement_role`, `activation_membre`, `desactivation_membre` ; entité
`invitation`). Le journal reste **immuable**.

---

## 5. Sécurité (invariants garantis)

- `anon` : ne peut ni lister, ni inviter, ni modifier les membres — **aucun**
  privilège de table sur `organization_invitations`, **aucun** `EXECUTE` sur les
  fonctions de gestion (vérifié §8). Le funnel public (`submit_mandate_funnel`)
  reste inchangé.
- `authenticated` : **SELECT sous RLS** ; toute écriture passe par une fonction
  `SECURITY DEFINER` qui **re-vérifie le rôle** et écrit un AuditEvent.
- **Aucune clé secrète côté client** : `SUPABASE_SECRET_KEY` est strictement
  serveur (client Admin `import "server-only"`), jamais préfixée `NEXT_PUBLIC_`,
  jamais dans le bundle, les logs ou un payload client. Seul le **nom** de la
  variable apparaît, en clair, dans le message d'erreur de configuration réservé
  aux administrateurs — jamais sa valeur.
- **Aucun compte `auth.users` supprimé** en V1 ; une désactivation agit sur la
  **membership**, pas sur le compte global.
- Les fonctions `SECURITY DEFINER` ont un `search_path` **figé** ; leurs droits
  `EXECUTE` sont explicitement restreints à `authenticated`.

---

## 6. Configuration Supabase Auth & variables

| Variable | Rôle | Secret ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet | Non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publiable (anon), RLS | Non |
| `NEXT_PUBLIC_SITE_URL` | URL canonique (fallback prod `https://go.prodigio.fr`) | Non |
| **`SUPABASE_SECRET_KEY`** | Clé secrète (`sb_secret_…`) pour `inviteUserByEmail` | **Oui — strictement serveur** |

**URL de redirection** (canonique) : `NEXT_PUBLIC_SITE_URL` en priorité, sinon
`https://go.prodigio.fr` en production. Le lien d'invitation pointe vers
`…/invitation/callback` (redirection **interne uniquement**, anti open-redirect).

### Manipulation manuelle unique restante (Supabase + Vercel)

`SUPABASE_SECRET_KEY` **n'est pas** présente dans l'environnement de travail :
l'envoi réel d'invitations est donc **désactivé proprement** (l'écran équipe
affiche une **erreur de configuration réservée aux administrateurs** ; aucune
invitation réelle n'a été envoyée, aucune valeur inventée). Pour l'activer :

1. **Vercel** → Projet → *Settings* → *Environment Variables* : ajouter
   `SUPABASE_SECRET_KEY` = clé **secrète** Supabase (Supabase → *Settings* →
   *API Keys* → clé `sb_secret_…`), en **production** (et preview si besoin).
   **Ne jamais** la préfixer `NEXT_PUBLIC_`.
2. **Supabase** → *Authentication* → *URL Configuration* :
   - *Site URL* : `https://go.prodigio.fr` ;
   - *Redirect URLs* : ajouter `https://go.prodigio.fr/invitation/callback`
     (et l'URL de preview si les invitations doivent y fonctionner).
3. (Recommandé) *Authentication* → *Email Templates* → **Invite** : vérifier que
   le lien pointe vers `{{ .ConfirmationURL }}` (flux `verifyOtp`/PKCE géré par
   `/invitation/callback`).

Tant que ces étapes ne sont pas faites, tout le reste (préparation d'invitation,
gestion des rôles, désactivation/réactivation, RLS) fonctionne ; seul l'**envoi
de l'e-mail** d'invitation attend la clé.

---

## 7. Limites restantes (reportées)

- **`partenaire_lecture` non attribuable en V1** : son isolation fine (accès en
  lecture aux **seuls** dossiers explicitement partagés avec son organisation,
  coordonnées masquées) nécessiterait d'activer le partage par
  `opportunity_organizations`, ce qui **élargirait considérablement** la mission.
  Le rôle est **préparé** (présent en base, masqué côté application) mais **bloqué
  à l'attribution** côté fonctions **et** interface jusqu'à sa sécurisation. En
  l'état, un `partenaire_lecture` (créé hors interface) ne voit **aucun** dossier.
- **`agent_immobilier`** : opérationnel en **lecture seule** sur ses dossiers
  **affectés**. Les mutations sur dossier partagé (matrice §∂) sont reportées.
- **Annuaire des membres pour l'agent** : `crm_list_members` reste visible aux
  membres actifs (affichage des responsables). Limitation mineure documentée ;
  l'agent n'étant pas opérationnellement utilisé avant la mission Google Calendar.
- **Temps réel** : la liste équipe s'actualise après action (revalidation), pas
  en temps réel — cohérent avec le reste du CRM V1.

---

## 8. Vérifications réalisées (projet distant, transactions annulées)

Migrations appliquées sur `wmhrpweefutwldbhllhg` (voir
[07-SUPABASE-SETUP.md](07-SUPABASE-SETUP.md) §11) :
`20260730190000_users_and_access_v1`,
`20260730191000_users_access_lock_anon_execute`.

**Aucune régression** (JWT admin réel simulé) : l'administrateur voit toujours le
dossier réel (1 opportunité, 1 contact). `anon` : lecture directe refusée.

**Logique (14 contrôles, tous ✅)** : admin crée une invitation ; setter refusé ;
manager ne peut pas créer d'admin ; invitation dupliquée **idempotente** (1 seule
active) ; `partenaire_lecture` **non attribuable** ; invitation **expirée**
refusée ; **révoquée** refusée ; **e-mail différent** refusé ; acceptation crée
**exactement 1** membership ; **rejeu** sans doublon ; changement de rôle
**autorisé + audité** ; **auto-modification de rôle refusée** ; **désactivation**
retire l'accès (`crm_has_access` = faux) ; **réactivation** le restaure.

**Protection du dernier administrateur (✅)** : rétrogradation du dernier admin
actif **bloquée** (garde de comptage) ; auto-désactivation **bloquée** ;
rétrogradation autorisée seulement s'il reste ≥ 1 admin actif.

**Isolation RLS (✅)** : non-membre → **0** dossier / **0** contact ;
`agent_immobilier` → **uniquement** son dossier affecté (1), pas les autres, pas
le dossier réel ; `partenaire_lecture` → **0** dossier ; mutations refusées
(`42501`) pour agent et partenaire.

**ACL (✅)** : `anon` **ne peut exécuter aucune** fonction de gestion
(`crm_create_invitation`, `crm_accept_invitation`, `crm_change_member_role`,
`crm_set_member_status`, `crm_list_team`, `crm_revoke_invitation`,
`crm_my_pending_invitation` → `EXECUTE` = false) ; `authenticated` conserve
l'`EXECUTE` (chaque fonction re-vérifie le rôle) ; `organization_invitations` :
`anon` SELECT/INSERT = false, `authenticated` SELECT = true / INSERT = false ;
RLS active ; `submit_mandate_funnel` reste exécutable par `anon` (funnel
inchangé). Advisors sécurité : seuls des **WARN attendus** (fonctions
`SECURITY DEFINER` exécutables par `authenticated` = architecture d'écriture ;
`submit_mandate_funnel` par `anon` = point d'entrée public).

**Données réelles** : le compte administrateur (`agence@indescale.com`) et
l'unique dossier réel sont **intacts** ; **aucune** donnée de test persistée
(toutes les vérifications ont été **annulées** par `rollback`).

**Tests automatisés (Vitest)** : logique pure des rôles (rôles attribuables,
`roleHome`), statut/compteurs/tri de l'écran équipe, garde de configuration Admin
(`isSupabaseAdminConfigured` faux sans secret → aucun appel Admin), absence de
préfixe `NEXT_PUBLIC_` sur le secret, redirection interne sûre. `lint`,
`typecheck`, `test:run`, `build` : verts.

---

## 9. Préparation de la connexion Google Calendar par utilisateur (futur)

Le rôle **`agent_immobilier`** — destiné à **Cyril et aux futurs agents** — est
en place avec **isolation par dossiers affectés**. Lors de la mission Google
Calendar :

- chaque agent aura son **compte** (via ce parcours d'invitation), rattaché à
  l'organisation, avec accès **limité à ses dossiers** ;
- la connexion Google (OAuth par utilisateur) se rattachera à
  **`user_id`** (identité déjà en place via `auth.users` +
  `organization_memberships`) — aucun nouveau modèle d'identité à créer ;
- les rendez-vous se rattacheront aux **opportunités affectées** (RLS déjà
  cloisonnée), sans élargir la visibilité au-delà de l'affectation.

Aucune dépendance Google Calendar / Twilio / Resend n'est ajoutée dans cette
mission.
