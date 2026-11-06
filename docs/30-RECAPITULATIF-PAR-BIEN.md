# Le récapitulatif, un par bien

## Ce qui a changé

Le récapitulatif de 8 h 30, 13 h et 17 h 30 était **un seul e-mail**, tous
biens confondus, vers une liste écrite en dur dans le scénario Make 10027310.
Deux défauts jumeaux, sortis le 6 novembre en préparant l'arrivée d'Édouard
ROWLANDSON (Cimalpes) :

- il n'y était pas, donc il ne voyait **aucun** des leads des 2 Alpes qu'il
  est chargé de traiter ;
- Nicolas, qui ne suit que Cassis, y lisait **ceux des 2 Alpes**.

L'isolation tenait dans le CRM et pas dans cet e-mail.

`GET /api/recap-leads` rend désormais, **en plus** des champs d'origine, un
tableau `recaps` : une entrée par bien ayant reçu des leads sur le créneau.

```json
{
  "envoyer": true, "sujet": "…", "html": "…", "nombre": 3,
  "recaps": [
    {
      "property_id": "8aedb3d5-…",
      "bien": "Les Airelles aux 2 Alpes",
      "destinataires": ["agence@…", "…"],
      "envoyer": true,
      "sujet": "Les Airelles aux 2 Alpes · 1 nouveau lead",
      "html": "…",
      "nombre": 1
    }
  ]
}
```

**Les destinataires ne vivent plus dans Make.** `crm_recap_recipients()` les
déduit de qui suit le bien — `property_assignments`, la même source que
`crm_property_access` — plus les administrateurs et managers. Confier un bien
à quelqu'un suffit donc pour qu'il reçoive le récapitulatif : c'est exactement
le geste que personne n'avait fait pour Édouard.

Les compteurs « en retard » et « sans action » sont calculés **par bien**, et
leurs liens portent `projets=<id>`. Sans ça, Édouard cliquait sur « 4 en
retard » et ouvrait une liste de dossiers de Cassis qu'il n'a pas le droit de
voir : un chiffre qui n'ouvre pas ce qu'il annonce est pire qu'un chiffre
absent.

---

## L'étape qui reste — scénario Make 10027310

Le scénario lit encore les champs **globaux**. Ils sont conservés à
l'identique exprès : entre le déploiement et cette bascule, rien ne s'arrête,
le récapitulatif part comme avant. Mais le trou n'est pas refermé tant que la
bascule n'est pas faite.

**Pourquoi je ne l'ai pas faite moi-même :** le jeton d'accès à la route
(`RECAP_LEADS_TOKEN`) est écrit en clair dans l'en-tête `authorization` du
module HTTP de ce scénario. Réécrire le blueprint par l'API obligerait à
recopier ce jeton dans une commande et dans un journal de session. C'est
précisément ce qu'on ne fait plus.

### Option A — trois réglages dans l'interface (2 minutes)

Le module HTTP n'est pas touché, donc le jeton ne bouge pas.

1. Entre le module **HTTP** et le module **Gmail**, ajouter un **Iterator**
   sur `1. data: recaps`.
2. Sur le module **Gmail**, remplacer :
   - *To* → `destinataires` (la collection de l'Iterator, telle quelle)
   - *Subject* → `sujet`
   - *Content / HTML* → `html`
3. Sur le filtre devant Gmail, remplacer la condition par
   `envoyer` **=** `true` (celui de l'Iterator, plus celui du module HTTP).

### Option B — sortir le jeton du blueprint (recommandé)

Remplacer le module HTTP par **HTTP → Make an API Key Auth request**, dont la
clé vit dans une **connexion** Make et non dans le blueprint. Le jeton
disparaît alors du scénario, ce qui referme aussi la ligne 11 du registre de
rotation. La connexion se crée en remplissant un formulaire Make — personne
n'a besoin de faire circuler la valeur.

Une fois l'une ou l'autre faite, les champs globaux peuvent être retirés de la
réponse.

---

## Vérifier

Après la bascule, un déclenchement manuel doit produire **un e-mail par bien
ayant eu des leads**, chacun avec le nom du bien en tête d'objet. Et la liste
calculée se contrôle en base :

```sql
select project_name, string_agg(email, ', ' order by email)
from crm_recap_recipients()
group by project_name order by project_name;
```

Au 6 novembre : Cassis → agence, Antoine, JC, Nicolas. Les Airelles → agence,
Antoine, JC, Édouard. Le compte de recette, suspendu, est écarté par
`status = 'actif'` bien qu'il soit encore affecté aux deux villas.
