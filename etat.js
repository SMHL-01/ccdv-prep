#!/usr/bin/env node
'use strict';
/**
 * etat.js — ou en est le projet, sous-domaine par sous-domaine.
 *
 *   node etat.js              tableau a l'ecran, n'ecrit rien
 *   node etat.js --ecrire     + reecrit la ZONE generee d'ETAT.md, celle qui se
 *                               lit sur GitHub sans cloner. Uniquement ce qui est
 *                               entre <!-- etat:debut --> et <!-- etat:fin --> ;
 *                               marqueur manquant, double ou inverse = echec, code
 *                               de sortie 1, fichier intact.
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

// La zone generee est delimitee dans ETAT.md. Tout ce qui est HORS de ces deux
// marqueurs est du contenu tenu a la main et n'est jamais touche : avant cette
// regle, `--ecrire` faisait un writeFileSync du fichier entier et supprimait
// silencieusement la section « Les deux banques » ajoutee a la main. Si les
// marqueurs manquent, sont en double ou inverses, on ECHOUE : jamais de retour
// au comportement « je reecris tout ».
const MARQUEUR_DEBUT = '<!-- etat:debut -->';
const MARQUEUR_FIN = '<!-- etat:fin -->';

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

// Rend UNIQUEMENT le bloc a placer entre les marqueurs. Le titre du fichier et
// tout autre paragraphe restent hors zone, donc a la main.
function rendreMarkdown({ lignes, personnes }, jour) {
  const t = totaux(lignes);
  const L = [];
  L.push(`> Zone generee par \`node etat.js --ecrire\` le ${jour} — banque doc uniquement. Ne rien editer a la main entre les marqueurs : la seule facon de faire bouger ce tableau est d'ecrire des questions, ou de modifier \`reservations.json\`. Ce qui est hors des marqueurs n'est jamais touche par le script.`);
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
  return L.join('\n').trim();
}

// Un marqueur ne compte que s'il occupe sa propre ligne : la banniere du fichier
// cite les deux marqueurs dans une phrase, et une detection par sous-chaine les
// aurait comptes en double.
function positions(lignes, marqueur) {
  const p = [];
  lignes.forEach((l, i) => { if (l.trim() === marqueur) p.push(i); });
  return p;
}

function echouer(raison, remede) {
  console.error(`\n  ETAT.md NON reecrit : ${raison}`);
  console.error(`  ${remede}`);
  console.error(`  Aucune ecriture n'a eu lieu, le fichier est intact.\n`);
  process.exit(1);
}

function ecrireZone(donnees) {
  const jour = new Date().toISOString().slice(0, 10);
  let bloc = rendreMarkdown(donnees, jour);

  if (!fs.existsSync(SORTIE)) {
    // Rien a preserver : on cree le fichier avec ses marqueurs.
    fs.writeFileSync(SORTIE, ['# Ou en est ccdv-prep', '', MARQUEUR_DEBUT, bloc, MARQUEUR_FIN, ''].join('\n'), 'utf8');
    console.log('  ETAT.md etait absent : cree, avec ses marqueurs et la zone generee.\n');
    return;
  }

  const avant = fs.readFileSync(SORTIE, 'utf8');
  const lignes = avant.split('\n');
  const pDebut = positions(lignes, MARQUEUR_DEBUT);
  const pFin = positions(lignes, MARQUEUR_FIN);

  if (pDebut.length === 0 || pFin.length === 0) {
    echouer(
      `marqueur ${pDebut.length === 0 ? MARQUEUR_DEBUT : MARQUEUR_FIN} absent (il doit occuper sa propre ligne).`,
      `Encadrer la zone generee — du resume chiffre jusqu'a la fin des tableaux — par ${MARQUEUR_DEBUT} et ${MARQUEUR_FIN}, chacun seul sur sa ligne, puis relancer.`
    );
  }
  if (pDebut.length > 1 || pFin.length > 1) {
    echouer(
      `marqueur en double (${pDebut.length} debut, ${pFin.length} fin) : impossible de savoir quelle zone reecrire.`,
      'Ne garder qu\'une seule paire de marqueurs, puis relancer.'
    );
  }
  if (pDebut[0] > pFin[0]) {
    echouer(
      `marqueurs inverses : ${MARQUEUR_FIN} est ligne ${pFin[0] + 1}, ${MARQUEUR_DEBUT} ligne ${pDebut[0] + 1}.`,
      `Remettre ${MARQUEUR_DEBUT} avant ${MARQUEUR_FIN}, puis relancer.`
    );
  }

  const tete = lignes.slice(0, pDebut[0] + 1).join('\n');
  const queue = lignes.slice(pFin[0]).join('\n');
  const ancien = lignes.slice(pDebut[0] + 1, pFin[0]).join('\n').trim();

  // Idempotence : si seule la date de generation change, on garde l'ancienne.
  // Sinon deux lancements a un jour d'intervalle produiraient un diff git non
  // vide sans qu'aucun avancement n'ait bouge, et les vraies regressions se
  // noieraient dans ce bruit.
  const sansDate = (x) => x.replace(/le \d{4}-\d{2}-\d{2}/, 'le <date>');
  if (sansDate(ancien) === sansDate(bloc)) bloc = ancien;

  const apres = `${tete}\n\n${bloc}\n\n${queue}`;
  if (apres === avant) {
    console.log('  ETAT.md inchange : la zone generee etait deja a jour.\n');
    return;
  }
  fs.writeFileSync(SORTIE, apres, 'utf8');
  console.log('  ETAT.md : zone generee reecrite, contenu hors marqueurs preserve.\n');
}

function main() {
  const donnees = collecter();
  console.log(rendreTexte(donnees));
  if (process.argv.includes('--ecrire')) ecrireZone(donnees);
}

main();
