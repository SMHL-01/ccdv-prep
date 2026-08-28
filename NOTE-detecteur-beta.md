# Detecteur beta : ligne de base mesuree avant tout correctif

> Ecrit le 2026-08-28, a la demande de Said (« notez la ligne de faux
> positifs actuelle quelque part, pour qu'on voie ce que le changement a
> libere »).
>
> **Etat : arbitre et applique le 2026-08-28 (commit `d56f667`).** La
> mesure a contredit l'hypothese de depart -- le correctif demande a
> l'origine n'a pas ete pousse, il aurait fait echouer `npm run livrer`
> sur les deux banques. Said a retire son feu vert initial et valide a
> la place la regle d'union decrite plus bas. C'est elle qui est en
> vigueur dans `verifier-questions.js`.
>
> Ce fichier reste la trace de la ligne de base d'avant correctif, et de
> ce qui a ete ecarte. Il n'y a plus rien a arbitrer ici, sauf le point
> laisse ouvert en fin de document (marge nulle a 7 sur 8).

## La regle d'avant correctif

`verifier-questions.js`, ligne 180 a l'epoque :

```js
if (/api\/beta|managed-agents/.test(q.doc_ref || '')) beta++;
```

Plafond : `PLAFOND_BETA = 8`, par banque. Mesure sur 690 questions
(406 doc + 284 prepcourse) : **6 doc, 6 prepcourse**.

## Faux positifs mesures : zero

Hypothese de depart : le motif confond l'emplacement et le statut, donc
une page `managed-agents/*` stable est comptee a tort, et 6 slots sur 8
sont manges par l'artefact.

Les 6 questions prepcourse comptees sont toutes dans
`m2-2.6-agent-loop.json`, sur deux pages :
`managed-agents/overview` (PC-AGL-001, 004, 005, 009) et
`managed-agents/migration` (PC-AGL-002, 008).

Ce que dit `managed-agents/overview`, section « Beta access » :

> Claude Managed Agents is in beta. All Managed Agents endpoints require
> the `managed-agents-2026-04-01` beta header.

Et `managed-agents/migration` :

> Managed Agents API requests require the `managed-agents-2026-04-01`
> beta header, except memory store endpoints, which use
> `agent-memory-2026-07-22` instead.

Donc les 6 questions portent bien sur une API beta, au sens exact du
plafond. Le motif est grossier dans sa forme — il teste une URL — mais
sur ce corpus il tombe juste : **toute page `managed-agents/*` documente
une surface gatee par en-tete beta**. Il n'y a rien a liberer.

## Le vrai defaut est l'inverse : le silence, pas le bruit

La seconde moitie du raisonnement de Said tient : une vraie page beta
hebergee ailleurs passe sous le radar. C'est mesurable.

42 des 479 pages du corpus contiennent « in beta ». 10 questions
prepcourse mentionnent un mecanisme beta dans leur propre texte
(`anthropic-beta`, `betas`, `beta header`, `(beta)`, `in beta`) et
**une seule** est attrapee par le motif URL :

```
PC-STR-007  PC-MBG-004  PC-MBG-008  PC-AGL-005*  PC-MSC-005
PC-MSC-010  PC-MMB-003  PC-RAG-003  PC-TTR-002   PC-DEP-009
                        (* la seule vue par le motif actuel)
```

## Pourquoi « tester le contenu » au niveau de la page ne marche pas

Regle testee : la page declare son propre sujet en beta
(`## Beta access`, `is in beta`, `requires the ... beta header`).
Resultat : **50 pages sur 479**, et cote questions **44 doc + 26
prepcourse = 70** contre un plafond de 8. `npm run livrer` echouerait
sur les deux banques, ce qui bloquerait exactement le gel demande.

Et la regle est fausse en plus d'etre inutilisable. Exemple :
`build-with-claude/context-windows` porte 12 questions et serait
marquee beta parce qu'elle mentionne en passant `task budgets`, la
compaction, `interleaved-thinking-2025-05-14` et
`model-context-window-exceeded-2025-08-26`. C'est une page stable qui
cite des sous-fonctions beta. La page est la mauvaise unite : le plafond
parle de la question, pas de la page.

## Ce que je propose a la place

Union de deux tests, la ou la reponse testee se trouve reellement :

1. le motif URL actuel, qui ne produit aucun faux positif mesure ;
2. un motif de mecanisme beta (`anthropic-beta`, `betas`,
   `beta header`, `(beta)`, `in beta`) applique **a l'enonce et a la
   bonne reponse uniquement** — pas a `explanation_fr` ni aux
   distracteurs, ou une mention est du contexte et non le fait teste.

Mesure de cette union sur les 690 questions :

| regle | doc | prepcourse |
|---|---|---|
| URL seule (actuelle) | 6 | 6 |
| enonce + bonne reponse seuls | 1 | 2 |
| **union** | **7** | **7** |

Les deux restent sous 8, le point aveugle se ferme, et le gel n'est pas
menace.

**C'est cette regle qui a ete implementee** (`porteSurBeta()` dans
`verifier-questions.js`, commit `d56f667`). `npm run livrer` apres
correctif : « Tous les controles passent », et « Questions portant sur
une API beta : 7 (plafond 8) » sur les deux banques.

Les deux questions rendues visibles, verifiees une par une -- aucune
n'est un faux positif, dans les deux cas le statut beta EST le fait
teste :

- **`CAD-029`** (banque doc) : sa bonne reponse A repose sur le fait que
  le parametre `fallbacks` est en beta sur la Claude API. Page citee
  `build-with-claude/refusals-and-fallback`, stable, donc invisible au
  motif URL.
- **`PC-MSC-005`** (banque prepcourse) : la question porte entierement
  sur le nombre d'en-tetes beta requis par Skills sur la Messages API.
  Page citee `agent-skills/overview`, stable elle aussi.

## Le seul point encore ouvert : marge nulle a 7 sur 8

A 7 sur 8, la prochaine question beta fait echouer `livrer`.

Decision prise avec Said le 2026-08-28 : **on ne releve pas la
constante.** Le plafond protege quelque chose de reel -- une banque qui
teste du beta se perime a chaque changement d'API. A 7/8, la regle a
fait son travail. La prochaine question beta doit etre un arbitrage
explicite a trois, pas un ajustement de constante.

## Commandes pour rejouer la mesure

Toutes les mesures ci-dessus viennent de scripts jetables lances sur
`docs-corpus/`, `questions/` et `questions-prepcourse/`. Rien n'est
cache dans l'outillage : la ligne de base a reproduire est
`6 doc / 6 prepcourse` avec la regle actuelle, sur 690 questions.
