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

## E. Pilotage pub (décision du 12/11/2026)

Voir [33-PILOTAGE-PUB.md](33-PILOTAGE-PUB.md). Les règles de calcul ont été
validées par Victor le 12/11/2026 ; restent ouverts :

| # | Question ouverte | Statut / hypothèse de travail | Impact si changée |
|---|---|---|---|
| 21 | **Commission des Airelles : sur le prix HT de la grille du promoteur ?** | **Non tranché.** Aujourd'hui, le prix HT de la grille est **pris comme prix affiché** (nature du prix `ht_grille_promoteur`, signalée à l'écran). | Commission potentielle des Airelles. |
| 22 | **Base HT des honoraires** | La règle validée suppose un **taux de commission TTC**. Avec une base HT ou « à confirmer », **aucune commission n'est calculée** : une autre formule reste à valider si un bien l'exige. | Tout bien dont le taux serait HT. |
| 23 | **Commission encaissée sans prix de vente final** | **Hypothèse retenue : « manquante »** tant que le prix final n'est pas saisi — pas de repli sur le prix affiché, qui n'est pas ce qui a été payé. À confirmer. | Commission encaissée, ROAS réel. |
| 24 | **Part de Prodigio : conditions du bien ou photographie du mandat ?** | Pour un bien sous mandat, la part saisie dans les conditions **prime** ; laissée vide, celle de la photographie du mandat s'applique ; un écart est **signalé**. La constitution range les parts dans des règles par partenaire × segment : les conditions par bien en sont **distinctes** et ne réinterprètent aucun mandat. | Commission des biens sous mandat. |
| 25 | **Taux de TVA des honoraires** | **Saisi avec chaque version** des conditions (20 % dans la règle validée) ; jamais codé en dur. | Commission HT. |
| 26 | **Événements du pilotage au journal d'audit** | Le journal est lisible par les managers : les événements du pilotage n'y portent **aucun montant**, seulement des identifiants. Un manager voit donc qu'une saisie a eu lieu, pas son contenu. Les masquer aussi aux managers demanderait de modifier la politique `audit_events_crm_read` — **non fait, à décider**. | Cloisonnement du pilotage. |
| 27 | **Répartition d'un coût commun aux lots** | Au **prorata du prix** des lots (règle validée) ; appliquée à l'étape 3, sur la page Pilotage. | Rentabilité par lot. |
| 28 | **Rattachement : calculé à la lecture, ou figé dans chaque ligne ?** | Le brief range le rattachement parmi les colonnes des statistiques du jour. **Choix proposé : le calculer à la lecture**, à partir des règles en vigueur, et garder dans chaque ligne les noms et identifiants tels que Meta les donnait. Une règle corrigée reclasse alors tout l'historique, sans relire Meta ni réécrire une statistique. Si Victor préfère qu'une règle nouvelle ne touche pas au passé, il faudra dater les règles par période. **À valider.** | Dépense par bien, sur le passé. |
| 29 | **Couverture d'une portée de plus de 100 pubs** | Le filtre `ad.id IN` est plafonné à **100 identifiants par requête** (plafond prudent, pour ne pas dépendre d'une limite de Meta non documentée). Au-delà, la couverture vaut « — », avec la raison. | Fréquence d'un bien très diffusé, ou du total. |
| 30 | **Couverture et règles changées** | La couverture se lit chez Meta **avec les règles du moment de la lecture** (elle ne se recalcule pas). Après un changement de règle, elle se met à jour à la lecture suivante — le lendemain matin, ou au bouton « Lire Meta maintenant ». | Fréquence par bien, le jour d'un changement de règle. |
| 31 | **Fenêtre d'attribution des leads** | La requête ne précise aucune fenêtre : l'API applique la sienne. Un ensemble de publicités réglé autrement dans le Gestionnaire peut afficher d'autres leads. Piste si l'écart se voit : le paramètre d'attribution unifiée de l'API — **à vérifier sur v27.0 avant de l'ajouter**. | Leads et coût par lead. |
| 32 | **Durée d'une lecture sur Vercel** | La route demande **300 s** ; la lecture s'arrête d'elle-même à **200 s** et se déclare « partielle ». Si l'offre Vercel du projet accorde moins, la fonction est coupée : la lecture restée « en cours » est close d'office **vingt minutes** plus tard, et la suivante repart du dernier jour complet. Selon l'offre, Vercel peut aussi décaler l'appel du matin dans l'heure. **À vérifier : l'offre et la durée accordée.** | Première lecture de l'historique (plusieurs clics possibles). |
| 33 | **Tolérance du contrôle quotidien** | Un écart de **un centime par pub et par jour** est toléré entre la somme des pubs et la dépense du compte (arrondis de Meta) ; au-delà, l'écart est affiché. **À valider.** | Alertes de contrôle. |

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
