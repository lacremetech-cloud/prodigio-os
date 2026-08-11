# 19 — Expérience publique du bien & Funnel Acquéreur (V1)

> **Statut : implémenté (tranche V1).** Cette étape transforme un bien préparé
> dans la **Fabrique de biens** ([docs/18](18-PROPERTY-FACTORY-V1.md)) en une
> **expérience publique premium dédiée à cette seule propriété**, puis permet aux
> acquéreurs intéressés de **se qualifier**. Elle NE construit PAS le CRM
> Acquéreurs complet (voir §12 — Limites).

Parcours cible :

```
Fabrique du bien → bien prêt à lancer → préparation de la publication →
prévisualisation privée → publication → page publique cinématographique →
questionnaire acquéreur → qualification serveur → intérêt enregistré et visible.
```

Migration : `supabase/migrations/20260802120000_public_property_experience_v1.sql`
(strictement **additive**). Modules : `src/modules/buyers/**`. Pages publiques :
`/bien/[slug]`, `/bien/[slug]/interet`. Prévisualisation privée :
`/apercu-bien/[id]`. Configuration : onglet **Expérience publique** du cockpit
`/crm/biens/[id]`.

---

## 1. Principe fondamental

La page publique **ne ressemble jamais à une fiche d'annonce immobilière
classique**. Elle donne l'impression de découvrir une **propriété singulière,
une marque, une histoire, un mode de vie** — une expérience conçue autour d'un
**seul** bien.

- **Aucune** grille de biens similaires, **aucun** moteur de recherche, **aucun**
  composant de portail immobilier. On ne mélange jamais plusieurs annonces.
- Rendu **éditorial et cinématographique** : hero plein écran, rythme éditorial,
  alternance de compositions, révélations sobres, galerie premium, typographie
  forte, contraste strict, CTA généreux. Parallaxe légère et micro-interactions
  respectent **`prefers-reduced-motion`** (`Reveal`, `Parallax`).
- **Seules les sections réellement renseignées s'affichent** : aucune section
  vide, aucun faux texte, aucune donnée inventée.

---

## 2. Architecture de publication

### Machine d'état de publication (distincte de la Fabrique)

`property_public_config.publication_status` :

| Statut | Sens |
|---|---|
| `brouillon` | Configuration en cours, jamais servie. |
| `en_preparation` | Contenu en cours de préparation. |
| `pret_a_publier` | Prêt (préparation publique complète). |
| `publie` | **Snapshot en ligne servi au public.** |
| `depublie` | Retiré du public (snapshots conservés). |
| `archive` | Archivé. |

La machine d'état **de la Fabrique** (`properties.status`) reste inchangée : la
publication est un **workflow parallèle**, elle ne casse aucun statut de
production existant.

### Conditions de publication (garde **côté serveur**)

`crm_property_publish` refuse la publication si `crm_property_public_readiness`
n'est pas satisfaite. Les **10 critères** calculés en base :

1. **Readiness interne** du bien satisfaite (`crm_property_readiness`).
2. **Positionnement** (Fabrique) validé.
3. **Titre public** renseigné.
4. **Introduction** renseignée.
5. **Slug public** défini.
6. **Contenu public validé** (décision admin/manager).
7. **Image principale publique** définie et approuvée.
8. **Médias à diffuser explicitement approuvés** (au moins un).
9. **Confidentialité définie** (localisation approximative + réglage vérifié).
10. **CTA acquéreur** configuré.

Le contrôle est **toujours** effectué côté serveur (jamais seulement dans l'UI) :
même un appel direct de la fonction est refusé si les critères ne sont pas réunis.

### Snapshot public versionné

À la publication, `crm_property_publish` **assemble un snapshot immuable**
(`property_public_snapshots`, `version` incrémentale) via
`build_property_public_content`, puis marque le bien `publie` et pointe
`published_snapshot_id` vers cette version. Le snapshot permet de :

- **publier une version** figée du contenu ;
- **modifier la Fabrique sans changer** immédiatement la page publiée ;
- **republier** une nouvelle version (v2, v3…) — l'historique est conservé ;
- conserver **version + date** de publication.

`build_property_public_content` ne lit **que** `property_public_config` +
`property_public_media` : jamais les champs privés du bien, les notes internes,
les documents, l'adresse exacte, le mandat, les données économiques ou les
informations du propriétaire. **Garantie structurelle d'absence de fuite.**

### Prévisualisation privée = page publiée

`/apercu-bien/[id]` (authentifié, RLS/rôle re-vérifiés par
`crm_property_public_preview`) rend le **même contenu assemblé** que le futur
snapshot : **preview et page publiée sont identiques** (même assembleur en base).
Toujours `noindex`.

---

## 3. Médias publics vs privés — cycle de vie maîtrisé

**Trois buckets distincts**, aucun mélange :

| Bucket | Visibilité | Contenu |
|---|---|---|
| `property-assets` | **PRIVÉ** (Fabrique) | Sources originales, documents légaux. **Jamais rendu public.** |
| `property-public-master` | **PRIVÉ** (nouveau) | Le **master** de chaque média approuvé. Accès serveur uniquement ; URL signée courte pour la prévisualisation. |
| `property-public` | **PUBLIC** (nouveau) | Les **copies publiques** des médias du bien **publié uniquement**. |

**Cycle de vie** (le point critique) :

1. **Téléversement** → le master va dans le bucket **PRIVÉ** `property-public-master`
   (`storage_path`, chemin `{propertyId}/master/{uuid}.{ext}`). Aucune copie
   publique n'existe encore.
2. **Publication** → pour chaque média approuvé/actif, une **copie publique
   fraîche** est créée dans `property-public`
   (`public_path`, chemin `{propertyId}/pub/{uuid}.{ext}`) ; le snapshot pointe
   ces copies. Avant la copie, **toutes** les copies publiques antérieures du bien
   sont **purgées** (une seule version en ligne à la fois).
3. **Dépublication / archivage** → **suppression** des objets du bucket public +
   `public_path` remis à `null`. **La copie directe cesse alors de résoudre**
   (nouvelle requête → 404).

Garanties :

- le bucket privé `property-assets` **n'est jamais rendu public** ; le master n'est
  **jamais** rendu public (on en fait une **copie**, on ne le publie pas) ;
- **copies publiques versionnées** (chemin frais à chaque publication, sans PII) ;
- **aucun document légal** dans les buckets publics (types autorisés : JPEG, PNG,
  WEBP, MP4) ;
- **aucune URL signée persistée** : le public utilise des URL directes du bucket
  public ; la prévisualisation authentifiée génère des URL signées **courtes**
  (120 s) du master, jamais stockées ;
- **seuls** les médias `approved = true` et `status = 'actif'` sont copiés/servis.

> ⚠️ **Caches & copies déjà téléchargées.** Une dépublication supprime les objets
> côté bucket, donc **toute nouvelle requête** à l'URL publique échoue (404).
> Elle **ne peut pas** révoquer une copie **déjà téléchargée** par un visiteur, ni
> une éventuelle mise en cache CDN/navigateur déjà servie : ces copies restent hors
> de notre contrôle jusqu'à expiration du cache. Ne jamais prétendre l'inverse.
> (Le bucket Supabase Storage public est servi avec un cache court ; un CDN
> éventuel devant l'app doit être configuré en conséquence.)

Une **image principale** (aperçu social), un **hero** et une **image sociale** sont
sélectionnés parmi les médias approuvés (`crm_property_set_public_media_role`).
L'URL publique est reconstruite côté application (`publicMediaUrl`) — le snapshot
stocke le **chemin** de la copie publique (indépendant de l'environnement), jamais
l'hôte Supabase ni le chemin du master.

---

## 4. Page publique (`/bien/[slug]`)

Route canonique. Ne sert **que** le snapshot **en ligne** d'un bien **publié**
(`public_property_by_slug`, `SECURITY DEFINER`, `anon`) — jamais un brouillon,
une prévisualisation ou un bien dépublié (→ **404 propre**, message neutre).

Structure éditoriale (sections optionnelles, ordre configurable) : Hero
(plein écran, image ou vidéo **muette** en autoplay, overlay lisible, nom,
signature, localisation approximative, caractéristiques essentielles, CTA) →
piliers → Le bien en quelques mots → L'histoire → L'expérience de vie →
Architecture & caractère → Caractéristiques essentielles → Galerie immersive →
Vidéo → Environnement & art de vivre → Détails « coup de cœur » → CTA de
qualification.

L'**adresse exacte n'est jamais publique** : seule une **localisation
approximative** est diffusée.

---

## 5. Funnel Acquéreur (`/bien/[slug]/interet`)

Questionnaire progressif (7 étapes + confirmation), reprenant les qualités UX du
funnel propriétaire, adapté à l'acquéreur. Questions (non intrusives) : nature du
projet, budget, financement, horizon d'achat, disponibilité, mode de décision,
pays/région de résidence, coordonnées (prénom, nom, téléphone international,
e-mail), canal & moment de rappel préférés, consentement.

Réponse **toujours neutre et premium** : jamais de « refusé » ni de « non
qualifié », quel que soit le score interne.

### Capture & sécurité (patterns validés réutilisés)

- **Validation Zod** aux frontières (client + serveur).
- **Turnstile vérifié côté serveur** — action **dédiée** `buyer_submission`
  (jamais rejouable depuis le funnel Mandats). Turnstile refusé ⇒ **aucune
  insertion**.
- **Idempotence** (`buyer_interests.idempotency_key` unique) : un rejeu identique
  ne crée **ni** deuxième soumission métier **ni** deuxième notification.
- **Dédoublonnage conservateur** du contact (e-mail normalisé uniquement ; jamais
  le téléphone). Réutilise la table `contacts`.
- **Attribution** first-touch / last-touch, UTM, `fbclid`/`gclid`, referrer,
  origine, version du funnel, **version du scoring**, **snapshot des réponses**
  (brutes + normalisées).
- **Preuve RGPD** reliée à la soumission (`privacy_records.buyer_interest_id`),
  base légale **à valider** (conformité **non présumée**).
- Aucune information sensible contrôlable depuis le navigateur (score, base légale,
  canaux, destinataires fixés **côté serveur**).

---

## 6. Scoring acquéreur

`compute_buyer_scores` (SQL, `buyer-scoring-v1`) — **miroir** de
`src/modules/buyers/scoring/config.ts`. **Distinct** du scoring Mandats,
**versionné et explicable**. Dimensions (0–100) :

- **Compatibilité budgétaire** (budget vs valeur de référence **interne** du bien) ;
- **Maturité** du projet (horizon + décision + nature) ;
- **Financement** ;
- **Disponibilité**.

Score global pondéré (budget 35 %, maturité 30 %, financement 20 %, disponibilité
15 %) → **priorité opérationnelle interne** (`prioritaire` / `a_qualifier` /
`a_suivre`). Les **seuils sont centralisés** (config), jamais dispersés dans l'UI.

Le score est **recalculé et stocké en base** (source de vérité, non falsifiable) ;
un score injecté depuis le navigateur est **ignoré**. Le **score exact reste
interne** ; le visiteur reçoit une réponse neutre.

La **valeur de référence** (`reference_value_cents`) est saisie par l'opérateur,
**interne**, jamais diffusée publiquement (ce n'est **pas** un paramètre codé en
dur : c'est une donnée de configuration par bien).

---

## 7. Réception minimale dans Prodigio OS

Le cockpit du bien affiche une section **« Intérêts acquéreurs »** en lecture
opérationnelle minimale : nombre total, nouvelles demandes, demandes
prioritaires, date, identité, coordonnées **selon les droits**, score interne,
réponses essentielles, attribution, **statut minimal** (`nouveau` / `consulte` /
`traite`), ouverture du détail.

**Pas encore** de Kanban acquéreur, de tâches acquéreur, de matching multi-biens
ni de pipeline complet. Cette structure **prépare proprement** le futur CRM
Acquéreurs sans le préempter.

---

## 8. Sécurité, permissions & audit

- **RLS** sur toutes les tables (`property_public_config`, `property_public_media`,
  `property_public_snapshots`, `buyer_interests`) : accès dérivé du bien via
  `crm_property_access` (opérateur = tout ; agent affecté = ses biens). Aucun
  accès public direct : le public passe **uniquement** par les fonctions
  `SECURITY DEFINER` dédiées.
- **Écritures** exclusivement via fonctions `crm_property_*` /
  `crm_buyer_interest_*` (rôle re-vérifié, `search_path` figé).
- **Décisions sensibles** (valider le contenu, publier, dépublier, archiver)
  réservées à **administrateur / manager** (`crm_can_decide`).
- Droits : **admin/manager** configurent & publient ; **agent affecté** participe
  éditorialement selon ses droits ; **setter** lit les intérêts sans publier ;
  **partenaire lecture** : aucun accès implicite ; **public** : uniquement le
  snapshot publié et le dépôt contrôlé.
- **Audit** (`audit_events`, immuable) : `bien_public_config`,
  `bien_public_media_ajoute/supprime`, `bien_public_hero`, `bien_public_valide`,
  `bien_public_statut`, `bien_publie`, `bien_depublie`,
  `acquereur_interet_statut`.

---

## 9. SEO, confidentialité & performance

- Par bien : `index`/`noindex` (**noindex par défaut**), canonical, Open Graph,
  image sociale, titre & description SEO.
- **Sitemap** (`/sitemap.xml`) : **uniquement** les biens **publiés ET
  indexables** (`public_indexable_properties`). **Jamais** les brouillons,
  prévisualisations, pages CRM ou données acquéreurs.
- **Robots** (`/robots.txt`) : interdit `/crm/`, `/apercu-bien/`,
  `/bien/*/interet`, `/proprietaire/analyse`, `/connexion`, `/invitation`,
  `/acces`, `/api/`.
- **404 propre** pour un slug inexistant ou dépublié
  (`src/app/bien/[slug]/not-found.tsx`).
- Performance : priorité à l'image Hero, tailles responsives, `loading="lazy"`
  sur la galerie, vidéo `preload="none"`, scripts légers, mobile irréprochable.

---

## 10. Slack — canal acquéreurs

Alerte **best-effort** pour chaque **nouvelle** demande acquéreur réellement
enregistrée (jamais un rejeu). Variable serveur **facultative** :

```
SLACK_BUYER_LEADS_WEBHOOK_URL   # canal privé #alertes-acquereurs
```

**Ne JAMAIS réutiliser silencieusement le canal Mandats.** Slack ne bloque jamais
l'enregistrement de la demande (envoi programmé via `after()`). La notification
contient : propriété concernée, identité, téléphone international, e-mail, projet,
budget, financement, horizon, **score & priorité internes**, attribution utile,
**lien profond** vers l'intérêt dans Prodigio OS. Elle **exclut** : jeton
Turnstile, webhook, IP, user agent, preuve de consentement, JSON brut, secrets.

### Manipulation manuelle (création du canal)

1. Slack → créer le canal privé **`#alertes-acquereurs`**.
2. **Incoming Webhooks** → *Add New Webhook to Workspace* → sélectionner
   `#alertes-acquereurs` → copier l'URL `https://hooks.slack.com/services/…`.
3. Vercel (Production uniquement) → variable `SLACK_BUYER_LEADS_WEBHOOK_URL` =
   cette URL. **Ne pas** la committer ; laisser vide en preview/dev.

---

## 11. Tests & recette

Tests unitaires (`src/modules/buyers/**/*.test.ts`) : scoring déterministe &
versionné (injection de faux score ignorée), validation (honeypot neutralisé,
téléphone/e-mail), construction du payload (brut vs normalisé, slug, preuve),
message Slack (champs requis présents, sensibles exclus), notifications (canal
dédié, panne non bloquante, aucun secret journalisé), URLs médias publics.

Les garanties **au niveau base** (publication refusée si readiness incomplète,
snapshot sans donnée privée, slug unique, brouillon inaccessible, bien dépublié
inaccessible, Turnstile refusé → aucune insertion, idempotence, RLS) sont
**portées par la migration** — la base fait autorité.

**Recette contrôlée** (bien fictif, médias fictifs) : créer un bien → compléter la
Fabrique → atteindre la readiness → préparer le contenu public → prévisualiser →
publier → vérifier la page (desktop + mobile) → soumettre un acquéreur fictif →
vérifier scoring/attribution/unicité → vérifier l'apparition dans le cockpit →
vérifier la construction déterministe de l'alerte Slack (sans webhook réel si la
variable n'est pas autorisée) → dépublier → supprimer **uniquement** les données
et fichiers de test → confirmer que toutes les données réelles sont intactes.
**Ne jamais contourner l'audit immuable pour nettoyer.**

---

## 12. Limites (hors périmètre V1)

Non construits (seams propres préparés) : CRM Acquéreurs complet, matching
acquéreur ↔ plusieurs biens, portail propriétaire, automatisations e-mail,
SMS/WhatsApp, campagnes Meta réelles, génération automatique du copywriting,
création automatique de brochure, site sur domaine personnalisé, signature
électronique, prise de rendez-vous visite acquéreur, statistiques publicitaires
avancées.

---

## 13. Préparation du futur CRM Acquéreurs

Les fondations posées ici (contact réutilisé avec rôle acquéreur distinct via
`buyer_interests`, soumission conservée, attribution, scoring versionné, preuve
RGPD, statut de réception) constituent le socle du futur CRM Acquéreurs :
pipeline, tâches, matching multi-biens et affectations pourront s'y greffer de
façon **additive**, sans réécriture.

---

## Captures (données fictives)

Générées hors ligne par `scripts/public-experience-shots.mjs` (bien fictif
« Villa Aurelia ») dans `docs/assets/public-experience/` :

- Page publique desktop — `public-desktop.png`
- Page publique mobile — `public-mobile.png`
- Hero image — `hero-image.png`
- Hero vidéo (fallback) — `hero-video-fallback.png`
- Galerie — `gallery.png`
- Funnel (desktop / mobile) — `funnel-desktop.png`, `funnel-mobile.png`
- Confirmation — `confirmation.png`
- Configuration CRM (sombre / clair) — `crm-config-dark.png`, `crm-config-light.png`
- Liste minimale des intérêts — `interests-dark.png`
