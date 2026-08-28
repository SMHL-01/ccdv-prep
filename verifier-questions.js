#!/usr/bin/env node
'use strict';
/**
 * verifier-questions.js
 *
 * Controle qualite des deux banques de questions (doc et prepcourse), et
 * tenue de l index des concepts de la banque doc. Sur plusieurs centaines de
 * questions, la repetition et la derive des repartitions sont les deux
 * risques principaux : ce script les rend visibles apres chaque sous-domaine
 * ou topic.
 *
 *   node verifier-questions.js                tous les fichiers, les deux banques
 *   node verifier-questions.js <fichier.json> un seul fichier (cherche dans les deux)
 *   node verifier-questions.js --index        reecrit questions/_index-concepts.json (banque doc)
 *   node verifier-questions.js --hors-ligne  saute le controle des reservations sur origin/main
 *
 * Les deux banques sont verifiees avec les memes regles mais rapportees et
 * plafonnees SEPAREMENT (jamais melangees dans un seul total) : la banque doc
 * (questions/, un fichier par sous-domaine) et la banque prepcourse
 * (questions-prepcourse/, un fichier par topic, champ "source": "prepcourse").
 * Les deux partagent le meme corpus de sourcage, docs-corpus/ : un doc_ref
 * prepcourse doit exister dans docs-corpus/ tout comme un doc_ref doc, meme
 * si le contenu de la question vient de prepcourse-corpus/.
 *
 * Ce qui est verifie, par banque :
 *   - schema de chaque question et validite du JSON
 *   - repartition par nature (cible 65 / 30 / 5) et par difficulte (25 / 50 / 25)
 *   - plafond strict de 5 % de "factual_magnitude", evalue SUR LA BANQUE
 *     entiere et non fichier par fichier : par fichier il etait inatteignable,
 *     puisqu'il faut 20 questions pour qu'une seule tienne sous les 5 %.
 *   - repartition des bonnes reponses sur A, B, C, D
 *   - part de questions a reponses multiples (cible 20 %)
 *   - longueur des options : la bonne reponse ne doit pas etre reperable
 *   - explication presente pour CHAQUE mauvaise option
 *   - doc_ref reellement present dans docs-corpus/ (corpus partage)
 *   - plafond de 8 questions sur les API beta
 *   - doublons d identifiant et de concept, dans le fichier et vis-a-vis des
 *     autres fichiers DE LA MEME BANQUE -- pas de comparaison inter-banques :
 *     les deux corpus abordent parfois les memes faits sous un angle
 *     different (cours vs doc), ce n est pas une repetition a signaler.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR_QUESTIONS = path.join(__dirname, 'questions');
const DIR_QUESTIONS_PREPCOURSE = path.join(__dirname, 'questions-prepcourse');
const DIR_CORPUS = path.join(__dirname, 'docs-corpus');
const FICHIER_INDEX = path.join(DIR_QUESTIONS, '_index-concepts.json');
const RESERVATIONS_PREPCOURSE = path.join(__dirname, 'reservations-prepcourse.json');
const CIBLE_DEFAUT_PREPCOURSE = 8;

const BANQUES = [
  { nom: 'doc', dir: DIR_QUESTIONS, label: 'banque doc' },
  { nom: 'prepcourse', dir: DIR_QUESTIONS_PREPCOURSE, label: 'banque prepcourse' },
];

const CIBLES_NATURE = { judgment: 65, factual_semantic: 30, factual_magnitude: 5 };
const PLAFOND_MAGNITUDE = 5; // pour cent, strict
const CIBLES_DIFFICULTE = { facile: 25, moyen: 50, difficile: 25 };
const CIBLE_MULTI = 20; // pour cent
const PLAFOND_BETA = 8; // questions portant sur les API beta, tout le corpus
const ECART_LONGUEUR_MAX = 25; // caracteres, entre l option la plus courte et la plus longue

const NATURES = Object.keys(CIBLES_NATURE);
const DIFFICULTES = Object.keys(CIBLES_DIFFICULTE);
const CLES = ['A', 'B', 'C', 'D'];

// --- Corpus : les URL reellement disponibles pour le sourcage ---------------

let urlsCorpus = null;
function chargerUrlsCorpus() {
  if (urlsCorpus) return urlsCorpus;
  urlsCorpus = new Set();
  if (!fs.existsSync(DIR_CORPUS)) return urlsCorpus;
  for (const f of fs.readdirSync(DIR_CORPUS).filter((x) => x.endsWith('.md'))) {
    const contenu = fs.readFileSync(path.join(DIR_CORPUS, f), 'utf8');
    for (const m of contenu.matchAll(/^\*\*Source :\*\* (\S+)$/gm)) urlsCorpus.add(m[1]);
  }
  return urlsCorpus;
}

// --- Chargement -------------------------------------------------------------

function fichiersQuestions(dir, filtre) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .filter((f) => !filtre || f === path.basename(filtre))
    .sort()
    .map((f) => path.join(dir, f));
}

function charger(chemin) {
  const brut = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  const questions = Array.isArray(brut) ? brut : brut.questions || [];
  return { chemin, meta: Array.isArray(brut) ? {} : brut, questions };
}

// --- Controles unitaires ----------------------------------------------------

const CHAMPS = ['id', 'domain', 'subdomain', 'weight', 'type', 'nature', 'difficulty', 'concept', 'question_en', 'options', 'correct', 'explanation_fr', 'distractors_fr', 'doc_ref'];

function controlerQuestion(q, anomalies) {
  const ou = q.id || '(sans id)';
  for (const c of CHAMPS) {
    if (q[c] === undefined || q[c] === null) anomalies.push(`${ou} : champ manquant "${c}"`);
  }
  if (!NATURES.includes(q.nature)) anomalies.push(`${ou} : nature "${q.nature}" hors des trois valeurs admises`);
  if (!DIFFICULTES.includes(q.difficulty)) anomalies.push(`${ou} : difficulty "${q.difficulty}" hors des trois valeurs admises`);
  if (!['single', 'multi'].includes(q.type)) anomalies.push(`${ou} : type "${q.type}" invalide`);

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    anomalies.push(`${ou} : ${q.options ? q.options.length : 0} options au lieu de 4`);
    return;
  }
  const cles = q.options.map((o) => o.key);
  if (cles.join('') !== 'ABCD') anomalies.push(`${ou} : cles d options "${cles.join('')}" au lieu de ABCD`);

  if (!Array.isArray(q.correct) || !q.correct.length) {
    anomalies.push(`${ou} : aucune bonne reponse`);
    return;
  }
  if (q.type === 'single' && q.correct.length !== 1) anomalies.push(`${ou} : type single mais ${q.correct.length} bonnes reponses`);
  if (q.type === 'multi' && q.correct.length < 2) anomalies.push(`${ou} : type multi mais ${q.correct.length} bonne reponse`);
  for (const c of q.correct) if (!CLES.includes(c)) anomalies.push(`${ou} : bonne reponse "${c}" inconnue`);

  // Une question multi doit dire combien de reponses choisir.
  if (q.type === 'multi' && !/\b(TWO|THREE|two|three)\b/.test(q.question_en)) {
    anomalies.push(`${ou} : question multi dont l enonce n indique pas combien de reponses selectionner`);
  }

  // Longueurs : la bonne reponse ne doit pas etre reperable a l oeil.
  const longueurs = q.options.map((o) => (o.text_en || '').length);
  const ecart = Math.max(...longueurs) - Math.min(...longueurs);
  if (ecart > ECART_LONGUEUR_MAX) anomalies.push(`${ou} : ecart de longueur entre options de ${ecart} caracteres (max ${ECART_LONGUEUR_MAX})`);
  const lgBonnes = q.options.filter((o) => q.correct.includes(o.key)).map((o) => o.text_en.length);
  if (Math.max(...lgBonnes) === Math.max(...longueurs) && ecart > 12) {
    anomalies.push(`${ou} : la bonne reponse est l option la plus longue (ecart ${ecart})`);
  }

  // Une explication par mauvaise option.
  for (const o of q.options) {
    if (q.correct.includes(o.key)) continue;
    if (!q.distractors_fr || !q.distractors_fr[o.key]) anomalies.push(`${ou} : pas d explication pour l option fausse ${o.key}`);
  }

  // Sourcage : l URL doit exister dans le corpus.
  const urls = chargerUrlsCorpus();
  if (urls.size && q.doc_ref && !urls.has(q.doc_ref)) {
    anomalies.push(`${ou} : doc_ref absent du corpus -> ${q.doc_ref}`);
  }
}

// --- Repartitions -----------------------------------------------------------

function pourcent(n, total) {
  return total ? (100 * n) / total : 0;
}

function ligneRepartition(libelle, n, total, cible) {
  const p = pourcent(n, total);
  const ecart = cible === undefined ? '' : `  cible ${String(cible).padStart(2)} %  ecart ${(p - cible >= 0 ? '+' : '') + (p - cible).toFixed(1)}`;
  return `    ${libelle.padEnd(20)} ${String(n).padStart(3)}  ${p.toFixed(1).padStart(5)} %${ecart}`;
}

// Une question "porte sur une API beta" de deux facons, et le plafond doit
// voir les deux.
//
// 1. Par l'URL citee. Toute page api/beta ou managed-agents/* documente une
//    surface gatee par en-tete beta : managed-agents/overview dit textuellement
//    "Claude Managed Agents is in beta. All Managed Agents endpoints require
//    the managed-agents-2026-04-01 beta header". Motif grossier -- il teste un
//    emplacement pour deduire un statut -- mais zero faux positif mesure sur
//    les 690 questions des deux banques.
//
// 2. Par le mecanisme que la question exige de connaitre. Une fonction beta
//    documentee sur une page stable etait invisible : 10 questions prepcourse
//    citent un en-tete ou un statut beta dans leur propre texte, une seule
//    etait vue par le motif URL.
//
// Le test de contenu s'applique a l'ENONCE et a la BONNE REPONSE seulement, et
// c'est la restriction qui rend la regle juste. Une mention beta dans
// explanation_fr ou dans un distracteur est du contexte ; ce qui doit compter,
// c'est ce qu'il faut savoir pour repondre juste.
//
// Ne pas remonter ce test au niveau de la page : mesure a 50 pages sur 479,
// soit 70 questions contre un plafond de 8, et faux en plus d'etre inutilisable
// (context-windows porte 12 questions et n'est pas une page beta, elle cite des
// sous-fonctions beta en passant). Voir NOTE-detecteur-beta.md.

const MOTIF_BETA_URL = /api\/beta|managed-agents/;
const MOTIF_BETA_MECANISME = /anthropic-beta|\bbetas\b|beta header|\(beta\)|\bin beta\b/i;

function porteSurBeta(q) {
  if (MOTIF_BETA_URL.test(q.doc_ref || '')) return true;
  const correctes = new Set(q.correct || []);
  const texte = [q.question_en || '', q.question_fr || '']
    .concat((q.options || []).filter((o) => correctes.has(o.key)).map((o) => o.text_en || ''))
    .join(' ');
  return MOTIF_BETA_MECANISME.test(texte);
}

function analyser(questions) {
  const parNature = {};
  const parDifficulte = {};
  const parCle = { A: 0, B: 0, C: 0, D: 0 };
  let multi = 0;
  let beta = 0;
  for (const q of questions) {
    parNature[q.nature] = (parNature[q.nature] || 0) + 1;
    parDifficulte[q.difficulty] = (parDifficulte[q.difficulty] || 0) + 1;
    for (const c of q.correct || []) parCle[c] = (parCle[c] || 0) + 1;
    if (q.type === 'multi') multi++;
    if (porteSurBeta(q)) beta++;
  }
  return { parNature, parDifficulte, parCle, multi, beta };
}

// --- Reservations de la banque prepcourse ------------------------------------
//
// Le protocole dit : on ne commence a ecrire un topic qu'APRES avoir POUSSE sa
// reservation. Une reservation restee en local ne protege de rien, l'autre
// personne ne la voit pas. C'est exactement ce qui s'est passe sur
// m2-2.1-prompting : le commit de reservation et le commit de questions sont
// partis dans le meme push, donc la reservation n'etait pas visible cote distant
// pendant l'ecriture. D'ou la lecture de reservations-prepcourse.json sur
// origin/main, et pas de la copie locale.

function git(args) {
  return execFileSync('git', args, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function reservationsDistantes() {
  try {
    git(['fetch', '--quiet', 'origin', 'main']);
  } catch (e) {
    return { ok: false, raison: `git fetch origin main a echoue : ${String(e.message || e).split('\n')[0]}` };
  }
  try {
    return { ok: true, reservations: JSON.parse(git(['show', 'origin/main:reservations-prepcourse.json'])).reservations || {} };
  } catch (e) {
    return { ok: false, raison: `reservations-prepcourse.json illisible sur origin/main : ${String(e.message || e).split('\n')[0]}` };
  }
}

function controlerReservationsPrepcourse(horsLigne, anomalies) {
  const locales = JSON.parse(fs.readFileSync(RESERVATIONS_PREPCOURSE, 'utf8')).reservations || {};
  const distant = horsLigne ? null : reservationsDistantes();

  // On regarde le repertoire, pas la liste des fichiers charges : le controle
  // doit se declencher sur l'EXISTENCE du fichier de questions, pas sur son
  // remplissage, sinon il suffirait de creer le fichier vide d'abord pour le
  // contourner.
  const avecFichier = new Set(
    fichiersQuestions(DIR_QUESTIONS_PREPCOURSE, null).map((f) => path.basename(f, '.json'))
  );
  const topics = [...new Set([...Object.keys(locales), ...avecFichier])].sort();

  console.log('\n=== [prepcourse] reservations');
  if (horsLigne) {
    console.log('  --hors-ligne : controle sur origin/main SAUTE, la reservation distante n\'est pas verifiee.');
  } else if (!distant.ok) {
    anomalies.push(`reservations prepcourse : ${distant.raison}`);
    console.log(`  ${distant.raison}`);
    console.log('  Impossible de savoir si les topics sont reserves cote distant. Relancer connecte, ou assumer avec --hors-ligne.');
  }

  // Une cible est obligatoire des qu'un topic est reserve ou fait, meme sans
  // fichier de questions : elle se decide en reservant, pas en ecrivant.
  for (const [topic, r] of Object.entries(locales)) {
    if ((r.etat === 'reserve' || r.etat === 'fait') && r.cible === undefined) {
      anomalies.push(`${topic} : etat "${r.etat}" sans champ "cible" dans reservations-prepcourse.json — la cible se fixe a la reservation`);
    }
  }

  for (const topic of topics) {
    const l = locales[topic];
    const ecrit = avecFichier.has(topic);

    // Une cible est un engagement pris AVANT d'ecrire, pas une mesure ajustee
    // apres. La reviser reste possible — un chapitre peut s'averer plus mince
    // que prevu — mais jamais en silence : anomalie, pas blocage.
    if (l && distant && distant.ok && ecrit) {
      const r = distant.reservations[topic];
      if (r && r.cible !== undefined && l.cible !== undefined && r.cible !== l.cible) {
        anomalies.push(`${topic} : cible modifiee (${r.cible} sur origin/main -> ${l.cible} en local) alors que le fichier de questions existe deja. Une cible se revise AVANT d'ecrire. Si c'est voulu, le justifier dans le message de commit.`);
        console.log(`  ${topic} : cible ${r.cible} -> ${l.cible} APRES creation du fichier de questions`);
      }
    }

    if (!ecrit) continue;

    if (!l) {
      anomalies.push(`${topic} : des questions sont ecrites alors que le topic n'est pas reserve du tout dans reservations-prepcourse.json`);
      console.log(`  ${topic} : NON RESERVE, meme en local`);
      continue;
    }
    if (l.cible === undefined) {
      // Repli sur 8, mais jamais en silence : c'est une anomalie a corriger.
      anomalies.push(`${topic} : reservation sans "cible" — repli sur ${CIBLE_DEFAUT_PREPCOURSE}, a fixer explicitement dans reservations-prepcourse.json`);
      console.log(`  ${topic} : cible absente, repli sur ${CIBLE_DEFAUT_PREPCOURSE}`);
    } else if (!Number.isInteger(l.cible) || l.cible <= 0) {
      anomalies.push(`${topic} : cible invalide (${JSON.stringify(l.cible)}), entier strictement positif attendu`);
    }

    if (!distant || !distant.ok) continue;
    const r = distant.reservations[topic];
    if (!r) {
      anomalies.push(`${topic} : reserve en local mais ABSENT de reservations-prepcourse.json sur origin/main — pousser la reservation AVANT d'ecrire les questions`);
      console.log(`  ${topic} : absent d'origin/main`);
    } else if (r.etat !== 'reserve' && r.etat !== 'fait') {
      anomalies.push(`${topic} : etat "${r.etat}" sur origin/main — "propose" n'est pas une reservation, pousser l'etat "reserve" AVANT d'ecrire`);
      console.log(`  ${topic} : etat "${r.etat}" sur origin/main, ce n'est pas une reservation`);
    } else if (r.cible === undefined) {
      anomalies.push(`${topic} : reserve sur origin/main sans "cible" — pousser la cible avec la reservation`);
      console.log(`  ${topic} : reserve sur origin/main, mais sans cible`);
    } else {
      console.log(`  ${topic} : reserve sur origin/main (${r.etat}, cible ${r.cible})`);
    }
  }
}

// --- Programme principal ----------------------------------------------------

function traiterBanque(banque, filtre, anomaliesGlobales) {
  const fichiers = fichiersQuestions(banque.dir, filtre);
  if (!fichiers.length) return null;

  const index = [];
  const toutes = [];

  for (const chemin of fichiers) {
    const nom = path.basename(chemin);
    let charge;
    try {
      charge = charger(chemin);
    } catch (e) {
      // Un fichier vide ou casse doit produire une anomalie lisible, pas une
      // stack trace : sinon il interrompt tous les autres controles au passage.
      const msg = `[${banque.nom}] ${nom} : fichier illisible (${String(e.message || e).split('\n')[0]})`;
      console.log(`\n=== ${msg}`);
      anomaliesGlobales.push(msg);
      continue;
    }
    const { meta, questions } = charge;
    const anomalies = [];
    const vusIds = new Set();
    const vusConcepts = new Map();

    for (const q of questions) {
      controlerQuestion(q, anomalies);
      if (vusIds.has(q.id)) anomalies.push(`${q.id} : identifiant en double dans le fichier`);
      vusIds.add(q.id);
      const cle = (q.concept || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (cle && vusConcepts.has(cle)) anomalies.push(`${q.id} : concept deja teste par ${vusConcepts.get(cle)}`);
      if (cle) vusConcepts.set(cle, q.id);
      index.push({ id: q.id, fichier: nom, subdomain: q.subdomain, concept: q.concept, doc_ref: q.doc_ref });
      toutes.push(q);
    }

    const a = analyser(questions);
    console.log(`\n=== [${banque.nom}] ${nom}`);
    console.log(`    ${meta.subdomain || '?'} — poids ${meta.weight || '?'} % — ${questions.length} questions` + (meta.target_questions ? ` (cible ${meta.target_questions})` : ''));
    console.log('\n  Nature :');
    for (const n of NATURES) console.log(ligneRepartition(n, a.parNature[n] || 0, questions.length, CIBLES_NATURE[n]));
    console.log('\n  Difficulte :');
    for (const d of DIFFICULTES) console.log(ligneRepartition(d, a.parDifficulte[d] || 0, questions.length, CIBLES_DIFFICULTE[d]));
    console.log('\n  Forme :');
    console.log(ligneRepartition('reponses multiples', a.multi, questions.length, CIBLE_MULTI));
    const totalCles = Object.values(a.parCle).reduce((x, y) => x + y, 0);
    console.log('\n  Bonnes reponses :');
    for (const c of CLES) console.log(ligneRepartition(`option ${c}`, a.parCle[c], totalCles, 25));

    // Le plafond de factual_magnitude s'evalue sur la BANQUE, pas ici : voir la
    // synthese finale. La contrainte reelle est « pas plus de 5 % de questions
    // de pur chiffre a l'examen », qui est une propriete globale. L'appliquer
    // fichier par fichier la rendait inatteignable : a 5 % strict, il faut au
    // moins 20 questions pour qu'une seule tienne (1/20 = 5,0 %, 1/19 = 5,3 %),
    // or 17 des 25 sous-domaines pesent moins que ca au blueprint.

    if (anomalies.length) {
      console.log(`\n  ${anomalies.length} anomalie(s) :`);
      for (const x of anomalies) console.log('    ! ' + x);
      anomaliesGlobales.push(...anomalies.map((x) => `[${banque.nom}] ${nom} : ${x}`));
    } else {
      console.log('\n  Aucune anomalie.');
    }
  }

  // --- Synthese sur cette banque, jamais melangee avec l autre ---
  const a = analyser(toutes);
  console.log('\n' + '='.repeat(64));
  console.log(`${banque.label.toUpperCase()} : ${toutes.length} questions, ${fichiers.length} fichier(s)`);
  console.log('\n  Nature :');
  for (const n of NATURES) console.log(ligneRepartition(n, a.parNature[n] || 0, toutes.length, CIBLES_NATURE[n]));
  console.log('\n  Difficulte :');
  for (const d of DIFFICULTES) console.log(ligneRepartition(d, a.parDifficulte[d] || 0, toutes.length, CIBLES_DIFFICULTE[d]));
  const pctMagnitude = pourcent(a.parNature.factual_magnitude || 0, toutes.length);
  console.log(`\n  factual_magnitude : ${a.parNature.factual_magnitude || 0} questions, ${pctMagnitude.toFixed(1)} % (plafond ${PLAFOND_MAGNITUDE} % sur ${banque.label})`);
  if (pctMagnitude > PLAFOND_MAGNITUDE) {
    anomaliesGlobales.push(`[${banque.nom}] plafond depasse : ${pctMagnitude.toFixed(1)} % de factual_magnitude (max ${PLAFOND_MAGNITUDE} %)`);
  }

  console.log(`\n  Questions portant sur une API beta : ${a.beta} (plafond ${PLAFOND_BETA})`);
  if (a.beta > PLAFOND_BETA) anomaliesGlobales.push(`[${banque.nom}] plafond beta depasse : ${a.beta} questions (max ${PLAFOND_BETA})`);

  // Identifiants dupliques entre fichiers DE CETTE BANQUE. Le controle par
  // fichier ne suffit pas : deux sous-domaines/topics dont les initiales se
  // rejoignent produisent le meme prefixe, et l'application indexe ses
  // questions par identifiant -- une collision y fait disparaitre une
  // question au profit de son homonyme, et confond leur progression en
  // repetition espacee.
  const parId = new Map();
  for (const e of index) {
    if (!parId.has(e.id)) parId.set(e.id, []);
    parId.get(e.id).push(e.fichier);
  }
  const idsEnDouble = [...parId.entries()].filter(([, f]) => f.length > 1);
  if (idsEnDouble.length) {
    console.log(`\n  ${idsEnDouble.length} identifiant(s) partage(s) par plusieurs fichiers :`);
    for (const [id, f] of idsEnDouble) console.log(`    ! ${id} — ${[...new Set(f)].join(', ')}`);
    anomaliesGlobales.push(`[${banque.nom}] ${idsEnDouble.length} identifiant(s) en double entre fichiers`);
  }

  // Doublons de concept entre fichiers DE CETTE BANQUE. Pas de comparaison
  // avec l autre banque : voir la note en tete de fichier.
  const parConcept = new Map();
  for (const e of index) {
    const cle = (e.concept || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!cle) continue;
    if (!parConcept.has(cle)) parConcept.set(cle, []);
    parConcept.get(cle).push(e.id);
  }
  const doublons = [...parConcept.entries()].filter(([, ids]) => ids.length > 1);
  if (doublons.length) {
    console.log(`\n  ${doublons.length} concept(s) teste(s) plus d une fois :`);
    for (const [c, ids] of doublons) console.log(`    ! ${ids.join(', ')} — ${c}`);
    anomaliesGlobales.push(`[${banque.nom}] ${doublons.length} concept(s) en double`);
  }

  return { fichiers, index, toutes };
}

function main() {
  const args = process.argv.slice(2);
  const reecrireIndex = args.includes('--index');
  const horsLigne = args.includes('--hors-ligne');
  const filtre = args.find((a) => a.endsWith('.json'));

  const anomaliesGlobales = [];

  // D'abord le protocole de reservation : il doit tourner meme si un fichier de
  // questions est casse, sinon un fichier vide suffirait a le faire sauter.
  if (fs.existsSync(RESERVATIONS_PREPCOURSE)) {
    controlerReservationsPrepcourse(horsLigne, anomaliesGlobales);
  }

  const resultats = {};
  for (const banque of BANQUES) {
    resultats[banque.nom] = traiterBanque(banque, filtre, anomaliesGlobales);
  }

  const banquesTraitees = BANQUES.filter((b) => resultats[b.nom]);
  if (!banquesTraitees.length) {
    console.error(`Aucun fichier de questions dans ${BANQUES.map((b) => path.relative(__dirname, b.dir) + '/').join(' ni ')}`);
    process.exit(1);
  }

  if (reecrireIndex) {
    // On n'ecrit jamais l'index a partir d'une banque qui ne passe pas les
    // controles : sinon un `--index` lance par reflexe grave dans un fichier
    // genere l'etat d'une banque cassee, et le probleme devient invisible.
    if (anomaliesGlobales.length) {
      console.error(`\n  Index des concepts NON reecrit : ${anomaliesGlobales.length} anomalie(s) a corriger d'abord.`);
      console.error('  Corriger, relancer `npm run questions` jusqu\'au vert, puis `npm run index`.');
      process.exit(1);
    }
    const indexDoc = resultats.doc ? resultats.doc.index : [];
    fs.writeFileSync(FICHIER_INDEX, JSON.stringify(indexDoc, null, 2), 'utf8');
    console.log(`\n  Index des concepts reecrit : ${indexDoc.length} entrees -> questions/_index-concepts.json (banque doc)`);
  }

  console.log('');
  if (anomaliesGlobales.length) {
    console.log(`${anomaliesGlobales.length} anomalie(s) au total.`);
    process.exitCode = 1;
  } else {
    console.log('Tous les controles passent.');
  }
}

main();
