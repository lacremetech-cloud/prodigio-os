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
validées par Victor le 12/11/2026. Le **22/11/2026**, en donnant son accord
pour la mise en production de l'étape 2, il a tranché les questions 23, 26,
28, 31 et 33 telles que proposées (marquées « Décidé »). Restent ouverts :

| # | Question ouverte | Statut / hypothèse de travail | Impact si changée |
|---|---|---|---|
| 21 | **Commission des Airelles : sur le prix HT de la grille du promoteur ?** | **Non tranché.** Aujourd'hui, le prix HT de la grille est **pris comme prix affiché** (nature du prix `ht_grille_promoteur`, signalée à l'écran). | Commission potentielle des Airelles. |
| 22 | **Base HT des honoraires** | La règle validée suppose un **taux de commission TTC**. Avec une base HT ou « à confirmer », **aucune commission n'est calculée** : une autre formule reste à valider si un bien l'exige. | Tout bien dont le taux serait HT. |
| 23 | **Commission encaissée sans prix de vente final** | **Décidé par Victor le 22/11/2026 : « manquante »** tant que le prix final n'est pas saisi — pas de repli sur le prix affiché, qui n'est pas ce qui a été payé. | Commission encaissée, ROAS réel. |
| 24 | **Part de Prodigio : conditions du bien ou photographie du mandat ?** | Pour un bien sous mandat, la part saisie dans les conditions **prime** ; laissée vide, celle de la photographie du mandat s'applique ; un écart est **signalé**. La constitution range les parts dans des règles par partenaire × segment : les conditions par bien en sont **distinctes** et ne réinterprètent aucun mandat. | Commission des biens sous mandat. |
| 25 | **Taux de TVA des honoraires** | **Saisi avec chaque version** des conditions (20 % dans la règle validée) ; jamais codé en dur. | Commission HT. |
| 26 | **Événements du pilotage au journal d'audit** | Le journal est lisible par les managers : les événements du pilotage n'y portent **aucun montant**, seulement des identifiants. Un manager voit donc qu'une saisie a eu lieu, pas son contenu. **Décidé par Victor le 22/11/2026 : la trace reste visible des managers** (jamais un montant) ; la politique `audit_events_crm_read` n'est pas modifiée. | Cloisonnement du pilotage. |
| 27 | **Répartition d'un coût commun aux lots** | Au **prorata du prix** des lots (règle validée) ; appliquée à l'étape 3, sur la page Pilotage. | Rentabilité par lot. |
| 28 | **Rattachement : calculé à la lecture, ou figé dans chaque ligne ?** | Le brief range le rattachement parmi les colonnes des statistiques du jour. **Décidé par Victor le 22/11/2026 : calculé à la lecture**, à partir des règles en vigueur ; chaque ligne garde les noms et identifiants tels que Meta les donnait. Une règle modifiée **reclasse tout le passé**, sans relire Meta ni réécrire une statistique. (Dater les règles par période resterait possible si le besoin venait.) | Dépense par bien, sur le passé. |
| 29 | **Couverture d'une portée de plus de 100 pubs** | Le filtre `ad.id IN` est plafonné à **100 identifiants par requête** (plafond prudent, pour ne pas dépendre d'une limite de Meta non documentée). Au-delà, la couverture vaut « — », avec la raison. | Fréquence d'un bien très diffusé, ou du total. |
| 30 | **Couverture et règles changées** | La couverture se lit chez Meta **avec les règles du moment de la lecture** (elle ne se recalcule pas). Après un changement de règle, elle se met à jour à la lecture suivante — le lendemain matin, ou au bouton « Lire Meta maintenant ». | Fréquence par bien, le jour d'un changement de règle. |
| 31 | **Fenêtre d'attribution des leads** | **Décidé par Victor le 22/11/2026 : la fenêtre par défaut de l'API.** La requête n'en précise aucune ; un ensemble de publicités réglé autrement dans le Gestionnaire peut afficher d'autres leads. Piste si l'écart se voit : le paramètre d'attribution unifiée de l'API — **à vérifier sur v27.0 avant de l'ajouter**. | Leads et coût par lead. |
| 32 | **Durée d'une lecture sur Vercel** | La route demande **300 s** ; la lecture s'arrête d'elle-même à **200 s** et se déclare « partielle ». Si l'offre Vercel du projet accorde moins, la fonction est coupée : la lecture restée « en cours » est close d'office **vingt minutes** plus tard, et la suivante repart du dernier jour complet. Selon l'offre, Vercel peut aussi décaler l'appel du matin dans l'heure. L'aperçu Vercel du 12/11/2026 s'est construit sans erreur avec ces 300 s ; la durée réellement accordée **se constatera en production**, à la première lecture longue. | Première lecture de l'historique (plusieurs clics possibles). |
| 33 | **Tolérance du contrôle quotidien** | Un écart de **un centime par pub et par jour** est toléré entre la somme des pubs et la dépense du compte (arrondis de Meta) ; au-delà, l'écart est affiché. **Décidé par Victor le 22/11/2026.** | Alertes de contrôle. |
| 34 | **Pub commune : répartir aussi les leads ?** | Une pub commune à plusieurs biens se répartit au prorata du prix affiché — sa dépense, **et aussi** ses impressions, clics et leads (étape 3a), pour que le coût par lead d'un bien reste cohérent et que la somme des biens égale le total. Un bien peut donc afficher un nombre de leads non entier. Aucune règle de groupe n'est en vigueur au 23/11/2026. **Décidé par Victor le 23/11/2026 : tout au prorata.** | Leads et coût par lead d'un bien en groupe. |
| 35 | **Définition du CTR** | Tous les clics ÷ impressions, comme le champ `ctr` de Meta — la même définition que le cockpit de l'iMac (relu le 23/11/2026). **Réglé.** | CTR affiché. |
| 36 | **Période par défaut de la page Pilotage** | **Décidé par Victor le 23/11/2026, comme le cockpit de l'iMac** : la page rouvre sur la dernière période proposée choisie (des dates au choix ne se retiennent pas), retenue par le navigateur (cookie de préférence) ; la première fois, sur toute la période. | Ce qu'on voit en ouvrant la page. |
| 37 | **Nombre de pubs gagnantes de la vue générale** | **Décidé par Victor le 23/11/2026 : 3**, comme le cockpit de l'iMac et l'onglet d'un bien. | Vue générale. |
| 38 | **Offre, résultat commercial, réouverture : trois formulaires en panne** | `crm_buyer_record_offer` met la personne à l'étape `offre`, `crm_buyer_record_outcome` à `gagne` ou `perdu`, `crm_buyer_reopen` à `visite` : aucune de ces étapes n'existe plus parmi les neuf du pipeline, et la base refuse (contrainte `buyer_profiles_pipeline_stage_check`, vérifié le 23/11/2026 sur une base locale et, pour l'offre, relevé en production). Cause : la migration `20261012170000` a réécrit leurs corps vers les clés du pipeline à huit colonnes ; le passage aux neuf étapes ne les a pas repris. Les formulaires « Offre », « Résultat commercial » et « Rouvrir » de la fiche acquéreur échouent donc ; aucune offre ni aucun montant ne peut être saisi. La page Pilotage affiche « aucune offre saisie », jamais 0 €. **Décidé par Victor le 23/11/2026 : réparation dans une PR séparée** (PR #85, migration `20261123200000`, installée le 28/11/2026) — offre → « offre en cours » ; perdu → « pas intéressé » ; gagné → étape inchangée, résultat noté ; rouvrir → « à rappeler ». | Offres, montants, coût par offre ; résultats commerciaux. |
| 39 | **Visite « faite »** | Une visite est « faite » quand sa tâche est close ; la sauvegarde d'un traitement (`crm_buyer_enregistrer`) peut clore n'importe quelle tâche, quelle que soit l'activité notée : « faite » veut dire « tâche close », pas « visite constatée ». Par ailleurs, le panneau de traitement (`enregistrerTraitementAction`) n'accepte côté application que sept étapes, sans « R1 planifié » ni « offre en cours », alors que la base les accepte (`crm_etapes_acquereur()`). **Proposition, hors pilotage** : à revoir avec l'équipe. | Visites faites, coût par visite, étapes atteintes. |
| 40 | **Paramètres des pubs des Airelles** | Leurs adresses portent `utm_id` = l'identifiant de la **campagne**, pas celui de la pub comme l'annonce docs/31 ; le `meta_ad_id` des demandes des Airelles porte donc la campagne. La page Pilotage retrouve la pub par `utm_content`, sans rien réécrire. Changer les paramètres des pubs, ou corriger `meta_ad_id` en base (migration à mise à jour bornée, contrôles avant et après) : **décision de Victor** ; Meta reste en lecture seule pour nous. | Rattachement des demandes aux pubs des Airelles. |
| 41 | **Personnes archivées dans le pilotage** | Écartées de tous les chiffres du CRM du pilotage, comme des listes du CRM ; le nombre de demandes écartées est dit à l'écran. **Validé par Victor le 23/11/2026** (« Je t'autorise pour tout », en réponse à la présentation de la PR #84). | Demandes, personnes, coûts. |
| 42 | **`compterDossiers` et la tuile « En cours »** | Ils comptent « à traiter » sur l'ancienne étape `nouveau`, qui n'existe plus : le chiffre dérive. La page Pilotage ne s'en sert pas. **Proposition, hors pilotage** : les aligner sur les neuf étapes. | Tuiles du CRM acquéreurs. |
| 43 | **Coûts du CRM : les mêmes jours que Meta** | Les coûts et l'écart avec Meta ne comptent la dépense et les leads Meta qu'à partir de la **première demande reçue dans le CRM** pour le bien (au total : la première, tous biens), quand la période commence avant ; l'écran donne ce jour. **Validé par Victor le 23/11/2026** (même réponse). | Coûts par demande, qualifié, visite, offre ; leads Meta mis en face. |
| 44 | **Pubs homonymes dans « pub par pub »** | Plusieurs pubs d'un même bien peuvent porter le même nom (deux campagnes aux noms identiques) : le tableau montre alors deux lignes de même libellé. Relevé à la recette du 28/11/2026. **Proposition** : les distinguer (campagne, date de début, lien « Voir la pub »). | Lecture du tableau pub par pub. |
| 45 | **Taux de passage** | Aujourd'hui : atteinte de l'étape d'arrivée ÷ atteinte de l'étape de départ. Deux groupes différents : une personne arrivée en visite sans passer par « dossier envoyé » le fausse, et il peut dépasser 100 %. Relevé à la recette du 28/11/2026. **Proposition** : le calculer sur les personnes passées par les deux étapes (nouvelle migration), ou le renommer. | Taux de passage de l'onglet d'un bien. |

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
