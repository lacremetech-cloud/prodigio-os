# 11 — Page d'accueil publique (`/`)

La racine `https://go.prodigio.fr/` est la **porte d'entrée publique** de
l'écosystème Prodigio. Des prospects (publicité, bouche-à-oreille, saisie
directe) peuvent y arriver : elle doit présenter Prodigio en quelques secondes
puis **orienter chaque visiteur vers le bon parcours**. Ce n'est **ni** un
sitemap interne, **ni** une copie de la landing propriétaire.

---

## 1. Rôle et périmètre

- **Courte, cinématographique, premium, très lisible, orientée action.**
- Ne **duplique pas** la landing `/proprietaire` (récit long) : elle la
  **résume** et y renvoie.
- N'expose **aucune** route interne (`/crm/*`). Le seul accès authentifié
  proposé est `/connexion` (« Accès privé » / « Espace sécurisé »).

## 2. Structure

| Section | Fond | Contenu |
|---|---|---|
| **Hero** | onyx (sombre) | Nav (logo + « Accès privé »), signature **H1**, description, deux grands CTA, indice de défilement. |
| **Positionnement** | ivoire (clair) | « Ce qu'est Prodigio » : 6 points courts (pas une agence, système actif, bien = marque, visibilité financée, acquéreurs FR + étranger, accès sur sélection). |
| **Aiguillage** | onyx (sombre) | « Choisissez votre accès » : carte **Propriétaire** (découvrir + éligibilité) et carte **Espace sécurisé** (connexion). |
| **Pied de page** | bois noir | `SiteFooter` réutilisé — positionnement honnête, **aucun lien mort**. |

Rythme de contraste **sombre → clair → sombre** ; un seul `H1` (la signature),
les titres de section sont des `H2`, les piliers/labels des `H3`.

## 3. Signature et CTA

- **Signature (H1)** : « Prodigio ne met pas votre bien en vente. Prodigio le
  vend. »
- **CTA primaire** : « Vérifier l'éligibilité de mon bien » → `/proprietaire/analyse`.
- **CTA secondaire** : « Découvrir le Système Prodigio » → `/proprietaire`.
- Copywriting sans promesse juridiquement risquée, sans délai garanti, sans
  superlatif invérifiable.

## 4. Réutilisation du design system

Aucun nouvel asset ni dépendance. La page réutilise :

- **Composants** : `LandingCta`, `Reveal`, `Parallax`, `ProdigioLogo`,
  `AttributionCapture`, `SiteFooter`.
- **Tokens & utilitaires** (`globals.css`) : palette onyx / ivoire / or,
  polices Cormorant (titres) + Inter (reste), `grain`, `badge-shine`,
  `cta-shine`, `animate-glow`, `animate-scroll-cue`, `eyebrow`, système
  `reveal`.
- **Assets** : `media.hero` (`/images/mandate/hero.webp`) pour le hero **et**
  l'image Open Graph.

## 5. Attribution (UTM) préservée

`AttributionCapture` est monté dès la racine : les UTM et le référent saisis à
l'entrée sont captés (premier + dernier contact) et conservés en
`sessionStorage`. La navigation interne (Next `Link`) préserve ce stockage —
l'attribution est donc intacte jusqu'au dépôt de la demande, même quand le
visiteur arrive d'abord sur `/`.

## 6. Référencement, accessibilité, performance

- `title` absolu, `meta description`, **Open Graph** (titre, description, `url`,
  image 2400×1350 + `alt`), **canonique** `/` (résolu sur
  `https://go.prodigio.fr/` en production via `metadataBase`, jamais codé en
  dur).
- **Un seul `H1`**, structure sémantique (`header` / `section` +
  `aria-labelledby` / `footer`), focus visibles, contrastes conformes (tokens
  audités AA), navigation clavier.
- Image hero en `next/image` (`priority`, poster natif, `sizes="100vw"`) ;
  parallaxe légère et animations **désactivées** sous `prefers-reduced-motion`
  (contenu alors immédiatement visible). Page **prérendue statiquement**.

---

## 7. Prochaine évolution (hors périmètre de cette itération)

> **Ne pas construire ici.** Documenté pour la suite uniquement.

**Un futur lanceur privé dans `/crm`.** Une fois authentifié, l'utilisateur
disposera, **à l'intérieur de `/crm`**, d'un lanceur (tableau de bord d'entrée)
qui présente les accès internes selon son **rôle** et son **organisation** :
vue d'ensemble, dossiers de mandats, pipeline, tâches, paramètres, et les futurs
modules (Biens & Acquéreurs, Portail propriétaire).

Ce lanceur reste **strictement privé** : il vit derrière `/connexion`, protégé
par le middleware **et** la RLS. Il **ne doit jamais** apparaître sur la page
d'accueil publique ni exposer d'URL interne à un visiteur non authentifié. La
page `/` publique se contente d'un lien neutre « Accéder à Prodigio OS » →
`/connexion`.
