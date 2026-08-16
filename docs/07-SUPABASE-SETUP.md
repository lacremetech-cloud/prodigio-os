# 07 — Supabase : configuration et application de la migration

Ce document explique comment **activer le dépôt des demandes** de la landing
propriétaire (funnel Mandats — tranche « capture ») : variables d'environnement,
application de la **migration SQL versionnée**, modèle de sécurité, vérification,
et prérequis de production.

> **État actuel — DÉPLOYÉ (capture + scoring + durcissement).** Trois migrations
> sont **appliquées** sur le projet `prodigio-os` (`wmhrpweefutwldbhllhg`, région
> `eu-west-3`, Postgres 17) : `mandate_funnel_capture` (version ledger
> `20260729150515`), `mandate_scoring` (version ledger `20260729165606`) **et**
> `restrict_compute_mandate_scores` (version ledger `20260729172238`) — cette
> dernière retire l'`EXECUTE` public/anon/authenticated sur la fonction interne
> `compute_mandate_scores` (voir §7.2).
> Les variables publiques sont fournies dans l'environnement cloud. Le funnel est
> **fonctionnel de bout en bout** : une soumission réelle depuis
> `/proprietaire/analyse` crée bien FunnelSubmission + Contact + Opportunity +
> OpportunityContact + PrivacyRecord, **calcule et stocke les scores côté base**,
> et affiche l'écran de confirmation.
>
> Vérifié après déploiement (voir §6 pour la capture, §7 pour le scoring) : RLS
> active sur les 5 tables, **aucune politique publique**, **aucun GRANT direct**
> pour `anon`/`authenticated`/`PUBLIC`, fonction `submit_mandate_funnel`
> `SECURITY DEFINER` exécutable par `anon`/`authenticated` uniquement, réponse
> publique neutre `{ accepted: true }`, idempotence et dédoublonnage conservateur
> confirmés, **scores non falsifiables depuis le navigateur** (recalcul serveur).
> Les données de test ont été supprimées ; les tables sont vides.
>
> ✅ **Ajouté (cette tranche)** : **Cloudflare Turnstile** (anti-abus) protège
> désormais le dépôt public — la soumission Supabase n'a lieu **que** si le jeton
> est vérifié côté serveur (siteverify). Aucun changement de schéma ni de
> migration (voir §8). Il reste à **fournir les vraies clés** et le hostname en
> preview / production.
>
> ⚠️ **Non terminé (bloquant de production)** : la **validation juridique RGPD**
> n'est **pas** faite — voir §5.

---

## 1. Variables d'environnement

À définir dans `.env.local` (dev) et dans les variables de l'hébergeur
(preview / production) — **jamais** commitées.

| Variable | Rôle | Secret ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL publique du projet (`https://<ref>.supabase.co`) | Non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé **publiable** (anon), protégée par RLS | Non (publique par conception) |
| `SUPABASE_PROJECT_REF` | Référence du projet (documentation / CLI) | Non |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clé de site Cloudflare Turnstile (rendue au navigateur) | Non (publique par conception) |
| `TURNSTILE_SECRET_KEY` | Secret Turnstile pour siteverify | **Oui — strictement serveur** |
| `TURNSTILE_EXPECTED_HOSTNAME` | Hostname attendu (contrôle d'origine ; imposé en prod) | Non |

> **À NE JAMAIS ajouter ici ni dans le dépôt** : clé `service_role`, mot de passe
> Supabase, `SUPABASE_DB_URL`, ou toute chaîne de connexion PostgreSQL. Le funnel
> public n'en a **pas besoin** : il n'utilise que la clé publiable + une fonction
> SQL contrôlée.

Voir [`.env.example`](../.env.example) pour le gabarit commenté.

---

## 2. Migration à appliquer

Fichier **exact** :

```
supabase/migrations/20260729120000_mandate_funnel_capture.sql
```

Elle crée, dans le schéma `public` :

- les tables `contacts`, `opportunities`, `funnel_submissions`,
  `opportunity_contacts`, `privacy_records` (conformes à
  [03-DOMAIN-MODEL.md](03-DOMAIN-MODEL.md)) ;
- les **contraintes**, **index** et un déclencheur `updated_at` ;
- l'activation de **RLS** sur toutes les tables, **sans** politique publique
  (aucun accès direct pour `anon` / `authenticated`) ;
- la fonction `submit_mandate_funnel(payload jsonb)` en **`SECURITY DEFINER`**,
  **seul** point d'entrée public, qui crée/relie **atomiquement**
  `FunnelSubmission + Contact + Opportunity + OpportunityContact + PrivacyRecord`,
  de manière **idempotente** (rejeu sûr sur `idempotency_key`).

### Comment l'appliquer

**Option A — Éditeur SQL Supabase (le plus simple).**
1. Ouvrez le projet sur `app.supabase.com` → **SQL Editor**.
2. Collez l'intégralité du fichier de migration.
3. Exécutez. La migration est transactionnelle (`begin`/`commit`).

**Option B — Supabase CLI** (sans exposer d'URL de base dans le dépôt).
```bash
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push        # applique les migrations de supabase/migrations/
```

> Ne collez **pas** d'URL de connexion PostgreSQL dans le dépôt ou la
> documentation. La CLI gère l'authentification hors dépôt.

---

## 3. Modèle de sécurité (résumé)

- **RLS activé + aucune politique** ⇒ un visiteur public **ne peut ni lire, ni
  modifier, ni supprimer** aucune donnée directement. Privilèges révoqués pour
  `anon`, `authenticated` **et** `public` (défense en profondeur).
- Le dépôt passe **uniquement** par `submit_mandate_funnel`, exécutée avec les
  droits de son propriétaire (`SECURITY DEFINER`, `search_path = public, pg_temp`,
  objets tous qualifiés) et accordée à `anon` / `authenticated`.
- La clé publiable étant publique, **on considère que la fonction peut être
  appelée directement**, sans l'interface, l'action serveur, le honeypot ni Zod.
  Elle se **défend donc elle-même** : validation de structure et de taille du
  payload (≤ 64 Ko), **bornage de tous les textes**, **validation des
  énumérations**, et valeurs de contrôle (stade, segment, statut, canaux
  autorisés, finalité, destinataires) **fixées côté serveur** — jamais issues du
  client.
- **Réponse neutre** : la fonction ne renvoie qu'un **accusé booléen**
  (`{ accepted: true }`). Aucune donnée personnelle, aucun identifiant
  réutilisable, et **l'existence préalable d'un contact n'est jamais révélée**
  (pas d'oracle d'énumération d'e-mails/téléphones).
- **Idempotence sûre** : `insert … on conflict (idempotency_key) do nothing` —
  un double-clic ou deux appels **simultanés** avec la même clé ne créent jamais
  deux dossiers et n'échouent pas.
- **Dédoublonnage conservateur** : rapprochement d'un contact existant **par
  e-mail normalisé uniquement** (identifiant fort). **Pas** de fusion sur le
  téléphone (numéros partagés en famille) ; aucune donnée d'un contact existant
  n'est écrasée ; la soumission est conservée pour une résolution humaine.
- La **soumission originale** est conservée telle quelle ; aucune suppression au
  seul motif de doublon.
- Les accès du futur back-office (lecture des dossiers par rôle/organisation)
  feront l'objet de **politiques dédiées** dans une migration ultérieure — hors
  de cette tranche.

---

## 4. Vérification

1. Renseignez les variables, relancez `npm run dev`.
2. Ouvrez `/proprietaire/analyse`, complétez le parcours, envoyez la demande.
3. Résultat attendu : l'écran de **confirmation** avec récapitulatif.
4. Dans Supabase → **Table editor**, vérifiez une nouvelle ligne dans
   `funnel_submissions` (et les objets reliés). Un second envoi avec la **même**
   clé d'idempotence ne crée **pas** de doublon.

---

## 5. Prérequis de production (bloquants)

Ces points **doivent** être traités avant une mise en production réelle — ils ne
sont **pas** résolus par cette tranche :

- ✅ **Cloudflare Turnstile** (anti-abus) : **implémenté** (voir §8). Le dépôt
  Supabase n'a lieu que si le jeton est vérifié côté serveur. Il reste, avant la
  mise en production, à **créer un widget Turnstile** (mode *Managed*, action
  `mandate_submission`) et à renseigner `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
  `TURNSTILE_SECRET_KEY` et `TURNSTILE_EXPECTED_HOSTNAME` avec de **vraies**
  clés (les clés de test sont refusées en production).
- ⛔ **Validation juridique RGPD** : la base légale est enregistrée comme
  `a_valider_juridiquement` et la formulation du consentement est **provisoire**.
  Aucune conformité n'est présumée (voir [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md)).
  En particulier, le **consentement au démarchage téléphonique** devra être
  compatible avec les **règles applicables à partir du 11 août 2026** : la
  formulation actuelle doit être **revue et validée juridiquement** avant toute
  prospection téléphonique. La preuve conservée (texte de notice, version, date,
  finalité, canaux autorisés, préférence) prépare cette mise en conformité mais
  **ne l'établit pas**.
- ⛔ **Environnements séparés** (dev / preview / prod) avec des projets et
  secrets Supabase distincts.
- ⛔ **Déploiement Vercel** et URL canonique (`NEXT_PUBLIC_SITE_URL`).
- ▶️ **VSL** : renseigner `NEXT_PUBLIC_MANDATE_VSL_URL` (Vimeo/Wistia) pour
  activer le lecteur sans reconstruire la page.

---

## 6. Vérification post-déploiement (réalisée)

Contrôles effectués sur le projet distant `wmhrpweefutwldbhllhg` après application
de la migration, puis **nettoyage complet** des données de test.

**Objets déployés**
- Tables : `contacts`, `opportunities`, `funnel_submissions`,
  `opportunity_contacts`, `privacy_records` (RLS activée sur les 5).
- Fonction : `submit_mandate_funnel(payload jsonb)` — `SECURITY DEFINER`,
  `search_path = public, pg_temp`.

**Sécurité (mesurée)**
- `pg_policies` (public) : **aucune politique** → RLS = refus par défaut.
- Sonde REST anonyme sur les 5 tables : **HTTP 401 / `42501 permission denied`**
  (aucune lecture publique).
- `information_schema.role_table_grants` (anon/authenticated/PUBLIC sur les 5
  tables) : **vide** → aucun privilège direct.
- `information_schema.role_routine_grants` : `EXECUTE` accordé à `anon` **et**
  `authenticated` uniquement (PUBLIC exclu).

**Parcours réel (E2E)**
- Une soumission complète depuis `/proprietaire/analyse` (données de test
  identifiables) a créé **1** ligne dans chacune des 5 tables, avec attribution
  (UTM + `fbclid`, premier/dernier contact), `raw_answers` + `normalized_answers`,
  `processing_status = traite`, et les champs de contrôle (stade/segment/statut/
  source/canaux/responsables/destinataires) **fixés côté serveur**.
- **Idempotence** : deux appels avec la même clé → **1** soumission.
- **Dédoublonnage + neutralité** : un appel avec un e-mail déjà connu ne crée
  **pas** de contact en double et renvoie `{ accepted: true }` (l'existence
  préalable n'est jamais révélée).
- **Nettoyage** : toutes les données de test (marqueur e-mail `prodigio-e2e%`)
  supprimées ; les 5 tables sont revenues à **0 ligne**.

> La migration reste appliquée ; **seules les données de test** ont été insérées
> puis supprimées. Aucune donnée réelle n'existe encore en base.

---

## 7. Préqualification (scoring) — migration APPLIQUÉE et vérifiée

Migration **versionnée déployée** :
`supabase/migrations/20260729160000_mandate_scoring.sql` (additive au-dessus de
la capture), appliquée le 2026-07-29 sur `wmhrpweefutwldbhllhg` et enregistrée au
ledger sous la version `20260729165606`.

> **Note de versionnage.** Comme pour la capture (fichier `…120000`, ledger
> `…150515`), l'horodatage du **fichier** (`…160000`) diffère de la version
> **ledger** (`…165606`) : la version est stampée par l'outil au moment de
> l'application. Le **nom** (`mandate_scoring`) et le contenu SQL font foi ;
> l'ordre relatif (scoring après capture) est préservé. `mandate_funnel_capture`
> n'a **pas** été réappliquée.

Ce qu'elle ajoute :
- fonction `compute_mandate_scores(...)` **déterministe, `IMMUTABLE`**, miroir SQL
  de `src/modules/mandates/scoring/config.ts` (version `mandate-scoring-v1`) ;
- colonnes de scoring sur `funnel_submissions` (photographie immuable :
  `compatibility_score`, `maturity_score`, `operational_priority`,
  `public_appreciation`, `score_version`, `score_breakdown`,
  `contact_recall_preference`) et de **recommandation** sur `opportunities`
  (`recommended_priority`, `compatibility_score`, `maturity_score`,
  `score_version`) ;
- mise à jour de `submit_mandate_funnel` : les scores sont **recalculés côté
  base** à partir des réponses validées — tout score fourni dans le payload est
  **ignoré** (impossible d'imposer un score depuis le navigateur). RLS, GRANT,
  idempotence, dédoublonnage et **réponse neutre `{ accepted: true }`** inchangés.

Principes :
- **Deux scores distincts** (compatibilité propriété / maturité projet), jamais
  fusionnés ; en découlent une **priorité opérationnelle** (interne) et une
  **appréciation publique** qualitative (`fort_potentiel` / `a_confirmer` /
  `analyse_personnalisee`) — **jamais** de « non éligible » automatique.
- Le **seuil premium** (docs/05 #6) n'est pas une constante € dans l'UI : il est
  porté par la répartition de points entre bandes de valeur, **versionnée**.
- La **segmentation validée reste humaine** : `opportunities.segment` demeure
  `non_determine` ; le scoring n'est qu'une **recommandation** (docs/03 —
  « Décision de segment »).
- L'appréciation affichée au propriétaire est aussi calculée **côté serveur**
  (action Next, mêmes règles) : le navigateur ne voit **jamais** les scores
  numériques.

> Compatibilité de déploiement : la migration est **additive** (les colonnes
> utilisent `add column if not exists`, la fonction est remplacée). Elle a été
> appliquée **exactement une fois** après contrôle du schéma distant.

### 7.1 Vérification post-déploiement du scoring (réalisée)

Contrôles effectués sur `wmhrpweefutwldbhllhg` après application, puis
**nettoyage complet** des données de test (marqueur e-mail `@e2e-scoring.test`,
clés `e2e-scoring-*`).

**Contrôle préalable (avant écriture)**
- Schéma distant conforme à l'état `mandate_funnel_capture` : colonnes de scoring
  **absentes**, `compute_mandate_scores` **inexistante**, `submit_mandate_funnel`
  **sans** appel au scoring, 5 tables **à 0 ligne**. Aucune divergence bloquante.
- Miroir SQL ↔ `src/modules/mandates/scoring/config.ts` **exact** (barèmes des
  bandes de valeur, types de bien, horizon, situation de mandat ; seuils
  `compat ≥ 60` / `maturité ≥ 55` ; bornes d'appréciation `≥ 60` / `≥ 35` ;
  versions `mandate-scoring-v1` / `economic-baseline-v1`).

**Objets déployés (mesurés)**
- Fonction `compute_mandate_scores(text,text,text,text)` — `IMMUTABLE`,
  `search_path = pg_catalog, pg_temp`.
- Colonnes `funnel_submissions` : `contact_recall_preference`,
  `compatibility_score`, `maturity_score`, `operational_priority`,
  `public_appreciation`, `score_version`, `score_breakdown`.
- Colonnes `opportunities` : `recommended_priority`, `compatibility_score`,
  `maturity_score`, `score_version`.
- Contraintes CHECK : `funnel_submissions_recall_pref_check`,
  `funnel_submissions_priority_check`, `funnel_submissions_appreciation_check`,
  `opportunities_recommended_priority_check`.
- RLS toujours active sur les 5 tables, **0 politique**.

**Trois parcours E2E identifiables (scores stockés, recalculés côté base)**

| Parcours | property_type / value_band | horizon / mandat | compat | maturité | priorité interne | appréciation publique | rappel |
|---|---|---|---|---|---|---|---|
| **Fort potentiel** | villa_architecte / plus_2m | des_que_possible / mandat_simple | 100 | 100 | `rappel_prioritaire` | `fort_potentiel` | matin |
| **À confirmer** | appartement_exception / 500k_800k | six_mois / aucun_mandat | 59 | 64 | `circuit_partenaire` | `a_confirmer` | apres_midi |
| **Analyse personnalisée** | autre / accompagnement_estimation | en_reflexion / autre | 58 | 29 | `suivi_long_terme` | `analyse_personnalisee` (needs_estimation) | debut_soiree |

- Sur l'`opportunité` : `recommended_priority` + scores portés, `segment` resté
  **`non_determine`** (la segmentation validée reste humaine).

**Non-falsifiabilité (tentative de manipulation)**
- Un payload injectant `compatibility_score=1`, `maturity_score=2`,
  `operational_priority='suivi_long_terme'`, `public_appreciation='analyse_personnalisee'`,
  `score_version='HACKED-CLIENT'`, `score_breakdown={"hacked":true}` a été **entièrement
  ignoré** : la base a stocké les valeurs **recalculées** (100/100,
  `rappel_prioritaire`, `fort_potentiel`, `mandate-scoring-v1`,
  `needs_estimation=false`). Les scores fournis par le client n'ont **aucun effet**.

**Idempotence, dédoublonnage, neutralité**
- Rejeu d'une même `idempotency_key` → **1** seule soumission (aucun doublon).
- Nouvelle soumission avec un e-mail déjà connu → **contact réutilisé**
  (`resolution = contact_existant`, aucun contact en double) mais soumission et
  opportunité distinctes conservées.
- Les **5 appels** (dont manipulation et dédoublonnage) renvoient exactement
  `{ accepted: true }` — aucun score, aucune donnée, aucune existence révélée.

**Nettoyage**
- Toutes les données de test supprimées ; les 5 tables sont revenues à **0 ligne**.
  Les objets de scoring (fonctions, colonnes, migration au ledger) **persistent**.

**Contrôles de validation (locaux, dépendances verrouillées)**
- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run test:run` ✅ (**54/54**)
  · `npm run build` ✅.

### 7.2 Durcissement — `compute_mandate_scores` verrouillée (CORRIGÉ, déployé)

**Constat.** La migration de scoring révoquait `compute_mandate_scores` de
`public` avec l'intention de la garder **interne** (appelée uniquement par
`submit_mandate_funnel`). Mais l'ACL réelle (`pg_proc.proacl`) montrait que `anon`
et `authenticated` conservaient un `EXECUTE` **explicite** hérité des *default
privileges* Supabase sur les fonctions du schéma `public`, que `revoke … from
public` ne retire pas. La fonction restait donc appelable directement par le
public (divulgation du barème ; **ni lecture, ni falsification** de données —
`submit_mandate_funnel` recalcule toujours côté serveur).

**Correction déployée.** Migration additive et versionnée dédiée :
`supabase/migrations/20260729170000_restrict_compute_mandate_scores.sql`
(ledger `20260729172238`). Elle exécute uniquement, sur la signature exacte
`public.compute_mandate_scores(text, text, text, text)` :

```sql
revoke execute on function public.compute_mandate_scores(text, text, text, text) from public;
revoke execute on function public.compute_mandate_scores(text, text, text, text) from anon;
revoke execute on function public.compute_mandate_scores(text, text, text, text) from authenticated;
```

Elle **ne touche pas** `submit_mandate_funnel`, ni la RLS, ni les tables, ni la
logique de scoring, et ne modifie **aucune migration antérieure**.

**ACL de `compute_mandate_scores` — avant / après :**

| | ACL (`proacl`) |
|---|---|
| Avant | `postgres=X` · **`anon=X`** · **`authenticated=X`** · `service_role=X` |
| Après | `postgres=X` · `service_role=X` |

**Vérification effective (`has_function_privilege`) :**
- `compute_mandate_scores` exécutable par `public` / `anon` / `authenticated` :
  **false / false / false** ✅
- `submit_mandate_funnel` exécutable par `anon` / `authenticated` : **true / true**
  ✅ (inchangé — seul point d'entrée public)
- RLS active sur les 5 tables, **0 politique**, **aucun** grant direct de table
  pour `anon`/`authenticated`/`PUBLIC` ✅

**Fonctionnement préservé.** `submit_mandate_funnel` est `SECURITY DEFINER` :
elle appelle `compute_mandate_scores` avec les droits de son **propriétaire**
(qui conserve l'`EXECUTE`), donc le funnel continue de calculer et stocker les
scores. Test E2E **exécuté sous le rôle `anon`** après la correction : dépôt
`domaine_caractere` / `plus_2m` / `des_que_possible` / `aucun_mandat` →
`{ accepted: true }`, ligne créée avec `compatibility_score = 100`,
`maturity_score = 96`, `operational_priority = rappel_prioritaire`,
`public_appreciation = fort_potentiel` (scores bien recalculés côté base). Donnée
de test ensuite supprimée ; les 5 tables sont revenues à **0 ligne**.

> `service_role` (clé serveur / back-office) conserve volontairement son
> `EXECUTE` ; seuls les rôles publics `PUBLIC`/`anon`/`authenticated` sont
> concernés par le retrait.

---

## 8. Cloudflare Turnstile — anti-abus du dépôt public (APPLIQUÉ, app-layer)

Le funnel public est désormais protégé par **Cloudflare Turnstile** (mode
**Managed**). Le dépôt Supabase (`submit_mandate_funnel`) n'est exécuté **que**
si un **jeton** Turnstile a été **vérifié côté serveur**. **Aucun changement de
schéma** ni **de migration** : Turnstile est entièrement une couche applicative
(Next.js), la base reste inchangée.

### 8.1 Principe

```
Navigateur (widget Turnstile, action=mandate_submission)
  → obtient un JETON (le SEUL élément anti-abus transmis)
  → Action serveur submitMandateFunnelAction
      → siteverify (https://challenges.cloudflare.com/turnstile/v0/siteverify)
      → si et seulement si OK : RPC submit_mandate_funnel (dépôt Supabase)
```

- Le **secret** reste **strictement côté serveur** (jamais `NEXT_PUBLIC_`, jamais
  renvoyé au client).
- Le **jeton n'est jamais** stocké (Supabase / FunnelSubmission / `raw_answers`),
  **ni journalisé**, **ni** placé dans les analytics ou les erreurs client : il
  vit à part du payload et n'est utilisé que pour la vérification.
- **Rendu « interaction-only »** : le widget reste **invisible** tant que
  Cloudflare ne juge pas un challenge nécessaire (discret, premium).
- **Réinitialisation** propre du widget après échec / expiration (nouvel essai).

### 8.2 Le dépôt Supabase est refusé si…

La vérification (`verifyTurnstileToken`) échoue — et donc **aucune RPC** n'est
appelée — dans chacun de ces cas :

- jeton **absent** ;
- jeton **invalide** (`success=false`) ;
- jeton **expiré** ou **déjà utilisé** (`timeout-or-duplicate` / `token-already-spent`) ;
- **action** ≠ `mandate_submission` ;
- **hostname** ≠ `TURNSTILE_EXPECTED_HOSTNAME` (imposé **en production**) ;
- **siteverify indisponible** (timeout / erreur réseau) — message utilisateur
  **neutre** : « Nous n'avons pas pu vérifier votre demande. Veuillez réessayer
  dans quelques instants. »

Sont **intégralement préservés** : idempotence, dédoublonnage conservateur,
**réponse publique neutre** `{ accepted: true }`, **scoring serveur**, UTM /
attribution, **préférence de rappel**, RLS et permissions (§3, §6, §7).

### 8.3 Variables et garde-fou de production

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clé de site (publique) rendue au navigateur |
| `TURNSTILE_SECRET_KEY` | Secret serveur pour siteverify (**jamais** exposé) |
| `TURNSTILE_EXPECTED_HOSTNAME` | Hostname attendu (imposé en production) |

**Garde-fou** : en **production**, les **clés de test** Cloudflare sont
**refusées** (`isTurnstileProductionSafe`) — une clé de test ne peut jamais
accorder l'accès en prod ; le dépôt est refusé (message neutre) plutôt que
« validé » par une clé de test.

### 8.4 Clés de test officielles (dev / tests)

- Sitekey succès : `1x00000000000000000000AA` · échec : `2x00000000000000000000AB`
  · challenge forcé : `3x00000000000000000000FF`.
- Secret succès : `1x0000000000000000000000000000000AA` · échec :
  `2x0000000000000000000000000000000AA` · déjà utilisé :
  `3x0000000000000000000000000000000AA`.

### 8.5 Vérifications réalisées

- **Tests unitaires / intégration** (Vitest) : jeton valide, absent, invalide,
  expiré / déjà utilisé, mauvaise action, mauvais hostname, timeout / erreur
  réseau, **absence de RPC Supabase quand Turnstile échoue**, **RPC exécutée
  quand Turnstile réussit**, exclusion du jeton du payload, garde-fou de
  production. `lint` · `typecheck` · `test:run` · `build` : **verts**.
- **E2E local avec les clés de test officielles** contre l'endpoint **réel**
  `siteverify` : succès → `ok` ; secret d'échec → `invalid-token` ; secret
  « déjà utilisé » → `duplicate-or-expired` ; jeton absent → `missing-token`
  (sans réseau) ; action vide en mode production → `action-mismatch`.

### 8.6 Captures (étape finale)

`docs/assets/turnstile/` — desktop et mobile :

- `normal-*.png` — état normal (widget « interaction-only » invisible, mention
  discrète « Demande protégée … par Cloudflare ») ;
- `verifying-*.png` — vérification / transmission en cours (spinner) ;
- `error-*.png` — message neutre d'erreur avec **possibilité de réessayer**
  (widget réinitialisé).

> Note : la capture du **challenge interactif** Cloudflare lui-même n'a pas pu
> être produite depuis l'environnement de développement (accès navigateur à
> `challenges.cloudflare.com` bloqué : `ERR_CONNECTION_RESET`). Le challenge
> n'apparaît, en production, que lorsque Cloudflare le juge nécessaire (mode
> *interaction-only*), dans la zone réservée au-dessus de la mention de sécurité.

---

## 9. CRM interne Mandats V1 — migrations et sécurité (APPLIQUÉ)

Trois migrations **additives** déploient le CRM interne au-dessus du funnel,
**sans** modifier les migrations antérieures ni la fonction publique
`submit_mandate_funnel`. Appliquées sur `wmhrpweefutwldbhllhg` :

| Fichier | Ledger | Rôle |
|---|---|---|
| `20260730120000_crm_internal_v1.sql` | `20260730153703` | Tables CRM + colonnes additives + helpers + RLS + fonctions de mutation + org opérateur |
| `20260730160000_crm_lock_anon_execute.sql` | `20260730160843`* | Retire `EXECUTE` à `anon`/`public` sur toutes les fonctions `crm_*` |
| `20260730170000_harden_set_updated_at.sql` | `20260730…`* | Fixe un `search_path` immuable sur `set_updated_at()` |

<sub>* version ledger stampée par l'outil au moment de l'application.</sub>

**Objets créés** (schéma `public`) :
- Tables : `organizations`, `organization_memberships`, `opportunity_organizations`,
  `opportunity_assignments`, `activities`, `tasks`, `audit_events`.
- Colonnes additives sur `opportunities` : `outcome`, `outcome_reason`,
  `outcome_recorded_by/at`, `segment_decided_by/at`, `segment_decision_reason`,
  `segment_is_derogation`.
- Helpers `SECURITY DEFINER` : `crm_active_roles`, `crm_has_access`,
  `crm_has_role`, `crm_can_view_contact_details`, `crm_list_members`.
- Fonctions de mutation `SECURITY DEFINER` (revérifient le rôle + écrivent l'audit) :
  `crm_assign_opportunity`, `crm_self_assign`, `crm_change_stage`,
  `crm_log_activity`, `crm_create_task`, `crm_set_task_status`,
  `crm_decide_segment`, `crm_record_outcome`.
- Bootstrap / administration : `crm_bootstrap_first_admin`, `crm_invite_member`.
- Organisation opérateur **Prodigio** (`slug='prodigio'`) + **trigger** de
  rattachement automatique (`opportunity_organizations`) + **backfill** des
  opportunités existantes.
- Journal d'audit **immuable** (déclencheur bloquant UPDATE/DELETE).

**Modèle de sécurité (mesuré sur le projet distant, après déploiement) :**
- RLS **active** sur les **12** tables métier, **1 politique de lecture** chacune.
- `anon` : `has_table_privilege = false` (SELECT **et** INSERT) sur **toutes** les
  tables ; sonde `select` sous `role anon` → `42501 permission denied`.
- `authenticated` : **SELECT uniquement** (`INSERT/UPDATE/DELETE = false`) ; toute
  écriture passe par les fonctions `SECURITY DEFINER`.
- `anon` ne peut exécuter **aucune** fonction `crm_*` (`has_function_privilege =
  false`) ; `submit_mandate_funnel` reste exécutable par `anon` (funnel inchangé),
  `compute_mandate_scores` reste verrouillée.
- Advisors sécurité : seuls des WARN **attendus** subsistent (fonctions
  `SECURITY DEFINER` exécutables par `authenticated` — c'est **l'architecture
  d'écriture** voulue ; et `submit_mandate_funnel` exécutable par `anon` — point
  d'entrée public du funnel). `function_search_path_mutable` sur `set_updated_at`
  est **corrigé** par la 3ᵉ migration.

**Vérifications fonctionnelles (simulation de JWT côté base, transactions
annulées) :**
- Admin (membre actif) : lit les dossiers sous RLS (5 opportunités de test).
- Utilisateur authentifié **sans** membership : **0** dossier visible (RLS).
- `anon` : lecture directe → `permission denied`.
- `crm_change_stage` : admin → OK ; sans rôle → `42501` ; `anon` → `permission
  denied for function`.
- **Idempotence** : deux `crm_self_assign` → **1** seule affectation.
- **Audit immuable** : UPDATE sur `audit_events` → exception `0A000`.

**Parcours réel (E2E navigateur, données de test identifiables) :**
connexion → CRM → liste des leads → fiche → affectation → activité → prochaine
action → changement de stade. Captures desktop et mobile dans
`docs/assets/crm/` (données réelles **masquées**, données de démo clairement
identifiables `@crm-e2e.test`).

**Données préservées.** La **soumission réelle** déjà présente (1 opportunité,
1 contact, 1 soumission, 1 privacy record) est **conservée** et rattachée à
l'organisation opérateur (backfill). Seules les données de **test** créées pour
cette mission ont été supprimées. **Premier administrateur réel** créé à la
demande du propriétaire (`agence@indescale.com`, rôle `administrateur`).

Guide d'utilisation, rôles et bootstrap : [09-CRM-GUIDE.md](09-CRM-GUIDE.md).

---

## 10. RPC `submit_mandate_funnel` — retour enrichi (alerte Slack)

Migration **additive** `20260730180000_mandate_funnel_return_ids` (appliquée sur
`wmhrpweefutwldbhllhg`). `CREATE OR REPLACE` de `submit_mandate_funnel` avec un
**corps identique** à la version déployée — **seules** les deux instructions
`return` changent :

- nouvelle demande réellement enregistrée →
  `{ accepted:true, created:true, opportunity_id:<uuid> }` ;
- rejeu idempotent (même clé) → `{ accepted:true, created:false }`.

Ces champs `created` / `opportunity_id` sont destinés au **serveur uniquement**
(déclenchement d'une **alerte Slack sans doublon** — voir
[10-SLACK-ALERTS.md](10-SLACK-ALERTS.md)) : l'action Next ne les renvoie **jamais**
au navigateur. La **neutralité** publique est préservée (`created` reflète la
fraîcheur de la clé d'idempotence, jamais l'existence d'un contact ;
`opportunity_id` est un UUID qui n'ouvre aucun accès sans authentification). RLS,
GRANT (`anon`/`authenticated` conservés par `CREATE OR REPLACE`), scoring,
dédoublonnage, preuve RGPD et idempotence **inchangés**.

Vérification (transaction annulée, aucune donnée persistée) : nouvelle demande →
`created:true` + `opportunity_id` + 5 objets créés (dont rattachement org
opérateur) ; rejeu même clé → `created:false` ; `anon`/`authenticated` conservent
l'`EXECUTE`.

---

## 11. Utilisateurs, invitations, rôles & accès — V1 (APPLIQUÉ)

Deux migrations **additives** déploient la gestion des utilisateurs au-dessus du
CRM, **sans** modifier les migrations antérieures ni `submit_mandate_funnel`.
Appliquées sur `wmhrpweefutwldbhllhg` :

| Fichier | Rôle |
|---|---|
| `20260730190000_users_and_access_v1.sql` | Table `organization_invitations` + fonctions d'administration (invitations, rôles, activation) + acceptation + isolation RLS `agent_immobilier` (dossiers affectés) + extension additive des contraintes `audit_events` |
| `20260730191000_users_access_lock_anon_execute.sql` | Retire `EXECUTE` à `anon`/`public` sur les nouvelles fonctions (même correctif que `crm_lock_anon_execute`) |

**Objets créés** (schéma `public`) :
- Table `organization_invitations` (RLS active, lecture réservée aux
  administrateurs, aucune écriture directe, index unique partiel « une invitation
  active par organisation et e-mail », **aucun token brut stocké**).
- Fonctions `SECURITY DEFINER` (`search_path` figé) : `crm_create_invitation`,
  `crm_resend_invitation`, `crm_mark_invitation_sent`, `crm_revoke_invitation`,
  `crm_accept_invitation`, `crm_my_pending_invitation`, `crm_change_member_role`,
  `crm_set_member_status`, `crm_list_team`, `crm_list_invitations`, et les helpers
  d'isolation `crm_is_operator`, `crm_assigned_opportunity_ids`,
  `crm_role_is_assignable`.
- Politiques RLS de lecture **role-aware** : les rôles opérateur
  (admin/manager/setter) conservent la visibilité complète ; `agent_immobilier`
  est restreint à ses **dossiers affectés** ; `partenaire_lecture` ne voit aucun
  dossier (partage non activé en V1).
- Contraintes `audit_events` **étendues** (entité `invitation` ; événements
  `invitation_*`, `changement_role`, `activation_membre`, `desactivation_membre`).

**Sécurité (mesurée sur le projet distant, transactions annulées)** — voir le
détail dans [12-USERS-AND-ACCESS.md](12-USERS-AND-ACCESS.md) §8 :
- **Aucune régression** : l'admin réel voit toujours le dossier réel ; `anon`
  refusé ; `submit_mandate_funnel` toujours exécutable par `anon` (funnel intact).
- `anon` **ne peut exécuter aucune** fonction de gestion (`EXECUTE` = false) ;
  `authenticated` conserve l'`EXECUTE` (chaque fonction re-vérifie le rôle).
- Isolation RLS vérifiée : non-membre → 0 dossier ; `agent_immobilier` → dossiers
  affectés uniquement ; `partenaire_lecture` → 0 dossier ; mutations refusées.
- Invariants : admin seul invite ; auto-élévation / auto-désactivation impossibles ;
  **dernier administrateur actif protégé** ; désactivation = perte immédiate
  d'accès sans suppression du compte `auth.users` ; acceptation unique/idempotente.
- Advisors sécurité : seuls des **WARN attendus** (fonctions `SECURITY DEFINER`
  exécutables par `authenticated` = architecture d'écriture ; funnel public).

**Clé serveur.** Les opérations d'invitation Auth utilisent `SUPABASE_SECRET_KEY`
(clé `sb_secret_…`), **strictement serveur**. Absente de l'environnement de
travail → l'envoi d'e-mail d'invitation est **désactivé proprement** (erreur de
configuration réservée aux administrateurs ; **aucune invitation réelle envoyée**,
aucune valeur inventée). Manipulation manuelle unique restante : voir
[12-USERS-AND-ACCESS.md](12-USERS-AND-ACCESS.md) §6.

**Données préservées.** Le compte administrateur réel (`agence@indescale.com`) et
l'unique dossier propriétaire réel sont **intacts** ; **aucune** donnée de test
persistée.

---

## 12. CRM Acquéreurs V1 — migration **écrite, NON appliquée**

| Fichier | Rôle |
|---|---|
| `20260803120000_buyers_crm_v1.sql` | Dossiers acquéreurs consolidés : `buyer_profiles`, `buyer_search_criteria`, `buyer_assignments` ; élargissement de `tasks`/`activities` ; RLS dédiée ; 17 fonctions `SECURITY DEFINER` ; matching versionné ; `submit_buyer_interest` étendu (retour `buyer_profile_id`) |

> ⚠️ **Statut : NON APPLIQUÉE sur `wmhrpweefutwldbhllhg`.** La migration est
> fournie pour revue et application contrôlée. Contrairement aux sections
> précédentes, **aucune vérification n'a été réalisée sur le projet distant** :
> ne pas lire les résultats ci-dessous comme un état de production.

**Strictement additive.** Aucune table, colonne ou donnée supprimée. Les seules
modifications d'objets existants sont des **élargissements** :

- `tasks.opportunity_id` et `activities.opportunity_id` deviennent **nullable**,
  avec ajout de `buyer_profile_id` et d'une contrainte imposant **exactement un**
  rattachement. Toutes les lignes existantes portent `opportunity_id` : **aucune
  donnée invalidée**.
- Contraintes `audit_events` **étendues** (sur-ensemble strict) : entité
  `buyer_profile`, événements `acquereur_*`.
- `buyer_interests` reçoit la colonne `buyer_profile_id`.
- Politiques RLS de `tasks` / `activities` réécrites en conservant **à
  l'identique** la branche mandat.
- `submit_buyer_interest` remplacée (`create or replace`) : comportement public
  inchangé (idempotence, dédoublonnage conservateur, scoring en base, preuve
  RGPD, réponse neutre) ; ajout du rattachement au dossier et du champ serveur
  `buyer_profile_id`.

### Validation réalisée (locale, PostgreSQL 16)

Un harnais reproduisant l'environnement Supabase (`auth.users`, `auth.uid()`,
`storage.buckets`, rôles `anon` / `authenticated` / `service_role`) a permis de
**rejouer les 14 migrations dans l'ordre** puis d'exécuter, en transactions
annulées :

- **Fonctionnel** — premier dépôt (1 contact / 1 dossier / 1 intérêt) ; rejeu
  idempotent sans doublon ; même personne sur un autre bien → **1 contact,
  1 dossier, 2 intérêts**, critères unionnés ; données du contact **intactes**
  après réutilisation ; matching explicable retourné.
- **Règles métier** — étapes protégées refusées ; « perdu » sans motif refusé ;
  dossier clos non déplaçable ; réouverture tracée ; contrainte de rattachement
  exclusif des tâches vérifiée dans les deux sens.
- **Isolation RLS** — agent non affecté : **0 dossier** ; setter : dossier visible.
- **Posture de sécurité** — `anon`/`PUBLIC` sans `EXECUTE` sur les 17 fonctions ;
  aucun privilège table pour `anon` ; RLS active sur les 6 tables concernées ;
  `search_path` figé partout ; trigger d'immuabilité de l'audit conservé.

### À faire avant application

1. Revoir la migration (aucune donnée acquéreur en base à ce jour :
   `buyer_interests` = 0 ligne, le backfill est donc un no-op).
2. L'appliquer via l'éditeur SQL Supabase ou `apply_migration`, **dans une
   fenêtre contrôlée**.
3. Rejouer les vérifications de sécurité sur le projet distant et consigner les
   résultats ici (comme pour les sections 9 et 11).
4. Vérifier les **advisors** Supabase : seuls des `WARN` attendus
   (fonctions `SECURITY DEFINER` exécutables par `authenticated` = architecture
   d'écriture ; funnel public).

Détail fonctionnel : [20-CRM-ACQUEREURS.md](20-CRM-ACQUEREURS.md).
