# Conversions Meta (API de conversions)

Trois conversions remontent vers Meta, émises **depuis le serveur**, au moment
du fait métier :

| Ce qu'on suit            | Événement Meta         | Déclencheur réel                               |
| ------------------------ | ---------------------- | ---------------------------------------------- |
| Prospect                 | `Lead`                 | une demande est déposée depuis un tunnel       |
| Inscription terminée     | `CompleteRegistration` | le dossier entre à l’étape « En discussion »   |
| Rendez-vous programmé    | `Schedule`             | le dossier entre à l'étape « Visite »          |

## Pourquoi côté serveur

Les bloqueurs, le refus des cookies tiers et iOS font disparaître une part
importante des événements du pixel navigateur. Surtout, nos formulaires vivent
dans une **iframe** : les cookies de la page d'atterrissage nous sont de toute
façon inaccessibles. Ici, une conversion part quand elle a lieu — pas quand un
script a pu s'exécuter.

Les deux dernières conversions n'ont d'ailleurs **aucun équivalent navigateur** :
elles se produisent dans le CRM, des jours après la visite du site.

## Configuration

Deux variables, en production uniquement (Vercel) :

```
META_CAPI_PIXEL_ID=<identifiant du pixel>
META_CAPI_ACCESS_TOKEN=<jeton de l'API de conversions>
```

Le jeton se crée dans le **Gestionnaire d'événements → votre pixel → Paramètres
→ API de conversions → Générer un jeton d'accès**. Il donne le droit d'écrire
dans le pixel : il se traite comme un mot de passe et se révoque depuis le
Business Manager.

Absentes, **aucune conversion n'est émise** et l'application fonctionne à
l'identique. C'est volontaire : une preview ne doit jamais polluer les
statistiques d'un compte publicitaire.

Pour vérifier, le temps d'un test, renseigner `META_CAPI_TEST_EVENT_CODE` avec
le code affiché dans **Événements de test**. ⚠️ Laissé en place, il écarte les
événements des statistiques réelles — à retirer après la vérification.

## Ce qui est envoyé

Jamais une coordonnée en clair. L'e-mail, le téléphone et le nom sont
normalisés puis hachés en SHA-256 (`hash.ts`) ; seules les empreintes partent.
Meta compare ces empreintes aux siennes : c'est ce qui rattache la conversion à
la campagne, sans qu'une adresse lisible circule.

S'y ajoute le `fbclid` relevé sur l'URL d'arrivée, reconstitué au format du
cookie `_fbc`. **C'est le signal d'attribution le plus fort dont nous
disposions** : il relie la conversion à la publicité exacte, des semaines plus
tard, sans dépendre d'aucun cookie. Il est conservé avec la demande, et relu
pour les conversions ultérieures.

L'IP et le user-agent ne partent que pour `Lead` : c'est le seul moment où le
navigateur est celui du prospect. Pour les deux autres, le navigateur présent
est celui du commercial — l'envoyer dégraderait la correspondance au lieu de
l'améliorer.

## Dédoublonnage

Chaque événement porte un `event_id` déterministe :

- `lead-<id de la demande>` — une demande, une conversion ;
- `qualifie-<id du dossier>` — un dossier n'entre en discussion qu'une fois ;
  y revenir plus tard ne recompte pas la conversion ;
- `visite-<id du dossier>-<date>` — un retour en visite des mois plus tard est
  une vraie seconde conversion ; glisser la carte deux fois le même jour n'en
  est pas une.

Si un pixel navigateur est ajouté plus tard sur les pages d'atterrissage, il
devra réutiliser ces mêmes identifiants pour que Meta dédoublonne.

## Une mesure ne casse jamais le métier

Aucun appel n'est bloquant : tout part après la réponse, et les erreurs sont
avalées avec un simple avertissement. Un Meta injoignable ne retarde pas un
dépôt, ne fait pas échouer un changement d’étape, ne bloque pas un déplacement de
carte.

Un événement sans e-mail, téléphone ni `fbclid` n'est **pas** envoyé : il serait
compté sans jamais être rattaché à personne, et fausserait la lecture des
campagnes.

## Ce qui ne part jamais chez Meta : le budget

Les conditions des Outils Meta Business (section 1.h, lues à la source le
28/11/2026) interdisent de transmettre des données qui comprennent des
informations financières **ou qui en sont tirées, directement ou
indirectement** ; les **noms et les critères** des événements, des conversions
personnalisées et des audiences ne doivent ni refléter ces informations, ni
les laisser deviner, ni en dépendre. Depuis le 02/09/2025, Meta restreint
d'office les conversions personnalisées qui suggèrent une situation
financière.

D'où trois règles, pour l'étape 4 et après :

- **Un événement fondé sur la réponse de budget porte un nom qui le dit**
  (« au moins 1 M€ », par exemple), jamais un nom neutre (« LeadPalier1 ») :
  un nom neutre ne ferait que cacher le critère au contrôle de Meta. Victor a
  choisi les paliers le 28/11/2026 et rapporte le même jour un accord **oral**
  de Meta : selon son interlocuteur, le budget d'un projet immobilier n'entre
  pas dans les informations visées. Aucun écrit à ce jour. Les paliers peuvent
  donc être construits **en simulation** — rien ne part, le journal note ce
  qui serait parti. **L'envoi réel attend trois conditions** : l'accord
  **écrit** de Meta entre les mains de Victor (un accord oral ne protège pas
  le compte si le contrôle automatique bloque la conversion ou si un examen
  vient plus tard), la mention du formulaire corrigée et validée par un
  juriste (ci-dessous), puis son feu vert explicite pour le premier envoi
  (docs/05, n° 46). Validé par Victor le 28/11/2026, avec les noms
  `LeadBudgetAuMoins500k`, `LeadBudgetAuMoins1M`, `LeadBudgetAuMoins2M` et
  `LeadBudgetAuMoins3M`.
- **« A un projet » n'est pas un critère neutre** tant qu'il est tiré de la
  question du budget : toutes les réponses « oui » sont des tranches qui
  commencent à 500 000 €. Victor a choisi le 28/11/2026 de ne pas séparer la
  question : « aucun projet = lead mort ». Aucun signal « projet déclaré » à
  part ; avec le formulaire d'aujourd'hui, le palier « au moins 500 000 € »
  vaut toute demande sauf « pas de projet », aux mêmes conditions que les
  autres paliers (docs/05, n° 47).
- **« Qualifié » est une décision de l'équipe** sur l'ensemble du dossier :
  projet réel, sérieux, délai, adéquation au bien. Ce n'est jamais un seuil
  de budget recopié sous un autre nom, et l'événement ne porte ni montant ni
  réponse de budget. Qu'il corresponde souvent aux bons budgets est une
  conséquence observée, pas son critère.

Aujourd'hui, rien de budgétaire ne part : le budget déclaré se lit dans
Prodigio OS, pub par pub (docs/33 § 10).

## Point à trancher — l'information affichée au prospect

Le formulaire annonce aujourd'hui : « Vos coordonnées […] ne sont pas cédées à
des tiers. » Transmettre une empreinte de l'e-mail à Meta pour mesurer les
campagnes est une communication à un tiers, même hachée. La phrase doit être
reprise pour rester exacte. Elle est datée (`UNIVERSAL_CONSENT_NOTICE_VERSION`)
et conservée comme preuve de ce qui a été montré : la modifier suppose de
monter cette version.
