# ccdv-prep

Préparation à la certification Anthropic **Claude Certified Developer – Foundations** (CCDV-F).

Deux livrables :

1. **Corpus de documentation** découpé pour NotebookLM (`docs-corpus/`)
2. **Application web de révision par QCM** (à venir, étapes 2 à 4)

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
