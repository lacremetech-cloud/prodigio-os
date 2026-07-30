# 09 — CRM interne Mandats V1 — guide

Ce document explique le **CRM interne** (tranche verticale « Mandats V1 ») : à quoi
il sert, comment créer le premier administrateur, inviter des membres, l'utiliser,
comment fonctionnent les rôles, comment vérifier la sécurité, et ce qui est
**volontairement reporté**.

> Le CRM est une **application interne authentifiée** au-dessus du funnel public.
> Il **ne duplique pas** les données : il lit `contacts`, `opportunities`,
> `funnel_submissions`, `opportunity_contacts`, `privacy_records` et les tables
> CRM (organisations, memberships, affectations, activités, tâches, audit).

---

## 1. Ce que permet le CRM V1

Un·e utilisateur·rice autorisé·e peut, **sans jamais ouvrir Supabase** :

- se connecter (`/connexion`) ;
- voir les propriétaires entrés par le funnel (`/crm/mandats`) ;
- comprendre immédiatement le projet, le score et la priorité ;
- s'affecter un lead ou l'affecter à un autre membre ;
- changer le stade dans le pipeline (`/crm/mandats/pipeline`) ;
- enregistrer une activité (appel, tentative, note, RDV…) ;
- programmer une prochaine action (rappel/tâche avec échéance) ;
- retrouver les dossiers urgents / en retard (`/crm/taches`, `/crm`) ;
- valider un segment (manager/admin) et enregistrer un résultat commercial ;
- suivre les indicateurs du funnel (`/crm`).

Pages : `/crm` (vue d'ensemble), `/crm/mandats` (boîte de réception),
`/crm/mandats/pipeline` (Kanban), `/crm/mandats/[id]` (fiche complète),
`/crm/taches` (tâches), `/crm/parametres` (équipe, rôles, sécurité).

---

## 2. Créer le premier administrateur

La **création du compte** d'authentification et l'**attribution du rôle** sont
**séparées** volontairement : aucun compte n'est créé silencieusement.

1. **Créer l'accès** dans Supabase → **Authentication → Users** :
   « Add user » (e-mail + mot de passe), ou « Invite » par e-mail.
2. **Se connecter** une première fois sur `/connexion` avec ce compte.
3. **S'attribuer le rôle admin** en appelant, **connecté**, la fonction sécurisée
   depuis le SQL Editor **en tant que cet utilisateur** — ou plus simplement,
   faites-le exécuter par un administrateur technique via le SQL Editor :

   ```sql
   -- À exécuter une seule fois, tant qu'AUCUN administrateur n'existe.
   -- La fonction ne cible que votre propre compte (auth.uid()).
   select public.crm_bootstrap_first_admin('admin@votre-domaine.tld');
   ```

   `crm_bootstrap_first_admin` :
   - refuse s'il existe **déjà** un administrateur actif (utilisez alors
     `crm_invite_member`) ;
   - exige que l'e-mail corresponde à un **compte existant** ;
   - crée l'organisation opérateur **Prodigio** si besoin et attribue le rôle
     `administrateur` ;
   - trace l'opération dans le **journal d'audit**.

> Alternative « service » : un administrateur de la base peut insérer directement
> le premier membership (voir `supabase/migrations/…_crm_internal_v1.sql`), mais
> la voie recommandée reste `crm_bootstrap_first_admin`.

---

## 3. Inviter un membre

Réservé aux **administrateurs**, désormais **entièrement depuis l'interface**
(plus besoin du SQL Editor) : **`/crm/parametres/equipe`** → « Inviter un
membre » (prénom, nom, e-mail, rôle). La personne reçoit une **invitation native
Supabase Auth**, définit son mot de passe et accepte — le rôle est attribué à
l'acceptation. Voir le guide dédié : [12-USERS-AND-ACCESS.md](12-USERS-AND-ACCESS.md).

Depuis ce même écran : voir les membres et invitations en attente, **renvoyer**
ou **révoquer** une invitation, **modifier un rôle**, **désactiver / réactiver**
un accès. Les rôles réellement attribuables en V1 : `administrateur`, `manager`,
`setter`, `agent_immobilier` (`partenaire_lecture` reste **préparé mais non
attribuable** — voir §7).

> La fonction historique `crm_invite_member` (attribution de rôle à un compte
> déjà existant, via SQL) demeure disponible mais n'est plus le chemin nominal :
> l'écran équipe la remplace pour l'usage courant.

---

## 4. Rôles et permissions

Les rôles vivent en base (`organization_memberships`) — **jamais codés en dur**
dans l'interface. V1 pleinement opérationnelle pour **administrateur**,
**manager**, **setter**.

| Capacité | Admin | Manager | Setter | Agent imm. | Partenaire (lecture) |
|---|:--:|:--:|:--:|:--:|:--:|
| Voir les dossiers Prodigio | ✔ | ✔ | ✔ | ∂ (préparé) | ∂ (préparé) |
| Voir les coordonnées (tél./e-mail) | ✔ | ✔ | ✔ | ✔ | — (masquées) |
| Affecter / s'affecter | ✔ | ✔ | ✔ | — | — |
| Activités, notes, tâches, stade | ✔ | ✔ | ✔ | — | — |
| Valider le **segment** | ✔ | ✔ | — | — | — |
| Résultat commercial | ✔ | ✔ | ✔ | — | — |
| Journal d'audit | ✔ | ✔ | — | — | — |
| Inviter / gérer les rôles | ✔ | — | — | — | — |

- **Stade ≠ segment** : le stade est la progression commerciale ; le segment est
  la catégorie du bien (décision **humaine**, distincte de la recommandation du
  scoring).
- **Activité ≠ audit** : les activités tracent les interactions ; l'audit trace
  les changements sensibles (stade, segment, affectation, permission, résultat)
  et est **non modifiable**.
- Une **tentative d'appel** est une activité (comptée), jamais un stade.
- Un lead sans responsable apparaît explicitement dans la file **« Non affectés »**.

Les rôles `agent_immobilier` et `partenaire_lecture` sont **préparés**
(architecture prête, isolation par `opportunity_organizations`) mais **non
pleinement opérationnels** en V1 — voir §7.

---

## 5. Utiliser le CRM (parcours type)

1. **Connexion** sur `/connexion`.
2. **Vue d'ensemble** `/crm` : indicateurs + « Priorités du jour ».
3. **Boîte de réception** `/crm/mandats` : filtres rapides (nouveau, non affecté,
   fort potentiel, à rappeler, en retard), recherche, tri, pagination.
4. **Fiche** `/crm/mandats/[id]` : synthèse, bien, projet, analyse (scores +
   décision de segment), acquisition, activité. Colonne d'actions à droite :
   affectation, stade, activité, prochaine action, résultat commercial.
5. **Pipeline** `/crm/mandats/pipeline` : Kanban ; changement de stade fluide par
   menu (persistant, autorisé côté serveur, tracé, retour arrière si échec).
6. **Tâches** `/crm/taches` : rappels/tâches en retard, du jour, à venir.

Un **nouveau lead** du funnel apparaît **après actualisation** (bouton
« Actualiser » de la barre supérieure). Le temps réel n'est **pas** activé en V1
(choix de simplicité et de sécurité).

---

## 6. Vérifier la sécurité

- **RLS** active sur **toutes** les tables métier ; **aucun** accès public direct.
- `anon` (public) : **aucun** privilège de table, ne peut exécuter **aucune**
  fonction `crm_*` (seule `submit_mandate_funnel` reste publique pour le funnel).
- `authenticated` : **SELECT uniquement** (sous RLS) ; **toute écriture** passe
  par des fonctions `SECURITY DEFINER` qui **revérifient le rôle** et écrivent un
  **AuditEvent**.
- Journal d'audit **immuable** (déclencheur bloquant UPDATE/DELETE).
- Coordonnées sensibles **masquées** pour les rôles non autorisés.
- **Aucune** clé `service_role` dans le navigateur ni dans le dépôt : la session
  repose sur le JWT utilisateur et la RLS PostgreSQL.

Contrôles reproductibles (SQL Editor) :

```sql
-- Aucun accès table pour anon :
select has_table_privilege('anon','public.opportunities','SELECT'); -- false
-- anon ne peut pas exécuter les fonctions de mutation :
select has_function_privilege('anon','public.crm_change_stage(uuid,text,text)','EXECUTE'); -- false
-- authenticated n'a que SELECT :
select has_table_privilege('authenticated','public.opportunities','INSERT'); -- false
```

Le détail des migrations et des contrôles effectués figure dans
[07-SUPABASE-SETUP.md](07-SUPABASE-SETUP.md) §9.

---

## 7. Volontairement reporté (hors V1)

- **Isolation partenaire fine** : la table `opportunity_organizations` et le
  rattachement automatique à l'organisation opérateur existent (fondation prête),
  mais la V1 accorde une visibilité **au niveau de l'organisation opérateur
  Prodigio** ; la restriction par partenaire sera activée quand un partenaire réel
  sera intégré (docs/06 — décisions ouvertes).
- **Rôle `agent_immobilier`** : opérationnel en **lecture seule** sur ses dossiers
  **affectés** (isolation RLS active — voir [12-USERS-AND-ACCESS.md](12-USERS-AND-ACCESS.md)).
- **Rôle `partenaire_lecture`** : préparé mais **non attribuable** en V1 (isolation
  fine du partage non finalisée).
- **Écran d'administration des membres** (invitation via UI) : **livré**
  (`/crm/parametres/equipe`) — voir [12-USERS-AND-ACCESS.md](12-USERS-AND-ACCESS.md).
- **Temps réel**, **drag-and-drop** du Kanban (menu de stade fluide en V1),
  **glisser-déposer**.
- Tout le périmètre listé « hors mission » (CRM Acquéreurs, portail propriétaire,
  Meta Ads, WhatsApp/SMS/téléphonie, Google Calendar, signature électronique,
  attribution financière, app mobile native).
- **Validation juridique RGPD** : toujours **bloquante** avant mise en production
  (voir [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)).

---

## 8. Configuration (rappel)

Le CRM utilise les **mêmes** variables publiques que le funnel :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Aucune
variable supplémentaire, **aucun** secret serveur additionnel. Voir
[`.env.example`](../.env.example).
