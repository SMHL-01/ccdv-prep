#!/usr/bin/env node
'use strict';
/**
 * generer-manifeste.js — construit questions/_manifeste.json.
 *
 * Le manifeste ne contient que les METADONNEES de chaque question : de quoi
 * calculer la couverture, remplir les filtres et tirer un examen, sans charger
 * une seule option ni une seule explication.
 *
 * C'est ce qui permet a l'application de rester legere au demarrage : a 400
 * questions, les enonces, les quatre options, les explications et les
 * justifications de chaque distracteur pesent plusieurs mega-octets, dont on
 * n'a besoin qu'au moment ou une serie commence.
 *
 * Lance automatiquement par "npm run build" et "npm run dev" (scripts prebuild
 * et predev), donc jamais a jour par accident.
 */

const fs = require('fs');
const path = require('path');

const DIR_QUESTIONS = path.join(__dirname, 'questions');
const SORTIE = path.join(DIR_QUESTIONS, '_manifeste.json');

/** Champs retenus : strictement ce dont l'app a besoin avant une serie. */
function metadonnees(q, fichier) {
  return {
    id: q.id,
    domain: q.domain,
    subdomain: q.subdomain,
    difficulty: q.difficulty || 'moyen',
    nature: q.nature || 'judgment',
    type: q.type || (Array.isArray(q.correct) && q.correct.length > 1 ? 'multi' : 'single'),
    fichier,
  };
}

function main() {
  if (!fs.existsSync(DIR_QUESTIONS)) {
    console.error(`Dossier introuvable : ${DIR_QUESTIONS}`);
    process.exit(1);
  }

  const fichiers = fs
    .readdirSync(DIR_QUESTIONS)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort();

  const questions = [];
  const parFichier = [];

  for (const fichier of fichiers) {
    const brut = JSON.parse(fs.readFileSync(path.join(DIR_QUESTIONS, fichier), 'utf8'));
    const lot = Array.isArray(brut) ? brut : brut.questions || [];
    for (const q of lot) questions.push(metadonnees(q, fichier));
    parFichier.push({ fichier, subdomain: brut.subdomain || null, nb: lot.length });
  }

  const manifeste = {
    commentaire:
      'Genere par generer-manifeste.js. Metadonnees uniquement : les enonces, options et explications sont charges a la demande, fichier par fichier, au lancement d une serie.',
    genere: new Date().toISOString().slice(0, 10),
    nbQuestions: questions.length,
    fichiers: parFichier,
    questions,
  };

  fs.writeFileSync(SORTIE, JSON.stringify(manifeste, null, 2) + '\n', 'utf8');

  const octets = fs.statSync(SORTIE).size;
  console.log(
    `Manifeste : ${questions.length} questions, ${fichiers.length} fichier(s), ${(octets / 1024).toFixed(1)} Ko -> questions/_manifeste.json`
  );
}

main();
