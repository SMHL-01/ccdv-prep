# ccdv-prep

Préparation à la certification Anthropic **Claude Certified Developer – Foundations** (CCDV-F).

Deux livrables :

1. **Corpus de documentation** découpé pour NotebookLM (`docs-corpus/`)
2. **Application web de révision par QCM** (`src/`, questions dans `questions/`)

## L'application

```
npm install
npm run dev      # développement
npm run build    # production, sortie dans dist/
```

React + Vite, sans backend : les questions sont des JSON statiques et la
progression vit dans le `localStorage` du navigateur.

**Le dossier `questions/` est chargé dynamiquement**, par
`import.meta.glob(['../questions/*.json', '!../questions/_*.json'])`. Il n'y a
aucune liste de fichiers codée en dur : déposer un nouveau fichier de
sous-domaine suffit, il apparaît au prochain `npm run build`. Les fichiers
préfixés d'un souligné sont de la méta et sont exclus dès la compilation.

**Le chargement est différé** (`eager: false`). Au démarrage, seul
`questions/_manifeste.json` est chargé : les métadonnées de chaque question —
identifiant, domaine, sous-domaine, difficulté, nature, fichier. Cela suffit à
calculer la couverture, remplir les filtres et tirer un examen blanc. Les
énoncés, options et explications ne sont récupérés qu'au lancement d'une série,
et seulement pour les fichiers concernés, chacun une fois. Le manifeste est
régénéré automatiquement avant chaque `dev` et chaque `build`
(`node generer-manifeste.js`).

Trois modes : examen blanc (53 questions tirées selon les poids du blueprint,
chronomètre de 120 minutes, correction à la fin comme le jour J), entraînement
filtré par domaine, sous-domaine et difficulté, et révisions du jour issues de
la répétition espacée — une question ratée revient à J+2, puis à J+7 si elle
est réussie.

Tant que la banque est incomplète, le tirage de l'examen blanc **se rééquilibre
sur les sous-domaines disponibles** en conservant leurs poids relatifs, et
l'application affiche en permanence la part du blueprint réellement couverte.

### Scripts de préparation

| Commande | Rôle |
| --- | --- |
| `npm run corpus` | aspire la documentation officielle dans `docs-corpus/` |
| `npm run couverture` | vérifie que chaque sous-domaine du blueprint a des sources |
| `npm run questions` | contrôle la banque : répartitions, doublons, sourçage |
| `node lire-page.js <motif>` | lit une page du corpus sans ses blocs de code |

`blueprint.json` est la source de vérité unique des 25 sous-domaines et de
leurs poids : il est lu à la fois par `verifier-couverture.js` et par
l'application.

## Étape 1 — Corpus de documentation

```
node aspirer-docs.js
```

Le script est **reprenable** : tout ce qui est déjà téléchargé dans `raw/` est
relu depuis le disque. Une relance ne refait aucune requête réseau et ne coûte
que quelques secondes.

### Sources aspirées

| Source | Contenu |
| --- | --- |
| `platform.claude.com/llms-full.txt` | doc plateforme complète, 549 pages |
| `docs.claude.com/llms.txt` | index de la doc plateforme |
| `code.claude.com/llms.txt` | index de la doc Claude Code, 174 pages |
| `modelcontextprotocol.io/llms-full.txt` | spécification et guides MCP |

Un parcours du site MCP page par page (profondeur 3) sert de secours si aucun
`llms.txt` n'est disponible.

### Ce que produit le script

`docs-corpus/`, un fichier `.md` par thème, chacun sous les 400 000 mots
qu'accepte une source NotebookLM, précédé d'un sommaire donnant l'URL d'origine
de chaque page :

| Fichier | Thème |
| --- | --- |
| `01-api-messages.md` | API Messages, streaming, vision, extended thinking, erreurs, prompt engineering |
| `02-cout-optimisation.md` | prompt caching, Batches API, comptage de tokens, tarifs, choix de modèle, évaluations |
| `03-agents-sdk.md` | Agent SDK, boucles d'agent, subagents, hooks, patterns agentiques |
| `04a-claude-code.md`, `04b-claude-code.md` | Claude Code, CLAUDE.md, settings.json, skills, commandes, mémoire |
| `05-mcp-outils.md` | MCP, transports, resources, prompts, tools, outils custom |
| `06-securite.md` | injection de prompt, guardrails, secrets et clés, déploiement sûr |

### Filtrage

Le corpus brut fait ~3,6 millions de mots, soit neuf fois le plafond
NotebookLM. Le script écarte donc explicitement la référence d'API
auto-générée (endpoints beta, API Compliance, Admin API), les journaux de
version et la gouvernance du projet MCP — aucun de ces contenus n'est au
programme de l'examen.

Le détail de ce qui a été écarté, et pourquoi, est écrit dans
`raw/_ecartees.json`. L'inventaire complet des pages retenues, avec leur thème
et leur nombre de mots, est dans `raw/_inventaire.json`.

## Contraintes techniques

- Node seul, sans dépendance externe.
- Toutes les requêtes forcent `family: 4` : sur cette machine le résolveur DNS
  ne renvoie que des AAAA non routables pour de nombreux domaines.
- Pause de 300 ms entre deux téléchargements, 3 réessais par URL.
