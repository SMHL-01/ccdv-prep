#!/usr/bin/env node
'use strict';
/**
 * lire-page.js — lecture ciblee du corpus, pour la redaction des questions.
 *
 * Le corpus fait 1,7 M de mots : impossible de tout charger. Ce script sert a
 * lire une page a la fois, debarrassee de ses blocs de code, qui occupent
 * souvent 80 % du volume et se repetent en sept langages.
 *
 *   node lire-page.js liste <motif>          URLs dont l URL ou le titre matche
 *   node lire-page.js <motif-url> [début] [longueur]   prose de la page
 *   node lire-page.js <motif-url> --code     prose + blocs de code conserves
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'docs-corpus');

function indexer() {
  const pages = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md')).sort()) {
    for (const bloc of fs.readFileSync(path.join(DIR, f), 'utf8').split(/\n(?=# )/)) {
      const m = bloc.match(/^# (.+)\n+\*\*Source :\*\* (\S+)/);
      if (m) pages.push({ fichier: f, titre: m[1].trim(), url: m[2].trim(), texte: bloc });
    }
  }
  return pages;
}

/** Retire les blocs de code : sept traductions du meme exemple n apportent rien. */
function proser(texte) {
  let t = texte.replace(/```[\s\S]*?```/g, '\n[code]\n');
  t = t.replace(/<CodeGroup>[\s\S]*?<\/CodeGroup>/g, '\n[exemples de code]\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/(\n\[code\]\n)+/g, '\n[code]\n');
  return t;
}

const [cmd, ...reste] = process.argv.slice(2);
const pages = indexer();

if (!cmd) {
  console.error('usage: node lire-page.js liste <motif> | node lire-page.js <motif-url> [debut] [longueur]');
  process.exit(1);
}

if (cmd === 'liste') {
  const re = new RegExp(reste[0] || '.', 'i');
  for (const p of pages) {
    if (re.test(p.url) || re.test(p.titre)) {
      console.log(String(proser(p.texte).length).padStart(7), p.fichier.padEnd(22), p.url, '|', p.titre);
    }
  }
  process.exit(0);
}

const re = new RegExp(cmd, 'i');
const trouvees = pages.filter((p) => re.test(p.url));
if (!trouvees.length) {
  console.error(`Aucune page pour /${cmd}/`);
  process.exit(1);
}
if (trouvees.length > 1) {
  console.error(`${trouvees.length} pages correspondent, precisez :`);
  for (const p of trouvees) console.error('  ' + p.url);
  process.exit(1);
}

const avecCode = reste.includes('--code');
const nums = reste.filter((x) => /^\d+$/.test(x)).map(Number);
const debut = nums[0] || 0;
const longueur = nums[1] || 12000;
const texte = avecCode ? trouvees[0].texte : proser(trouvees[0].texte);
console.log(`[${trouvees[0].url} — ${texte.length} car. de prose, extrait ${debut}-${debut + longueur}]\n`);
console.log(texte.slice(debut, debut + longueur));
