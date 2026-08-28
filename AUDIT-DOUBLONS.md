# Audit des doublons inter-banques -- 2026-08-28

## Ce qui a declenche l'audit

En preparant m4-4.6-security j'ai relance l'inventaire des pages libres et vu que
`.../strengthen-guardrails/reduce-latency` portait ONZE questions, alors que mon
scan de recouvrement pour m4-4.5-cost-caching avait affiche zero.

Cause : dans ce scan j'ai grep le motif `reducing-latency` au lieu de
`reduce-latency`. La page portait deja dix questions de la banque doc
(TCF-001 a TCF-009, TCF-024). PC-CST-013 posait exactement TCF-005.
Corrige et pousse (voir le commit "Corrige PC-CST-013").

L'erreur n'est pas le typo, c'est la methode : verifier l'occupation d'une page
par un motif d'URL tape a la main n'est pas fiable. J'ai donc audite les
635 questions des deux banques.

## Methode

Pour chaque paire de questions partageant le meme `doc_ref` exact, dans deux
fichiers differents, coefficient de recouvrement des tokens du champ `concept`
(les deux banques ecrivent ce champ en francais, c'est le meilleur signal
disponible) : `|A inter B| / min(|A|,|B|)`, seuil 0,38.

59 paires remontees, jugees une par une sur le critere : *est-ce que connaitre
la reponse de l'une donne la reponse de l'autre ?* Si oui = DOUBLON. Si la
question porte sur une decision ou un mecanisme different sur la meme page =
VOISIN, on garde.

Le detail brut des 59 paires (question + bonne reponse des deux cotes) est
reproductible avec le script en fin de document.

## Resultat

| Perimetre | Questions | Doublons | Taux |
|---|---|---|---|
| Topics Marie-Line (banque prepcourse) | 185 | 14 | 7,6 % |
| Topics Said (banque prepcourse) | 44 | 6 | 13,6 % |
| Banque doc (fermee) | 406 | 3 paires internes | -- |

## A corriger -- topics Marie-Line (14)

| Question | Doublon de | Fait commun |
|---|---|---|
| PC-AGL-002 | AGA-002 | ce que porte le `ResultMessage` final |
| PC-AGL-008 | AGA-014 | la depense des sous-agents s'impute au plafond du parent |
| PC-EVL-001 | REQ-004 (+REQ-002, REQ-003) | "safe outputs" inutilisable faute de seuil mesurable |
| PC-EVL-002 | ETD-002 (+ETD-001) | privilegier le volume sur la qualite de notation |
| PC-RAG-004 | CAD-016 (+CAD-017) | les deux facons de fournir un bloc `search_result` |
| PC-PMT-003 | PRE-004 (+PC-PRM-008, a Said) | les balises XML delimitent les exemples |
| PC-PMT-007 | OUH-003 | la casse des valeurs `enum` n'est pas garantie |
| PC-PMT-008 | OUH-004 | `refusal` et `max_tokens` cassent le schema |
| PC-MBG-001 | LLF-011 | definition du context rot |
| PC-MBG-005 | CTX-003 | apres compaction l'API laisse tomber les blocs anterieurs |
| PC-MBG-009 | MST-002 | regler `effort` avant de changer de modele |
| PC-STR-003 | CAM-015 | accumuler les deltas, parser a `content_block_stop` |
| PC-STR-007 | CAM-014 | tolerer les ping et les types d'evenements inconnus |
| PC-CMD-009 | CFG-008 | CLAUDE.md est du contexte, pas de la configuration imposee |

Fichiers concernes : m2-2.1-prompting (3), m2-2.4-streaming (2),
m2-2.5-model-budget (3), m2-2.6-agent-loop (2), m3-3.2-claudemd (1),
m3-3.4-rag (1), m4-4.1-evals (2).

## A corriger -- topics Said (6), je n'y touche pas

| Question | Doublon de | Fait commun |
|---|---|---|
| PC-LLB-001 | LLF-001 | definition d'un token |
| PC-LLB-006 | LLF-015 | temperature 0 n'est pas deterministe |
| PC-MDR-008 | MST-005 | partir d'evals sur son cas d'usage avant de changer de modele |
| PC-PRM-008 | PRE-004 (+PC-PMT-003, a moi) | les balises XML delimitent les exemples |
| PC-PRM-009 | PRE-013 (+REQ-011) | prompt engineering n'est pas le levier d'un probleme de cout/latence |
| PC-TSB-008 | CTM-012 | la Batch API renvoie un identifiant, les resultats se sondent a part |

Said, deux cas limites que je te laisse arbitrer plutot que de les trancher :
- **PC-PMS-005 / CFG-011** : CFG-011 pose l'ordre deny > ask > allow tout court,
  PC-PMS-005 pose en plus qu'un deny large bat un allow plus specifique. Le
  second fait n'est pas dans CFG-011. Je pencherais pour garder.
- **PC-TSB-009 / TCF-018** : TCF-018 pose la fenetre de 24 h, PC-TSB-009 pose que
  24 h est un plafond avant expiration et non la duree typique. C'est le
  contre-pied de TCF-018, pas sa repetition. Je pencherais pour garder.
- **PC-PRM-006 / PRE-009** : faits differents (diversite des exemples contre
  formulation positive). Rien a faire.

## Voisins gardes (meme page, fait different)

PC-EVL-005, PC-EVL-007, PC-MBG-010, PC-PMT-006, PC-RAG-007, PC-AGL-003,
PC-AGL-007. Et, dans la banque doc fermee : AGP-003/ACU-016,
CTM-012/TCF-020, REQ-011/PRE-013 -- signales pour information, la banque doc
est livree, je ne la modifie pas.

## Ce que je change dans la methode pour les topics restants

Le scan par motif d'URL tape a la main est abandonne. Avant d'ecrire un topic :
inventaire des pages du corpus annotees de leur nombre de questions, obtenu en
comparant les `doc_ref` reels des deux banques aux URL reelles de
`docs-corpus/`, sans motif intermediaire. Puis, apres redaction et avant commit,
passage du detecteur de recouvrement de concept ci-dessous sur le fichier ecrit.

```python
# meme doc_ref + recouvrement de concept >= 0.38 => a examiner a la main
import json, glob, os, re, itertools
def load(pat):
    out = []
    for p in sorted(glob.glob(pat)):
        if os.path.basename(p).startswith('_'): continue
        for q in json.load(open(p)).get('questions', []):
            q['_f'] = os.path.basename(p)[:-5]; out.append(q)
    return out
allq = load('questions/*.json') + load('questions-prepcourse/*.json')
STOP = set('un une le la les de des du et ou est sont dans pour que qui quoi ce cette au aux par sur avec pas ne son sa ses leur plus quand comment a en il elle on se d'.split())
def ct(q): return {w for w in re.findall(r"[a-zA-Zà-ÿ_]{4,}", q['concept'].lower()) if w not in STOP}
byref = {}
for q in allq: byref.setdefault(q['doc_ref'], []).append(q)
for ref, qs in byref.items():
    for a, b in itertools.combinations(qs, 2):
        if a['_f'] == b['_f']: continue
        ta, tb = ct(a), ct(b)
        if not ta or not tb: continue
        j = len(ta & tb) / min(len(ta), len(tb))
        if j >= 0.38:
            print("%.2f %s | %s  %s" % (j, a['id'], b['id'], ref))
```

## Limite connue de cet audit

Le detecteur ne compare que des questions partageant le **meme `doc_ref` exact**.
Deux questions qui posent le meme fait en citant deux pages differentes ne
remontent pas. C'est le trou restant, et il se comble a la lecture, pas au script.
