# 05 — Questions ouvertes

Décisions **non validées** à ce jour. Elles ne doivent **pas bloquer** le
démarrage : les éléments concernés sont traités comme des **hypothèses** et/ou
des **paramètres configurables**, jamais comme des constantes codées en dur.

> Convention : tant qu'une question n'est pas tranchée, l'implémentation doit
> rester **paramétrable** et ne pas présumer d'une obligation juridique.

| # | Question ouverte | Statut / hypothèse de travail | Impact si changée |
|---|---|---|---|
| 1 | **Entité portant les mandats** | Portage actuel par **INDESCALE** ; entité **Prodigio** à créer ; mandats portés par une **agence partenaire** (Héritage Patrimoine envisagé, Cyril Gallon). | Mentions légales, contrats, attribution des responsabilités. |
| 2 | **Carte professionnelle et habilitations** | L'agence partenaire dispose des autorisations nécessaires (à confirmer précisément). | Validité juridique des mandats et des actes. |
| 3 | **Base de rémunération : honoraires HT ou TTC** | **Non tranché.** Traité comme paramètre. | Calcul des partages économiques. |
| 4 | **Base du seuil premium** | **Non tranché** : estimation, prix de mandat, ou prix de vente ? Hypothèse de valeur : 800 000 €, **configurable**. | Segmentation des biens (premium vs. hors cible). |
| 5 | **Financement des shootings** | À définir (qui finance les prises de vue). | Coûts et responsabilités de production. |
| 6 | **Budgets publicitaires** | À définir (montants, répartition acquisition propriétaires vs. acheteurs). | Modèle économique, pilotage marketing. |
| 7 | **Propriété et attribution des leads** | À définir (à qui appartient le lead ; règles d'attribution). | Droits sur les données, répartition commerciale. |
| 8 | **Exclusivité** | À définir (mandats exclusifs ou non ; exclusivité territoriale/partenaire). | Stratégie commerciale, contrats. |
| 9 | **Règles de rappel et de qualification** | À définir (délais de premier rappel, cadence, critères de qualification). | Process setter, SLA, mesure de performance. |
| 10 | **Conservation des données** | À définir selon principes RGPD (durées de rétention par type de donnée). | Conformité RGPD, purge/archivage. |
| 11 | **Périmètre géographique initial** | À définir (zone(s) de lancement). | Ciblage publicitaire, périmètre partenaire. |
| 12 | **Partages économiques** | Hypothèses : **70/30** (premium) et **40/60** (hors cible), **configurables**. Base HT/TTC liée au #3. | Répartition des revenus. |

## Principes en attendant les décisions

- Le **seuil premium**, les **partages** et la **base HT/TTC** restent des
  **paramètres de configuration**.
- Aucune **obligation juridique** n'est inventée ni codée : le système reste
  neutre juridiquement tant que les points ci-dessus ne sont pas validés.
- Les **hypothèses** sont clairement identifiées comme telles dans la
  documentation et le code (commentaires/paramètres), pour être révisées sans
  refonte.
- La **conservation des données** suit par défaut le principe de **minimisation**
  RGPD jusqu'à définition de durées précises.
