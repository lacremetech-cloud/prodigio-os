# Alerte e-mail « nouveau lead » — état et reprise

**Besoin.** Antoine et JC n'ouvrent ni Slack ni WhatsApp. Les alertes de
nouveau lead n'allaient que dans Slack : elles partaient, personne ne les
lisait. Il leur faut un e-mail à chaque dépôt.

**Décision du 16/10/2026 :** passer par **Make**, qui reçoit déjà chaque dépôt,
plutôt que par un fournisseur d'envoi à contractualiser.

---

## Ce qui est DÉJÀ fait, en code et livré

| Élément | Où | État |
|---|---|---|
| Module d'alerte e-mail interne | `src/modules/buyers/notifications/alerte-email.ts` | Écrit, 16 tests |
| Branchement tunnel landings | `src/modules/buyers/funnel/universal-submit.ts` | Fait |
| Branchement tunnel historique | `src/modules/buyers/funnel/submit.ts` | Fait |
| Variable destinataires | `ALERTES_LEADS_EMAILS` | Déclarée, **non renseignée** |
| Budget en clair dans la charge Make | `accuse-depot.ts` → `budget_libelle` | Livré (`4080d91`) |

Ce code **ne sert pas** au chemin Make. Il attend un transport e-mail
(`LUMAIL_API_KEY` + `LUMAIL_FROM_EMAIL`, absents de la production). Il reste en
place : le jour où l'on veut sortir de Make, trois variables suffisent.

## Ce qui RESTE à faire, dans Make

### Blocage actuel

Le connecteur Make de la session pointe sur un **autre compte** :
zone `eu1.make.com`, organisation unique, scénarios Stripe / Systeme.io /
Calendly, créés par `eliovegancoach@gmail.com` (« VEG IN SHAPE »).

Les webhooks Prodigio sont sur **`hook.eu2.make.com`** — autre zone, donc autre
compte. Vérifié en base :

```sql
select slug, buyer_form_status,
       split_part(replace(buyer_form_webhook_url,'https://',''), '/', 1) as hote
  from public.property_public_config;
-- villa-verdun       | actif | hook.eu2.make.com
-- villa-jean-jaures  | actif | hook.eu2.make.com
```

Tant que le connecteur n'est pas réautorisé sur le compte Prodigio, le scénario
est hors d'atteinte.

### Le scénario à construire, une fois l'accès obtenu

Dans le scénario déclenché par le webhook Prodigio, **après** le module
Webhook, ajouter **Gmail › Send an email** :

- **Connexion** : compte Google `agence@indescale.com`
  (⚠️ étape personnelle — ne peut pas être faite à la place de l'utilisateur)
- **To** : `agence@indescale.com, adelombares@kprojects.fr, casteljc69@gmail.com`
  (⚠️ **jamais** `recette.claude@prodigio.fr` : compte de recette neutralisé)
- **Subject** :
  `Nouveau lead — {{first_name}} {{last_name}} · {{property_name}} · {{budget_libelle}}`
- **Content** : nom, `{{phone}}`, `{{email}}`, `{{budget_libelle}}`,
  `{{property_name}}`, `{{submitted_at}}`

L'objet doit porter à lui seul de quoi décider de rappeler : sur un téléphone,
la notification n'affiche que l'expéditeur et l'objet.

### Champs disponibles dans la charge

`interest_id`, `property_slug`, `property_name`, `brochure_url`, `first_name`,
`last_name`, `phone` (format `+33…`), `email`, `budget_choice` (code technique),
`budget_libelle` (en clair, ex. « Plus d'1 M€ »), `submitted_at` (ISO 8601).

Source : `ChargeAccuse` dans `src/modules/buyers/notifications/accuse-depot.ts`.

## Canal écarté, et pourquoi le garder en tête

Le **SMS est déjà branché en production** (`SMSFACTOR_API_TOKEN` et
`SMSFACTOR_SENDER` présents, transport `smsfactor.ts` écrit). C'est le seul
canal activable sans aucune action de l'utilisateur. Écarté le 16/10 au profit
de l'e-mail, mais c'est le repli immédiat si Make traîne : il ne demande que
les numéros d'Antoine et JC.

## Vérifier que ça marche

Déposer une demande de test sur `go.prodigio.fr/bien/villa-verdun/interet`,
puis **supprimer le contact** (voir le bloc `do $$` atomique de
`docs/28-ROTATION-DES-SECRETS.md` ou le script de suppression par identifiant :
jamais par nom, un `LIKE` emporterait un vrai client).
