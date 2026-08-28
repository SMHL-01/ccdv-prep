# Divergences corpus Prep Course / documentation officielle

> Ecrit le 2026-08-28 a la demande de Said : « ne les tranchez pas seuls
> et n'alignez rien pour l'instant. Ecrivez-les dans un fichier dedie
> avec, pour chacune, ce que dit le corpus, ce que dit la doc, et la
> reference exacte. »
>
> **Aucune de ces quatre divergences n'est arbitree. Aucune question de
> la banque ne repose sur le point litigieux.** Contrainte en vigueur
> jusqu'a arbitrage : ne pas creer de nouvelle question appuyee sur ces
> quatre points.
>
> Rappel de la regle qui rend ce fichier necessaire : le CONTENU vient
> de `prepcourse-corpus/`, mais le `doc_ref` doit REELLEMENT etayer la
> bonne reponse dans `docs-corpus/`. Un fait affirme par le Prep Course
> et introuvable dans la documentation ne peut pas servir de bonne
> reponse.

---

## 1. Scopes de configuration MCP : quatre (corpus) contre trois (doc)

**Gravite : haute.** C'est une question de denombrement, donc
directement transformable en QCM faux.

**Ce que dit le corpus**
`prepcourse-corpus/m3-3.4-rag.md:24`, section « Configuration scope: who
loads the server », enumere QUATRE scopes de meme rang : Local, User,
Project, Enterprise. Ligne 34 :

> **Enterprise scope** deploys through a centrally managed configuration
> controlled by an administrator.

Et le tableau ligne 65 traite « Enterprise » comme une valeur de la
colonne scope, au meme titre que les trois autres.

**Ce que dit la doc**
`docs-corpus/05-mcp-outils.md:1384`, page
`https://code.claude.com/docs/en/mcp`, section « MCP installation
scopes » :

> MCP servers can be configured at three scopes. [...] Administrators
> can also deploy servers at the enterprise level via managed
> configuration.

Le « enterprise level » existe donc, mais la doc le pose comme un
mecanisme de deploiement administrateur A COTE des scopes, pas comme un
quatrieme scope. Confirme deux fois ailleurs :
`docs-corpus/05-mcp-outils.md:1468` (« The three scopes match duplicates
by name ») et `:2438` (« writes the server to one of three scopes,
stored across two files »).

**Nature du desaccord**
Le corpus promeut un mecanisme de deploiement au rang de scope
d'installation. Ce n'est pas une erreur de fond — la fonction existe —
mais tout QCM du type « combien de scopes » ou « lequel n'est pas un
scope » aurait deux corriges opposes selon la source.

**Consequence appliquee**
Aucune question ne compte les scopes MCP ni ne presente Enterprise comme
un scope. Les questions MCP existantes portent sur le comportement
(quel fichier, quelle precedence, quel scope pour quel besoin), ce qui
est identique dans les deux sources.

---

## 2. Multiplicateur x15 des sous-agents : chiffre absent de la documentation

**Gravite : haute.** C'est exactement le cas que Said signale : « un
chiffre absent de la doc ne doit pas servir de reponse correcte a une
question d'examen blanc. »

**Ce que dit le corpus**
`prepcourse-corpus/m4-4.5-cost-caching.md:102` :

> An orchestrator-worker multiplies token consumption by the number of
> subagents, roughly a 15x token multiplier in Anthropic's reported
> case. That multiplier applies to both input and output tokens, since
> each subagent receives its own context and generates its own output.

Repete `:110` : « Parallel subagents multiply token cost, roughly by 15x
in the reported case, before improving any answer. »

**Ce que dit la doc**
Rien. Le chiffre 15 n'apparait dans aucune des 479 pages de
`docs-corpus/`, sous aucune forme (`15x`, `15 x`, `15-fold`). La
documentation affirme le principe qualitatif — un pattern
orchestrateur-travailleurs consomme plus de tokens, chaque sous-agent
ayant son propre contexte — mais ne chiffre pas le facteur.

**Nature du desaccord**
Ce n'est pas une contradiction, c'est un chiffre non sourcable. Il vient
vraisemblablement d'un billet d'ingenierie Anthropic hors du perimetre
`docs-corpus/`. Le corpus lui-meme le presente avec deux precautions
(« roughly », « in Anthropic's reported case ») que la formulation d'un
QCM ferait disparaitre.

**Consequence appliquee**
Aucune question ne demande le facteur, ni ne propose « 15x » comme bonne
reponse, ni ne le glisse en distracteur numerique. Le cout des
sous-agents est teste qualitativement (chaque sous-agent porte son
propre contexte, donc entree ET sortie sont multipliees), ce qui est
sourcable.

---

## 3. « Start with Sonnet » : contredit, pas seulement absent

**Gravite : haute, et differente des trois autres — ici la doc dit
l'inverse.**

**Ce que dit le corpus**
`prepcourse-corpus/m2-2.5-model-budget.md:16`, titre de section :

> **Model selection: Start with Sonnet, move deliberately**

**Ce que dit la doc**
`docs-corpus/02-cout-optimisation.md:3467`, page
`https://platform.claude.com/docs/en/about-claude/models/overview`,
section « Choosing a model » :

> If you're unsure which model to use, start with **Claude Opus 5** for
> complex agentic coding and enterprise work. For workloads that need
> the highest available capability, use Claude Fable 5.

La chaine « start with Sonnet » (ou « begin with Sonnet ») est absente
des 479 pages.

**Nature du desaccord**
Contradiction franche sur le defaut recommande. Lecture la plus probable
[Likely] : le corpus a ete redige contre une generation de modeles
anterieure, ou Sonnet etait le point d'entree raisonnable, et la
documentation a bouge avec la gamme actuelle (Fable 5 / Opus 5 /
Sonnet 5 / Haiku 4.5). Ce n'est pas une erreur du corpus a sa date,
c'est une peremption.

**Consequence appliquee**
Aucune question ne demande « par quel modele commencer ». Les questions
de selection de modele portent sur des criteres (latence, cout,
fenetre de contexte, capacite) et sur l'epinglage de l'ID complet plutot
que de l'alias mouvant — tous sourcables et insensibles a la generation.

---

## 4. Hook PostToolUse comme reponse a une exigence d'audit

**Gravite : moyenne.** Le corpus n'est pas faux, il est trop confiant.
Deux questions posent deja la nuance ; aucune ne repose sur la version
non nuancee.

**Ce que dit le corpus**
`prepcourse-corpus/m3-3.5-enterprise.md:50` :

> Audit hooks answer the logging question: a PostToolUse hook that logs
> every tool call and its parameters to an audit store provides the
> record a compliance review needs.

Ligne 62 en fait un critere de revue (« is there a PostToolUse hook
logging every tool call »), et le tableau lignes 74-76 met « PostToolUse
hook to audit log » comme la reponse d'audit pour les trois topologies.

**Ce que dit la doc**
Deux qualifications, aucune des deux presente dans le corpus.

1. La couverture n'est pas totale par construction. Les matchers
   s'ecrivent par NOM D'OUTIL, sensibles a la casse
   (`docs-corpus/04a-claude-code.md:15784` et `:15818`, page
   `https://code.claude.com/docs/en/debug-your-config`) : « The
   `matcher` field is a single string that uses `|` to match multiple
   tool names, for example `"Edit|Write"` », et « A misspelled tool name
   produces a matcher that matches nothing, so the hook fails
   silently ». Un matcher `Edit|Write` ne voit donc pas un fichier ecrit
   par `Bash`. Le hook reste un journal par appel d'outil, pas une
   garantie de couverture de l'arbre.

2. Pour un audit AU NIVEAU DE LA REQUETE, la doc ne pointe pas le hook.
   `docs-corpus/04a-claude-code.md:388`, page
   `https://code.claude.com/docs/en/admin-setup` :

   > If you need request-level audit logging or to route traffic by data
   > sensitivity, place a gateway between developers and your provider:
   > a self-hosted Claude apps gateway records a per-request audit log
   > with IdP identity.

   Le hook n'y figure pas. Et la ou la doc decrit PostToolUse, elle
   reste mesuree : « Audit outputs, trigger side effects »
   (`docs-corpus/03a-agents-sdk.md:436`), « Log all file changes to
   audit trail » (`:3084`).

**Nature du desaccord**
Le corpus donne le hook comme LA reponse d'audit ; la doc en fait un
outil de journalisation par appel d'outil, avec une couverture qui
depend du matcher, et renvoie l'audit par requete lie a l'identite IdP
vers une passerelle auto-hebergee.

**Consequence appliquee**
Les deux questions concernees encodent la nuance de la doc, pas
l'affirmation du corpus :
- `PC-ENT-010` : un matcher `Edit|Write` manque les fichiers ecrits par
  `Bash` ; la couverture complete demande un hook `Stop` qui balaie
  l'arbre une fois par tour, ou d'ajouter `Bash` au matcher avec
  `git status --porcelain`.
- `PC-ENT-012` : pour un audit au niveau requete rattache a l'identite
  IdP, la bonne reponse est la passerelle auto-hebergee ; le hook
  `PostToolUse` y est un distracteur assume.

---

## Ce qui reste a arbitrer

| # | Point | A decider |
|---|---|---|
| 1 | Scopes MCP, 4 ou 3 | Si une question doit un jour compter ou nommer les scopes, laquelle des deux enumerations fait foi ? |
| 2 | Multiplicateur x15 | On renonce definitivement au chiffre, ou on cherche une source hors `docs-corpus/` et on elargit le perimetre de sourcage ? |
| 3 | Start with Sonnet | Corpus perime : on le note comme tel dans la methode, ou on demande une mise a jour du corpus ? |
| 4 | Hook d'audit | La nuance actuelle nous suffit-elle, ou faut-il une question qui oppose explicitement hook et passerelle ? |

Position que je defends [Likely] : sur 1, 2 et 3, la documentation
tranche, parce que c'est elle que l'examen source. Le corpus dit ce
qu'il faut comprendre, la doc dit ce qui est vrai a la date de
l'examen ; quand les deux divergent sur un fait verifiable, la doc
gagne. Le point 4 n'est pas une divergence de fait mais de degre de
certitude, et il est deja traite correctement.

Ce qui ne se decide pas seul : elargir le perimetre de sourcage
(point 2) changerait la regle de fabrication de toute la banque. C'est
la seule des quatre questions qui merite vraiment une discussion a
trois.
