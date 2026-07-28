# 02 — Périmètre du MVP

Le MVP couvre **uniquement** une **tranche verticale exploitable** du moteur
Mandats. Les moteurs Biens & Acquéreurs et le Portail Propriétaire viendront
ensuite (voir [04-ROADMAP.md](04-ROADMAP.md)).

## Tranche verticale visée

```
Publicité → Funnel Mandats → Quiz → Enregistrement du lead → CRM Mandats
         → Setting → Qualification → Rendez-vous → Décision sur le segment
```

## Parcours complet (bout en bout)

1. Une **publicité** dirige un propriétaire vers une **landing** (avec VSL).
2. Le propriétaire remplit le **quiz** propriétaire (bien, projet de vente).
3. Ses **coordonnées et consentements** sont collectés.
4. Le lead est **enregistré directement dans Prodigio OS** (base centrale), avec
   son **attribution publicitaire** (source/campagne).
5. Le lead apparaît dans le **CRM Mandats** au stade initial du pipeline.
6. Un **setter** le **rappelle** (setting) et enregistre l'**activité**.
7. Le setter **qualifie** le bien et le projet (informations de qualification,
   distinctes du stade).
8. Un **rendez-vous** est planifié avec le propriétaire.
9. Une **décision de segment** est prise (cible Prodigio premium / hors cible /
   à réévaluer…), séparément du stade commercial.

## Fonctionnalités incluses

- **Landing** Mandats avec emplacement pour la VSL.
- **Quiz** propriétaire (formulaire structuré : bien, projet, estimation
  indicative).
- **Collecte des coordonnées et consentements** conformes RGPD (consentement
  horodaté).
- **Attribution publicitaire** : capture et stockage de la source / campagne du
  lead.
- **Enregistrement du lead** en base centrale (source de vérité) :
  création/rattachement d'une **personne** et d'une **opportunité de mandat**
  distinctes.
- **CRM Mandats** : liste et fiche des opportunités, avec **pipeline** (stades)
  et **segment** clairement **séparés**.
- **Activités** : journalisation des appels, changements de stade, etc.
- **Notes** libres sur la personne / l'opportunité.
- **Tâches** avec échéance et responsable.
- **Rendez-vous** : planification et suivi.
- **Qualification** : champs distincts du pipeline.
- **Segmentation** : affectation d'un segment à l'opportunité/au bien.
- **Permissions** par rôle et organisation (admin, manager, setter, agent
  partenaire).
- **Journal d'activité** retraçant les changements significatifs.
- **Paramètres configurables** : seuil premium et partages économiques stockés en
  configuration (non codés en dur), même si un seul partenaire est utilisé.

## Fonctionnalités explicitement exclues du MVP

- ❌ Moteur **Biens & Acquéreurs** (fiche bien commercialisable, landing bien,
  brochure confidentielle, campagnes acheteurs, setting acheteurs, visites,
  offres, vente).
- ❌ **Portail Propriétaire** (statistiques, comptes rendus, progression).
- ❌ **Automatisations** avancées et **analytics** poussés.
- ❌ **Multi-partenaires** en usage réel (l'architecture est prête, mais un seul
  partenaire est exploité).
- ❌ **Internationalisation** active (interface française ; structure préparée
  seulement).
- ❌ **Export** Google Sheets (pourra venir comme export secondaire, non
  prioritaire).
- ❌ Intégrations de **facturation / paiement** et calculs financiers réels des
  partages (les paramètres existent, mais la répartition opérationnelle n'est pas
  automatisée).
- ❌ Signature électronique du mandat (le pipeline va jusqu'à la décision de
  segment et le suivi ; le flux de signature complet est hors MVP).

## Critères permettant de considérer le MVP exploitable

- Un lead issu d'une publicité peut aller **de bout en bout** : de la landing
  jusqu'à un rendez-vous planifié et une décision de segment, **sans sortir de la
  base centrale**.
- La **personne** et l'**opportunité** sont des objets distincts et correctement
  reliés.
- Le **stade** et le **segment** sont **indépendants** : on peut modifier l'un
  sans l'autre.
- L'**attribution publicitaire** du lead est enregistrée et consultable.
- Les **consentements** sont horodatés et conservés.
- Un **setter** peut réaliser tout son travail quotidien (rappel, note, tâche,
  qualification, rendez-vous) depuis l'outil.
- Les **permissions** par rôle/organisation empêchent les accès non autorisés.
- Chaque **changement significatif** est **retraçable** via le journal
  d'activité.
- Le **seuil premium** et les **partages** sont modifiables en configuration sans
  toucher au code.
