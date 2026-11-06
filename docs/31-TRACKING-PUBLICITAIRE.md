# Le tracking publicitaire — qui fait quoi

## Ce qui est déjà en place, côté Prodigio

Rien à installer. Vérifié le 6 novembre.

| Brique | État |
|---|---|
| CAPI Meta (serveur) | `META_CAPI_PIXEL_ID` et `META_CAPI_ACCESS_TOKEN` renseignés en production |
| Alerte Slack `#alertes-acquereurs` | `SLACK_BUYER_LEADS_WEBHOOK_URL` renseigné, alertes Cassis reçues chaque jour |
| SMS d'accusé | `SMSFACTOR_API_TOKEN` et `SMSFACTOR_SENDER` renseignés |
| Transmission des paramètres publicitaires | corrigée le 6 novembre sur Les Airelles |

**Aucun pixel navigateur** sur aucune landing : le suivi est volontairement
côté serveur. Pas de bandeau cookies à gérer, et la conversion porte le nom du
bien, donc elle se ventile par bien dans le Gestionnaire.

### Le défaut corrigé, pour mémoire

Le formulaire vit dans une iframe servie par `go.prodigio.fr`. Son adresse
était écrite en dur : les `utm_*` et le `fbclid` restaient sur la landing et
n'atteignaient jamais le formulaire. Cassis transmettait ces paramètres depuis
le début, Les Airelles non — invisible tant qu'aucune campagne n'y tournait.

L'alerte Slack l'aurait d'ailleurs dit elle-même : sans campagne mais avec un
`fbclid`, elle affiche « Publicité Meta · campagne non transmise ».

---

## Ce qu'on demande au media buyer

### 1. Les paramètres d'URL, au niveau de la PUBLICITÉ

Dans Meta, bloc *Suivi* → *Paramètres d'URL* de chaque publicité :

```
utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&utm_id={{ad.id}}
```

**`{{ad.name}}`, pas `{{ad.id}}`.** Les campagnes Cassis envoient aujourd'hui
des identifiants numériques (`utm_content=120252600381260565`) : illisibles
dans une alerte. Avec le nom, l'alerte Slack annonce « Vidéo - Terrasse - v3 ».

À poser sur **toutes** les publicités, Cassis comprise.

### 2. Des noms de publicités qui veulent dire quelque chose

C'est une discipline, pas un réglage, et c'est ce qui décide de la valeur de
tout le reste. « Copie de Ad set 3 - copie » n'apprend rien. Une convention
`Format - Accroche - version` suffit.

### 3. Le MÊME dataset que la CAPI

**Le piège classique.** Si les publicités optimisent sur un dataset et que le
serveur envoie ses conversions dans un autre, Meta n'apprend rien et le coût
par prospect ne descend jamais — sans qu'aucune erreur n'apparaisse nulle part.

L'identifiant à utiliser est celui de `META_CAPI_PIXEL_ID`, lisible dans Vercel
(projet `prodigio-os` → variables d'environnement). À comparer avec le dataset
attaché aux campagnes.

### 4. Vérifier le domaine dans le Business Manager

`les-airelles.prodigio.fr` doit être vérifié (*Paramètres de l'entreprise* →
*Sécurité de la marque* → *Domaines*). Sans ça, les restrictions d'iOS
dégradent l'attribution.

### 5. Objectif et événement

Campagne **Prospects**, optimisée sur l'événement envoyé par le serveur à
chaque dépôt de formulaire. Pas sur les clics : un clic ne dit rien, et la
CAPI remonte déjà la vraie conversion.

---

## Ce qu'on vérifie une fois les premiers leads arrivés

1. **Gestionnaire d'événements** → l'événement arrive-t-il, et avec quelle
   qualité de correspondance ?
2. **L'alerte Slack** porte-t-elle le nom de la publicité ? Si elle dit
   « campagne non transmise », les paramètres d'URL manquent.
3. **La fiche du lead dans le CRM** porte la même provenance.

Les trois doivent concorder. Si l'un diverge, c'est là qu'est le défaut.
