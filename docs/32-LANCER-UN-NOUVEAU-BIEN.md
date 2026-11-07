# Lancer un nouveau bien — la check-list

Cette liste n'est pas théorique. Chaque ligne correspond à quelque chose qui a
été **réellement oublié au lancement des Airelles** (6–7 novembre 2026), et
qu'on a découvert après coup, une fois la campagne partie.

Aucun de ces oublis n'a produit d'erreur. Rien n'a jamais planté. C'est tout le
problème : un bien mal branché se comporte exactement comme un bien bien
branché, il rapporte simplement moins, et personne ne le sait.

À faire **avant la première publicité**, pas après.

---

## 1. Dans Prodigio OS

| | Quoi | Pourquoi |
|---|---|---|
| ☐ | Créer le bien et son formulaire acquéreur | Sans slug actif, aucune demande ne peut être enregistrée |
| ☐ | Renseigner `allowed_origins` avec **le domaine final de la landing** | La balise de mesure et le formulaire sont refusés en silence depuis toute autre origine |
| ☐ | Affecter le commercial responsable (`property_assignments`) | Sinon il ne voit pas les leads, et le récap du soir ne sait pas à qui écrire |

Vérification :

```sql
select public.buyer_form_context('<slug>');
```

Doit renvoyer le slug, `brochure_available: true`, et la landing dans
`allowed_origins`.

---

## 2. Le domaine de la landing

☐ **Créer le sous-domaine `<bien>.prodigio.fr` AVANT le lancement.**

C'est le point qui a motivé cette page. Villa Verdun et Jean-Jaurès tournent
encore sur `*.vercel.app` parce que le domaine n'a pas été posé au départ.

Une fois la campagne lancée, c'est trop tard : changer le domaine invalide les
`allowed_origins`, casse le referrer de toutes les statistiques existantes et
perturbe l'attribution en cours. Pour un gain purement cosmétique. **Ça se
décide avant, ou ça attend la campagne suivante.**

---

## 3. Sur la landing

| | Quoi | Ce qui arrive si on oublie |
|---|---|---|
| ☐ | **Transmettre les paramètres publicitaires à l'iframe** | Les `utm_*` et le `fbclid` restent sur la landing. Meta ne sait plus quelle publicité a produit le lead, et le CAPI part sans signal d'attribution |
| ☐ | **Poser la balise `/api/mesure/visite`** | Meta compte les demandes sans jamais connaître le nombre de visites. Sur Les Airelles : 9 % des visites comptées au lieu de 85 %, et un taux de conversion affiché à 114 % |

Les deux se copient depuis `Villa-Verdun-Cassis/index.html`. Attention : la
transmission des paramètres **ajoute** à l'adresse de l'iframe (`&`) au lieu de
la réécrire, sinon un `?lang=en` est perdu.

À poser sur **toutes les versions linguistiques**, pas seulement la française.

---

## 4. Sur prodigio.fr

Dans `src/data/site.js` :

| | Quoi | Ce qui arrive si on oublie |
|---|---|---|
| ☐ | `site: 'https://<bien>.prodigio.fr'` sur la fiche | Pas de bouton « visiter le site du bien » sur la carte |
| ☐ | Ajouter le bien aux options du questionnaire, avec **son slug réel et sa landing** | Un slug vide fait abandonner la demande en silence : `if (!slug) return { ok: true, routed: false }`. Le visiteur croit avoir demandé la brochure, aucune fiche n'existe |

---

## 5. Les brochures

| | Quoi |
|---|---|
| ☐ | Numéro WhatsApp du **commercial du bien**, pas celui d'un autre |
| ☐ | Le même numéro dans `_tools/gen_brochure.py`, pas seulement dans les fichiers produits |

Corriger la sortie sans corriger le générateur ne tient que jusqu'à la
prochaine régénération. C'est arrivé : les 48 brochures des Airelles ont porté
le bon numéro pendant deux jours pendant que le générateur gardait l'ancien.

Le numéro des **mentions légales** est celui de la société éditrice, pas celui
du commercial. On n'y touche pas.

---

## 6. Les notifications

| | Quoi |
|---|---|
| ☐ | Scénario Make des e-mails de premier contact, signés par le commercial du bien |
| ☐ | Le bien apparaît dans `crm_recap_recipients()` (découle de l'affectation, étape 1) |
| ☐ | Alerte Slack : rien à faire, elle suit le bien automatiquement |

---

## 7. Les vérifications, une fois la première publicité lancée

À faire le lendemain, pas la semaine suivante.

**Les leads arrivent-ils avec leur publicité ?**

```sql
select utm_campaign, utm_content, count(*)
from public.buyer_interests bi
join public.properties p on p.id = bi.property_id
where p.project_name = '<bien>'
group by 1, 2;
```

Des colonnes vides alors que la campagne tourne = la transmission des
paramètres ne fonctionne pas.

**Les visites sont-elles comptées ?**

Comparer `inline_link_clicks` et `landing_page_view` dans Meta, au niveau de la
publicité. Le ratio normal est d'environ **85 %**. En dessous de 40 %, la
balise ne passe pas. Un taux de conversion supérieur à 100 % est le signe le
plus visible, et il est impossible : c'est le dénominateur qui manque.

**Les conversions partent-elles ?**

```sql
select event_name, resultat, count(*)
from public.meta_conversion_log l
join public.buyer_interests bi on bi.id = l.interest_id
join public.properties p on p.id = bi.property_id
where p.project_name = '<bien>'
group by 1, 2;
```

**Et surtout : quelqu'un rappelle-t-il ?**

```sql
select count(*) filter (where a.call_attempts > 0) as appeles,
       count(*) as recus
from public.buyer_interests bi
join public.properties p on p.id = bi.property_id
left join public.crm_buyer_interest_activity a on a.interest_id = bi.id
where p.project_name = '<bien>';
```

Au 7 novembre 2026, tous biens confondus : **279 leads reçus, 7 appelés**,
dernière activité CRM le 19 octobre. Le meilleur tracking du monde ne sert à
rien derrière ce chiffre-là. C'est la seule ligne de cette page qui ne se règle
pas en écrivant du code.
