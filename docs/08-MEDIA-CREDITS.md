# 08 — Crédits et licences des photographies

Sélection éditoriale **provisoire** pour la première version de la landing
propriétaire et de l'analyse d'éligibilité. Ces visuels pourront être remplacés
par les **shootings Prodigio**.

## Règles appliquées

- Sources **exclusivement** Unsplash et Pexels, dont les licences autorisent
  clairement l'usage commercial **sans obligation d'attribution** (l'attribution
  ci-dessous est fournie par bonne pratique).
- **Aucune** image issue d'une agence immobilière, d'un portail d'annonces ou
  d'un site sans licence claire ; aucune image de marque (Barnes, Sotheby's,
  Kretz, Le Figaro Immobilier…).
- **Aucun hotlink** : toutes les images sont **téléchargées dans le dépôt**
  (`public/images/mandate/`), optimisées en **WebP** et servies via `next/image`
  avec des dimensions explicites.
- Aucun faux portrait d'intervenant n'a été généré.

## Format et poids

Images converties en WebP (qualité ≈ 60–78 selon l'usage), largeurs adaptées à
l'emploi (héros ≈ 2400 px, cartes ≈ 1400 px). `next/image` génère en plus les
tailles responsives.

## Inventaire

| Fichier (`public/images/mandate/`) | Usage | Source | Photographe | Licence | Page source |
|---|---|---|---|---|---|
| `hero.webp` | Hero landing | Unsplash | Aalo Lens | Unsplash License | https://unsplash.com/photos/eWOgoFHlE8g |
| `vsl.webp` | Visuel présentation (VSL) | Unsplash | Clay Banks | Unsplash License | https://unsplash.com/photos/vNecZJJQRLE |
| `constat.webp` | Section « Le constat » | Pexels | Ahmet ÇÖTÜR | Pexels License | https://www.pexels.com/photo/31817155/ |
| `cat-villa.webp` | Carte « Villa ou maison d'architecte » | Pexels | Viktoriia Kondratiuk | Pexels License | https://www.pexels.com/photo/17174768/ |
| `cat-appartement.webp` | Carte « Appartement d'exception » | Pexels | Max Vakhtbovych | Pexels License | https://www.pexels.com/photo/5998120/ |
| `cat-chalet.webp` | Carte « Chalet » (Megève) | Unsplash | Mario La Pergola | Unsplash License | https://unsplash.com/photos/H-wqkwnokYo |
| `cat-domaine.webp` | Carte « Domaine ou propriété de caractère » | Unsplash | Carnet de Voyage d'Alex | Unsplash License | https://unsplash.com/photos/bb0rqQ_1yxg |
| `cat-autre.webp` | Carte « Autre propriété » | Unsplash | Roger Starnes Sr | Unsplash License | https://unsplash.com/photos/Ph06_YFjRu0 |
| `ambiance-1.webp` | Ambiance analyse (arches en pierre) | Unsplash | Claudio Poggio | Unsplash License | https://unsplash.com/photos/-jBfdyEFH_E |
| `ambiance-2.webp` | Ambiance analyse + CTA final (façade Bordeaux) | Unsplash | Clément ROY | Unsplash License | https://unsplash.com/photos/aZCRwzwYrL4 |
| `confirmation.webp` | Écran de confirmation (rive au crépuscule) | Unsplash | Howard Walsh | Unsplash License | https://unsplash.com/photos/puiEPnbtF9k |

## Licences

- **Unsplash License** — https://unsplash.com/license
- **Pexels License** — https://www.pexels.com/license/

Les deux autorisent l'usage commercial gratuit sans attribution obligatoire. En
cas de doute sur une licence, l'image n'a **pas** été retenue.

---

## Comparaison « écrin » (`public/images/ecrin/`)

Illustrations issues des **actifs marketing Prodigio** (récupérés depuis
`prodigio.fr/systeme`, propriété du projet), converties en WebP.

- `ecrin-prodigio.webp`, `carte-identite.webp`, `brochure-couverture.webp`,
  `brochure-interieur.webp`, `publicites.webp` — créations **Prodigio**.
- `annonce-standard.webp` — capture d'une annonce de portail servant d'exemple
  « standard ». **Marque tierce neutralisée** (en-tête recadré, logo/pastille et
  filigrane floutés) afin d'éviter toute publicité comparative dénigrante :
  aucune agence n'est identifiable. *(N'est plus affichée depuis la refonte de
  la comparaison en deux parties ; conservée pour référence.)*
- `agence-1.webp`, `agence-2.webp` — fiches d'agences classiques servant
  d'exemples du **format standard identique partout** (bloc « Partout ailleurs »
  de la section 01). Fiche **complète** conservée (prix, caractéristiques,
  descriptif, vignettes) pour que le contraste avec l'écrin Prodigio soit
  lisible, mais **marque, logo, bloc agent et filigranes neutralisés** (floutés) :
  **aucune agence n'est identifiable**. Le but est de montrer un format, jamais
  de dénigrer une enseigne nommée.

> ⚠️ **Publicité comparative — validation juridique requise.** Réafficher des
> marques d'agences identifiables (comparaison nominative) relève d'une décision
> à valider par Cyril / Victor et, le cas échéant, un conseil juridique. En
> l'absence de validation, les fiches restent **neutralisées**.
