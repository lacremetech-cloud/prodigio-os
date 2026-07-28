# 05 — Questions ouvertes

Décisions **non validées** à ce jour. Elles ne doivent **pas bloquer** le
démarrage : les éléments concernés sont traités comme des **hypothèses** et/ou
des **paramètres configurables**, jamais comme des constantes codées en dur.

> Convention : tant qu'une question n'est pas tranchée, l'implémentation reste
> **paramétrable** et **ne présume aucune obligation ni conformité juridique
> automatique**.

## A. Portage, entité et habilitations

| # | Question ouverte | Statut / hypothèse de travail | Impact si changée |
|---|---|---|---|
| 1 | **Rôle d'INDESCALE** | INDESCALE porte le **développement et l'exploitation** du système Prodigio ; **ne porte pas** les mandats immobiliers. Entité Prodigio à créer. | Mentions légales, responsabilités, RGPD. |
| 2 | **Entité portant les mandats** | Une **entité immobilière habilitée**, **à confirmer contractuellement**. Héritage Patrimoine (Cyril Gallon) envisagé, entité exacte à valider. | Validité juridique des mandats. |
| 3 | **Carte professionnelle et habilitations** | L'agence partenaire disposerait des autorisations nécessaires (à confirmer précisément). | Validité juridique des actes. |
| 4 | **Périmètre géographique initial** | À définir (zone(s) de lancement). | Ciblage publicitaire, périmètre partenaire. |

## B. Modèle économique (paramètres configurables et versionnés)

| # | Question ouverte | Statut / hypothèse de travail | Impact si changée |
|---|---|---|---|
| 5 | **Base de rémunération : honoraires HT ou TTC** | **Non tranché.** Paramètre. **Distinct** de la base du seuil de valeur du bien. | Calcul des partages économiques. |
| 6 | **Base du seuil premium** | **Non tranché** : estimation, prix de mandat, ou prix de vente ? Hypothèse de valeur 800 000 €, **configurable**. **Ne pas** confondre avec HT/TTC des honoraires. | Segmentation des biens. |
| 7 | **Partages économiques** | Hypothèses : **70/30** (premium), **40/60** (hors cible), **configurables et versionnés** par partenaire et segment. | Répartition des revenus. |
| 8 | **Financement des shootings** | À définir (qui finance les prises de vue). | Coûts et responsabilités de production. |
| 9 | **Budgets publicitaires** | À définir (montants, répartition acquisition propriétaires vs acheteurs). | Modèle économique, pilotage marketing. |

## C. Leads, commercial et accès

| # | Question ouverte | Statut / hypothèse de travail | Impact si changée |
|---|---|---|---|
| 10 | **Propriété et attribution des leads** | À définir (à qui appartient le lead ; règles d'attribution entre Prodigio et l'agence). | Droits sur les données, répartition commerciale. |
| 11 | **Exclusivité** | À définir (mandats exclusifs ou non ; exclusivité territoriale/partenaire). | Stratégie commerciale, contrats. |
| 12 | **Règles de rappel et de qualification** | À définir (délais de premier rappel, cadence, critères de qualification). | Process setter, SLA, mesure de performance. |
| 13 | **Règles exactes de visibilité** (setter, agent partenaire, manager, lecture seule, multi-appartenance) | À décider — voir [06-ACCESS-MODEL.md](06-ACCESS-MODEL.md) §4. | Cloisonnement des données, permissions. |

## D. RGPD et protection des données

> La documentation ne doit **jamais** affirmer que la conservation d'une preuve
> **suffit** à garantir la conformité. Ces points requièrent une **validation
> juridique avant mise en production**.

| # | Question ouverte | Statut / hypothèse de travail | Impact si changée |
|---|---|---|---|
| 14 | **Identité exacte du/des responsable(s) de traitement** | **Non tranché.** À déterminer (INDESCALE, entité Prodigio, agence). | Base même de la conformité RGPD. |
| 15 | **Rôle RGPD d'INDESCALE et de l'agence partenaire** | À qualifier (responsable / sous-traitant / responsabilité conjointe ?). | Contrats, mentions, responsabilités. |
| 16 | **Transmission des données à Héritage (Patrimoine)** | À encadrer (base légale, information, destinataires). | Licéité des transferts. |
| 17 | **Texte exact autorisant le rappel téléphonique** | **Non validé.** À rédiger/valider juridiquement. | Licéité du setting téléphonique. |
| 18 | **Règles entrant en vigueur le 11 août 2026** | À intégrer avant/à cette échéance ; impact à évaluer. | Conformité des traitements et communications. |
| 19 | **Durées de conservation** | À définir par type de donnée ; par défaut **minimisation**. | Rétention, purge/archivage. |
| 20 | **Validation juridique avant production** | **Obligatoire** avant mise en production des traitements RGPD. | Passage en production. |

## Principes en attendant les décisions

- Le **seuil premium**, les **partages** et la **base HT/TTC** restent des
  **paramètres de configuration versionnés** ; la **base du seuil de valeur** et
  la **base HT/TTC des honoraires** sont **deux notions distinctes**.
- Aucune **obligation juridique** n'est inventée ni codée ; **aucune conformité
  n'est présumée**. Le système **conserve la preuve** nécessaire, ce qui **ne
  suffit pas** à garantir la conformité.
- Les **hypothèses** sont clairement identifiées comme telles dans la
  documentation et le code (commentaires/paramètres).
- La **conservation des données** suit par défaut le principe de **minimisation**
  jusqu'à définition de durées précises.
- Le modèle **PrivacyRecord / ConsentRecord** conserve finalité, base légale,
  version de notice, responsables, destinataires, canal autorisé, choix et preuve
  — voir [03-DOMAIN-MODEL.md](03-DOMAIN-MODEL.md).
