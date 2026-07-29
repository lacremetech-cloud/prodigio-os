# 07 — Supabase : configuration et application de la migration

Ce document explique comment **activer le dépôt des demandes** de la landing
propriétaire (funnel Mandats — tranche « capture ») : variables d'environnement,
application de la **migration SQL versionnée**, modèle de sécurité, vérification,
et prérequis de production.

> **État actuel — DÉPLOYÉ.** La migration `mandate_funnel_capture` est
> **appliquée** sur le projet `prodigio-os` (`wmhrpweefutwldbhllhg`, région
> `eu-west-3`, Postgres 17), enregistrée sous la version `20260729150515`. Les
> variables publiques sont fournies dans l'environnement cloud. Le funnel est
> **fonctionnel de bout en bout** : une soumission réelle depuis
> `/proprietaire/analyse` crée bien FunnelSubmission + Contact + Opportunity +
> OpportunityContact + PrivacyRecord et affiche l'écran de confirmation.
>
> Vérifié après déploiement (voir §6) : RLS active sur les 5 tables, **aucune
> politique publique**, **aucun GRANT direct** pour `anon`/`authenticated`/
> `PUBLIC`, fonction `submit_mandate_funnel` `SECURITY DEFINER` exécutable par
> `anon`/`authenticated` uniquement, réponse publique neutre `{ accepted: true }`,
> idempotence et dédoublonnage conservateur confirmés. Les données de test ont
> été supprimées ; les tables sont vides.
>
> ⚠️ **Non terminé (bloquants de production)** : Cloudflare Turnstile (anti-abus)
> et la **validation juridique RGPD** ne sont **pas** faits — voir §5.

---

## 1. Variables d'environnement

À définir dans `.env.local` (dev) et dans les variables de l'hébergeur
(preview / production) — **jamais** commitées.

| Variable | Rôle | Secret ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL publique du projet (`https://<ref>.supabase.co`) | Non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé **publiable** (anon), protégée par RLS | Non (publique par conception) |
| `SUPABASE_PROJECT_REF` | Référence du projet (documentation / CLI) | Non |

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

- ⛔ **Cloudflare Turnstile** (anti-abus) : le funnel dispose d'un honeypot et
  d'une clé d'idempotence, mais **n'est pas** protégé contre les abus
  automatisés. Turnstile doit être ajouté avant l'ouverture publique.
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
