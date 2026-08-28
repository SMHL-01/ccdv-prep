#!/usr/bin/env node
// Fabrique un paquet de relecture croisee.
//
// Pourquoi cet outil existe : npm run livrer verifie des repartitions, des
// longueurs d'options et des doublons. Il ne verifie ni la justesse d'un fait,
// ni la qualite d'un distracteur, ni l'unicite de la bonne reponse. Ces trois
// choses ne se voient qu'a la lecture par un humain qui n'a pas ecrit la
// question.
//
// Usage :
//   node outils-relecture.js --auteur said          -> les questions de Said
//   node outils-relecture.js --auteur marie-line    -> celles de Marie-Line
//   node outils-relecture.js --auteur said --tout   -> pas seulement "difficile"
//   node outils-relecture.js --auteur marie-line --echantillon 40 --graine 7
//
// La sortie va sur stdout ; rediriger vers un fichier hors du depot.
// L'echantillonnage est deterministe a graine fixee, pour qu'un desaccord sur
// une question se rejoue avec la meme commande.

const fs = require('fs');
const path = require('path');

// Proprietaires. Source : reservations.json et reservations-prepcourse.json.
// "Software Engineering Foundations" est mixte (21 questions de Said, 9 de
// Marie-Line, fusionnees le 2026-08-03) : impossible de trancher par fichier,
// donc marque mixte et sorti des deux paquets. A repartir a la main.
const SAID_DOC = new Set([
  'Agent Architecture', 'Agent Construction with Claude', 'Agent Patterns and Frameworks',
  'Claude Application Design', 'Claude Hooks', 'Identity, Secrets and Key Management',
  'MCP Server Development', 'Guardrails and Safe Deployment', 'Output Handling',
]);
const SAID_PREPCOURSE = new Set([
  'm1-1.1-llm-behavior', 'm1-1.2-models-reasoning', 'm1-1.3-prompting-modes',
  'm1-1.4-technical-substrate', 'm3-3.1-permission',
]);
const MIXTE = 'Software Engineering Foundations';

function lireBanques() {
  const out = [];
  for (const [dir, banque] of [['questions', 'doc'], ['questions-prepcourse', 'prepcourse']]) {
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      if (/^_/.test(f)) continue;
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const qs = Array.isArray(d) ? d : d.questions;
      const topic = d.topic || null;
      const sub = (qs[0] || {}).subdomain || '?';
      let auteur;
      if (banque === 'doc') auteur = sub === MIXTE ? 'mixte' : (SAID_DOC.has(sub) ? 'said' : 'marie-line');
      else auteur = SAID_PREPCOURSE.has(topic) ? 'said' : 'marie-line';
      for (const q of qs) out.push({ q, banque, fichier: path.join(dir, f), topic: topic || sub, auteur });
    }
  }
  return out;
}

// Pages de docs-corpus, indexees par URL. Meme decoupage que verifier-questions.js.
function lirePages() {
  const pages = new Map();
  for (const f of fs.readdirSync('docs-corpus').filter((f) => f.endsWith('.md')).sort()) {
    const txt = fs.readFileSync(path.join('docs-corpus', f), 'utf8');
    const parts = txt.split(/^\*\*Source :\*\* (\S+)$/m);
    for (let i = 1; i < parts.length; i += 2) pages.set(parts[i], parts[i + 1]);
  }
  return pages;
}

// L'extrait le plus probable. On ne cherche pas a prouver, on cherche a mettre
// sous les yeux du relecteur le passage qu'il devra juger. Le score est un
// simple recouvrement de mots avec l'enonce et la bonne reponse : grossier,
// mais il remonte le bon paragraphe la plupart du temps, et quand il se trompe
// c'est visible immediatement.
function motsCles(s) {
  return new Set(
    (s.toLowerCase().match(/[a-z0-9_.-]{4,}/g) || []).filter((m) => !MOTS_VIDES.has(m))
  );
}
const MOTS_VIDES = new Set(['this', 'that', 'with', 'from', 'which', 'when', 'what', 'they',
  'their', 'there', 'have', 'been', 'must', 'should', 'would', 'could', 'does', 'each',
  'both', 'other', 'than', 'then', 'them', 'these', 'those', 'only', 'also', 'more',
  'most', 'some', 'such', 'into', 'over', 'same', 'select', 'true', 'following']);

function extraits(page, cible, n = 2) {
  if (!page) return null;
  const cles = motsCles(cible);
  if (!cles.size) return null;
  const blocs = page.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b.length > 80);
  const notes = blocs.map((b) => {
    const mots = motsCles(b);
    let inter = 0;
    for (const m of cles) if (mots.has(m)) inter++;
    return { b, score: inter / Math.sqrt(mots.size + 8) };
  });
  notes.sort((x, y) => y.score - x.score);
  return notes.slice(0, n).filter((x) => x.score > 0);
}

// PRNG deterministe (mulberry32) : un echantillon rejouable a graine fixee.
function rng(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Echantillon stratifie par fichier : on ne veut pas 40 questions tirees de
// trois fichiers. Chaque fichier cede une part proportionnelle a son effectif,
// et au moins une question s'il en a.
function echantillonner(items, taille, graine) {
  if (!taille || taille >= items.length) return items;
  const parFichier = new Map();
  for (const it of items) {
    if (!parFichier.has(it.fichier)) parFichier.set(it.fichier, []);
    parFichier.get(it.fichier).push(it);
  }
  const r = rng(graine);
  const cles = [...parFichier.keys()].sort();
  const choisis = [];
  const restes = [];
  for (const k of cles) {
    const groupe = parFichier.get(k).slice();
    for (let i = groupe.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [groupe[i], groupe[j]] = [groupe[j], groupe[i]];
    }
    const part = (groupe.length / items.length) * taille;
    const prend = Math.max(1, Math.floor(part));
    choisis.push(...groupe.slice(0, prend));
    restes.push(...groupe.slice(prend));
  }
  for (let i = restes.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [restes[i], restes[j]] = [restes[j], restes[i]];
  }
  while (choisis.length > taille) choisis.pop();
  let k = 0;
  while (choisis.length < taille && k < restes.length) choisis.push(restes[k++]);
  return choisis;
}

// --- programme principal ---

const argv = process.argv.slice(2);
function opt(nom, defaut) {
  const i = argv.indexOf('--' + nom);
  return i === -1 ? defaut : argv[i + 1];
}
const auteur = opt('auteur', null);
const tout = argv.includes('--tout');
const taille = parseInt(opt('echantillon', '0'), 10);
const graine = parseInt(opt('graine', '1'), 10);

if (!auteur || !['said', 'marie-line', 'mixte'].includes(auteur)) {
  console.error('usage : node outils-relecture.js --auteur said|marie-line|mixte [--tout] [--echantillon N] [--graine G]');
  process.exit(2);
}

let items = lireBanques().filter((it) => it.auteur === auteur);
if (!tout) items = items.filter((it) => it.q.difficulty === 'difficile');
const totalAvant = items.length;
items = echantillonner(items, taille, graine);
const pages = lirePages();

const relecteur = auteur === 'said' ? 'Marie-Line' : (auteur === 'marie-line' ? 'Said' : 'a repartir');
console.log(`# Paquet de relecture croisee — questions ecrites par ${auteur}`);
console.log(`\nRelecteur : **${relecteur}**. Personne ne relit ses propres questions.`);
console.log(`\nPerimetre : ${tout ? 'toutes difficultes' : 'difficulte "difficile" uniquement'}.`);
console.log(`Questions dans le perimetre : ${totalAvant}. Dans ce paquet : ${items.length}.`);
if (taille && taille < totalAvant) {
  console.log(`Echantillon stratifie par fichier, graine ${graine}. Rejouable a l'identique :`);
  console.log('```bash');
  console.log(`node outils-relecture.js --auteur ${auteur}${tout ? ' --tout' : ''} --echantillon ${taille} --graine ${graine}`);
  console.log('```');
}
console.log(`
## Ce qu'on cherche

Quatre categories, et seulement celles-la. Noter la categorie, pas une
impression : sans categorie commune, deux relectures ne s'agregent pas.

| code | defaut | test |
|---|---|---|
| **F** | fait faux | la page citee dit autre chose, ou ne dit pas ca |
| **P** | fait perime | vrai a la redaction, plus vrai aujourd'hui |
| **D** | distracteur eliminable sans connaissance | on l'ecarte par la forme, la longueur, l'absurdite |
| **2** | deux bonnes reponses | un distracteur est defendable |

Si une question est bonne, ne rien ecrire. On compte les defauts, pas les
validations.

L'extrait sous chaque question est un candidat trouve par recouvrement de mots,
pas une preuve. S'il ne soutient pas la bonne reponse, c'est soit l'extrait qui
a rate, soit un defaut F : ouvrir la page pour trancher.

---
`);

let n = 0;
for (const it of items) {
  const q = it.q;
  n++;
  const page = pages.get(q.doc_ref);
  const correctes = new Set(q.correct || []);
  const txtCorrect = (q.options || []).filter((o) => correctes.has(o.key)).map((o) => o.text_en).join(' ');
  console.log(`## ${n}. ${q.id} — ${it.banque} — ${it.topic}`);
  console.log(`\`${q.nature}\` · \`${q.difficulty}\` · \`${q.type}\` · [${it.fichier}](${it.fichier})\n`);
  console.log(`**${q.question_en}**\n`);
  for (const o of q.options || []) {
    console.log(`- ${correctes.has(o.key) ? '**[' + o.key + ']**' : o.key} ${o.text_en}${correctes.has(o.key) ? '  ← donnee correcte' : ''}`);
  }
  console.log(`\n*Principe :* ${q.principe_fr || '(aucun)'}`);
  console.log(`\n*Source citee :* ${q.doc_ref}`);
  if (!page) {
    console.log(`\n> **PAGE ABSENTE DE docs-corpus.** Defaut F d'office : le doc_ref ne resout pas.`);
  } else {
    const ex = extraits(page, q.question_en + ' ' + txtCorrect);
    if (!ex || !ex.length) {
      console.log(`\n> **Aucun extrait trouve** sur cette page pour cet enonce. A ouvrir a la main.`);
    } else {
      console.log(`\n*Extrait candidat de la page citee :*\n`);
      for (const e of ex) console.log('> ' + e.b.replace(/\n/g, '\n> ') + '\n');
    }
  }
  console.log(`\n**Verdict :** _____   (vide = bonne ; sinon F / P / D / 2 + une ligne)\n`);
  console.log('---\n');
}
