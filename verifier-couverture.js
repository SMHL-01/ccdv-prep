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
const TOTAL_QUESTIONS = 400; // cible de l'etape 2
const SEUIL_MOTS_CLES = 2; // mots-cles distincts requis pour qu'une page compte
const SEUIL_FAIBLE = 3; // en dessous de ce nombre de pages, on signale

// --- Blueprint officiel ----------------------------------------------------
// 8 domaines, 25 feuilles (23 sous-domaines nommes + 2 domaines non subdivises,
// Claude Code et Eval/Testing/Debugging, qui sont eux-memes des feuilles).
// Les poids sont ceux de l'examen ; ils totalisent 100.

const BLUEPRINT = [
  {
    domaine: 'Agents and Workflows',
    poids: 14.7,
    sousDomaines: [
      {
        nom: 'Agent Architecture',
        poids: 4.5,
        motsCles: ['agent loop', 'agentic loop', 'orchestrator', 'subagent', 'agent architecture', 'harness', 'multi-agent'],
      },
      {
        nom: 'Agent Construction with Claude',
        poids: 5.3,
        motsCles: ['agent sdk', 'claude agent sdk', 'managed agent', 'self-hosted', 'anthropic-hosted', 'deployment', 'environment', 'session'],
      },
      {
        nom: 'Agent Patterns and Frameworks',
        poids: 4.9,
        motsCles: ['prompt chaining', 'routing', 'parallelization', 'evaluator-optimizer', 'orchestrator-workers', 'building effective agents', 'workflow'],
      },
    ],
  },
  {
    domaine: 'Applications and Integration',
    poids: 33.1,
    sousDomaines: [
      {
        nom: 'Understanding Requirements',
        poids: 3.4,
        motsCles: ['success criteria', 'requirements', 'use case', 'define the task', 'business metric', 'acceptance'],
      },
      {
        nom: 'Systems Life Cycle',
        poids: 2.8,
        motsCles: ['production', 'deployment', 'staging', 'rollout', 'monitoring', 'migration', 'deprecation', 'iterate'],
      },
      {
        nom: 'Claude API Mechanics',
        poids: 6.8,
        motsCles: ['messages api', 'stop_reason', 'max_tokens', 'content block', 'x-api-key', 'anthropic-version', 'server-sent events', 'rate limit', '429'],
      },
      {
        nom: 'Software Engineering Foundations',
        poids: 7.4,
        motsCles: ['sdk', 'typescript', 'python', 'error handling', 'retry', 'idempot', 'http status', 'exponential backoff'],
      },
      {
        nom: 'Claude Application Design',
        poids: 8.6,
        motsCles: ['rag', 'retrieval', 'citations', 'multi-turn', 'conversation', 'pipeline', 'architecture', 'use case guide'],
      },
      {
        nom: 'Configuration Management',
        poids: 4.1,
        motsCles: ['settings.json', 'environment variable', 'claude.md', '.claude', '.mcp.json', 'configuration file', 'permissions'],
      },
    ],
  },
  {
    domaine: 'Claude Code',
    poids: 3.1,
    sousDomaines: [
      {
        nom: 'Claude Code',
        poids: 3.1,
        motsCles: ['claude code', 'slash command', 'claude.md', 'plugin', 'skill', 'headless', 'ide integration'],
      },
    ],
  },
  {
    domaine: 'Eval, Testing and Debugging',
    poids: 2.6,
    sousDomaines: [
      {
        nom: 'Eval, Testing and Debugging',
        poids: 2.6,
        motsCles: ['eval', 'test case', 'grader', 'ground truth', 'llm-as-judge', 'regression', 'debug'],
      },
    ],
  },
  {
    domaine: 'Model Selection and Optimization',
    poids: 16.8,
    sousDomaines: [
      {
        nom: 'LLM Fundamentals',
        poids: 5.2,
        motsCles: ['token', 'tokenizer', 'temperature', 'sampling', 'context window', 'hallucination', 'next token', 'training data'],
      },
      {
        nom: 'Technical Fundamentals',
        poids: 6.1,
        motsCles: ['latency', 'throughput', 'time to first token', 'concurrency', 'streaming', 'quota', 'tokens per minute', 'service tier'],
      },
      {
        nom: 'Model Selection and Tradeoffs',
        poids: 2.7,
        motsCles: ['opus', 'sonnet', 'haiku', 'choosing a model', 'model comparison', 'tradeoff', 'benchmark', 'capability'],
      },
      {
        nom: 'Cost and Token Management',
        poids: 2.8,
        motsCles: ['prompt caching', 'cache_control', 'cache hit', 'batches api', 'pricing', 'cost', 'token counting', 'per million tokens'],
      },
    ],
  },
  {
    domaine: 'Prompt and Context Engineering',
    poids: 11.0,
    sousDomaines: [
      {
        nom: 'Context Engineering',
        poids: 3.8,
        motsCles: ['context window', 'long context', 'compaction', 'context editing', 'memory tool', 'context management', 'truncat'],
      },
      {
        nom: 'Prompt Engineering',
        poids: 4.6,
        motsCles: ['system prompt', 'xml tags', 'few-shot', 'chain of thought', 'prefill', 'be clear and direct', 'prompt template'],
      },
      {
        nom: 'Output Handling',
        poids: 2.6,
        motsCles: ['structured output', 'json schema', 'stop_sequence', 'output format', 'parsing', 'strict', 'response format'],
      },
    ],
  },
  {
    domaine: 'Security and Safety',
    poids: 8.1,
    sousDomaines: [
      {
        nom: 'AI Application Security',
        poids: 3.2,
        motsCles: ['prompt injection', 'untrusted', 'exfiltrat', 'sandbox', 'malicious', 'attack', 'threat'],
      },
      {
        nom: 'Guardrails and Safe Deployment',
        poids: 2.3,
        motsCles: ['guardrail', 'moderation', 'harmful', 'refusal', 'jailbreak', 'safety', 'classifier'],
      },
      {
        nom: 'Claude Hooks',
        poids: 1.0,
        motsCles: ['hook', 'pretooluse', 'posttooluse', 'sessionstart', 'hook event', 'matcher'],
      },
      {
        nom: 'Identity, Secrets and Key Management',
        poids: 1.6,
        motsCles: ['api key', 'x-api-key', 'secret', 'credential', 'authentication', 'environment variable', 'rotate'],
      },
    ],
  },
  {
    domaine: 'Tools and MCPs',
    poids: 10.6,
    sousDomaines: [
      {
        nom: 'Tool Implementation',
        poids: 4.4,
        motsCles: ['tool_use', 'input_schema', 'tool_result', 'json schema', 'tool definition', 'tool_choice', 'parallel tool'],
      },
      {
        nom: 'MCP Server Development',
        poids: 2.1,
        motsCles: ['mcp server', 'stdio', 'streamable http', 'transport', 'resources', 'model context protocol', 'initialize'],
      },
      {
        nom: 'Agentic Customization',
        poids: 4.1,
        motsCles: ['skill', 'subagent', 'slash command', 'plugin', 'custom tool', 'output style', 'hooks'],
      },
    ],
  },
];

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
