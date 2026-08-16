# Architecture de ccdv-prep

Documentation technique complète : données, chaîne de production, application.
Pour le mode d'emploi du travail à deux, voir `METHODE.md`. Pour l'avancement,
`npm run etat`.

---

## 1. Ce que fait le projet

Préparer la certification **Claude Certified Developer – Foundations (CCDV-F)**,
par deux livrables :

1. **Un corpus de documentation officielle** découpé pour NotebookLM (`docs-corpus/`)
2. **Une application web de révision par QCM** (`src/`, questions dans `questions/`)

L'examen réel : **53 questions, 120 minutes**, pondéré sur 8 domaines et
25 sous-domaines. La banque vise **400 questions**, soit ~7,5 examens blancs
sans répétition.

Aucun serveur, aucun compte, aucune base de données. Les questions sont des
JSON statiques, la progression vit dans le `localStorage` du navigateur.

---

## 2. Arborescence

```
ccdv-prep/
├── blueprint.json              source de vérité : 8 domaines, 25 sous-domaines, poids
├── reservations.json           qui travaille sur quel sous-domaine
│
├── aspirer-docs.js             étage 1 : constitution du corpus
├── lire-page.js                lecture ciblée d'une page du corpus
├── generer-manifeste.js        métadonnées de la banque, pour le démarrage de l'app
├── verifier-questions.js       contrôle qualité de la banque
├── verifier-couverture.js      le corpus couvre-t-il le blueprint ?
├── etat.js                     avancement réel, et écriture d'ETAT.md
│
├── questions/                   banque "doc" — un fichier par sous-domaine
│   ├── _manifeste.json         généré : métadonnées seules
│   ├── _index-concepts.json    généré : un concept par question, pour la dédup
│   ├── _exemples.json          trois questions de référence stylistique
│   └── <domaine>_<sous-domaine>.json
├── questions-prepcourse/       banque "prepcourse" — même format, même manifeste généré,
│   └── ...                     jamais mélangée à questions/ (voir §5.2 bis)
│
├── src/                        l'application React
│   ├── main.jsx                point d'entrée
│   ├── App.jsx                 sélection de banque, onglets, lancement des séries
│   ├── banque.js               chargement des questions, couverture — factory par banque
│   ├── tirage.js               composition d'un examen blanc pondéré
│   ├── stockage.js             progression et répétition espacée — cloisonnées par banque
│   ├── transfert.js            export/import JSON de la progression
│   ├── composants/             12 composants
│   └── styles/                 tokens.css, base.css, app.css
│
├── raw/                        cache de téléchargement — 59 Mo, non versionné
├── docs-corpus/                corpus assemblé — 17 Mo, non versionné
└── dist/                       build — non versionné
```

`raw/` et `docs-corpus/` sont ignorés par git : ce sont de la documentation
tierce, entièrement reproductible par `node aspirer-docs.js`.

---

## 3. Les données

### 3.1 `blueprint.json` — la source de vérité

Lu par `verifier-couverture.js` (pour les mots-clés), par `etat.js` (pour les
poids et les cibles) et par l'application (pour les poids, les noms et les
agrégats). **Une seule copie, donc aucune dérive possible.**

```json
{
  "examen": "Claude Certified Developer — Foundations (CCDV-F)",
  "questions_examen_blanc": 53,
  "duree_minutes": 120,
  "domaines": [
    {
      "domaine": "Agents and Workflows",
      "poids": 14.7,
      "sousDomaines": [
        {
          "nom": "Agent Architecture",
          "poids": 4.5,
          "motsCles": ["agent loop", "orchestrator", "subagent", "harness", "..."]
        }
      ]
    }
  ]
}
```

8 domaines, 25 feuilles — 23 sous-domaines nommés, plus *Claude Code* et
*Eval, Testing and Debugging* qui ne sont pas subdivisés. Les poids totalisent
100,0 %.

Les `motsCles` ne servent **qu'à** `verifier-couverture.js`, pour décider
qu'une page du corpus relève d'un sous-domaine : une page compte si elle
contient au moins **deux** mots-clés distincts du jeu. Le seuil de deux évite
le bruit — `token` seul apparaît dans la moitié du corpus.

### 3.2 Un fichier de questions

Un fichier par sous-domaine, nommé `<domaine-abrégé>_<sous-domaine>.json` :

```json
{
  "subdomain": "Claude Hooks",
  "domain": "Security and Safety",
  "weight": 1,
  "target_questions": 4,
  "sources_read": ["https://code.claude.com/docs/en/hooks"],
  "questions": [ /* ... */ ]
}
```

### 3.3 Une question — les 14 champs

Tous obligatoires ; `verifier-questions.js` refuse un champ manquant.

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | `"CLH-001"` | préfixe de 2 à 3 lettres par sous-domaine, **unique sur toute la banque** |
| `domain` | string | domaine du blueprint |
| `subdomain` | string | sous-domaine du blueprint |
| `weight` | number | poids du sous-domaine, recopié |
| `type` | `single` \| `multi` | une ou plusieurs bonnes réponses |
| `nature` | `judgment` \| `factual_semantic` \| `factual_magnitude` | jugement, rappel sémantique, ordre de grandeur |
| `difficulty` | `facile` \| `moyen` \| `difficile` | |
| `concept` | string (fr) | **ce que la question teste**, formulé de façon unique — sert à la déduplication |
| `question_en` | string (en) | l'énoncé, en anglais, sous forme de scénario |
| `options` | `[{key, text_en}]` | exactement 4, clés `A`,`B`,`C`,`D` dans cet ordre |
| `correct` | `["B"]` ou `["A","C"]` | tableau, même pour une réponse unique |
| `explanation_fr` | string (fr) | pourquoi c'est juste, **avec la citation de la doc** |
| `distractors_fr` | `{"A": "...", ...}` | une explication par option fausse |
| `doc_ref` | URL | la page qui étaye la bonne réponse |

L'énoncé et les options sont **en anglais** — langue de l'examen. Tout le reste
(explications, interface) est en français.

### 3.4 `questions/_manifeste.json` — généré

Métadonnées seules. C'est le seul fichier de questions chargé au démarrage de
l'application : à 406 questions, les énoncés, options et explications pèsent
plusieurs mégaoctets, dont on n'a besoin qu'au lancement d'une série.

```json
{
  "genere": "2026-08-04",
  "nbQuestions": 406,
  "fichiers": [{ "fichier": "...json", "subdomain": "Claude Hooks", "nb": 4 }],
  "questions": [
    { "id": "CLH-001", "domain": "...", "subdomain": "...",
      "difficulty": "facile", "nature": "judgment", "type": "single",
      "fichier": "security-safety_claude-hooks.json" }
  ]
}
```

Régénéré par `generer-manifeste.js`, lancé automatiquement en `predev` et
`prebuild` — donc **jamais périmé par accident**.

### 3.5 `questions/_index-concepts.json` — généré

Un enregistrement par question : `{id, fichier, subdomain, concept, doc_ref}`.
Écrit par `node verifier-questions.js --index`. Sert à repérer les concepts
testés deux fois.

### 3.6 `reservations.json`

Qui s'attribue quel sous-domaine. Fichier minuscule, donc modifiable par deux
personnes le même jour sans conflit git. C'est le point de coordination décrit
dans `METHODE.md`.

### 3.7 `docs-corpus/` et `raw/`

`raw/` est le cache brut des téléchargements (59 Mo, 727 pages) plus trois
journaux : `_inventaire.json` (pages retenues, thème, nombre de mots),
`_ecartees.json` (ce qui a été écarté et pourquoi), `_echecs.json`.

`docs-corpus/` est le corpus assemblé : 9 fichiers `.md` thématiques, 479 pages,
17 Mo. Chaque page y est sérialisée sous la forme :

```markdown
# Titre de la page

**Source :** https://...

texte de la page
```

C'est ce motif que lisent `verifier-couverture.js`, `verifier-questions.js`
(pour valider les `doc_ref`) et `lire-page.js`.

| Fichier | Thème |
| --- | --- |
| `01-api-messages.md` | API Messages, streaming, vision, extended thinking, erreurs, prompt engineering |
| `02-cout-optimisation.md` | prompt caching, Batches, comptage de tokens, tarifs, choix de modèle, évaluations |
| `03a`/`03b-agents-sdk.md` | Agent SDK, boucles d'agent, subagents, hooks, patterns agentiques |
| `04a`/`04b-claude-code.md` | Claude Code, CLAUDE.md, settings.json, skills, commandes, mémoire |
| `05-mcp-outils.md` | MCP, transports, resources, prompts, tools |
| `06-securite.md` | injection de prompt, guardrails, secrets et clés, déploiement sûr |

---

## 4. La chaîne de production

### 4.1 `aspirer-docs.js` — le corpus

Trois étages, tous **reprenables** : relancer le script ne retélécharge rien,
tout ce qui est dans `raw/` est relu depuis le disque.

```
1. TÉLÉCHARGEMENT  ->  raw/
2. INVENTAIRE      ->  raw/_inventaire.json
3. ASSEMBLAGE      ->  docs-corpus/
```

Sources : `platform.claude.com/llms-full.txt` (549 pages),
`docs.claude.com/llms.txt`, `code.claude.com/llms.txt` (174 pages),
`modelcontextprotocol.io/llms-full.txt`. Un parcours page par page du site MCP
(profondeur 3) sert de secours.

Réglages : pause de 300 ms entre deux téléchargements, 3 tentatives par URL,
timeout de 45 s, 400 000 mots maximum par fichier de sortie (NotebookLM plafonne
vers 500 000), 90 000 mots maximum par page — au-delà c'est une référence
auto-générée, pas du contenu lisible.

Le corpus brut fait ~3,6 millions de mots, neuf fois le plafond NotebookLM. Le
script écarte donc la référence d'API auto-générée, les journaux de version et
la gouvernance du projet MCP.

**Toutes les requêtes forcent `family: 4`** : sur cette machine le résolveur DNS
ne renvoie que des AAAA non routables pour de nombreux domaines.

### 4.2 `lire-page.js` — lecture ciblée

```
node lire-page.js liste <motif>              URLs dont l'URL ou le titre correspond
node lire-page.js <motif-url> [début] [long] la prose de la page
node lire-page.js <motif-url> --code         prose + blocs de code
```

Le corpus fait 1,7 million de mots : impossible de tout charger pour écrire une
question. Ce script sort une page à la fois, débarrassée de ses blocs de code —
qui occupent souvent 80 % du volume et se répètent en sept langages.

### 4.3 `generer-manifeste.js`

Balaie `questions/*.json` en excluant les fichiers préfixés d'un souligné, et
écrit `_manifeste.json`. Lancé par `predev` et `prebuild`.

### 4.4 `verifier-questions.js` — le contrôle qualité

```
node verifier-questions.js                  toute la banque
node verifier-questions.js <fichier.json>   un seul fichier
node verifier-questions.js --index          + réécrit _index-concepts.json
```

**Contrôles par question** — chacun produit une anomalie :

- les 14 champs présents, `nature` / `difficulty` / `type` dans les valeurs admises
- exactement 4 options, clés `ABCD` dans cet ordre
- `correct` non vide, cohérent avec `type` (1 pour `single`, ≥ 2 pour `multi`)
- une question `multi` doit annoncer combien de réponses choisir : son
  `question_en` doit contenir `TWO` ou `THREE`
- **écart de longueur maximal de 25 caractères** entre l'option la plus courte
  et la plus longue
- **la bonne réponse ne doit pas être l'option la plus longue** dès que l'écart
  dépasse 12 caractères — sinon elle est repérable à l'œil
- une entrée dans `distractors_fr` pour **chaque** option fausse
- `doc_ref` doit exister dans `docs-corpus/`

**Contrôles par fichier :** identifiant en double, concept en double.

**Contrôles sur la banque entière :**

- identifiants partagés par plusieurs fichiers *(ajouté après une collision
  réelle : `Agentic Customization` et `Agent Construction with Claude`
  abrégeaient tous deux en `AGC`)*
- concepts testés plus d'une fois, tous fichiers confondus
- plafond de **8 questions** portant sur une API beta (`doc_ref` correspondant
  à `api/beta` ou `managed-agents`)
- plafond de **5 % de `factual_magnitude`**, évalué **sur la banque**

> Le plafond de magnitude était initialement évalué par fichier. À 5 % strict,
> il faut au moins 20 questions pour qu'une seule tienne (1/20 = 5,0 %,
> 1/19 = 5,3 %), or 17 des 25 sous-domaines pèsent moins que cela au blueprint :
> la cible était mathématiquement hors d'atteinte, avec un maximum structurel
> à 2,0 %. La contrainte réelle — « pas plus de 5 % de questions de pur chiffre
> à l'examen » — est une propriété globale.

**Répartitions affichées** (rapportées, jamais bloquantes) : nature contre
65 / 30 / 5, difficulté contre 25 / 50 / 25, part de questions à réponses
multiples contre 20 %, et la distribution des bonnes réponses sur A, B, C, D
contre 25 % chacune.

### 4.5 `verifier-couverture.js`

Répond à **« la documentation permet-elle d'écrire ces questions ? »**, et à
rien d'autre. Colonnes : poids, `ECRIT / CIBLE`, nombre de pages sources,
verdict (`OK`, `FAIBLE` sous 3 pages, `TROU` à zéro).

> La colonne affichait autrefois `QUEST`, une cible calculée depuis le poids du
> blueprint, que tout le monde lisait comme un décompte. Elle montrait un
> nombre non nul sur des sous-domaines complètement vides. C'est ce qui a
> conduit deux personnes à croire le projet presque fini et à écrire le même
> sous-domaine en parallèle. **L'avancement se lit avec `node etat.js`.**

### 4.6 `etat.js` — l'avancement

Croise trois sources : `blueprint.json` (les 25 sous-domaines et leurs poids),
`questions/_manifeste.json` (ce qui est réellement écrit) et `reservations.json`
(qui s'est attribué quoi).

Point clé : **l'état `fait` se déduit du manifeste**, pas de ce qui est déclaré.
Personne ne peut afficher « terminé » sur un sous-domaine vide.

`node etat.js --ecrire` produit `ETAT.md`, qui se lit sur GitHub sans cloner.

### 4.7 Les commandes

| Commande | Rôle |
| --- | --- |
| `npm run etat` | où en est le projet |
| `npm run livrer` | manifeste + index des concepts + `ETAT.md`, dans cet ordre |
| `npm run questions` | contrôle qualité de la banque |
| `npm run couverture` | le corpus couvre-t-il le blueprint |
| `npm run corpus` | aspire la documentation |
| `npm run dev` / `build` | développement / production (manifeste régénéré avant) |

---

## 5. L'application

### 5.1 Pile technique

React 19 + Vite 8, **sans backend et sans routeur**. Node 22 épinglé par
`.nvmrc` pour la compilation Cloudflare Pages. Interface sombre, pensée mobile
(`viewport-fit=cover`, métadonnées Apple web app, `theme-color` accordé au fond).
Deux dépendances de production : `react` et `react-dom`.

### 5.2 Le chargement différé — la décision structurante

`src/banque.js` :

```js
const chargeurs = import.meta.glob(['../questions/*.json', '!../questions/_*.json'])
```

Deux contraintes tenues d'un coup :

**Aucune liste de fichiers codée en dur.** Déposer un nouveau fichier de
sous-domaine suffit : il apparaît au prochain build. Le motif négatif écarte les
fichiers de méta dès la compilation.

**`eager: false`.** Chaque entrée est une *fonction* qui importe le fichier à la
demande. Vite en fait autant de chunks séparés. Au démarrage, seul le manifeste
est chargé ; les énoncés n'arrivent qu'au lancement d'une série, et seulement
pour les fichiers concernés, chacun une fois (cache mémoire `cacheFichiers`).

Un examen blanc qui pioche dans dix sous-domaines déclenche **dix** requêtes,
pas cinquante-trois.

### 5.2 bis Deux banques cloisonnées

`doc` (`questions/`) et `prepcourse` (`questions-prepcourse/`) sont deux
banques **indépendantes**, jamais mélangées : manifeste séparé, `import.meta.glob`
séparé, cache de fichiers chargés séparé, et — voir §5.5 — clé `localStorage`
séparée pour la progression et la répétition espacée. La séparation vit dans la
structure des données, pas dans un filtre appliqué après coup sur un tas commun.

`App.jsx` affiche `EcranSelectionBanque` tant qu'aucune banque n'est choisie ;
rien d'autre ne s'affiche avant ce choix. Une fois choisie, tout ce qui suit —
couverture, tirage, stockage — passe par `BANQUES[banque]`. `BadgeSource`
affiche l'origine (`doc` / `Prep Course`) sur chaque question, en entraînement
comme dans la correction d'un examen.

### 5.3 `banque.js`

`creerBanque(manifeste, chargeurs)` est une factory : chaque banque obtient son
propre index par sous-domaine et par id, son propre cache de fichiers chargés.
Le blueprint (`SOUS_DOMAINES`) est partagé — même taxonomie, même examen — seul
le contenu diffère. `BANQUES = { doc, prepcourse }` expose les deux instances ;
des exports plats (`METADONNEES`, `couverture`, etc.), alignés sur `doc` seule,
restent disponibles pour rétrocompatibilité avec les scripts qui font du SSR de
ce module (`verifier-transfert.js`) sans connaître l'existence de deux banques.

| Export (par banque) | Rôle |
| --- | --- |
| `METADONNEES` | les métadonnées de toutes les questions, disponibles immédiatement |
| `SOUS_DOMAINES`, `DOMAINES` | le blueprint aplati, chaque feuille portant son domaine parent — partagé entre banques |
| `NB_QUESTIONS_EXAMEN`, `DUREE_EXAMEN_MIN` | 53 et 120, lus du blueprint |
| `metaDe(sousDomaine)`, `metaParId(id)` | index en mémoire |
| `chargerQuestions(metas)` | charge les fichiers nécessaires **en parallèle**, renvoie les questions complètes dans l'ordre demandé |
| `couverture()` | état de la banque **calculé sur le manifeste seul**, aucun fichier chargé |

`couverture()` renvoie le nombre de questions, le nombre de sous-domaines
couverts sur 25, et surtout **la part du poids de l'examen couverte** — le seul
chiffre qui dise vraiment ce qui manque, puisque les sous-domaines ne pèsent pas
pareil.

Détail défensif : un sous-domaine absent du blueprint reçoit quand même une
entrée dans l'index, plutôt que de disparaître en silence des statistiques.

### 5.4 `tirage.js` — la composition d'un examen blanc

Travaille **sur les métadonnées seules**, ce qui permet de composer un examen
sans avoir chargé une seule question complète.

`repartir()` distribue les 53 questions entre les sous-domaines disponibles,
proportionnellement à leur poids, par la **méthode des plus forts restes** : on
attribue d'abord la partie entière du quota, puis les places restantes aux plus
grandes décimales. Arrondir chaque quota séparément ferait perdre ou gagner deux
ou trois questions.

Deux garde-fous : le quota d'un sous-domaine est plafonné par le nombre de
questions réellement disponibles, et la distribution des restes se fait en
**plusieurs passes** — un sous-domaine peut être saturé avant que tout soit
distribué, et il faut alors reporter sur les autres.

`tirerExamen()` renvoie `{metas, repartition, poidsCouvert, complet}`. Le
drapeau `complet` est faux si la banque n'a pas fourni le compte demandé, ce que
l'écran **signale** au lieu de le masquer.

`melanger()` est un Fisher-Yates sur une copie.

`tirerEntrainement({domaine, sousDomaine, difficulte, limite})` filtre puis
mélange puis coupe — 20 questions par défaut.

### 5.5 `stockage.js` — progression et répétition espacée

**Deux clés `localStorage`, une par banque**, jamais lues ou écrites l'une pour
l'autre : `ccdv-prep:progression:v1` (banque `doc`) et
`ccdv-prep:progression:prepcourse:v1` (banque `prepcourse`). Toutes les
fonctions (`enregistrerReponse`, `enregistrerExamen`, `statistiques`,
`serieProgression`, `remplacer`, `reinitialiser`) prennent `banque` en dernier
paramètre facultatif, `"doc"` par défaut.

La banque `doc` garde **exactement** sa clé d'origine : aucune migration à
faire, aucun risque de collision avec `prepcourse`. Une progression écrite
avant l'existence de plusieurs banques se relit à l'identique. Vérifié via
`verifier-transfert.js` et un scénario manuel rejouant une progression au
format antérieur.

Format versionné : une version inconnue repart d'un état vide plutôt que
d'écraser silencieusement. Toutes les lectures et écritures sont protégées —
en navigation privée stricte ou sur quota plein, la session reste utilisable
en mémoire.

```json
{
  "version": 1,
  "reponses": [{ "id", "juste", "date", "domain", "subdomain", "difficulty" }],
  "fiches":   { "CLH-001": { "palier": 0, "prochaine": 1786464000000, "echecs": 1 } },
  "examens":  [{ "date", "total", "repondu", "juste", "score" }]
}
```

**Le cycle de répétition espacée** — paliers `[2, 7]` jours :

- une question **réussie du premier coup** n'entre jamais dans le cycle
- un **échec** la programme à **J+2** et incrémente son compteur d'échecs
- **réussie en révision**, elle avance d'un palier : J+2 → **J+7**
- **réussie au dernier palier**, elle sort du cycle (`prochaine: null`)
- un **nouvel échec** la ramène à J+2

Les échéances sont calées sur des **jours calendaires locaux** (minuit), pas sur
24 h après la minute exacte de l'échec : une révision « due aujourd'hui » doit
l'être dès le matin.

`statistiques()` ne compte que la **dernière réponse à chaque question** —
réviser trois fois la même ne doit pas peser trois fois. Le score global est
**pondéré par le poids des domaines**, sur les seuls domaines effectivement
travaillés : un domaine à 33 % ne se lit pas comme un domaine à 2,6 %, et la
moyenne brute effacerait exactement cela.

`serieProgression()` découpe l'historique en fenêtres de 10 réponses et renvoie
jusqu'à 20 points de taux de réussite.

### 5.6 Les composants

| Composant | Rôle |
| --- | --- |
| `App.jsx` | choix de banque, trois onglets, un écran de série en surimpression. **Pas de routeur** : une dépendance de moins, et le bouton « retour » du téléphone ne casse pas une série en cours |
| `EcranSelectionBanque` | premier écran, avant tout le reste : doc officielle ou Prep Course. Rien d'autre ne s'affiche tant qu'il n'est pas fait |
| `EcranAccueil` | ce qu'il y a à faire aujourd'hui, et où en est la banque |
| `EcranEntrainement` | choix du périmètre. Les listes ne montrent **que ce qui existe** : proposer un sous-domaine vide donnerait un écran « aucune question » sans dire pourquoi |
| `EcranStats` | score pondéré par domaine, courbe de progression, historique des examens, export/import, remise à zéro — tout scopé à la banque active |
| `IndicateurCouverture` | présent en permanence : questions, sous-domaines sur 25, part du poids couverte, et ce qui manque trié par poids |
| `Serie` | déroule une liste de questions, dans les trois modes |
| `CarteQuestion` | affichage, saisie, correction |
| `BadgeSource` | étiquette « Doc » / « Prep Course » sur une question, en entraînement et dans la correction d'examen |

`App.jsx` maintient un compteur `revision` incrémenté après chaque série : il
force le recalcul des révisions dues et des statistiques, qui vivent dans le
`localStorage` et non dans l'état React.

### 5.7 Les trois modes

| Mode | Chronomètre | Correction |
| --- | --- | --- |
| **Examen blanc** | 120 min | à la fin, comme le jour J |
| **Entraînement** | non | immédiate |
| **Révisions du jour** | non | immédiate |

Un seul composant `Serie` sert les trois : ils ne diffèrent que par ces deux
points.

Le chronomètre fige sa **date de fin** une fois pour toutes (`Date.now() + durée`)
plutôt que de décrémenter un compteur à chaque rendu — sinon il dériverait dès
que l'onglet passe en arrière-plan.

En examen blanc, `masquerCorrection` empêche **aussi la coloration des options** :
masquer l'explication ne servirait à rien si la bonne réponse restait lisible
d'un coup d'œil.

### 5.8 `CarteQuestion` — le détail qui compte

- sur une question `multi`, cliquer bascule ; sur une `single`, cliquer remplace
- le bouton de validation affiche `Valider (2/2 sélectionnées)`
- après validation, **la bonne réponse est signalée même si elle n'a pas été
  choisie** — c'est là que se fait l'apprentissage
- la correction montre l'explication de la bonne réponse **et** la raison pour
  laquelle chaque option cochée à tort était fausse
- sur une question `multi`, un bloc **« ce que vous avez oublié de cocher »** :
  on peut se tromper sans cocher aucune option fausse, il suffit d'en oublier
  une. Sur une `single` ce serait redondant
- un lien vers la page de documentation officielle

Le bilan de fin de série reprend le score, le détail par domaine avec une jauge,
et la liste des questions ratées en accordéon — avec le rappel qu'elles
reviendront dans deux jours.

---

## 6. Les règles de qualité

### 6.1 Le calibrage visé

| | Cible |
| --- | --- |
| Nature | 65 % jugement / 30 % factuel sémantique / 5 % ordres de grandeur |
| Difficulté | 25 % facile / 50 % moyen / 25 % difficile |
| Réponses multiples | ~20 % |
| Bonnes réponses | A, B, C, D à ~25 % chacune |
| Questions sur une API beta | 8 maximum sur toute la banque |

### 6.2 Les deux angles morts du vérificateur

Tous deux rencontrés pour de vrai sur ce projet.

**Reformuler n'est pas couvrir.** La déduplication compare des chaînes de
caractères. Sept questions ont testé le même paragraphe de la documentation sur
les réessais des SDK sous sept libellés différents, et le contrôle est passé au
vert. Une paire résiduelle (`GSD-002` / `TLI-016`) partage le même fait avec
**20 % de recouvrement lexical** — invisible à toute comparaison textuelle.

**Un `doc_ref` présent n'est pas un `doc_ref` qui étaye.** Le script vérifie que
l'URL existe dans le corpus, pas qu'elle soutient la réponse. Deux questions sur
l'idempotence citaient la page des erreurs, où le mot « idempotent » n'apparaît
pas une seule fois.

Le filet manuel, à relancer après toute campagne de rédaction : croiser les mots
significatifs de la bonne réponse avec le texte de la page citée, et vérifier à
la main tout ce qui dépasse ~55 % d'absence. Sur 406 questions, ce filtre a
produit 6 signalements, tous des faux positifs de paraphrase.

---

## 7. La banque aujourd'hui

```
406 questions  —  25 / 25 sous-domaines  —  100,0 % du poids de l'examen

judgment           268   66,0 %      facile      103   25,4 %
factual_semantic   127   31,3 %      moyen       201   49,5 %
factual_magnitude   11    2,7 %      difficile   102   25,1 %

API beta : 6 sur un plafond de 8
```

**406 et non 400** : *Cost and Token Management* a été écrit à 20 questions pour
une cible de 11, afin qu'une question `factual_magnitude` tienne sous l'ancien
plafond par fichier. Ce plafond a changé ; les questions excédentaires sont
conservées comme bonus d'entraînement. L'examen blanc n'en est pas affecté — le
tirage suit les poids du blueprint, pas le stock disponible.

`factual_magnitude` reste sous sa cible de 5 %. C'est le seul écart de la
banque, et il est documenté plutôt que caché.

---

## 8. Contraintes d'environnement

- **Node seul, sans dépendance externe** pour toute la chaîne de production.
  Les seules dépendances npm servent à l'application.
- **`family: 4` forcé** sur toutes les requêtes réseau : le résolveur DNS de la
  machine de développement ne renvoie que des AAAA non routables pour de
  nombreux domaines.
- **Node 22** épinglé par `.nvmrc` pour la compilation Cloudflare Pages.
