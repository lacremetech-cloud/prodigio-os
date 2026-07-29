# 02 — Périmètre du MVP

Le MVP couvre **uniquement** une **tranche verticale exploitable** du moteur
Mandats, **jusqu'au résultat du mandat**. Les moteurs Biens & Acquéreurs et le
Portail Propriétaire viendront ensuite (voir [04-ROADMAP.md](04-ROADMAP.md)).

## Tranche verticale visée (complète)

```
Publicité
→ Funnel Mandats
→ Soumission (FunnelSubmission conservée)
→ Contact et opportunité
→ Setting
→ Qualification
→ Rendez-vous
→ Estimation
→ Décision de segment
→ Proposition de mandat
→ Mandat signé, refusé ou perdu
```

> Le MVP **ne s'arrête pas** à la décision de segment : il va **jusqu'au résultat
> du mandat**. L'intégration à une **plateforme de signature électronique** reste
> **hors MVP** ; l'issue du mandat est **saisie manuellement**.

## Parcours complet (bout en bout)

1. Une **publicité** dirige un propriétaire vers une **landing** (avec VSL).
2. Le propriétaire remplit le **quiz** propriétaire (bien, projet de vente).
3. La **soumission** est enregistrée comme **FunnelSubmission** (conservée telle
   quelle, avec UTM, source/campagne/annonce, `fbclid` si dispo, referrer,
   preuves d'information et choix de contact).
4. Le système résout le **contact** (nouveau ou existant, dédoublonnage
   retraçable) et crée/relie une **opportunité** ; l'**attribution** (premier /
   dernier contact) est rattachée à la soumission.
5. Un **nouveau lead** déclenche une **notification**, une **affectation** à un
   setter actif (ou un placement en **file « non affecté »** avec alerte) et une
   **prochaine action**.
6. Un **setter** **rappelle** (setting) ; chaque appel/tentative est une
   **activité** (le nombre de tentatives est **calculé**, ce n'est pas un stade).
7. Le setter **qualifie** le bien et le projet (qualification distincte du stade).
8. Un **rendez-vous** est planifié puis **réalisé** (avec un **résultat de
   rendez-vous**).
9. Une **estimation / étude du dossier** est menée.
10. Une **décision de segment** est prise : **segment recommandé** par les règles,
    **validé** par un humain, avec **raison, auteur et date**.
11. Une **proposition de mandat** est faite (Mandat au statut `proposé`, avec
    **snapshot** des conditions économiques réellement proposées).
12. Le **résultat commercial de l'opportunité** est enregistré manuellement :
    `signé/gagné`, `refusé après proposition` ou `perdu/disqualifié avant
    signature`. Pour un Mandat **signé** : date de signature, organisation
    porteuse, type et exclusivité, document signé rattaché. La **raison** de
    perte/refus est portée par l'**opportunité**. (Une opportunité perdue avant
    proposition n'a **aucun Mandat**.)

## Fonctionnalités incluses

**Acquisition & capture**
- **Landing** Mandats avec emplacement pour la VSL.
- **Quiz** propriétaire structuré.
- **FunnelSubmission** conservée (idempotence, version de formulaire, landing/
  variante, réponses brutes + normalisées, UTM, source/campagne/ad set/annonce,
  identifiants de clic, URL/referrer).
- **Attribution multi-points** (premier / dernier contact au minimum), rattachée
  à la soumission ; historique conservé même si une campagne est renommée.
- **Dédoublonnage** : e-mails/téléphones normalisés, rattachement possible à un
  contact existant, résolution retraçable ; **aucune** soumission supprimée **au
  seul motif d'un doublon** (la soumission reste immuable pendant sa **durée de
  conservation applicable** ; suppression/anonymisation possible selon les règles
  de rétention, une obligation légale ou une demande recevable, et **tracée**).

**CRM Mandats**
- **Contacts** multiples par opportunité via **OpportunityContact** (rôles :
  propriétaire, copropriétaire, conjoint, représentant, intermédiaire,
  décisionnaire ; **un** contact principal ; indivision / personne morale gérées).
- **Opportunité** reliée à ses **organisations participantes**
  (OpportunityOrganization) et **affectations** (OpportunityAssignment).
- **Pipeline** (stades) et **Segment** clairement **séparés**.
- **Activités** métier (appel, tentative, e-mail, SMS/WhatsApp, RDV, commentaire,
  résultat).
- **AuditEvent** distinct des activités (création, changements de stade/segment/
  affectation/permission…), non modifiable par les utilisateurs ordinaires.
- **Notes**, **Tâches** (avec échéance/responsable), **Rendez-vous** (avec
  résultat).
- **Qualification** (champs distincts du pipeline).
- **Décision de segment** tracée (recommandé/validé, raison, auteur, date,
  dérogation manuelle tracée).
- **Résultat commercial de l'opportunité** (`OpportunityOutcome`), **distinct du
  Mandat** : `signé/gagné` / `refusé après proposition` / `perdu ou disqualifié
  avant signature` ; la **raison de perte / disqualification** appartient
  **principalement à l'opportunité**. Une opportunité perdue **avant toute
  proposition** peut n'avoir **aucun Mandat**.
- **Mandat** : entité distincte de l'opportunité et du résultat commercial —
  statut (brouillon / proposé / en attente de signature / signé / refusé /
  expiré ou annulé), organisation porteuse, type et exclusivité. **Document signé
  et date de signature obligatoires uniquement si `signé`** ; **snapshot** des
  règles économiques **obligatoire dès le statut `proposé`** (conditions
  réellement proposées).

**Opérationnel (setting)**
- **Notification** d'un nouveau lead.
- **Affectation** à un setter : soit **automatique** à un **setter actif**, soit
  placement dans une **file « non affecté »** explicite avec **alerte visible**.
  **Aucun lead** ne reste sans affectation ni sans prochaine action de façon
  silencieuse.
- **Création d'une prochaine action** (tâche).
- **Alerte / visibilité** sur les tâches **en retard** et sur la file **« non
  affecté »**.
- **Vue des leads à rappeler**.
- **Tableau de bord opérationnel minimal**.

**Transverse**
- **Permissions** par rôle et organisation (voir [06-ACCESS-MODEL.md](06-ACCESS-MODEL.md)).
- **Journal d'audit** retraçable.
- **PrivacyRecord / ConsentRecord** (finalité, base légale, notice, canaux,
  choix accordé/refusé/retiré, preuve, « ne plus contacter » par canal).
- **Paramètres économiques configurables et versionnés** (seuil, partages, base
  HT/TTC), même avec un seul partenaire ; **pas** de calcul financier automatique.

## Indicateurs minimums du tableau de bord

- nouveaux leads ;
- leads non traités ;
- délai du premier rappel ;
- taux de contact ;
- rendez-vous planifiés et réalisés ;
- mandats proposés ;
- mandats signés ;
- **taux de signature** ;
- **coût par lead** (lorsque la dépense est disponible) ;
- **coût par mandat signé** (lorsque la dépense est disponible).

## Fonctionnalités explicitement exclues du MVP

- ❌ **Signature électronique** du mandat (l'issue est saisie manuellement).
- ❌ **Import des dépenses** publicitaires et **calcul financier automatique** des
  partages (les données d'attribution et les règles versionnées sont toutefois
  capturées dès le départ).
- ❌ Moteur **Biens & Acquéreurs** (fiche bien, landing bien, brochure, campagnes
  acheteurs, setting acheteurs, visites, offres, vente).
- ❌ **Portail Propriétaire**.
- ❌ **Séquences avancées**, **nurturing automatisé**, **analytics complexes**.
- ❌ **Multi-partenaires** en usage réel (architecture prête, un seul partenaire
  exploité).
- ❌ **Internationalisation** active (interface française ; structure préparée).
- ❌ **Export** Google Sheets (export secondaire éventuel, non prioritaire).

## Critères permettant de considérer le MVP exploitable

- Un lead issu d'une publicité va **de bout en bout** : de la landing jusqu'au
  **résultat commercial de l'opportunité** (signé/gagné, refusé après
  proposition, ou perdu/disqualifié avant signature), **sans sortir de la base
  centrale**.
- Le **Mandat** et le **résultat commercial** (`OpportunityOutcome`) sont
  **distincts** : une opportunité perdue avant proposition n'a **aucun Mandat**,
  et le document/date de signature ne sont exigés que pour un Mandat **signé**.
- La **FunnelSubmission** est conservée et distincte du contact et de
  l'opportunité créés ; le **dédoublonnage** est retraçable ; aucune conservation
  **indéfinie** n'est présumée (rétention/effacement possibles et tracés).
- **Soumission**, **activité** et **audit** sont **trois concepts distincts**.
- **Aucun lead** ne reste **silencieusement** sans affectation ni prochaine
  action (affectation automatique **ou** file « non affecté » avec alerte).
- Une opportunité peut réunir **plusieurs contacts** (avec un contact principal)
  et **plusieurs organisations** (opérateur Prodigio + agence porteuse).
- Le **stade** et le **segment** sont **indépendants** ; la **décision de
  segment** est tracée (recommandé/validé, raison, auteur, date).
- L'**attribution** (premier/dernier contact) est enregistrée et consultable.
- Les **PrivacyRecord** sont horodatés, avec base légale et preuve conservées.
- Un **setter** peut réaliser tout son travail quotidien depuis l'outil, avec
  notification, affectation, prochaine action, alerte de retard et vue « à
  rappeler ».
- Les **permissions** par rôle/organisation empêchent les accès non autorisés
  (un partenaire ne voit jamais les dossiers d'un autre).
- Chaque **changement significatif** est **retraçable** via le journal d'audit.
- Le **seuil premium** et les **partages** sont **configurables et versionnés**
  sans toucher au code, et un changement de règle **ne réinterprète pas** les
  anciens dossiers.
