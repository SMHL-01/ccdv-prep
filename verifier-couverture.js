#!/usr/bin/env node
'use strict';
/**
 * verifier-couverture.js
 *
 * Verifie que chaque sous-domaine du blueprint CCDV-F a bien des sources dans
 * docs-corpus/. Un sous-domaine sans page correspondante est un TROU : les
 * questions de l'etape 2 ne pourraient pas etre sourcees, et la regle est
 * qu'une question non sourcable ne s'ecrit pas.
 *
 *   node verifier-couverture.js            tableau de synthese
 *   node verifier-couverture.js --detail   + les pages trouvees par sous-domaine
 *
 * Une page compte pour un sous-domaine si elle contient au moins DEUX mots-cles
 * distincts de son jeu. Le seuil de deux evite le bruit : "token" tout seul
 * apparait dans la moitie du corpus, "token" + "tokenizer" + "context window"
 * designe vraiment une page de fondamentaux.
 */

const fs = require('fs');
const path = require('path');

const DIR_CORPUS = path.join(__dirname, 'docs-corpus');
const FICHIER_BLUEPRINT = path.join(__dirname, 'blueprint.json');
const TOTAL_QUESTIONS = 400; // cible de l'etape 2
const SEUIL_MOTS_CLES = 2; // mots-cles distincts requis pour qu'une page compte
const SEUIL_FAIBLE = 3; // en dessous de ce nombre de pages, on signale

// --- Blueprint officiel ----------------------------------------------------
// Le blueprint vit dans blueprint.json, seule source de verite : ce script en
// lit les mots-cles, et l'application en lit les poids pour ponderer l'examen
// blanc. Une seule copie, donc pas de derive possible entre les deux.

const BLUEPRINT = JSON.parse(fs.readFileSync(FICHIER_BLUEPRINT, 'utf8')).domaines;

// --- Lecture du corpus -----------------------------------------------------

/** Decoupe les fichiers de docs-corpus/ en pages { titre, url, fichier, texte }. */
function lireCorpus() {
  if (!fs.existsSync(DIR_CORPUS)) {
    console.error(`Dossier introuvable : ${DIR_CORPUS}\nLancez d'abord : node aspirer-docs.js`);
    process.exit(1);
  }
  const pages = [];
  for (const fichier of fs.readdirSync(DIR_CORPUS).filter((f) => f.endsWith('.md')).sort()) {
    const contenu = fs.readFileSync(path.join(DIR_CORPUS, fichier), 'utf8');
    // Le corpus ecrit chaque page sous la forme :  # Titre / **Source :** URL / texte
    const blocs = contenu.split(/\n(?=# )/);
    for (const bloc of blocs) {
      const m = bloc.match(/^# (.+)\n+\*\*Source :\*\* (\S+)/);
      if (!m) continue; // en-tete de fichier ou sommaire : pas une page
      pages.push({ titre: m[1].trim(), url: m[2].trim(), fichier, texte: bloc.toLowerCase() });
    }
  }
  return pages;
}

// --- Comptage --------------------------------------------------------------

function evaluer(sousDomaine, pages) {
  const trouvees = [];
  for (const p of pages) {
    const touches = sousDomaine.motsCles.filter((k) => p.texte.includes(k));
    if (touches.length >= SEUIL_MOTS_CLES) trouvees.push({ page: p, touches: touches.length });
  }
  trouvees.sort((a, b) => b.touches - a.touches);
  const verdict = trouvees.length === 0 ? 'TROU' : trouvees.length < SEUIL_FAIBLE ? 'FAIBLE' : 'OK';
  return { trouvees, verdict };
}

// --- Sortie ----------------------------------------------------------------

function cadrer(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}

function main() {
  const detail = process.argv.includes('--detail');
  const pages = lireCorpus();
  console.log(`\nCorpus lu : ${pages.length} pages dans ${DIR_CORPUS}`);
  console.log(`Regle : une page compte si elle contient >= ${SEUIL_MOTS_CLES} mots-cles distincts du sous-domaine.\n`);

  const L = [42, 6, 5, 7, 7];
  console.log(
    cadrer('SOUS-DOMAINE', L[0]) + ' ' + cadrer('POIDS', L[1]) + ' ' + cadrer('QUEST', L[2]) + ' ' + cadrer('PAGES', L[3]) + ' ' + 'VERDICT'
  );
  console.log('-'.repeat(L.reduce((a, b) => a + b + 1, 0) + 7));

  const trous = [];
  const faibles = [];
  let nSousDomaines = 0;

  for (const d of BLUEPRINT) {
    console.log(`\n[${d.domaine} — ${d.poids} %]`);
    for (const sd of d.sousDomaines) {
      nSousDomaines++;
      const { trouvees, verdict } = evaluer(sd, pages);
      if (verdict === 'TROU') trous.push(sd.nom);
      if (verdict === 'FAIBLE') faibles.push(sd.nom);
      const questions = Math.round((TOTAL_QUESTIONS * sd.poids) / 100);
      console.log(
        '  ' +
          cadrer(sd.nom, L[0] - 2) +
          ' ' +
          cadrer(sd.poids.toFixed(1), L[1]) +
          ' ' +
          cadrer(questions, L[2]) +
          ' ' +
          cadrer(trouvees.length, L[3]) +
          ' ' +
          verdict
      );
      if (detail) {
        for (const t of trouvees.slice(0, 5)) {
          console.log(`        - ${t.touches} mots-cles  ${t.page.titre}  [${t.page.fichier}]`);
          console.log(`          ${t.page.url}`);
        }
        if (trouvees.length > 5) console.log(`        ... et ${trouvees.length - 5} autres pages`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`${nSousDomaines} sous-domaines evalues, ${BLUEPRINT.length} domaines, poids total ${BLUEPRINT.reduce((a, d) => a + d.poids, 0).toFixed(1)} %`);
  if (trous.length) {
    console.log(`\nTROUS (${trous.length}) — aucune source, ces questions ne peuvent pas etre ecrites :`);
    for (const t of trous) console.log(`  - ${t}`);
  } else {
    console.log('\nAucun trou : les 25 sous-domaines ont au moins une page source.');
  }
  if (faibles.length) {
    console.log(`\nCouverture mince (< ${SEUIL_FAIBLE} pages), a surveiller pendant la redaction :`);
    for (const f of faibles) console.log(`  - ${f}`);
  }
  console.log('');
  process.exitCode = trous.length ? 1 : 0;
}

main();
