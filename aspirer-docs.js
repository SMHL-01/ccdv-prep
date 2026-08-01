/**
 * aspirer-docs.js — Constitution du corpus de documentation officielle
 * pour la certification "Claude Certified Developer - Foundations" (CCDV-F).
 *
 * Usage :  node aspirer-docs.js
 *
 * Trois etages, tous reprenables (relancer le script ne retelecharge rien) :
 *   1. TELECHARGEMENT  -> raw/          (cache brut sur disque)
 *   2. INVENTAIRE      -> raw/_inventaire.json
 *   3. ASSEMBLAGE      -> docs-corpus/  (fichiers thematiques pour NotebookLM)
 *
 * Contrainte machine : le resolveur DNS local ne renvoie que des AAAA non
 * routables pour beaucoup de domaines -> toutes les requetes forcent family:4.
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --------------------------------------------------------------------------
// Reglages
// --------------------------------------------------------------------------

const RACINE = __dirname;
const DIR_RAW = path.join(RACINE, 'raw');
const DIR_PAGES = path.join(DIR_RAW, 'pages');
const DIR_CORPUS = path.join(RACINE, 'docs-corpus');
const FICHIER_ECHECS = path.join(DIR_RAW, '_echecs.json');
const FICHIER_INVENTAIRE = path.join(DIR_RAW, '_inventaire.json');

const PAUSE_MS = 300; // pause entre deux telechargements reels
const MAX_MOTS_PAR_FICHIER = 400000; // NotebookLM plafonne vers 500 000
const MARGE_SOMMAIRE = 20000; // place reservee au sommaire et aux en-tetes
const MAX_MOTS_PAR_PAGE = 90000; // au-dela, c'est une reference auto-generee, pas du contenu lisible
const TENTATIVES = 3;
const TIMEOUT_MS = 45000;
const PROFONDEUR_CRAWL = 3;

const UA = 'Mozilla/5.0 (compatible; ccdv-prep-doc-fetcher/1.0; +usage personnel, revision certification)';

// --------------------------------------------------------------------------
// Utilitaires
// --------------------------------------------------------------------------

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function assurerDossier(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function compterMots(texte) {
  const m = texte.match(/\S+/g);
  return m ? m.length : 0;
}

function formaterOctets(n) {
  if (n < 1024) return n + ' o';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' Ko';
  return (n / (1024 * 1024)).toFixed(2) + ' Mo';
}

/** Nom de fichier sur disque, deterministe, derive de l'URL. */
function nomFichierPour(url) {
  const u = new URL(url);
  let base = (u.hostname + u.pathname).replace(/\.md$/, '');
  base = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (base.length > 150) base = base.slice(0, 120) + '_' + hachageCourt(url);
  return base + '.md';
}

function hachageCourt(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// --------------------------------------------------------------------------
// Reseau : https.request avec family:4, redirections, gzip, reessais
// --------------------------------------------------------------------------

https.globalAgent = new https.Agent({ keepAlive: true, family: 4, maxSockets: 4 });

function requete(url, redirections = 0) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return resolve({ ok: false, status: 0, erreur: 'URL invalide' });
    }
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        family: 4,
        headers: { 'user-agent': UA, 'accept-encoding': 'gzip, deflate', accept: '*/*' },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const code = res.statusCode;
        if ([301, 302, 303, 307, 308].includes(code) && res.headers.location && redirections < 5) {
          res.resume();
          return resolve(requete(new URL(res.headers.location, url).toString(), redirections + 1));
        }
        if (code !== 200) {
          res.resume();
          return resolve({ ok: false, status: code, erreur: 'HTTP ' + code });
        }
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        let flux = res;
        if (enc === 'gzip') flux = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') flux = res.pipe(zlib.createInflate());
        const morceaux = [];
        flux.on('data', (c) => morceaux.push(c));
        flux.on('end', () =>
          resolve({
            ok: true,
            status: 200,
            type: res.headers['content-type'] || '',
            corps: Buffer.concat(morceaux).toString('utf8'),
          })
        );
        flux.on('error', (e) => resolve({ ok: false, status: 0, erreur: String(e.message || e) }));
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, erreur: 'timeout' });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, erreur: String(e.message || e) }));
    req.end();
  });
}

/** Reessaie : les ENOTFOUND sporadiques sont connus sur cette machine. */
async function telecharger(url) {
  let dernier = null;
  for (let i = 1; i <= TENTATIVES; i++) {
    const r = await requete(url);
    if (r.ok) return r;
    dernier = r;
    // Un 404 est definitif, inutile d'insister.
    if (r.status >= 400 && r.status < 500) return r;
    if (i < TENTATIVES) await dormir(1000 * i);
  }
  return dernier;
}

// --------------------------------------------------------------------------
// ETAGE 1 : telechargement
// --------------------------------------------------------------------------

const stats = { reseau: 0, cache: 0, echecs: 0 };
const echecs = [];

/**
 * Recupere une URL en passant par le cache disque.
 * Renvoie le contenu texte, ou null si echec.
 */
async function recuperer(url, cheminDisque, etiquette) {
  if (fs.existsSync(cheminDisque) && fs.statSync(cheminDisque).size > 0) {
    stats.cache++;
    return fs.readFileSync(cheminDisque, 'utf8');
  }
  const r = await telecharger(url);
  await dormir(PAUSE_MS);
  if (!r || !r.ok) {
    stats.echecs++;
    const motif = (r && r.erreur) || 'inconnu';
    echecs.push({ url, motif });
    console.log(`   ECHEC  ${etiquette || url}  (${motif})`);
    return null;
  }
  assurerDossier(path.dirname(cheminDisque));
  fs.writeFileSync(cheminDisque, r.corps, 'utf8');
  stats.reseau++;
  return r.corps;
}

/** Extrait toutes les URL .md citees dans un index llms.txt. */
function extraireLiensMd(texte) {
  const vus = new Set();
  const re = /\((https?:\/\/[^)\s]+?\.md)\)/g;
  let m;
  while ((m = re.exec(texte)) !== null) vus.add(m[1]);
  // Certains index listent les URL nues, sans parentheses markdown.
  const re2 = /(?:^|\s)(https?:\/\/[^\s)"']+?\.md)(?=\s|$)/gm;
  while ((m = re2.exec(texte)) !== null) vus.add(m[1]);
  return [...vus];
}

/** Titre lisible d'une page markdown (premier titre H1, sinon derive de l'URL). */
function titreDe(texte, url) {
  const mFront = texte.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (mFront) {
    const t = mFront[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (t) return t[1].trim();
  }
  const h1 = texte.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const u = new URL(url);
  return u.pathname.replace(/\.md$/, '').split('/').filter(Boolean).pop() || u.hostname;
}

/** Parcours en largeur d'un site, profondeur limitee (secours si pas de llms.txt). */
async function crawler(racineUrl, profondeurMax) {
  const origine = new URL(racineUrl).origin;
  const vus = new Set();
  let file = [{ url: racineUrl, prof: 0 }];
  const pages = [];
  while (file.length) {
    const { url, prof } = file.shift();
    const propre = url.split('#')[0].replace(/\/$/, '') || origine;
    if (vus.has(propre)) continue;
    vus.add(propre);
    // Les sites Mintlify servent une version .md de chaque page : on l'essaie.
    const urlMd = propre + '.md';
    const nom = nomFichierPour(urlMd);
    let contenu = await recuperer(urlMd, path.join(DIR_PAGES, nom), urlMd);
    if (contenu) pages.push({ url: urlMd, fichier: nom });
    if (prof < profondeurMax) {
      const rHtml = await telecharger(propre);
      await dormir(PAUSE_MS);
      if (rHtml && rHtml.ok) {
        const re = /href="([^"#?]+)"/g;
        let m;
        while ((m = re.exec(rHtml.corps)) !== null) {
          let lien;
          try {
            lien = new URL(m[1], propre);
          } catch (e) {
            continue;
          }
          if (lien.origin !== origine) continue;
          if (/\.(png|jpg|jpeg|svg|css|js|ico|zip|pdf|webp)$/i.test(lien.pathname)) continue;
          const cible = lien.origin + lien.pathname.replace(/\/$/, '');
          if (!vus.has(cible)) file.push({ url: cible, prof: prof + 1 });
        }
      }
    }
    if (pages.length > 400) break; // garde-fou
  }
  return pages;
}

async function etage1Telechargement() {
  console.log('\n===== ETAGE 1 : telechargement =====\n');
  assurerDossier(DIR_RAW);
  assurerDossier(DIR_PAGES);

  const pages = []; // { url, fichier, source }

  // --- 1. Contenu integral de la doc plateforme -----------------------------
  console.log('1/4  platform.claude.com/llms-full.txt (contenu integral)');
  await recuperer(
    'https://platform.claude.com/llms-full.txt',
    path.join(DIR_RAW, 'platform-llms-full.txt'),
    'llms-full plateforme'
  );

  // --- 2. Index doc plateforme + Claude Code --------------------------------
  const index = [
    { url: 'https://docs.claude.com/llms.txt', fichier: 'docs-llms.txt', source: 'plateforme' },
    { url: 'https://code.claude.com/llms.txt', fichier: 'code-llms.txt', source: 'claude-code' },
  ];
  const aTelecharger = [];
  for (const idx of index) {
    console.log(`2/4  index ${idx.url}`);
    const txt = await recuperer(idx.url, path.join(DIR_RAW, idx.fichier), idx.url);
    if (!txt) continue;
    const liens = extraireLiensMd(txt)
      // On ne garde que l'anglais : les autres langues sont des traductions du meme contenu.
      .filter((u) => /\/docs\/en\//.test(u) || !/\/docs\/(de|es|fr|it|ja|ko|pt-BR|ru|zh-CN|zh-TW|id)\//.test(u));
    console.log(`     ${liens.length} pages listees`);
    for (const u of liens) aTelecharger.push({ url: u, source: idx.source });
  }

  // --- 3. Telechargement page par page --------------------------------------
  console.log(`\n3/4  telechargement de ${aTelecharger.length} pages markdown`);
  let i = 0;
  for (const p of aTelecharger) {
    i++;
    const nom = nomFichierPour(p.url);
    const dest = path.join(DIR_PAGES, nom);
    const neuf = !fs.existsSync(dest);
    const contenu = await recuperer(p.url, dest, p.url);
    if (contenu) pages.push({ url: p.url, fichier: nom, source: p.source });
    if (neuf && i % 25 === 0) console.log(`     ${i}/${aTelecharger.length} ...`);
  }

  // --- 4. Model Context Protocol --------------------------------------------
  console.log('\n4/4  modelcontextprotocol.io');
  let mcpOk = false;
  const cheminMcpFull = path.join(DIR_RAW, 'mcp-llms-full.txt');
  const mcpFull = await recuperer('https://modelcontextprotocol.io/llms-full.txt', cheminMcpFull, 'mcp llms-full');
  if (mcpFull && mcpFull.length > 1000) {
    console.log('     llms-full.txt trouve');
    mcpOk = true;
  } else {
    const mcpIdx = await recuperer(
      'https://modelcontextprotocol.io/llms.txt',
      path.join(DIR_RAW, 'mcp-llms.txt'),
      'mcp llms'
    );
    if (mcpIdx && mcpIdx.length > 200) {
      console.log('     llms.txt trouve, telechargement des pages listees');
      for (const u of extraireLiensMd(mcpIdx)) {
        const nom = nomFichierPour(u);
        const c = await recuperer(u, path.join(DIR_PAGES, nom), u);
        if (c) pages.push({ url: u, fichier: nom, source: 'mcp' });
      }
      mcpOk = true;
    }
  }
  if (!mcpOk) {
    console.log(`     aucun llms.txt : parcours du site, profondeur ${PROFONDEUR_CRAWL}`);
    const trouvees = await crawler('https://modelcontextprotocol.io', PROFONDEUR_CRAWL);
    for (const p of trouvees) pages.push({ ...p, source: 'mcp' });
  }

  fs.writeFileSync(FICHIER_ECHECS, JSON.stringify(echecs, null, 2), 'utf8');
  console.log(
    `\n   telechargees : ${stats.reseau} | deja en cache : ${stats.cache} | echecs : ${stats.echecs}`
  );
  return pages;
}

// --------------------------------------------------------------------------
// ETAGE 2 : inventaire (une entree par page, avec son classement thematique)
// --------------------------------------------------------------------------

/**
 * Decoupe un fichier llms-full.txt en pages.
 * Deux formats rencontres :
 *   "# Titre\n\n**URL:** https://..."   (platform.claude.com)
 *   "# Titre\nSource: https://..."      (modelcontextprotocol.io)
 */
function decouperLlmsFull(texte) {
  const lignes = texte.split(/\r?\n/);
  const pages = [];
  let courante = null;
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    const mTitre = l.match(/^#\s+(.+?)\s*$/);
    if (mTitre) {
      // Une URL doit suivre dans les 3 lignes pour que ce soit un debut de page.
      let url = null;
      for (let j = i + 1; j <= i + 3 && j < lignes.length; j++) {
        const mUrl = lignes[j].match(/^(?:\*\*URL:\*\*|Source:)\s*(https?:\/\/\S+)/);
        if (mUrl) {
          url = mUrl[1];
          break;
        }
      }
      if (url) {
        if (courante) pages.push(courante);
        courante = { titre: mTitre[1], url, lignes: [] };
        continue;
      }
    }
    if (courante) courante.lignes.push(l);
  }
  if (courante) pages.push(courante);
  return pages.map((p) => ({ titre: p.titre, url: p.url, texte: p.lignes.join('\n').trim() }));
}

// --- Classement thematique -------------------------------------------------
//
// Chaque page va dans AU PLUS un fichier. Les regles sont evaluees dans
// l'ordre du tableau THEMES : la premiere qui matche gagne. Le corpus brut
// fait ~3,6 M de mots, soit 9 fois le plafond NotebookLM : il faut donc
// filtrer, et pas seulement repartir.

// Pages explicitement RETENUES, evaluees AVANT la liste noire.
//
// Le motif /docs/en/api/beta/ de la liste noire interceptait les endpoints
// Managed Agents (agents, deployments, environments, sessions). Or le blueprint
// cite nommement "managed agent deployment models (self-hosted vs.
// Anthropic-hosted)" dans le domaine Agents, qui pese 14,7 %. Ces pages sont au
// programme.
//
// Les motifs acceptent la page parente SANS barre finale : c'est justement
// /api/beta/agents (et non /api/beta/agents/create) qui porte la presentation
// du modele. Le garde-fou MAX_MOTS_PAR_PAGE reste applique : les dumps de
// champs auto-generes s'ecartent d'eux-memes.
const LISTE_BLANCHE = [
  { motif: /\/api\/beta\/agents(\/|$)/, cle: '03-agents-sdk' },
  { motif: /\/api\/beta\/deployments(\/|$)/, cle: '03-agents-sdk' },
  { motif: /\/api\/beta\/environments(\/|$)/, cle: '03-agents-sdk' },
  { motif: /\/api\/beta\/sessions(\/|$)/, cle: '03-agents-sdk' },
];

// Pages exclues d'office : reference d'API auto-generee, journaux de version,
// gouvernance du projet MCP. Rien de tout cela n'est au programme de l'examen,
// et cela represente a soi seul plus de la moitie du volume brut.
const LISTE_NOIRE = [
  { motif: /\/docs\/en\/api\/compliance/, raison: 'API Compliance (journaux d audit) : hors blueprint' },
  { motif: /\/docs\/en\/api\/beta(\/|$)/, raison: 'reference endpoints beta auto-generee' },
  { motif: /\/docs\/en\/api\/admin(\/|$)/, raison: 'reference Admin API auto-generee (le concept est couvert par manage-claude)' },
  { motif: /\/release-notes\/system-prompts/, raison: 'texte integral des system prompts : 70 000 mots non interrogeables' },
  { motif: /code\.claude\.com\/docs\/en\/changelog/, raison: 'journal des versions' },
  { motif: /modelcontextprotocol\.io\/seps\//, raison: 'propositions d evolution MCP (gouvernance)' },
  { motif: /modelcontextprotocol\.io\/community\//, raison: 'gouvernance du projet MCP' },
  { motif: /modelcontextprotocol\.io\/specification\/[^/]+\/schema/, raison: 'dump TypeScript du schema' },
  { motif: /modelcontextprotocol\.io\/(blog|about|legacy)/, raison: 'hors documentation technique' },
  // Administration d'entreprise. Le blueprint definit "Identity, Secrets and Key
  // Management" (1,6 %) comme la gestion des secrets, identifiants et cles d'API
  // ENTRE ENVIRONNEMENTS de developpement et de production. Gouverner une
  // organisation Anthropic n'en fait pas partie. Motifs volontairement portes par
  // /manage-claude/ : la page generale /api/rate-limits, elle, reste au programme.
  { motif: /\/manage-claude\/cmek/, raison: 'CMEK (cles de chiffrement client) : administration entreprise' },
  { motif: /\/manage-claude\/(wif-|workload-identity)/, raison: 'Workload Identity Federation : administration entreprise' },
  { motif: /\/manage-claude\/compliance/, raison: 'Compliance API : administration entreprise' },
  { motif: /\/manage-claude\/(api-and-)?data-retention/, raison: 'retention des donnees : administration entreprise' },
  { motif: /\/manage-claude\/data-residency/, raison: 'residence des donnees : administration entreprise' },
  { motif: /\/manage-claude\/(spend-limits|usage-cost|rate-limits|[\w-]*analytics)/, raison: 'facturation et telemetrie d organisation : administration entreprise' },
  { motif: /\/manage-claude\/workspaces/, raison: 'gestion des workspaces : administration entreprise' },
  { motif: /\/manage-claude\/(user-management|access-transparency)/, raison: 'administration des utilisateurs : administration entreprise' },
];

const THEMES = [
  {
    cle: '04-claude-code',
    titre: 'Claude Code',
    description: 'Claude Code, CLAUDE.md, settings.json, skills, commandes, memoire, dossier .claude',
    urls: [/code\.claude\.com\/docs\/en\//],
    exclureUrls: [/\/agent-sdk\//, /\/mcp/, /\/hooks/, /\/security/, /\/iam/, /\/data-usage/],
  },
  {
    cle: '03-agents-sdk',
    titre: 'Agents et Agent SDK',
    description: 'Claude Agent SDK, boucles d agent, subagents, hooks, patterns agentiques, hebergement',
    urls: [
      /\/agent-sdk\//,
      /\/docs\/en\/agents(?:-and-tools)?\//,
      /agents?-overview/,
      /building-effective-agents/,
      /\/sub-?agents/,
      /\/subagents/,
      /\/agent-teams/,
      /\/managed-agents/,
      /\/hooks/, // le blueprint a une rubrique "Claude Hooks" a part entiere
      /\/use-case-guides\//, // patterns d application : conception agentique
      /\/background-tasks/,
      /\/checkpointing/,
      /\/compaction/,
      /\/task-budgets/,
    ],
    motsCles: ['agent sdk', 'agentic loop', 'subagent'],
    exclureUrls: [/\/tool-use\//, /\/mcp/, /content-moderation/],
  },
  {
    cle: '05-mcp-outils',
    titre: 'MCP et outils',
    description: 'MCP (serveurs, transports stdio et HTTP, resources, prompts, tools), outils custom, schemas',
    urls: [
      /modelcontextprotocol\.io/,
      /\/mcp/,
      /\/tool-use/,
      /\/tools\//,
      /\/agents-and-tools\/tool-use/,
      /\/bash-tool/,
      /\/text-editor-tool/,
      /\/code-execution-tool/,
      /\/computer-use/,
      /\/web-search-tool/,
      /\/web-fetch-tool/,
      /\/memory-tool/,
      /\/tool-search-tool/,
      /\/fine-grained-tool-streaming/,
      /\/token-efficient-tool-use/,
      /\/connectors\//,
      /\/skills/,
      /\/plugins/,
      /\/slash-commands/,
    ],
  },
  {
    cle: '06-securite',
    titre: 'Securite',
    description: 'injection de prompt, guardrails, gestion des secrets et des cles, deploiement sur',
    urls: [
      /\/security/,
      /\/iam/,
      /\/identity/,
      /\/api-keys?/,
      /\/admin-api/,
      /\/api\/admin/,
      /\/data-usage/,
      /\/privacy/,
      /\/legal/,
      /\/usage-policy/,
      /\/mitigate/,
      /\/reduce-hallucinations/,
      // Les pages "strengthen-guardrails" sont le coeur du domaine Securite du
      // blueprint. Seule reduce-latency releve vraiment de l optimisation.
      /\/reduce-prompt-leak/,
      /\/handle-streaming-refusals/,
      /\/increase-consistency/,
      /keep-claude-in-character/,
      /guardrails?\//,
      /\/prompt-injection/,
      /\/safety/,
      /\/moderation/,
      /\/harmful/,
      /\/jailbreak/,
      /\/devcontainer/,
      /\/network-config/,
      /\/sandboxing/,
      /\/permissions?/,
      // "Identity, Secrets and Key Management" = cles d API et identifiants entre
      // dev et prod. Motifs cibles, et non /manage-claude/ en entier, qui ramenait
      // 70 000 mots d administration d entreprise hors blueprint.
      /\/authentication/,
      /\/service-accounts?/,
      /content-moderation/,
      /\/refusals-and-fallback/,
    ],
    motsCles: ['prompt injection', 'guardrail', 'jailbreak'],
    exclureUrls: [/\/reduce-latency/], // celle-la releve de l optimisation, pas de la securite
  },
  {
    cle: '02-cout-optimisation',
    titre: 'Cout et optimisation',
    description: 'prompt caching, Message Batches API, comptage de tokens, tarifs, choix de modele',
    urls: [
      /prompt-caching/,
      /\/batch/,
      /\/message-batches/,
      /token-counting/,
      /count.*tokens/,
      /\/pricing/,
      /\/cost/,
      /\/usage-cost/,
      /choosing-?a?-?model/,
      /model-?selection/,
      /\/models-overview/,
      /\/models\b/,
      /\/context-windows/,
      /\/latency/,
      /reducing-latency/,
      /\/glossary/,
      /\/rate-limits/,
      /\/service-tiers/,
      /\/priority-tier/,
      /\/cache-diagnostics/,
      /\/effort/,
      /\/fast-mode/,
      /\/thinking-steering-and-cost/,
      /\/fallback-credit/,
      /\/model-deprecations/,
      /\/about-claude\//, // modeles, comparatifs, guides de migration
      /\/test-and-evaluate\//, // evals et debogage : le blueprint les compte a part
    ],
    motsCles: ['prompt caching', 'batches api', 'cache_control'],
  },
  {
    cle: '01-api-messages',
    titre: 'API Messages',
    description: 'API Messages, streaming, vision, extended thinking, erreurs, versions de modeles',
    urls: [
      /\/api\/messages/,
      /\/api\/.*message/,
      /\/messages\b/,
      /\/streaming/,
      /\/vision/,
      /\/pdf-support/,
      /\/files/,
      /extended-thinking/,
      /\/errors/,
      /\/versioning/,
      /\/client-sdks/,
      /\/openai-sdk/,
      /\/get-started/,
      /\/overview/,
      /\/intro/,
      /\/quickstart/,
      /\/citations/,
      /\/embeddings/,
      /\/search-results/,
      /\/structured-outputs/,
      /\/json-mode/,
      /\/stop-sequences/,
      /\/multilingual/,
      /amazon-bedrock/,
      /vertex-ai/,
      /\/claude-in-/,
      /\/api\//,
      // Rattrapages larges, evalues en dernier : tout ce qui reste du guide
      // "build with claude" et des SDK clients atterrit ici.
      /\/build-with-claude\//,
      /\/cli-sdks-libraries\//,
      /\/docs\/en\/claude\//,
      /claude_api_primer/,
    ],
  },
];

// Themes complementaires : le blueprint couvre aussi le prompt engineering,
// les evals et la conception d'application. On les repartit sur les fichiers
// existants plutot que d'en creer un septieme.
const REGLES_COMPLEMENTAIRES = [
  { motif: /prompt-engineering|\/prompt\/|be-clear-direct|chain-of-thought|few-?shot|system-prompt|prompt-templates|xml-tags|prefill|\/context-|\/long-context|\/prompt-improver|\/prompt-generator/, cle: '01-api-messages' },
  { motif: /\/test-and-evaluate|\/evals?\b|\/develop-tests|success-criteria|\/eval-tool|\/debug/, cle: '02-cout-optimisation' },
];

/** Renvoie { theme, motif } ; theme vaut null si la page est ecartee. */
function classer(url, titre, mots) {
  const tropLongue = mots > MAX_MOTS_PAR_PAGE;
  const raisonTropLongue = `page de ${mots} mots : reference auto-generee, au-dela du seuil`;
  // La liste blanche court-circuite la liste noire, mais jamais le garde-fou.
  for (const b of LISTE_BLANCHE) {
    if (b.motif.test(url)) {
      return tropLongue ? { theme: null, motif: raisonTropLongue } : { theme: b.cle, motif: null };
    }
  }
  for (const n of LISTE_NOIRE) {
    if (n.motif.test(url)) return { theme: null, motif: n.raison };
  }
  if (tropLongue) {
    return { theme: null, motif: raisonTropLongue };
  }
  for (const t of THEMES) {
    if (t.exclureUrls && t.exclureUrls.some((r) => r.test(url))) continue;
    if (t.urls.some((r) => r.test(url))) return { theme: t.cle, motif: null };
  }
  for (const r of REGLES_COMPLEMENTAIRES) {
    if (r.motif.test(url)) return { theme: r.cle, motif: null };
  }
  // Dernier recours : mots-cles dans le titre.
  const tt = (titre || '').toLowerCase();
  for (const t of THEMES) {
    if (t.motsCles && t.motsCles.some((k) => tt.includes(k))) return { theme: t.cle, motif: null };
  }
  return { theme: null, motif: 'aucun theme correspondant' };
}

function etage2Inventaire() {
  console.log('\n===== ETAGE 2 : inventaire =====\n');
  const inventaire = [];
  const vusUrl = new Set();

  const ajouter = (url, titre, texte, origine) => {
    const cle = url.replace(/\.md$/, '').replace(/\/$/, '');
    if (vusUrl.has(cle)) return;
    const mots = compterMots(texte);
    if (!texte || mots < 40) return; // page vide ou stub
    vusUrl.add(cle);
    const c = classer(url, titre, mots);
    inventaire.push({ url, titre, origine, mots, theme: c.theme, motifEcart: c.motif });
  };

  // a) pages markdown telechargees une par une (source la plus propre)
  if (fs.existsSync(DIR_PAGES)) {
    for (const f of fs.readdirSync(DIR_PAGES)) {
      const chemin = path.join(DIR_PAGES, f);
      const texte = fs.readFileSync(chemin, 'utf8');
      const url = urlDepuisNomFichier(f, texte);
      ajouter(url, titreDe(texte, url), texte, 'page');
    }
  }

  // b) MCP : decoupage du llms-full
  const cheminMcp = path.join(DIR_RAW, 'mcp-llms-full.txt');
  if (fs.existsSync(cheminMcp)) {
    for (const p of decouperLlmsFull(fs.readFileSync(cheminMcp, 'utf8'))) {
      ajouter(p.url, p.titre, p.texte, 'mcp-full');
    }
  }

  // c) plateforme : decoupage du llms-full, en secours des pages manquantes
  const cheminPf = path.join(DIR_RAW, 'platform-llms-full.txt');
  if (fs.existsSync(cheminPf)) {
    for (const p of decouperLlmsFull(fs.readFileSync(cheminPf, 'utf8'))) {
      ajouter(p.url, p.titre, p.texte, 'platform-full');
    }
  }

  fs.writeFileSync(FICHIER_INVENTAIRE, JSON.stringify(inventaire, null, 2), 'utf8');
  console.log(`   ${inventaire.length} pages uniques inventoriees -> raw/_inventaire.json`);

  const parTheme = {};
  for (const e of inventaire) {
    const k = e.theme || '(ecartee)';
    parTheme[k] = parTheme[k] || { pages: 0, mots: 0 };
    parTheme[k].pages++;
    parTheme[k].mots += e.mots;
  }
  for (const k of Object.keys(parTheme).sort()) {
    console.log(
      `   ${k.padEnd(22)} ${String(parTheme[k].pages).padStart(4)} pages  ${String(
        parTheme[k].mots
      ).padStart(8)} mots`
    );
  }

  // Journal des pages ecartees : indispensable pour verifier qu'aucun sujet
  // du blueprint n'est passe a la trappe.
  const ecartees = inventaire.filter((e) => !e.theme).sort((a, b) => b.mots - a.mots);
  fs.writeFileSync(
    path.join(DIR_RAW, '_ecartees.json'),
    JSON.stringify(ecartees.map(({ url, titre, mots, motifEcart }) => ({ url, titre, mots, motifEcart })), null, 2),
    'utf8'
  );
  const parMotif = {};
  for (const e of ecartees) {
    parMotif[e.motifEcart] = parMotif[e.motifEcart] || { n: 0, m: 0 };
    parMotif[e.motifEcart].n++;
    parMotif[e.motifEcart].m += e.mots;
  }
  console.log('\n   Pages ecartees (detail dans raw/_ecartees.json) :');
  for (const [motif, v] of Object.entries(parMotif).sort((a, b) => b[1].m - a[1].m)) {
    console.log(`     ${String(v.n).padStart(3)} pages  ${String(v.m).padStart(8)} mots  ${motif}`);
  }
  return inventaire;
}

/** Retrouve l'URL d'origine d'une page a partir de son nom de fichier / contenu. */
function urlDepuisNomFichier(nomFichier, texte) {
  const m = texte.match(/^(?:\*\*URL:\*\*|Source:)\s*(https?:\/\/\S+)/m);
  if (m) return m[1];
  const base = nomFichier.replace(/\.md$/, '');
  const i = base.indexOf('_');
  const hote = i === -1 ? base : base.slice(0, i);
  const chemin = i === -1 ? '' : base.slice(i + 1).replace(/_/g, '/');
  return `https://${hote}/${chemin}`;
}

// --------------------------------------------------------------------------
// ETAGE 3 : assemblage des fichiers thematiques
// --------------------------------------------------------------------------

function texteDePage(entree) {
  // Le texte est relu depuis le disque au moment de l'assemblage, pour ne pas
  // garder 25 Mo en memoire pendant l'inventaire.
  if (entree.origine === 'page') {
    const f = path.join(DIR_PAGES, nomFichierPour(entree.url));
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  }
  const fichier =
    entree.origine === 'mcp-full' ? 'mcp-llms-full.txt' : entree.origine === 'platform-full' ? 'platform-llms-full.txt' : null;
  if (fichier) {
    const cache = texteDePage._cache || (texteDePage._cache = {});
    if (!cache[fichier]) {
      const p = path.join(DIR_RAW, fichier);
      cache[fichier] = fs.existsSync(p) ? decouperLlmsFull(fs.readFileSync(p, 'utf8')) : [];
    }
    const trouve = cache[fichier].find((x) => x.url === entree.url);
    if (trouve) return trouve.texte;
  }
  return '';
}

/** Nettoyage leger : les balises MDX et le bruit de navigation genent NotebookLM. */
function nettoyer(texte, titre, urlPage) {
  let t = texte
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '') // frontmatter
    .replace(/<Frame[^>]*>|<\/Frame>/g, '')
    .replace(/<div\s*\/>/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  // La page repete souvent son propre titre en H1 : on l'enleve, l'en-tete
  // que l'on ajoute juste au-dessus fait deja le travail.
  t = t.replace(/^#\s+(.+?)\r?\n+/, (bloc, h1) => (h1.trim() === String(titre).trim() ? '' : bloc));

  // Liens relatifs -> absolus, pour que chaque question puisse citer une URL
  // complete a l'etape 2.
  try {
    const origine = new URL(urlPage).origin;
    t = t.replace(/\]\((\/[^)\s]*)\)/g, (_, chemin) => `](${origine}${chemin})`);
  } catch (e) {
    /* URL non parsable : on laisse le texte tel quel */
  }
  return t.trim();
}

function etage3Assemblage(inventaire) {
  console.log('\n===== ETAGE 3 : assemblage du corpus =====\n');
  assurerDossier(DIR_CORPUS);
  // On repart d'un dossier propre : sinon un decoupage precedent (01a, 01b...)
  // laisserait des fichiers orphelins que l'on enverrait par erreur a NotebookLM.
  for (const f of fs.readdirSync(DIR_CORPUS)) {
    if (f.endsWith('.md')) fs.unlinkSync(path.join(DIR_CORPUS, f));
  }

  const resultats = [];

  for (const theme of THEMES) {
    const pages = inventaire
      .filter((e) => e.theme === theme.cle)
      .sort((a, b) => a.url.localeCompare(b.url));
    if (!pages.length) continue;

    // Repartition en tranches sous le plafond de mots.
    const tranches = [];
    let courante = [];
    let motsCourants = 0;
    for (const p of pages) {
      if (courante.length && motsCourants + p.mots > MAX_MOTS_PAR_FICHIER - MARGE_SOMMAIRE) {
        tranches.push(courante);
        courante = [];
        motsCourants = 0;
      }
      courante.push(p);
      motsCourants += p.mots;
    }
    if (courante.length) tranches.push(courante);

    tranches.forEach((tranche, idx) => {
      const suffixe = tranches.length > 1 ? String.fromCharCode(97 + idx) : '';
      const nom = theme.cle.replace(/^(\d\d)-/, `$1${suffixe}-`) + '.md';
      const chemin = path.join(DIR_CORPUS, nom);

      const sortie = [];
      sortie.push(`# ${theme.titre}${tranches.length > 1 ? ` (partie ${idx + 1}/${tranches.length})` : ''}`);
      sortie.push('');
      sortie.push(`> ${theme.description}`);
      sortie.push('>');
      sortie.push(`> Corpus de revision CCDV-F. ${tranche.length} pages de documentation officielle Anthropic.`);
      sortie.push('');
      sortie.push('## Sommaire');
      sortie.push('');
      tranche.forEach((p, i) => {
        sortie.push(`${i + 1}. **${p.titre}** — ${p.url}`);
      });
      sortie.push('');
      sortie.push('---');
      sortie.push('');

      tranche.forEach((p) => {
        sortie.push(`# ${p.titre}`);
        sortie.push('');
        sortie.push(`**Source :** ${p.url}`);
        sortie.push('');
        sortie.push(nettoyer(texteDePage(p), p.titre, p.url));
        sortie.push('');
        sortie.push('---');
        sortie.push('');
      });

      const contenu = sortie.join('\n');
      fs.writeFileSync(chemin, contenu, 'utf8');
      resultats.push({
        fichier: nom,
        pages: tranche.length,
        mots: compterMots(contenu),
        octets: Buffer.byteLength(contenu, 'utf8'),
      });
    });
  }
  return resultats;
}

// --------------------------------------------------------------------------
// Point d'entree
// --------------------------------------------------------------------------

(async () => {
  const t0 = Date.now();
  await etage1Telechargement();
  const inventaire = etage2Inventaire();
  const resultats = etage3Assemblage(inventaire);

  console.log('\n===== RESULTAT =====\n');
  const totalPagesRetenues = resultats.reduce((s, r) => s + r.pages, 0);
  console.log(`Pages telechargees cette fois : ${stats.reseau}`);
  console.log(`Pages deja en cache           : ${stats.cache}`);
  console.log(`Echecs                        : ${stats.echecs}`);
  console.log(`Pages inventoriees            : ${inventaire.length}`);
  console.log(`Pages retenues dans le corpus : ${totalPagesRetenues}`);
  console.log('');
  console.log('Fichier'.padEnd(26) + 'Pages'.padStart(7) + 'Mots'.padStart(10) + 'Taille'.padStart(12));
  console.log('-'.repeat(55));
  for (const r of resultats) {
    const alerte = r.mots > MAX_MOTS_PAR_FICHIER ? '  !! DEPASSE' : '';
    console.log(
      r.fichier.padEnd(26) +
        String(r.pages).padStart(7) +
        String(r.mots).padStart(10) +
        formaterOctets(r.octets).padStart(12) +
        alerte
    );
  }
  console.log('-'.repeat(55));
  console.log(
    'TOTAL'.padEnd(26) +
      String(totalPagesRetenues).padStart(7) +
      String(resultats.reduce((s, r) => s + r.mots, 0)).padStart(10) +
      formaterOctets(resultats.reduce((s, r) => s + r.octets, 0)).padStart(12)
  );
  console.log(`\nTermine en ${Math.round((Date.now() - t0) / 1000)} s. Corpus dans docs-corpus/`);
  if (stats.echecs) console.log(`Echecs detailles dans raw/_echecs.json — relancer le script les reessaiera.`);
})();
