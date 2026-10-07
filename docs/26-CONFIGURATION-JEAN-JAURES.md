# 26 — Configuration Jean Jaurès (préparée, **non appliquée**)

> Ce document décrit la configuration à réaliser **après validation et fusion de
> la PR #37**, **depuis l'interface de production**, par les fonctions
> officielles. Rien n'est appliqué à ce stade, et **aucune insertion SQL directe
> n'est autorisée** pour la réaliser.

---

## 1. Valeurs

| Réglage | Valeur |
|---|---|
| Identifiant public (slug) | `villa-jean-jaures` |
| Domaine autorisé | `https://villa-jeanjaures-cassis.vercel.app` |
| Destination de la brochure | `https://villa-jeanjaures-cassis.vercel.app/brochure/` |
| **Collecte** | **inactive** |
| **Vitrine Prodigio** | **non publiée** |

Le bien : `Villa Jean Jaurès`, origine `partenaire_commercialisation`,
organisation porteuse **JCA**, statut `preparation_a_lancer`.

## 2. Comment la réaliser

Cockpit du bien → bloc **« Formulaire acquéreur »**, désormais **le premier
bloc de la page** :

1. l'identifiant public est **déjà pré-rempli** d'après le nom du bien
   (`villa-jean-jaures`) — le vérifier, le corriger si besoin ;
2. déplier **« Réglages facultatifs »** pour la brochure et le domaine autorisé ;
3. **Enregistrer les réglages** — et s'arrêter là ;
4. **ne pas** cliquer sur « Ouvrir la collecte ».

> Le « Slug public » du bloc **Expérience publique** est **le même champ** :
> un seul identifiant par bien, modifiable depuis l'un ou l'autre bloc.

L'action passe par `crm_property_set_buyer_form`, qui ne touche **jamais**
`publication_status` et consigne dans le journal d'audit que la publication n'a
pas bougé.

## 3. Ce que cette configuration produit — et ne produit pas

**Produit** une ligne `property_public_config` en `brouillon`, avec le slug, la
brochure et l'origine autorisée. Un événement d'audit `formulaire_acquereur`.

**Ne produit pas** : aucune publication, aucune collecte ouverte, aucun lead.
Tant que `buyer_form_status` reste `inactif`, `/bien/villa-jean-jaures/interet`
**répond 404** et `submit_buyer_interest` renvoie l'accusé neutre.

## 4. Vérification attendue après configuration

```sql
select slug, buyer_form_status, publication_status,
       buyer_form_brochure_url is not null as brochure_definie,
       buyer_form_allowed_origins
  from public.property_public_config;
-- attendu : villa-jean-jaures | inactif | brouillon | true | {https://villa-jeanjaures-cassis.vercel.app}
```

Et l'en-tête servi sur la route, une fois la collecte ouverte :

```
content-security-policy: frame-ancestors 'self' https://villa-jeanjaures-cassis.vercel.app
```

## 5. Ordre des opérations

1. Validation visuelle du formulaire (captures de la PR #37).
2. Fusion de la PR #37.
3. Configuration ci-dessus, **collecte inactive**.
4. Ouverture de la collecte — **sur votre accord explicite, et pas avant**.
5. Bascule de la landing (branche `claude/formulaire-prodigio-preview` du dépôt
   `villa-jeanajures-cassis`), puis parcours réel de bout en bout.

Les étapes 4 et 5 sont liées : tant que la collecte est fermée, l'iframe de la
landing affichera le repli WhatsApp au lieu du formulaire.
