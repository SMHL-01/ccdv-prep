#!/usr/bin/env node
'use strict';
/**
 * etat.js — ou en est le projet, sous-domaine par sous-domaine.
 *
 *   node etat.js              tableau a l'ecran
 *   node etat.js --ecrire     + reecrit ETAT.md, qui se lit sur GitHub sans cloner
 *
 * Trois sources, aucune saisie manuelle du chiffre d'avancement :
 *   blueprint.json          les 25 sous-domaines et leurs poids
 *   questions/_manifeste.json  ce qui est REELLEMENT ecrit
 *   reservations.json       qui s'est attribue quoi
 *
 * C'est le seul endroit ou lire l'avancement. verifier-couverture.js repond a
 * une autre question — « la doc permet-elle d'ecrire ces questions ? » — et sa
 * colonne des questions attendues est une CIBLE, jamais un decompte.
 */

const fs = require('fs');
const path = require('path');

const BLUEPRINT = path.join(__dirname, 'blueprint.json');
const MANIFESTE = path.join(__dirname, 'questions', '_manifeste.json');
const RESERVATIONS = path.join(__dirname, 'reservations.json');
const SORTIE = path.join(__dirname, 'ETAT.md');

const TOTAL_QUESTIONS = 400;

const lire = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function collecter() {
  const domaines = lire(BLUEPRINT).domaines;
  const res = lire(RESERVATIONS);

  let ecrites = new Map();
  if (fs.existsSync(MANIFESTE)) {
    for (const f of lire(MANIFESTE).fichiers) ecrites.set(f.subdomain, f.nb);
  }

  const lignes = [];
  for (const d of domaines) {
    for (const sd of d.sousDomaines) {
      const nb = ecrites.get(sd.nom) || 0;
      const cible = Math.round((TOTAL_QUESTIONS * sd.poids) / 100);
      const r = res.reservations[sd.nom] || {};
      // L'etat se deduit du manifeste, pas de ce qui est declare : personne ne
      // peut afficher « fait » sur un sous-domaine ou rien n'est ecrit.
      let etat;
      if (nb >= cible && nb > 0) etat = 'fait';
      else if (nb > 0) etat = 'en cours';
      else if (r.qui) etat = r.etat === 'propose' ? 'propose' : 'reserve';
      else etat = 'libre';
      lignes.push({
        domaine: d.domaine,
        nom: sd.nom,
        poids: sd.poids,
        nb,
        cible,
        qui: r.qui || null,
        etat,
        note: r.note || null,
      });
    }
  }
  return { lignes, personnes: res.personnes };
}

function totaux(lignes) {
  const t = { ecrites: 0, cible: 0, poidsCouvert: 0, faits: 0 };
  for (const l of lignes) {
    t.ecrites += l.nb;
    t.cible += l.cible;
    if (l.nb > 0) {
      t.poidsCouvert += l.poids;
      if (l.etat === 'fait') t.faits++;
    }
  }
  return t;
}

function parPersonne(lignes, personnes) {
  const out = new Map();
  for (const cle of Object.keys(personnes)) out.set(cle, { ecrites: 0, restantes: 0, sd: 0 });
  for (const l of lignes) {
    if (!l.qui || !out.has(l.qui)) continue;
    const p = out.get(l.qui);
    p.ecrites += l.nb;
    if (l.etat !== 'fait') {
      p.restantes += Math.max(0, l.cible - l.nb);
      p.sd++;
    }
  }
  return out;
}

const SYMBOLE = { fait: '[x]', 'en cours': '[~]', reserve: '[ ]', propose: '[?]', libre: '[ ]' };

function rendreTexte({ lignes, personnes }) {
  const t = totaux(lignes);
  const L = [];
  L.push('');
  L.push(`  ${t.ecrites} / ${TOTAL_QUESTIONS} questions  —  ${t.poidsCouvert.toFixed(1)} % du poids de l'examen couvert  —  ${t.faits} / ${lignes.length} sous-domaines termines`);
  L.push('');
  let domaineCourant = null;
  for (const l of lignes) {
    if (l.domaine !== domaineCourant) {
      domaineCourant = l.domaine;
      L.push(`  [${l.domaine}]`);
    }
    const qui = l.qui ? l.qui : '—';
    L.push(
      `    ${SYMBOLE[l.etat]} ${l.nom.padEnd(38)} ${String(l.nb).padStart(3)} / ${String(l.cible).padEnd(3)}  ${String(l.poids).padStart(4)} %  ${qui.padEnd(12)} ${l.etat}`
    );
  }
  L.push('');
  L.push('  Charge restante :');
  for (const [cle, p] of parPersonne(lignes, personnes)) {
    L.push(`    ${cle.padEnd(12)} ${String(p.restantes).padStart(3)} questions a ecrire, sur ${p.sd} sous-domaine(s)  (${p.ecrites} deja ecrites)`);
  }
  const libres = lignes.filter((l) => l.etat === 'libre');
  if (libres.length) {
    L.push('');
    L.push(`  Non attribues (${libres.length}) : ${libres.map((l) => l.nom).join(', ')}`);
  }
  L.push('');
  return L.join('\n');
}

function rendreMarkdown({ lignes, personnes }) {
  const t = totaux(lignes);
  const jour = new Date().toISOString().slice(0, 10);
  const L = [];
  L.push('# Ou en est ccdv-prep');
  L.push('');
  L.push(`> Genere par \`node etat.js --ecrire\` le ${jour}. Ne pas editer a la main : la seule facon de faire bouger ce tableau est d'ecrire des questions, ou de modifier \`reservations.json\`.`);
  L.push('');
  L.push(`**${t.ecrites} / ${TOTAL_QUESTIONS} questions** — **${t.poidsCouvert.toFixed(1)} %** du poids de l'examen couvert — **${t.faits} / ${lignes.length}** sous-domaines termines.`);
  L.push('');
  L.push('## Charge restante');
  L.push('');
  L.push('| Qui | Questions a ecrire | Sous-domaines ouverts | Deja ecrites |');
  L.push('| --- | ---: | ---: | ---: |');
  for (const [cle, p] of parPersonne(lignes, personnes)) {
    L.push(`| ${personnes[cle]} | ${p.restantes} | ${p.sd} | ${p.ecrites} |`);
  }
  L.push('');
  L.push('## Les 25 sous-domaines');
  L.push('');
  L.push('`[x]` termine · `[~]` commence · `[ ]` reserve, rien d\'ecrit · `[?]` propose, a confirmer');
  L.push('');
  let domaineCourant = null;
  for (const l of lignes) {
    if (l.domaine !== domaineCourant) {
      domaineCourant = l.domaine;
      L.push('');
      L.push(`### ${l.domaine}`);
      L.push('');
      L.push('| | Sous-domaine | Ecrites | Cible | Poids | Qui |');
      L.push('| --- | --- | ---: | ---: | ---: | --- |');
    }
    const qui = l.qui ? personnes[l.qui] || l.qui : '—';
    const note = l.note ? ` <br><sub>${l.note}</sub>` : '';
    L.push(`| \`${SYMBOLE[l.etat]}\` | ${l.nom}${note} | ${l.nb} | ${l.cible} | ${l.poids} % | ${qui} |`);
  }
  L.push('');
  return L.join('\n') + '\n';
}

function main() {
  const donnees = collecter();
  console.log(rendreTexte(donnees));
  if (process.argv.includes('--ecrire')) {
    fs.writeFileSync(SORTIE, rendreMarkdown(donnees), 'utf8');
    console.log(`  ETAT.md reecrit.\n`);
  }
}

main();
