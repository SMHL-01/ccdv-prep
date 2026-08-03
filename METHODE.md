# Travailler a deux sur ccdv-prep

Le 2026-08-02, Said et Marie-Line ont ecrit **le meme sous-domaine** chacun de
leur cote : 60 questions pour 30 places, avec les memes identifiants
`SEF-001..030`. Une journee de travail perdue, et le seul fichier des sept ou la
qualite a baisse. Ce document existe pour que cela ne recommence pas.

La cause n'etait pas de la negligence. Les deux commandes de controle du projet
repondaient « tout passe » et « aucun trou » alors que 15 sous-domaines sur 25
etaient vides : `verifier-couverture.js` affichait la cible du blueprint dans une
colonne qu'on lisait comme un decompte. C'est corrige. Mais l'outillage ne
remplace pas une reservation ecrite.

---

## La regle, en une phrase

**On ne commence pas a ecrire un sous-domaine avant d'avoir pousse sa
reservation sur `main`.**

`reservations.json` est minuscule et une reservation n'y touche qu'une ligne :
deux personnes peuvent le modifier le meme jour sans conflit. C'est ce qui rend
la regle tenable.

---

## Le cycle, a chaque session

### 1. Avant de commencer — se resynchroniser

```bash
git checkout main
git pull
npm run etat
```

`npm run etat` affiche les 25 sous-domaines, ce qui est ecrit, ce qui est
reserve et par qui. C'est la seule source d'avancement. `ETAT.md` dit la meme
chose et se lit sur GitHub sans cloner.

### 2. Reserver — avant d'ecrire une seule question

Ouvrir `reservations.json`, passer le sous-domaine choisi a `"etat": "reserve"`
avec son nom, puis :

```bash
git add reservations.json
git commit -m "Reserver : <nom du sous-domaine>"
git push
```

Si le push est rejete, c'est que l'autre a pousse entre-temps : `git pull`,
verifier qu'elle/il n'a pas pris le meme, repousser.

**Ne jamais reserver plus de deux sous-domaines a l'avance.** Une reservation
qui dort empeche l'autre d'avancer.

### 3. Ecrire

Un sous-domaine = un fichier `questions/<domaine>_<sous-domaine>.json`. Ne
jamais toucher au fichier de quelqu'un d'autre. Ne jamais editer
`_manifeste.json` ni `_index-concepts.json` a la main : ils sont generes.

### 4. Avant de commiter — regenerer et verifier

```bash
npm run livrer
```

Cette commande enchaine les trois regenerations dans le bon ordre : manifeste,
index des concepts, `ETAT.md`. Puis :

```bash
npm run questions
```

Il doit afficher **« Tous les controles passent »**. Sinon on corrige avant de
commiter — jamais apres.

### 5. Pousser

```bash
git add -A
git commit -m "Questions : <nom du sous-domaine>, <n> questions"
git pull --rebase        # recuperer le travail de l'autre AVANT de pousser
npm run questions        # revalider apres le rebase
git push
```

Le `git pull --rebase` avant chaque push est ce qui evite les divergences. S'il
signale un conflit sur `_manifeste.json`, `_index-concepts.json` ou `ETAT.md` :
ne pas le resoudre a la main, prendre n'importe quelle version puis relancer
`npm run livrer`, qui les reconstruit correctement.

---

## Le partage du travail

Said travaille avec Claude Pro et un quota limite : il prend les **petits**
sous-domaines, qu'il peut terminer en une session. Marie-Line travaille avec
Claude Code : elle prend le **gros**.

| | Said | Marie-Line |
| --- | ---: | ---: |
| Sous-domaines ouverts | 5 | 10 |
| Questions a ecrire | 37 | 129 |

Le detail vit dans `reservations.json` et s'affiche avec `npm run etat`. Si le
rythme ne colle pas, on redeplace une ligne — c'est fait pour.

---

## Regles de qualite, au-dela du vert du vérificateur

`verifier-questions.js` attrape le schema, les repartitions, l'equilibre A/B/C/D
et les doublons. Il ne voit pas ces deux pieges, tous deux rencontres pour de
vrai :

**Reformuler n'est pas couvrir.** La deduplication compare des chaines de
caracteres. Sept questions ont deja teste le meme paragraphe de la doc sur les
reessais des SDK avec sept libelles differents : le controle passait au vert.
Avant d'ecrire une question, verifier qu'elle teste un **fait distinct**, pas la
meme phrase sous un autre angle.

**Un `doc_ref` present n'est pas un `doc_ref` qui etaye.** Le script verifie que
l'URL existe dans le corpus, pas qu'elle soutient la reponse. Deux questions sur
l'idempotence citaient la page des erreurs, ou le mot « idempotent » n'apparait
pas une seule fois. Reflexe : ouvrir la page citee, y trouver la phrase qui
justifie la bonne reponse, et la citer dans `explanation_fr`.

Rappel de calibrage : la banque est **sous la cible en `factual_magnitude`**
(3,0 % pour 5 %). Les sous-domaines restants doivent en contenir un peu plus que
la moyenne.

---

## Si ca diverge quand meme

```bash
git fetch origin
git status -sb                        # « ahead N, behind M » = divergence
git log HEAD..origin/main --oneline   # ce que l'autre a fait
git log origin/main..HEAD --oneline   # ce que j'ai en local
```

Si deux personnes ont ecrit le meme fichier de questions, ne pas choisir un
camp au hasard : les deux jeux contiennent du bon. Fusionner en gardant le
nombre cible, renumeroter les identifiants en continu, puis `npm run livrer` et
`npm run questions`. C'est ce qui a ete fait pour Software Engineering
Foundations le 2026-08-03.
