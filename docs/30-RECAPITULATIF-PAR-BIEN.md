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

## Le câblage, tel qu'il est

Scénario Make **10027310**, trois modules :

1. **HTTP → Make an API Key Auth request** sur `GET /api/recap-leads`.
   La clé vit dans un trousseau Make (`apikeyauth`, « Prodigio OS — jeton du
   récapitulatif »), **plus dans le blueprint**. Le jeton a été renouvelé au
   passage : la valeur qui traînait en clair dans l'en-tête `authorization` est
   morte, et la ligne 11 du registre de rotation est refermée.
2. **Iterator** sur `1. data: recaps` — une sortie par bien.
3. **Gmail** avec `destinataires`, `sujet`, `html`, derrière un filtre
   `envoyer = true`.

Mapper un tableau d'adresses dans le champ *To* n'allait pas de soi : vérifié
d'abord dans un scénario jetable (un envoi vers deux adresses, puis supprimé),
pour ne pas le découvrir à 8 h 30.

Les champs globaux de la réponse (`envoyer`, `sujet`, `html`) ne servent plus à
personne. Ils peuvent être retirés de la route.

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
