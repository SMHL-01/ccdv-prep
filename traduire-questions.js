#!/usr/bin/env node
'use strict';

/* ============================================================
   TRADUIRE-QUESTIONS — ajoute les champs francais a la banque.

   Ce script est STRICTEMENT ADDITIF. Il n'ecrit que des cles qui
   n'existent pas encore, et ne touche jamais question_en, text_en,
   correct, explanation_fr, distractors_fr ni doc_ref. Une traduction
   corrigee a la main survit donc a une reexecution, et une execution
   interrompue se reprend la ou elle s'est arretee.

   Champs produits, par question :
     question_fr        traduction de l'enonce
     options[].text_fr  traduction de chaque option
     citations_fr       traduction des citations de doc, dans l'ordre
                        d'apparition des « … » dans explanation_fr
     principe_fr        la regle generale derriere le cas particulier,
                        seulement quand le concept la merite

   Usage :
     ANTHROPIC_API_KEY=sk-... node traduire-questions.js
     node traduire-questions.js --fichier=security-safety_claude-hooks.json
     node traduire-questions.js --limite=6 --essai
   ============================================================ */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DOSSIER = path.join(__dirname, 'questions');
const MODELE = 'claude-opus-5';
const LOT = 6; // questions par requete
const PARALLELE = 3; // requetes simultanees
const TENTATIVES = 4;

// --- Arguments ---------------------------------------------------------------

const args = process.argv.slice(2);
const lire = (nom, defaut) => {
  const t = args.find((a) => a.startsWith(`--${nom}=`));
  return t ? t.slice(nom.length + 3) : defaut;
};
const ESSAI = args.includes('--essai');
const FICHIER_CIBLE = lire('fichier', null);
const LIMITE = Number(lire('limite', 0)) || Infinity;
const EFFORT = lire('effort', 'medium');

// --- Le prompt ---------------------------------------------------------------

// Assez long pour depasser le minimum de mise en cache (512 jetons sur
// Opus 5) : il est identique a chaque requete, donc facture au tarif de
// lecture de cache des la deuxieme.
const SYSTEME = `Tu traduis en francais la banque de questions d'un examen de certification Anthropic (Claude Certified Developer — Foundations). L'utilisateur revise sur telephone : l'anglais reste la version de reference, parce que c'est la langue de l'examen ; ta traduction est une aide a la comprehension affichee juste en dessous, en plus petit.

REGLES DE TRADUCTION

1. Traduis le SENS, pas les mots. Une option traduite doit rester aussi discriminante que l'originale : si deux options anglaises se distinguent par une nuance, la nuance doit survivre en francais.
2. NE TRADUIS JAMAIS les identifiants techniques, noms d'evenements, de champs, de parametres, d'outils, de codes ni de valeurs litterales. Ils restent tels quels, en anglais : PreToolUse, PostToolUse, SessionStart, stop_reason, max_tokens, budget_tokens, tool_use, tool_result, acceptEdits, dontAsk, plan, permissionDecision, updatedInput, cache_control, ephemeral, input_schema, defer_loading, mcp_toolset, agent_toolset, end_turn, pause_turn, refusal, thinking, effort, xhigh, allowed_hosts, environment_variable, CLAUDE.md, SKILL.md, etc. Dans le doute, laisse en anglais.
3. Les termes de metier qui ont un usage francais etabli se traduisent : hook reste « hook », mais tool = outil, prompt = prompt, token = jeton uniquement quand il s'agit d'une unite de facturation, sinon token. Agent = agent. Context window = fenetre de contexte. Rate limit = limite de debit. Sandbox = bac a sable. Prefill = prefixe de reponse.
4. Registre : vouvoiement, phrases courtes, ton neutre et technique. Pas de tournure scolaire (« Dans cet exercice… »), pas de reformulation de l'enonce.
5. ACCENTUATION. Le francais que tu produis est accentue normalement : é è ê à â î ô û ù ç. « dépréciée », « s'exécute », « découle », « règle générale », « paramètre ». Ce prompt-ci est rédigé sans accents pour des raisons internes au dépôt — ne calque pas ce registre, il ne s'applique pas à ta sortie. Seuls les identifiants techniques de la règle 2 restent tels quels. Une sortie non accentuée s'afficherait dans l'application juste à côté d'explications accentuées, et l'écart sauterait aux yeux ; elle produirait aussi de vraies fautes, puisque l'accord se perd avec l'accent (« est déprécié » au lieu de « est dépréciée »).
6. Typographie : apostrophe DROITE ('), jamais l'apostrophe typographique. Espace simple avant ? ! : ; — pas d'espace insecable. Guillemets francais « » uniquement si l'original en a.
7. Aucune traduction ne doit etre plus longue que le double de l'originale.

CITATIONS DE DOCUMENTATION

On te fournit, pour chaque question, la liste des citations de documentation enchassees en anglais dans l'explication francaise. Traduis-les dans le meme ORDRE, une entree par citation. N'inclus pas les guillemets. Si une citation est deja en francais ou ne contient aucun texte a traduire, renvoie une chaine vide pour cette entree — surtout, ne decale pas les autres.

LE PRINCIPE

L'objectif de l'application n'est pas de faire apprendre des reponses par coeur : les questions de l'examen reel seront differentes. Il s'agit de developper une logique. Quand la question touche un concept non trivial, redige donc un paragraphe « principe_fr » de 2 a 4 phrases qui enonce la REGLE GENERALE sous-jacente, pas le cas particulier.

Un bon principe donne un modele mental transferable. Exemple sur une question de mode de permission : expliquer que default / acceptEdits / dontAsk / plan forment une echelle d'autonomie ou chaque cran retire une categorie de confirmation, et que plan est a part parce qu'il interdit toute ecriture — plutot que de repeter « B et D sont corrects ».

Un mauvais principe paraphrase l'explication, repete les lettres des bonnes reponses, ou enonce une generalite vide (« il faut lire la documentation »).

Si la question est purement factuelle — un chiffre a retenir, un nom d'endpoint, une valeur par defaut — et qu'aucune regle generale ne s'en degage, renvoie une chaine vide pour principe_fr. Mieux vaut rien qu'un remplissage. Vise environ deux tiers de questions avec principe.

Tu recois un lot de questions en JSON et tu renvoies leur traduction, dans l'ordre, avec le meme identifiant.`;

const SCHEMA = {
  type: 'object',
  properties: {
    traductions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question_fr: { type: 'string' },
          options_fr: {
            type: 'object',
            properties: {
              A: { type: 'string' },
              B: { type: 'string' },
              C: { type: 'string' },
              D: { type: 'string' },
            },
            required: ['A', 'B', 'C', 'D'],
            additionalProperties: false,
          },
          citations_fr: { type: 'array', items: { type: 'string' } },
          principe_fr: { type: 'string' },
        },
        required: ['id', 'question_fr', 'options_fr', 'citations_fr', 'principe_fr'],
        additionalProperties: false,
      },
    },
  },
  required: ['traductions'],
  additionalProperties: false,
};

// --- Citations ---------------------------------------------------------------

const MOTIF_CITATION = /«[^»]*»/g;

/** Les citations de doc d'une explication, sans les guillemets, dans l'ordre. */
function citationsDe(explication) {
  return (explication || '').match(MOTIF_CITATION)?.map((c) => c.slice(1, -1).trim()) || [];
}

// --- Appel API ---------------------------------------------------------------

const CLE = process.env.ANTHROPIC_API_KEY;

/**
 * POST /v1/messages en HTTPS nu.
 * `family: 4` est indispensable ici : la resolution DNS de la machine renvoie
 * des adresses IPv6 non routables, et une requete qui les tente reste pendue
 * jusqu'au timeout.
 */
function appeler(corps) {
  return new Promise((resolve, rejeter) => {
    const charge = Buffer.from(JSON.stringify(corps), 'utf8');
    const requete = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        family: 4,
        timeout: 300000,
        headers: {
          'content-type': 'application/json',
          'content-length': charge.length,
          'x-api-key': CLE,
          'anthropic-version': '2023-06-01',
        },
      },
      (reponse) => {
        const morceaux = [];
        reponse.on('data', (m) => morceaux.push(m));
        reponse.on('end', () => {
          const texte = Buffer.concat(morceaux).toString('utf8');
          if (reponse.statusCode !== 200) {
            const erreur = new Error(`HTTP ${reponse.statusCode} — ${texte.slice(0, 400)}`);
            erreur.statut = reponse.statusCode;
            return rejeter(erreur);
          }
          try {
            resolve(JSON.parse(texte));
          } catch (e) {
            rejeter(new Error(`Reponse illisible : ${texte.slice(0, 200)}`));
          }
        });
      }
    );
    requete.on('timeout', () => requete.destroy(new Error('Delai depasse')));
    requete.on('error', rejeter);
    requete.end(charge);
  });
}

const RETRYABLES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function traduireLot(lot) {
  const entree = lot.map((q) => ({
    id: q.id,
    concept: q.concept,
    question_en: q.question_en,
    options: q.options.map((o) => ({ key: o.key, text_en: o.text_en })),
    correct: q.correct,
    explanation_fr: q.explanation_fr,
    citations_a_traduire: citationsDe(q.explanation_fr),
  }));

  const corps = {
    model: MODELE,
    max_tokens: 16000,
    system: [{ type: 'text', text: SYSTEME, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA }, effort: EFFORT },
    messages: [{ role: 'user', content: JSON.stringify(entree, null, 1) }],
  };

  let derniere;
  for (let essai = 1; essai <= TENTATIVES; essai++) {
    try {
      const reponse = await appeler(corps);
      if (reponse.stop_reason === 'refusal') {
        throw new Error(`Refus du modele (${reponse.stop_details?.category || 'sans categorie'})`);
      }
      if (reponse.stop_reason === 'max_tokens') {
        throw new Error('Reponse tronquee : augmenter max_tokens ou reduire LOT');
      }
      const bloc = reponse.content.find((b) => b.type === 'text');
      if (!bloc) throw new Error('Aucun bloc de texte dans la reponse');
      const { traductions } = JSON.parse(bloc.text);
      return { traductions, usage: reponse.usage };
    } catch (e) {
      derniere = e;
      const rejouable = !e.statut || RETRYABLES.has(e.statut);
      if (!rejouable || essai === TENTATIVES) break;
      const attente = 2000 * 2 ** (essai - 1);
      console.warn(`    ! ${e.message.slice(0, 120)} — nouvelle tentative dans ${attente / 1000}s`);
      await dormir(attente);
    }
  }
  throw derniere;
}

// --- Ecriture ----------------------------------------------------------------

// Les champs francais sont ranges a cote de leur original anglais : un diff
// git reste lisible, et l'oeil retrouve la paire sans la chercher.
const ORDRE = [
  'id', 'domain', 'subdomain', 'weight', 'type', 'nature', 'difficulty', 'concept',
  'question_en', 'question_fr', 'options', 'correct',
  'explanation_fr', 'citations_fr', 'principe_fr', 'distractors_fr', 'doc_ref',
];

function reordonner(q) {
  const sortie = {};
  for (const cle of ORDRE) if (q[cle] !== undefined) sortie[cle] = q[cle];
  // Toute cle non prevue est conservee, a la fin : rien ne se perd.
  for (const cle of Object.keys(q)) if (sortie[cle] === undefined) sortie[cle] = q[cle];
  if (Array.isArray(sortie.options)) {
    sortie.options = sortie.options.map((o) => {
      const oo = {};
      for (const cle of ['key', 'text_en', 'text_fr']) if (o[cle] !== undefined) oo[cle] = o[cle];
      for (const cle of Object.keys(o)) if (oo[cle] === undefined) oo[cle] = o[cle];
      return oo;
    });
  }
  return sortie;
}

/** Applique une traduction a une question. Ne remplace jamais l'existant. */
function appliquer(q, t, anomalies) {
  let poses = 0;

  if (q.question_fr === undefined && t.question_fr) {
    q.question_fr = t.question_fr;
    poses++;
  }

  for (const o of q.options) {
    const traduit = t.options_fr?.[o.key];
    if (o.text_fr === undefined && traduit) {
      o.text_fr = traduit;
      poses++;
    }
  }

  const attendues = citationsDe(q.explanation_fr);
  if (attendues.length > 0 && q.citations_fr === undefined) {
    const recues = t.citations_fr || [];
    if (recues.length !== attendues.length) {
      anomalies.push(
        `${q.id} : ${recues.length} traduction(s) de citation pour ${attendues.length} citation(s) — champ non ecrit`
      );
    } else {
      q.citations_fr = recues;
      poses++;
    }
  }

  if (q.principe_fr === undefined && t.principe_fr && t.principe_fr.trim()) {
    q.principe_fr = t.principe_fr.trim();
    poses++;
  }

  return poses;
}

/** Une question a-t-elle encore quelque chose a produire ? */
function incomplete(q) {
  if (q.question_fr === undefined) return true;
  if (q.options.some((o) => o.text_fr === undefined)) return true;
  if (citationsDe(q.explanation_fr).length > 0 && q.citations_fr === undefined) return true;
  if (q.principe_fr === undefined) return true;
  return false;
}

// --- Deroule -----------------------------------------------------------------

function decouper(tableau, taille) {
  const lots = [];
  for (let i = 0; i < tableau.length; i += taille) lots.push(tableau.slice(i, i + taille));
  return lots;
}

/** Execute les taches avec au plus `largeur` en vol, en preservant l'ordre. */
async function enParallele(taches, largeur) {
  const resultats = new Array(taches.length);
  let curseur = 0;
  const ouvriers = Array.from({ length: Math.min(largeur, taches.length) }, async () => {
    while (curseur < taches.length) {
      const i = curseur++;
      resultats[i] = await taches[i]();
    }
  });
  await Promise.all(ouvriers);
  return resultats;
}

async function main() {
  if (!CLE && !ESSAI) {
    console.error(
      'ANTHROPIC_API_KEY absent.\n' +
        'Exportez une cle API, ou connectez-vous avec `ant auth login` puis :\n' +
        '  export ANTHROPIC_API_KEY=$(ant auth print-credentials --access-token)'
    );
    process.exit(1);
  }

  const fichiers = fs
    .readdirSync(DOSSIER)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .filter((f) => !FICHIER_CIBLE || f === FICHIER_CIBLE)
    .sort();

  if (!fichiers.length) {
    console.error(FICHIER_CIBLE ? `Fichier introuvable : ${FICHIER_CIBLE}` : 'Aucun fichier.');
    process.exit(1);
  }

  const anomalies = [];
  let totalPoses = 0;
  let totalQuestions = 0;
  const cumul = { entree: 0, sortie: 0, cacheEcrit: 0, cacheLu: 0 };
  let budget = LIMITE;

  for (const nom of fichiers) {
    if (budget <= 0) break;
    const chemin = path.join(DOSSIER, nom);
    const banque = JSON.parse(fs.readFileSync(chemin, 'utf8'));

    let aFaire = banque.questions.filter(incomplete);
    if (aFaire.length > budget) aFaire = aFaire.slice(0, budget);

    if (!aFaire.length) {
      console.log(`· ${nom} — deja complet`);
      continue;
    }

    process.stdout.write(`· ${nom} — ${aFaire.length} question(s) a traduire… `);
    budget -= aFaire.length;

    if (ESSAI) {
      console.log('(essai : rien n’est appele)');
      continue;
    }

    const lots = decouper(aFaire, LOT);
    let resultats;
    try {
      resultats = await enParallele(
        lots.map((lot) => () => traduireLot(lot)),
        PARALLELE
      );
    } catch (e) {
      console.log('ECHEC');
      console.error(`  ${e.message}`);
      console.error('  Fichier laisse intact. Relancez : les questions deja faites seront sautees.');
      process.exit(1);
    }

    const parId = new Map();
    for (const r of resultats) {
      cumul.entree += r.usage.input_tokens || 0;
      cumul.sortie += r.usage.output_tokens || 0;
      cumul.cacheEcrit += r.usage.cache_creation_input_tokens || 0;
      cumul.cacheLu += r.usage.cache_read_input_tokens || 0;
      for (const t of r.traductions) parId.set(t.id, t);
    }

    let poses = 0;
    for (const q of aFaire) {
      const t = parId.get(q.id);
      if (!t) {
        anomalies.push(`${q.id} : aucune traduction renvoyee`);
        continue;
      }
      poses += appliquer(q, t, anomalies);
    }

    banque.questions = banque.questions.map(reordonner);
    fs.writeFileSync(chemin, JSON.stringify(banque, null, 2) + '\n', 'utf8');

    totalPoses += poses;
    totalQuestions += aFaire.length;
    console.log(`${poses} champ(s) ecrit(s)`);
  }

  console.log('');
  console.log(`${totalPoses} champ(s) ecrit(s) sur ${totalQuestions} question(s).`);

  if (!ESSAI && (cumul.entree || cumul.sortie)) {
    // Tarifs Opus 5, en dollars par million de jetons.
    const cout =
      (cumul.entree * 5 + cumul.cacheEcrit * 6.25 + cumul.cacheLu * 0.5 + cumul.sortie * 25) / 1e6;
    console.log(
      `Jetons — entree ${cumul.entree}, cache ecrit ${cumul.cacheEcrit}, cache lu ${cumul.cacheLu}, sortie ${cumul.sortie}.`
    );
    console.log(`Cout estime : ${cout.toFixed(2)} $`);
  }

  if (anomalies.length) {
    console.log(`\n${anomalies.length} anomalie(s) — champs concernes non ecrits :`);
    for (const a of anomalies.slice(0, 30)) console.log(`  - ${a}`);
    if (anomalies.length > 30) console.log(`  … et ${anomalies.length - 30} autre(s)`);
    console.log('Relancez le script : il reprendra ce qui manque.');
  }

  console.log('\nVerifiez la banque : npm run questions');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
