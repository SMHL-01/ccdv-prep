# Ou en est la banque Prep Course

> Tenu a la main pour l'instant (pas de `etat.js --ecrire` equivalent tant que
> l'outillage de la banque Prep Course n'est pas construit). Source de verite
> ponctuelle : `reservations-prepcourse.json`. Mettre a jour ce fichier a
> chaque reservation ou topic termine, comme `ETAT.md` pour la banque doc.

**17 / 27 topics valides, 0 reserve par Said, 10 proposes a Marie-Line**
(glossaire `00-glossaire.md` exclu : reference transverse, pas un topic a
questions). Repartition posee le 2026-08-13 : Said a boucle ses 5 topics
habituels (m1-1.1 a m1-1.4, m3-3.1 — 44 questions, 0 anomalie sur
l'ensemble). Rien d'autre prevu de son cote pour l'instant. Reste
propose a Marie-Line : le reste des modules 2, 4, 5 et m3-3.2 a m3-3.5 ;
elle confirme en passant chaque topic a `reserve` dans
`reservations-prepcourse.json` avant d'ecrire — et en POUSSANT cette
reservation avant la premiere question, ce que `npm run questions` verifie
desormais en lisant le fichier sur `origin/main`.

**Cibles : 284 questions pour la banque, 107 restant a ecrire sur 10 topics.**
Posees en une passe le 2026-08-27, derivees et non arbitrees :
`cible = 8 + arrondi(6 x densite normalisee du chapitre dans prepcourse-corpus/)`,
bornes 8 a 14. Le plancher 8 sort du calibrage, pas du jugement : sous 8
questions, 65/30/5 en nature, 25/50/25 en difficulte et ~20 % de multi ne
tombent plus juste. La densite module au lieu d'allouer — sans borne, l'ecart
x14 entre le chapitre le plus mince (m5-5.3-lifecycle, 2 090 car.) et le plus
dense (m5-5.4-deployment, 25 608 car.) se propagerait tel quel, et une
allocation proportionnelle a la densite des 6 topics deja faits (610 car. par
question) donnerait une banque a 532 questions.

Le poids d'examen du blueprint n'est pas la cle d'allocation de cette banque,
pour deux raisons : un topic du cours couvre souvent deux domaines — `m1-1.4`
(Applications 5 + Model Selection 4) et `m3-3.1` (Applications 5 + Security 4)
le font deja — donc son poids n'est pas un nombre defini ; et la banque doc
assure deja la proportionnalite au blueprint par construction, 406 questions
pour 100 % du poids. Le mapping topic -> domaine reste a faire, mais comme axe
d'audit de couverture (multi-valeur), pas comme cle d'allocation.

Note calibrage (2026-08-13, cloturee sur les topics de Said) : consigne
tenue sur m1-1.3, m1-1.4 et m3-3.1 (1 factual_magnitude documentee
chacun). Sur les 44 questions ecrites a ce stade, la repartition colle
aux cibles : judgment 65,9 % (cible 65), factual_semantic 27,3 % (cible
30), factual_magnitude 6,8 % (cible 5, plafond) — a suivre sur les
topics de Marie-Line plutot que de re-forcer un chiffre par fichier.

Note calibrage (2026-08-25, apres m2-2.1) : le plafond `factual_magnitude`
de la banque prepcourse est en depassement HERITE, pas cause par un fichier
fautif -- les 3 questions viennent des topics de Said et chacun de ses fichiers
passe seul. Le plafond etant evalue sur la banque entiere, il se resorbe par
dilution : 3/44 = 6,8 % avant m2-2.1, 3/53 = 5,7 % apres, et il repassera sous
les 5 % a 60 questions (3/60 = 5,0 %). Consigne pour les prochains topics :
zero `factual_magnitude` jusqu'a ce que `npm run questions` affiche « Tous les
controles passent » sur la banque prepcourse, puis reprendre le rythme d'une
question de grandeur par fichier. Ne PAS retoucher les fichiers de Said pour
faire tomber le chiffre.

Note calibrage (2026-08-27, apres m2-2.2) : le depassement herite est
resorbe. La banque prepcourse passe a 62 questions et 3 factual_magnitude,
soit 4,8 % — sous le plafond de 5 %, et `npm run livrer` affiche « Tous les
controles passent » pour la premiere fois. La dilution a suffi, aucun fichier
de Said n'a ete touche. La consigne « zero factual_magnitude » est donc levee :
reprise du rythme d'une question de grandeur par fichier des que le plafond le
permet, en surveillant que la banque ne repasse pas au-dessus de 5 %.

Correctif de cette note (2026-08-27, avant m2-2.3) : la levee etait annoncee
« a partir de m2-2.3 », l'arithmetique dit le contraire. Une question de
grandeur dans un fichier de 13 aurait porte la banque a 4 sur 75, soit 5,3 % —
au-dessus du plafond, donc anomalie. m2-2.3 est donc ecrit a zero
factual_magnitude (3 sur 75 = 4,0 %). La reprise devient possible au topic
suivant : 4 sur 84 = 4,8 %. Regle a appliquer avant d'en poser une, plutot que
de decider par fichier : verifier que (magnitude + 1) / (banque + cible) reste
sous 5 %.

Note sourcing (2026-08-27, apres m2-2.2) : quatre faits du chapitre thinking
etaient deja couverts par m1-1.2 (`PC-MDR-004` budget_tokens en 400,
`PC-MDR-005/006` le parametre effort, `PC-MDR-007` display omitted par defaut).
Ces angles ont ete ecartes et les 9 questions portent sur le reste du chapitre :
structure et position des blocs, cout et cache, protocole de renvoi en boucle
d'outils, `redacted_thinking`, bascule en cours de tour. Reflexe a garder pour
les topics dont le sujet recoupe un topic de Said : lister les `concept` deja
poses AVANT de rediger, pas apres.

Note methode (2026-08-13, apres m3-3.1) : m3-3.1 est le premier topic de
Said dont le corpus est narratif (etude de cas incident) plutot qu'un
resume de doc. Reflexe garde : ancrer quand meme chaque question sur la
doc officielle (`permission-modes`, `permissions`) plutot que sur la
seule narration, pour que `doc_ref` reste verifiable. A reappliquer sur
les topics au profil similaire (guardrails, security incidents, etc.).

## Module 1 — Fondations LLM & modeles

| | Topic | Ecrites | Qui |
| --- | --- | ---: | --- |
| `[x]` | m1-1.1-llm-behavior | 8 | Said |
| `[x]` | m1-1.2-models-reasoning | 9 | Said |
| `[x]` | m1-1.3-prompting-modes | 9 | Said |
| `[x]` | m1-1.4-technical-substrate | 9 | Said |

## Module 2 — Prompting, outils & agents

| | Topic | Ecrites | Qui |
| --- | --- | ---: | --- |
| `[x]` | m2-2.1-prompting | 9 | Marie-Line |
| `[x]` | m2-2.2-thinking | 9 | Marie-Line |
| `[x]` | m2-2.3-tools | 13 | Marie-Line |
| `[x]` | m2-2.4-streaming | 9 | Marie-Line |
| `[x]` | m2-2.5-model-budget | 12 | Marie-Line |
| `[x]` | m2-2.6-agent-loop | 13 | Marie-Line |
| `[x]` | m2-2.7-memory-scope | 11 | Marie-Line |
| `[x]` | m2-2.8-multimodal-batch | 10 | Marie-Line |

## Module 3 — Plateforme & integration

| | Topic | Ecrites | Qui |
| --- | --- | ---: | --- |
| `[x]` | m3-3.1-permission | 9 | Said |
| `[x]` | m3-3.2-claudemd | 11 | Marie-Line |
| `[x]` | m3-3.3-plugins | 12 | Marie-Line |
| `[x]` | m3-3.4-rag | 11 | Marie-Line |
| `[x]` | m3-3.5-enterprise | 13 | Marie-Line |

## Module 4 — Qualite, cout & securite

| | Topic | Ecrites | Qui |
| --- | --- | ---: | --- |
| `[ ]` | m4-4.1-evals | 0 | Marie-Line (propose) |
| `[ ]` | m4-4.2-testing-tracing | 0 | Marie-Line (propose) |
| `[ ]` | m4-4.3-tool-errors | 0 | Marie-Line (propose) |
| `[ ]` | m4-4.4-model-selection | 0 | Marie-Line (propose) |
| `[ ]` | m4-4.5-cost-caching | 0 | Marie-Line (propose) |
| `[ ]` | m4-4.6-security | 0 | Marie-Line (propose) |

## Module 5 — Cycle de vie applicatif

| | Topic | Ecrites | Qui |
| --- | --- | ---: | --- |
| `[ ]` | m5-5.1-packaging | 0 | Marie-Line (propose) |
| `[ ]` | m5-5.2-requirements | 0 | Marie-Line (propose) |
| `[ ]` | m5-5.3-lifecycle | 0 | Marie-Line (propose) |
| `[ ]` | m5-5.4-deployment | 0 | Marie-Line (propose) |

`[x]` termine · `[~]` reserve, pas encore ecrit · `[ ]` propose ou libre, rien d'ecrit
