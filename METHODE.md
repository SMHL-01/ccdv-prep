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

### 4. Avant de commiter — verifier, puis ecrire

Verifier et ecrire sont deux gestes separes, jamais la meme commande. D'abord la
verification, qui ne modifie aucun fichier de documentation :

```bash
npm run livrer
```

Elle regenere `_manifeste.json` puis passe les controles. Elle doit afficher
**« Tous les controles passent »**. Sinon on corrige avant de commiter — jamais
apres. Une fois au vert, et une fois seulement, les deux ecritures :

```bash
npm run index
npm run etat:ecrire
```

`npm run index` refuse d'ecrire si une anomalie subsiste. `npm run etat:ecrire`
ne reecrit que la zone d'`ETAT.md` situee entre `<!-- etat:debut -->` et
`<!-- etat:fin -->`, et echoue avec un code non nul si ces marqueurs manquent,
sont en double ou inverses : tout ce qui est hors de la zone est tenu a la main
et n'est jamais touche. `ETAT-prepcourse.md` n'a pas de generateur du tout, il
s'edite entierement a la main.

### 5. Pousser

```bash
git add -A
git commit -m "Questions : <nom du sous-domaine>, <n> questions"
git pull --rebase        # recuperer le travail de l'autre AVANT de pousser
npm run questions        # revalider apres le rebase
git push
```

Le `git pull --rebase` avant chaque push est ce qui evite les divergences. S'il
signale un conflit sur `_manifeste.json` ou `_index-concepts.json` : ne pas le
resoudre a la main, prendre n'importe quelle version puis relancer
`npm run livrer` et `npm run index`, qui les reconstruisent correctement. Un
conflit dans `ETAT.md` se resout par zone : dans la zone generee, prendre
n'importe quelle version et relancer `npm run etat:ecrire` ; hors zone, lire les
deux versions et fusionner a la main, c'est du texte que personne ne regenere.

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
nombre cible, renumeroter les identifiants en continu, puis `npm run livrer`
jusqu'au vert et enfin `npm run index`. C'est ce qui a ete fait pour Software Engineering
Foundations le 2026-08-03.

---

## Deuxieme banque : Prep Course

Meme regle, fichiers paralleles. Les questions issues du Prep Course officiel
(source `prepcourse`, vs `doc` pour la banque ci-dessus) vivent dans
`questions-prepcourse/` (un fichier par topic, pas par sous-domaine), avec leur
propre `reservations-prepcourse.json` et `ETAT-prepcourse.md`. Ne jamais
reserver un topic dans `reservations.json` ni un sous-domaine dans
`reservations-prepcourse.json` : chaque banque a son fichier. Le contenu vient
de `prepcourse-corpus/`, mais chaque `doc_ref` doit quand meme pointer vers une
page reelle de `docs-corpus/` qui etaye le fait.

### Reserver un topic Prep Course

Une reservation qui n'est pas poussee ne protege personne : l'autre ne la voit
pas. Donc, dans cet ordre, et en deux commits distincts :

1. Passer le topic a `"etat": "reserve"` dans `reservations-prepcourse.json`,
   **avec son champ `"cible"`** — le nombre de questions vise. La cible se fixe
   en reservant, jamais apres coup, et il n'y a pas de convention implicite a 8 :
   un topic mince merite une cible plus basse, un topic dense une cible plus
   haute. La changer plus tard se voit dans le diff de ce fichier, c'est voulu.
2. `git pull --rebase` puis `git push`. La reservation est maintenant sur
   `origin/main`.
3. Seulement alors, ecrire les questions.

`npm run questions` verifie ces trois points a chaque lancement : il fait un
`git fetch` et lit `reservations-prepcourse.json` **sur `origin/main`**, pas la
copie locale. Un fichier de questions sur un topic absent, ou reste en
`"propose"`, ou sans cible cote distant, leve une anomalie. Sans reseau,
`npm run questions -- --hors-ligne` saute ce controle en le disant ; sans ce
drapeau, un `git fetch` en echec est lui-meme une anomalie, jamais un vert par
defaut.

C'est ce qui manquait sur `m2-2.1-prompting` : le commit de reservation et le
commit de questions sont partis dans le meme `git push`, donc la reservation
n'etait visible de personne pendant l'ecriture.
