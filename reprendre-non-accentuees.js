'use strict';
/* Efface les champs francais des questions revenues sans aucun accent, pour que
   traduire-questions.js — strictement additif — les regenere seules. */

const fs = require('fs');
const path = require('path');

const ACC = /[éèêëàâäîïôöùûüçÉÈÊÀÂÎÔÙÇ]/g;
const DIR = 'questions';

let reprises = 0;
let champs = 0;
const detail = [];

for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue;
  const chemin = path.join(DIR, f);
  const contenu = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  const lot = Array.isArray(contenu) ? contenu : contenu.questions;
  let touche = 0;

  for (const q of lot) {
    const texte = [
      q.question_fr,
      q.principe_fr,
      ...(q.citations_fr || []),
      ...(q.options || []).map((o) => o.text_fr),
    ]
      .filter(Boolean)
      .join(' ');

    // Seuil de 150 caracteres : en dessous, une absence d'accent peut etre
    // legitime. Au-dessus, du francais sans le moindre accent ne l'est pas.
    if (texte.length <= 150 || (texte.match(ACC) || []).length > 0) continue;

    if ('question_fr' in q) { delete q.question_fr; champs++; }
    if ('citations_fr' in q) { delete q.citations_fr; champs++; }
    if ('principe_fr' in q) { delete q.principe_fr; champs++; }
    for (const o of q.options || []) {
      if ('text_fr' in o) { delete o.text_fr; champs++; }
    }
    reprises++;
    touche++;
  }

  if (touche) {
    fs.writeFileSync(chemin, JSON.stringify(contenu, null, 2) + '\n');
    detail.push(`  ${String(touche).padStart(2)}  ${f}`);
  }
}

console.log(`${reprises} question(s) a reprendre, ${champs} champ(s) efface(s) :`);
for (const d of detail) console.log(d);

// Garde-fou : rien d'autre que les champs traduits n'a bouge.
let intactes = 0;
let total = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue;
  const contenu = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const q of Array.isArray(contenu) ? contenu : contenu.questions) {
    total++;
    if (q.question_en && q.correct && q.explanation_fr) intactes++;
  }
}
console.log(`Garde-fou : ${intactes}/${total} questions gardent question_en, correct et explanation_fr.`);
