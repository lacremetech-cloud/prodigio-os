# 01 — Vision produit

## Problème résolu

La commercialisation de biens immobiliers d'exception repose aujourd'hui
majoritairement sur des méthodes passives (diffusion sur portails, attente
d'acheteurs) et sur des outils dispersés (tableurs, formulaires no-code,
messageries). Il en résulte :

- une **acquisition de mandats** irrégulière et peu mesurable ;
- une **perte d'information** entre les canaux publicitaires, le funnel et le
  suivi commercial ;
- une **absence de source de vérité** unique sur les propriétaires, les biens et
  l'avancement des ventes ;
- une **expérience propriétaire** peu transparente sur la stratégie et les
  résultats.

## Proposition de valeur

Prodigio est un **système technologique et opérationnel** qui industrialise la
**commercialisation active** de biens d'exception :

- il **finance et attribue** les publicités d'acquisition de propriétaires
  vendeurs ;
- il **capte, qualifie et oriente** les leads dans une base centrale unique, en
  **conservant la soumission originale** du funnel ;
- il **pilote la stratégie marketing** de commercialisation pour les biens
  premium ;
- il **finance également** l'acquisition d'acheteurs pour ces biens ;
- il s'appuie sur une **agence partenaire** habilitée pour porter juridiquement
  les mandats et réaliser notamment les visites ;
- il donne au propriétaire une **visibilité transparente** sur la stratégie et
  les résultats.

Prodigio n'est pas, à ce stade, une agence : c'est le **moteur** qui alimente et
pilote la commercialisation, l'agence partenaire apportant le cadre légal.

> **Statut de portage.** **INDESCALE** porte actuellement le **développement et
> l'exploitation du système Prodigio**, dans l'attente de la création de l'entité
> Prodigio. **INDESCALE ne porte pas les mandats immobiliers** : ceux-ci sont
> portés par une **entité immobilière habilitée**, à confirmer contractuellement.
> **Héritage Patrimoine** (dirigé par Cyril Gallon) est le **premier partenaire
> envisagé**, sous réserve de validation de son entité exacte et de ses
> habilitations. Les éléments juridiques ne sont pas tous validés — voir
> [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md).

## Utilisateurs

- **Administrateur Prodigio** — configure le système, les paramètres (seuil,
  partages, règles économiques versionnées), les organisations et les accès.
- **Manager** — pilote l'activité commerciale, supervise les setters et les
  performances.
- **Setter** — rappelle les leads entrants, qualifie le bien et le projet,
  planifie les rendez-vous.
- **Agent immobilier partenaire** — porte le mandat, réalise notamment les
  visites, agit dans le cadre de l'agence partenaire ; ne voit que les dossiers
  partagés avec son organisation.
- **Propriétaire vendeur** — client final ; plus tard, accède au portail
  propriétaire pour suivre la stratégie et les résultats.
- **Accès lecture seule** (éventuel) — consultation sans modification.

Les droits dépendent du **rôle** et de l'**organisation** — voir
[06-ACCESS-MODEL.md](06-ACCESS-MODEL.md).

## Moteurs du produit

1. **Moteur Mandats** — acquérir et qualifier des propriétaires vendeurs :
   landing avec VSL, quiz propriétaire, **conservation de la soumission**,
   attribution publicitaire, collecte des coordonnées et **enregistrements RGPD**,
   CRM de qualification, appels/notes/tâches/rendez-vous, estimation,
   segmentation du bien, et **suivi jusqu'au résultat du mandat** (signé, refusé
   ou perdu).

2. **Moteur Biens & Acquéreurs** — commercialiser le bien et trouver l'acheteur :
   fiche bien, contenus/médias, landing dédiée, brochure confidentielle,
   campagnes publicitaires, acquisition d'acheteurs, qualification du budget et
   du projet, setting, visites, offres, vente.

3. **Portail Propriétaire** — donner de la visibilité au vendeur : présentation
   de la stratégie, statistiques publicitaires, demandes générées, profils
   qualifiés, visites planifiées et réalisées, offres, progression de la
   commercialisation, documents et comptes rendus.

Le MVP se concentre sur une **tranche verticale du moteur Mandats**, **jusqu'au
résultat du mandat** — voir [02-MVP-SCOPE.md](02-MVP-SCOPE.md).

## Principes d'expérience

- **Premium et confidentiel** : chaque bien est mis en scène comme une marque.
- **Éditorial** : narration immobilière soignée plutôt que fiche technique.
- **Immersif** : landings avec galerie, chiffres clés et brochure dédiée.
- **CTA de référence** : « Recevoir la brochure confidentielle ».
- **Palette** : ivoire, noir bois, or vieilli (référence visuelle Chalet Mitja /
  Le Cambre d'Aze — inspiration éditoriale uniquement, pas de reprise technique).
- **Clarté opérationnelle** côté interne : le CRM privilégie la lisibilité et la
  rapidité d'action (setting, qualification, rendez-vous, décision de mandat).
- **Accessibilité** et **français** au lancement, structure prête pour
  l'internationalisation.

## Indicateurs de réussite

> Hypothèses de pilotage à affiner ; les cibles chiffrées ne sont pas fixées ici.
> Le tableau de bord opérationnel minimal du MVP est détaillé dans
> [02-MVP-SCOPE.md](02-MVP-SCOPE.md).

- **Acquisition** : nouveaux leads, leads non traités, coût par lead (si dépense
  disponible), qualité d'attribution des sources.
- **Qualification & setting** : taux de contact, délai du premier rappel, taux de
  qualification aboutie.
- **Conversion mandats** : rendez-vous planifiés et réalisés, mandats proposés,
  mandats signés, **taux de signature**, coût par mandat signé (si dépense
  disponible).
- **Segmentation** : répartition premium / hors cible, fiabilité de la décision
  de segment (recommandé vs validé).
- **Fiabilité du système** : complétude et traçabilité des données, part des
  informations centralisées (vs hors base).
