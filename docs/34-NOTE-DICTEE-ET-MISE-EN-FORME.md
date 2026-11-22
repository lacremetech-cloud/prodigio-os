# Dicter une note, et la mettre en forme

« Il raccroche, il fait un audio dans le CRM, l'IA nous met carré en
écriture. »

Deux gestes indépendants, sous la zone de note du panneau de traitement et de
la fiche acquéreur. On peut dicter sans mettre en forme, et mettre en forme un
transcript collé sans avoir dicté un mot.

---

## Ce qui se passe, dans l'ordre

1. **Dicter.** Le bouton « Dicter » ouvre le micro. Le texte reconnu
   **s'ajoute** à ce qui est déjà écrit — il ne l'écrase jamais. On dicte
   souvent en deux fois.
2. **Mettre en forme.** Le bouton envoie la dictée (ou le transcript collé) au
   modèle, qui rend la note au format attendu :

   > Ce que la personne cherche · Points de blocage · Ce qui s'est dit ·
   > Prochaine étape

3. **Relire, corriger, enregistrer.** Le bouton « Enregistrer » est le même
   qu'avant.

**Rien n'est enregistré automatiquement.** L'IA rend un brouillon dans la zone
de texte ; c'est le commercial qui signe. Une note d'appel est relue des
semaines plus tard par quelqu'un qui n'était pas à l'appel et sert à décider
qui rappeler : une phrase inventée par une machine et jamais relue y ferait
plus de dégâts qu'une note absente.

Le bouton « Revenir à ma version » rend la dictée mot pour mot tant que le
panneau reste ouvert.

---

## Les garde-fous

Ils vivent dans `src/modules/buyers/crm/gabarit-note.ts`, et des tests les
verrouillent.

| Règle | Pourquoi |
|---|---|
| N'inventer rien | Un trou assumé se comble au prochain appel ; une invention se propage |
| Écrire « non précisé » | Plutôt que combler un vide par une phrase plausible |
| Garder les mots de la personne | « vue mer » vaut mieux que « bien avec exposition » |
| Une à trois phrases par section | On relit cette note avant de décrocher, pas pour se documenter |

**Aucune note n'est journalisée.** Elle porte le nom, le budget et parfois la
situation familiale d'un acquéreur réel. En cas d'échec, on consigne la cause,
jamais la matière.

---

## Mettre la fonctionnalité en service

Elle est **dormante tant que la clé d'API est absente** : le bouton « Mettre en
forme » ne s'affiche simplement pas, et la saisie libre continue comme avant.
Pas de panne silencieuse, pas d'action proposée qui échouerait.

Pour l'activer : ajouter `ANTHROPIC_API_KEY` dans Vercel
(*Settings → Environment Variables*, portée **Production**), puis redéployer.

Le modèle est `claude-haiku-5-5`, choisi pour le coût : structurer une note
déjà écrite n'est pas une tâche de raisonnement. À quelques dizaines de notes
par mois, la facture se compte en centimes. Un seul endroit à changer pour
monter en gamme — la constante `MODELE` dans `resume-ia.ts`.

---

## La dictée : ce qu'elle sait et ne sait pas faire

Elle s'appuie sur la reconnaissance vocale **du navigateur**. Pas de fichier
audio stocké, pas de transcription facturée, rien à héberger.

| | |
|---|---|
| **Marche sur** | Chrome, Edge, Safari — iPhone compris |
| **Ne marche pas sur** | Firefox : le bouton ne s'y affiche pas du tout |
| **À savoir** | Chrome envoie l'audio à Google pour le reconnaître |

Si cette dernière ligne devient gênante, l'alternative est d'enregistrer
l'audio et de le transcrire par une API choisie — cela demande du stockage, un
coût à la minute, et davantage de travail.

**Enregistrer un appel** et **dicter un résumé après l'appel** sont deux choses
différentes : la première suppose d'informer l'interlocuteur, la seconde non.
C'est la seconde que cette fonctionnalité sert.

---

## Si l'on veut changer le gabarit

Tout tient dans `CONSIGNE_NOTE` et `SECTIONS_NOTE`
(`src/modules/buyers/crm/gabarit-note.ts`). Les tests vérifient que les
sections restent annoncées dans l'ordre et que les interdits subsistent : une
modification qui les casse échoue avant d'arriver en ligne.

Le jour où l'équipe voudra l'ajuster elle-même, il faudra le sortir du code
vers les paramètres. Ce n'est pas fait.
