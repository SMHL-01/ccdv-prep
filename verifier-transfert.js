#!/usr/bin/env node
'use strict';
/**
 * verifier-transfert.js — l'export produit-il un fichier valide, et l'import
 * le relit-il sans perte ?
 *
 * Les deux modules verifies (src/stockage.js, src/transfert.js) sont des
 * modules ES, alors que les outils de ce depot sont en CommonJS. Plutot que de
 * basculer tout le paquet en "type": "module" pour un seul script, on les
 * charge via une URL data: — ce que `import()` accepte depuis CommonJS. Ni
 * l'un ni l'autre n'importe quoi que ce soit, donc rien a resoudre.
 *
 * Le localStorage est simule par une Map : stockage.js n'y touche qu'a
 * l'appel, jamais au chargement du module.
 *
 * Une derniere section passe par le pipeline SSR de Vite pour exercer le VRAI
 * chemin d'export — celui qui traverse banque.js, son import.meta.glob et le
 * chargement a la demande des fichiers de sous-domaines. C'est la seule facon
 * de verifier que l'enrichissement fonctionne sur la banque telle qu'elle est,
 * et pas sur un catalogue reconstitue a la main.
 *
 *   node verifier-transfert.js               verifie
 *   node verifier-transfert.js --echantillon verifie, puis montre un extrait
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;

let echecs = 0;
function verifier(intitule, fn) {
  try {
    fn();
    console.log(`  ok   ${intitule}`);
  } catch (e) {
    echecs++;
    console.log(`  ECHEC ${intitule}`);
    console.log(`       ${e.message.split('\n')[0]}`);
  }
}

async function charger(relatif) {
  const source = fs.readFileSync(path.join(RACINE, relatif), 'utf8');
  const url = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64');
  return import(url);
}

/** localStorage de substitution, remis a zero entre deux scenarios. */
function installerStockage() {
  const memoire = new Map();
  globalThis.localStorage = {
    getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
    setItem: (k, v) => memoire.set(k, String(v)),
    removeItem: (k) => memoire.delete(k),
  };
  return memoire;
}

/** Catalogue construit sur les VRAIES questions : c'est l'enrichissement de
    l'export qu'on verifie, pas une maquette qui lui ressemblerait. */
function catalogueReel(ids) {
  const dir = path.join(RACINE, 'questions');
  const index = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const contenu = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const lot = Array.isArray(contenu) ? contenu : contenu.questions || [];
    for (const q of lot) index.set(q.id, q);
  }
  const catalogue = new Map();
  for (const id of ids) if (index.has(id)) catalogue.set(id, index.get(id));
  return catalogue;
}

/* Progression de demonstration : de vraies questions, de vrais domaines, et
   les trois cas qui comptent — une reussie, une ratee, une a choix multiples
   ou l'on n'a coche qu'une des deux bonnes reponses. Les cles « correct » sont
   celles de la vraie banque, et une verification s'en assure : un extrait qui
   ment sur la bonne reponse ne prouverait rien de l'exploitabilite du format. */
function progressionDeDemonstration() {
  const j = (n) => 1754000000000 + n * 3600000;
  return {
    version: 1,
    reponses: [
      { id: 'CLH-001', juste: false, date: j(0), domain: 'Security and Safety', subdomain: 'Claude Hooks', difficulty: 'facile', choix: ['A'], correct: ['C'] },
      { id: 'AGA-004', juste: false, date: j(1), domain: 'Agents and Workflows', subdomain: 'Agent Architecture', difficulty: 'moyen', choix: ['B'], correct: ['A', 'B'] },
      { id: 'CTX-001', juste: true, date: j(2), domain: 'Prompt and Context Engineering', subdomain: 'Context Engineering', difficulty: 'facile', choix: ['A'], correct: ['A'] },
      { id: 'CTM-001', juste: true, date: j(30), domain: 'Model Selection and Optimization', subdomain: 'Cost and Token Management', difficulty: 'moyen', choix: ['A'], correct: ['A'] },
      { id: 'CLH-001', juste: true, date: j(50), domain: 'Security and Safety', subdomain: 'Claude Hooks', difficulty: 'facile', choix: ['C'], correct: ['C'] },
    ],
    fiches: {
      'CLH-001': { palier: 1, prochaine: 1755100000000, echecs: 1 },
      'AGA-004': { palier: 0, prochaine: 1754500000000, echecs: 1 },
    },
    examens: [{ date: j(31), total: 40, repondu: 38, juste: 27, score: 68 }],
  };
}

/**
 * Rejoue exactement ce que fait le bouton « Exporter mes resultats » : lire la
 * progression, resoudre les identifiants dans le manifeste, charger les
 * fichiers de sous-domaines concernes, construire le document.
 *
 * ssrLoadModule execute les modules ES du dossier src/ avec les
 * transformations de Vite — import.meta.glob compris, que Node ne sait pas
 * lire seul. Rend null si Vite n'est pas installe : la verification du reste
 * ne doit pas dependre des devDependencies.
 */
async function exporterCommeLApplication() {
  let creerServeur;
  try {
    ({ createServer: creerServeur } = await import('vite'));
  } catch {
    return null;
  }
  const serveur = await creerServeur({
    root: RACINE,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const banque = await serveur.ssrLoadModule('/src/banque.js');
    const transfert = await serveur.ssrLoadModule('/src/transfert.js');
    const progression = progressionDeDemonstration();
    const ids = transfert.idsCites(progression);
    const metas = ids.map(banque.metaParId).filter(Boolean);
    const questions = await banque.chargerQuestions(metas);
    const catalogue = new Map(questions.map((q) => [q.id, q]));
    const doc = transfert.construireExport(progression, catalogue, 1754300000000);
    return {
      transfert,
      progression,
      doc,
      catalogue,
      idsCites: ids.length,
      metasResolues: metas.length,
      questionsChargees: questions.length,
    };
  } finally {
    await serveur.close();
  }
}

async function main() {
  const stockage = await charger('src/stockage.js');
  const transfert = await charger('src/transfert.js');

  /* ---------------------------------------------------- 1. ENREGISTREMENT */

  console.log('\nCe que stockage.js retient par reponse');

  installerStockage();
  stockage.enregistrerReponse('CLH-001', false, {
    domain: 'Security and Safety',
    subdomain: 'Claude Hooks',
    difficulty: 'facile',
    choix: ['A'],
    correct: ['C'],
  });
  const apresUne = stockage.lire();
  const r0 = apresUne.reponses[0];

  verifier('id, sous-domaine, domaine, date', () => {
    assert.strictEqual(r0.id, 'CLH-001');
    assert.strictEqual(r0.subdomain, 'Claude Hooks');
    assert.strictEqual(r0.domain, 'Security and Safety');
    assert.ok(typeof r0.date === 'number' && r0.date > 0);
  });
  verifier('reponse donnee et bonne reponse', () => {
    assert.deepStrictEqual(r0.choix, ['A']);
    assert.deepStrictEqual(r0.correct, ['C']);
    assert.strictEqual(r0.juste, false);
  });
  verifier('question laissee sans reponse : [] et non « non enregistre »', () => {
    stockage.enregistrerReponse('CLH-002', false, { choix: [], correct: ['B'] });
    const r = stockage.lire().reponses[1];
    assert.deepStrictEqual(r.choix, []);
  });
  verifier('meta absente : le champ est omis, pas invente', () => {
    stockage.enregistrerReponse('CLH-003', true, {});
    const r = stockage.lire().reponses[2];
    assert.strictEqual('choix' in r, false);
  });

  /* ------------------------------------------------- 2. RETROCOMPATIBILITE */

  console.log('\nRetrocompatibilite avec la progression deja stockee');

  const memoire = installerStockage();
  const ancien = {
    version: 1,
    reponses: [
      { id: 'CLH-001', juste: true, date: 1751000000000, domain: 'Security and Safety', subdomain: 'Claude Hooks', difficulty: 'facile' },
      { id: 'AGA-001', juste: false, date: 1751000100000, domain: 'Agents and Workflows', subdomain: 'Agent Architecture', difficulty: 'facile' },
    ],
    fiches: { 'AGA-001': { palier: 0, prochaine: 1751200000000, echecs: 1 } },
    examens: [{ date: 1751000200000, total: 10, repondu: 10, juste: 7, score: 70 }],
  };
  memoire.set('ccdv-prep:progression:v1', JSON.stringify(ancien));

  verifier('un etat sans choix/correct se relit tel quel', () => {
    const etat = stockage.lire();
    assert.strictEqual(etat.reponses.length, 2);
    assert.strictEqual(etat.reponses[0].choix, undefined);
  });
  verifier('les statistiques restent calculables dessus', () => {
    const s = stockage.statistiques(undefined, [
      { nom: 'Security and Safety', poids: 12 },
      { nom: 'Agents and Workflows', poids: 26 },
    ]);
    assert.strictEqual(s.totalRepondu, 2);
    assert.strictEqual(Math.round(s.scorePondere), 32);
  });
  verifier('une nouvelle reponse s ajoute a cote des anciennes', () => {
    stockage.enregistrerReponse('MCP-001', true, { domain: 'Tools and MCPs', choix: ['B'], correct: ['B'] });
    const etat = stockage.lire();
    assert.strictEqual(etat.reponses.length, 3);
    assert.strictEqual(etat.reponses[0].choix, undefined);
    assert.deepStrictEqual(etat.reponses[2].choix, ['B']);
  });

  /* -------------------------------------------------------- 3. ALLER-RETOUR */

  console.log('\nExport puis import : aller-retour sans perte');

  installerStockage();
  const progression = {
    version: 1,
    reponses: [
      { id: 'CLH-001', juste: false, date: 1754000000000, domain: 'Security and Safety', subdomain: 'Claude Hooks', difficulty: 'facile', choix: ['A'], correct: ['C'] },
      { id: 'AGA-001', juste: true, date: 1754000600000, domain: 'Agents and Workflows', subdomain: 'Agent Architecture', difficulty: 'facile', choix: ['B'], correct: ['B'] },
      { id: 'PRE-001', juste: true, date: 1754100000000, domain: 'Prompt and Context Engineering', subdomain: 'Prompt Engineering', difficulty: 'moyen' },
      { id: 'CLH-001', juste: true, date: 1754200000000, domain: 'Security and Safety', subdomain: 'Claude Hooks', difficulty: 'facile', choix: ['C'], correct: ['C'] },
    ],
    fiches: { 'CLH-001': { palier: 1, prochaine: 1754800000000, echecs: 1 } },
    examens: [{ date: 1754100500000, total: 40, repondu: 38, juste: 27, score: 68 }],
  };
  const catalogue = catalogueReel(transfert.idsCites(progression));
  const doc = transfert.construireExport(progression, catalogue, 1754300000000);
  const texte = JSON.stringify(doc, null, 2);

  verifier('le fichier produit est du JSON valide', () => {
    const relu = JSON.parse(texte);
    assert.strictEqual(relu.format, 'ccdv-prep/progression');
    assert.strictEqual(relu.version, 1);
    assert.strictEqual(relu.genere, '2025-08-04T09:33:20.000Z');
  });
  verifier('chaque reponse porte concept et enonce, pas seulement l id', () => {
    const vue = doc.reponses.find((r) => r.id === 'CLH-001');
    assert.ok(vue.concept && vue.concept.length > 10, 'concept absent');
    assert.ok(vue.enonce && vue.enonce.includes('PreToolUse'), 'enonce absent');
    assert.ok(vue.enonce_fr, 'enonce francais absent');
  });
  verifier('reponse donnee et bonne reponse, en cles ET en texte', () => {
    const vue = doc.reponses[0];
    assert.deepStrictEqual(vue.reponseDonnee, ['A']);
    assert.deepStrictEqual(vue.bonneReponse, ['C']);
    assert.ok(vue.reponseDonnee_texte[0].length > 20);
    assert.ok(vue.bonneReponse_texte[0].length > 20);
    assert.notStrictEqual(vue.reponseDonnee_texte[0], vue.bonneReponse_texte[0]);
  });
  verifier('une reponse ancienne est signalee, pas travestie en abstention', () => {
    const vue = doc.reponses.find((r) => r.id === 'PRE-001');
    assert.strictEqual(vue.reponseDonnee, null);
    assert.ok(/non enregistree/.test(vue.note));
  });
  verifier('les reponses sortent dans l ordre chronologique', () => {
    const dates = doc.reponses.map((r) => Date.parse(r.date));
    assert.deepStrictEqual(dates, [...dates].sort((a, b) => a - b));
  });
  verifier('le resume donne les chiffres de tete', () => {
    assert.strictEqual(doc.resume.questionsRepondues, 3);
    assert.strictEqual(doc.resume.reponsesTotales, 4);
    assert.strictEqual(doc.resume.tauxReussite, 100); // CLH-001 compte pour sa DERNIERE reponse
    assert.strictEqual(doc.resume.parDomaine.length, 3);
  });
  verifier('les fiches sortent avec leur date de revision lisible', () => {
    assert.strictEqual(doc.fiches.length, 1);
    assert.strictEqual(doc.fiches[0].id, 'CLH-001');
    assert.match(doc.fiches[0].prochaineRevision, /^\d{4}-\d{2}-\d{2}$/);
    assert.strictEqual(doc.fiches[0].acquise, false);
  });

  verifier('l import restitue la progression a l identique', () => {
    const relu = transfert.lireExport(texte);
    assert.deepStrictEqual(relu.progression, JSON.parse(JSON.stringify(progression)));
  });
  verifier('l import ecrit reellement dans le stockage', () => {
    const relu = transfert.lireExport(texte);
    stockage.remplacer(relu.progression);
    assert.deepStrictEqual(stockage.lire(), JSON.parse(JSON.stringify(progression)));
  });
  verifier('exporter ce qui vient d etre importe redonne le meme fichier', () => {
    const relu = transfert.lireExport(texte);
    const encore = transfert.construireExport(relu.progression, catalogue, 1754300000000);
    assert.strictEqual(JSON.stringify(encore, null, 2), texte);
  });
  verifier('les revisions dues survivent a l aller-retour', () => {
    const relu = transfert.lireExport(texte);
    stockage.remplacer(relu.progression);
    assert.deepStrictEqual(stockage.idsDus(stockage.lire()), ['CLH-001']);
  });

  /* ---------------------------------------------------------- 4. FUSION */

  console.log('\nFusion de deux progressions');

  const autre = {
    version: 1,
    reponses: [
      { id: 'CLH-001', juste: false, date: 1754000000000, domain: 'Security and Safety', subdomain: 'Claude Hooks', choix: ['A'], correct: ['C'] },
      { id: 'MCP-001', juste: true, date: 1754500000000, domain: 'Tools and MCPs', subdomain: 'MCP Server Development', choix: ['D'], correct: ['D'] },
    ],
    fiches: { 'CLH-001': { palier: 0, prochaine: 1754100000000, echecs: 3 } },
    examens: [{ date: 1754400000000, total: 40, repondu: 40, juste: 30, score: 75 }],
  };

  verifier('les reponses des deux cotes sont reunies', () => {
    const f = transfert.fusionner(progression, autre);
    assert.strictEqual(f.reponses.length, 5); // 4 + 2 - 1 doublon
    assert.strictEqual(f.examens.length, 2);
  });
  verifier('un doublon exact n est pas compte deux fois', () => {
    const f = transfert.fusionner(progression, autre);
    const clh = f.reponses.filter((r) => r.id === 'CLH-001');
    assert.strictEqual(clh.length, 2);
  });
  verifier('la fiche retenue est celle du cote le plus recent', () => {
    const f = transfert.fusionner(progression, autre);
    // progression a repondu a CLH-001 le plus tard : c'est sa fiche qui vaut,
    // mais le compteur d echecs garde le maximum des deux.
    assert.strictEqual(f.fiches['CLH-001'].palier, 1);
    assert.strictEqual(f.fiches['CLH-001'].echecs, 3);
  });
  verifier('fusionner deux fois le meme fichier ne change rien', () => {
    const une = transfert.fusionner(progression, autre);
    const deux = transfert.fusionner(une, autre);
    assert.deepStrictEqual(deux, une);
  });
  verifier('fusionner avec du vide preserve tout', () => {
    const f = transfert.fusionner({ version: 1, reponses: [], fiches: {} }, progression);
    assert.deepStrictEqual(f.reponses, progression.reponses);
    assert.deepStrictEqual(f.fiches, progression.fiches);
  });

  /* -------------------------------------------------------- 5. REFUS NETS */

  console.log('\nRefus des fichiers inexploitables');

  const refuse = (texte, motif) => {
    assert.throws(() => transfert.lireExport(texte), (e) => new RegExp(motif, 'i').test(e.message));
  };
  verifier('un fichier qui n est pas du JSON', () => refuse('ceci n est pas du json', 'JSON valide'));
  verifier('un JSON etranger a l application', () => refuse('{"a":1}', 'export de progression'));
  verifier('un export d une version future', () =>
    refuse(JSON.stringify({ format: 'ccdv-prep/progression', version: 9 }), 'version 9'));
  verifier('un export ampute de sa progression brute', () =>
    refuse(JSON.stringify({ format: 'ccdv-prep/progression', version: 1, reponses: [] }), 'incomplet'));

  /* ------------------------------------------------------------ 6. NOM */

  console.log('\nNom du fichier');
  verifier('le nom porte la date du jour', () => {
    assert.match(transfert.nomFichier(Date.now()), /^ccdv-prep-progression-\d{4}-\d{2}-\d{2}\.json$/);
  });

  /* ------------------------------------------- 7. LE VRAI CHEMIN D EXPORT */

  console.log('\nChemin d export reel, a travers la banque de questions');

  const reel = await exporterCommeLApplication();
  if (!reel) {
    console.log('  passe  Vite indisponible — section ignoree');
  } else {
    verifier('les identifiants stockes se resolvent dans le manifeste', () => {
      assert.strictEqual(reel.metasResolues, reel.idsCites);
    });
    verifier('les fichiers de sous-domaines se chargent a la demande', () => {
      assert.strictEqual(reel.questionsChargees, reel.idsCites);
    });
    verifier('aucune reponse exportee ne reste un simple identifiant', () => {
      for (const r of reel.doc.reponses) {
        assert.ok(r.concept, `concept manquant sur ${r.id}`);
        assert.ok(r.enonce, `enonce manquant sur ${r.id}`);
        assert.ok(r.bonneReponse_texte?.length, `bonne reponse en clair manquante sur ${r.id}`);
      }
    });
    verifier('une question a reponses multiples garde ses deux cles', () => {
      const m = reel.doc.reponses.find((r) => r.id === 'AGA-004');
      assert.deepStrictEqual(m.bonneReponse, ['A', 'B']);
      assert.strictEqual(m.bonneReponse_texte.length, 2);
    });
    verifier('les bonnes reponses exportees sont bien celles de la banque', () => {
      for (const r of reel.doc.reponses) {
        const q = reel.catalogue.get(r.id);
        assert.deepStrictEqual(r.bonneReponse, q.correct, 'bonne reponse divergente sur ' + r.id);
        assert.strictEqual(r.juste, JSON.stringify(r.reponseDonnee) === JSON.stringify(q.correct));
      }
    });
    verifier('l aller-retour tient sur ce fichier-la aussi', () => {
      const relu = reel.transfert.lireExport(JSON.stringify(reel.doc, null, 2));
      assert.deepStrictEqual(relu.progression, JSON.parse(JSON.stringify(reel.progression)));
    });
  }

  /* --------------------------------------------------------- ECHANTILLON */

  const aMontrer = reel ? reel.doc : doc;

  if (process.argv.includes('--echantillon')) {
    const apercu = {
      ...aMontrer,
      reponses: aMontrer.reponses.slice(0, 3),
      fiches: aMontrer.fiches.slice(0, 2),
      progression: '(etat brut — tronque dans cet apercu, present en entier dans le vrai fichier)',
    };
    console.log('\n--- extrait de l export -------------------------------------\n');
    console.log(JSON.stringify(apercu, null, 2));
  }

  const sortie = process.argv.indexOf('--ecrire');
  if (sortie !== -1 && process.argv[sortie + 1]) {
    fs.writeFileSync(process.argv[sortie + 1], JSON.stringify(aMontrer, null, 2));
    console.log(`\nExport de demonstration ecrit : ${process.argv[sortie + 1]}`);
  }

  console.log(echecs === 0 ? '\nTout passe.' : `\n${echecs} verification(s) en echec.`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
