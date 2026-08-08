/* ============================================================
   TRANSFERT — sortir sa progression du navigateur, et l'y remettre.

   Deux besoins, qui ne demandent pas la meme chose du fichier :

   RELIRE SANS PERTE. Le localStorage est fragile : un nettoyage de
   navigateur, un changement d'appareil, et des semaines de revision
   disparaissent. L'import doit restituer l'etat A L'IDENTIQUE, fiches
   de repetition espacee comprises.

   ETRE LU PAR UN HUMAIN. « CLH-001, faux » ne s'analyse pas. Il faut
   le concept teste, l'enonce, la reponse donnee et la bonne — sinon le
   fichier ne sert qu'a la machine qui l'a ecrit.

   Ces deux besoins tirent en sens inverse : l'un veut l'etat brut,
   l'autre veut du texte. Le fichier porte donc les DEUX. « reponses »
   est la vue lisible, enrichie depuis la banque de questions ;
   « progression » est l'etat brut, et c'est lui seul que l'import
   relit. Aucun risque qu'une reconstruction depuis la vue lisible
   perde un champ en chemin : elle n'a jamais lieu.

   Ce module ne connait ni la banque ni le localStorage : il recoit un
   etat et un catalogue, il rend un objet. C'est ce qui le rend
   verifiable hors navigateur (voir verifier-transfert.js).
   ============================================================ */

export const FORMAT = 'ccdv-prep/progression'
export const VERSION_FORMAT = 1

/* ------------------------------------------------------------ DATES */

/* Jour local, AAAA-MM-JJ. Passer par toISOString() decalerait d'un jour les
   horodatages de minuit dans les fuseaux a l'est de Greenwich — or les fiches
   de revision sont justement calees sur minuit local. */
function jourISO(ms) {
  const d = new Date(ms)
  const deuxChiffres = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`
}

function instantISO(ms) {
  return new Date(ms).toISOString()
}

/** ccdv-prep-progression-2026-08-08.json */
export function nomFichier(maintenant = Date.now()) {
  return `ccdv-prep-progression-${jourISO(maintenant)}.json`
}

/* ------------------------------------------------------------ RESUME */

/* Derniere reponse a chaque question. Les reponses sont empilees dans l'ordre
   chronologique : la derniere ecriture pour un id est la plus recente. Meme
   convention que statistiques() dans stockage.js — reviser trois fois la meme
   question ne doit pas peser trois fois. */
function dernieresReponses(reponses) {
  const m = new Map()
  for (const r of reponses) m.set(r.id, r)
  return m
}

function tauxPar(champ, dernieres) {
  const par = new Map()
  for (const r of dernieres.values()) {
    const cle = r[champ]
    if (!cle) continue
    const e = par.get(cle) || { repondu: 0, juste: 0 }
    e.repondu++
    if (r.juste) e.juste++
    par.set(cle, e)
  }
  return [...par.entries()]
    .map(([nom, e]) => ({
      nom,
      repondu: e.repondu,
      juste: e.juste,
      taux: Math.round((100 * e.juste) / e.repondu),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom))
}

/** Chiffres de tete : de quoi juger un fichier sans le depiler ligne a ligne. */
export function resumer(progression) {
  const reponses = progression.reponses || []
  const dernieres = dernieresReponses(reponses)
  const justes = [...dernieres.values()].filter((r) => r.juste).length
  const fiches = Object.values(progression.fiches || {})
  const enCours = (f) => f.prochaine !== null && f.prochaine !== undefined
  return {
    questionsRepondues: dernieres.size,
    reponsesTotales: reponses.length,
    bonnesReponses: justes,
    tauxReussite: dernieres.size ? Math.round((100 * justes) / dernieres.size) : null,
    examensPasses: (progression.examens || []).length,
    fichesEnCours: fiches.filter(enCours).length,
    fichesAcquises: fiches.filter((f) => !enCours(f)).length,
    parDomaine: tauxPar('domain', dernieres),
    parSousDomaine: tauxPar('subdomain', dernieres),
  }
}

/* ------------------------------------------------------------ EXPORT */

/* Texte d'une option depuis sa cle. Rend undefined si la question n'est pas au
   catalogue : l'enrichissement est un bonus, jamais une condition. */
function textesOptions(question, cles) {
  if (!question || !Array.isArray(cles)) return undefined
  return cles.map((c) => question.options?.find((o) => o.key === c)?.text_en ?? c)
}

function enrichirReponse(r, question) {
  const bonne = r.correct ?? question?.correct ?? null
  return {
    id: r.id,
    date: instantISO(r.date),
    domaine: r.domain,
    sousDomaine: r.subdomain,
    difficulte: r.difficulty,
    concept: question?.concept,
    enonce: question?.question_en,
    enonce_fr: question?.question_fr,
    juste: r.juste,
    reponseDonnee: r.choix ?? null,
    reponseDonnee_texte: textesOptions(question, r.choix),
    bonneReponse: bonne,
    bonneReponse_texte: textesOptions(question, bonne),
    // Sans ces mentions, une reponse enregistree avant que le format ne retienne
    // le choix se lirait comme une abstention, et une question retiree de la
    // banque comme une question sans enonce. Deux contresens a l'analyse.
    ...(r.choix === undefined
      ? { note: 'reponse donnee non enregistree — anterieure a cette version du format' }
      : {}),
    ...(question ? {} : { note_question: 'question absente de la banque actuelle' }),
  }
}

function enrichirFiche(id, f, question) {
  return {
    id,
    concept: question?.concept,
    sousDomaine: question?.subdomain,
    echecs: f.echecs,
    palier: f.palier,
    prochaineRevision: f.prochaine ? jourISO(f.prochaine) : null,
    acquise: f.prochaine === null || f.prochaine === undefined,
  }
}

/** Tous les identifiants cites par une progression : de quoi savoir quelles
    questions charger avant d'appeler construireExport. */
export function idsCites(progression) {
  const ids = new Set()
  for (const r of progression.reponses || []) ids.add(r.id)
  for (const id of Object.keys(progression.fiches || {})) ids.add(id)
  return [...ids]
}

/**
 * Construit l'objet exporte.
 * @param {object} progression etat brut du localStorage
 * @param {Map<string,object>} catalogue id -> question complete, pour l'enrichissement
 * @param {number} maintenant horodatage de generation, injectable pour les tests
 */
export function construireExport(progression, catalogue = new Map(), maintenant = Date.now()) {
  const reponses = [...(progression.reponses || [])].sort((a, b) => a.date - b.date)
  const fiches = progression.fiches || {}

  return {
    format: FORMAT,
    version: VERSION_FORMAT,
    genere: instantISO(maintenant),
    commentaire:
      'Export de progression ccdv-prep. « reponses », « fiches » et « examens » sont la vue lisible, ' +
      'enrichie depuis la banque de questions. « progression » est l etat brut du navigateur : c est lui, ' +
      'et lui seul, que l import relit — les vues lisibles sont ignorees a la relecture.',
    resume: resumer(progression),
    reponses: reponses.map((r) => enrichirReponse(r, catalogue.get(r.id))),
    fiches: Object.entries(fiches)
      .map(([id, f]) => enrichirFiche(id, f, catalogue.get(id)))
      .sort((a, b) => a.id.localeCompare(b.id)),
    examens: (progression.examens || []).map((e) => ({ ...e, date: instantISO(e.date) })),
    progression,
  }
}

/* ------------------------------------------------------------ IMPORT */

/**
 * Relit un fichier exporte. Leve une Error au message affichable si le fichier
 * n'est pas exploitable : mieux vaut un refus clair qu'un import a moitie fait.
 */
export function lireExport(texte) {
  let doc
  try {
    doc = JSON.parse(texte)
  } catch {
    throw new Error('Ce fichier n’est pas du JSON valide.')
  }
  if (!doc || typeof doc !== 'object') {
    throw new Error('Ce fichier ne contient pas un export de progression.')
  }
  if (doc.format !== FORMAT) {
    throw new Error('Ce fichier n’est pas un export de progression ccdv-prep.')
  }
  if (doc.version !== VERSION_FORMAT) {
    throw new Error(
      `Export de version ${doc.version} non reconnu — cette application lit la version ${VERSION_FORMAT}.`
    )
  }
  const p = doc.progression
  if (!p || !Array.isArray(p.reponses) || typeof p.fiches !== 'object' || p.fiches === null) {
    throw new Error('L’export est incomplet : la progression brute manque ou est abîmée.')
  }
  return {
    genere: doc.genere,
    progression: { version: 1, reponses: p.reponses, fiches: p.fiches, examens: p.examens || [] },
    resume: doc.resume || resumer(p),
  }
}

/**
 * Fusionne deux progressions.
 *
 * Les reponses sont des FAITS DATES : on les reunit toutes, en dedoublonnant
 * sur (question, instant) — reimporter deux fois le meme fichier ne doit rien
 * ajouter.
 *
 * Les fiches sont un ETAT, pas un journal : on ne peut pas les additionner. On
 * retient celle du cote qui a repondu a cette question le plus recemment,
 * c'est-a-dire celle qui reflete le dernier evenement connu. Le compteur
 * d'echecs garde le maximum des deux : il ne redescend jamais.
 */
export function fusionner(actuel, importe) {
  const vues = new Set()
  const reponses = []
  for (const r of [...(actuel.reponses || []), ...(importe.reponses || [])]) {
    const cle = `${r.id}@${r.date}`
    if (vues.has(cle)) continue
    vues.add(cle)
    reponses.push(r)
  }
  reponses.sort((a, b) => a.date - b.date)

  const dernierInstant = (liste) => {
    const m = new Map()
    for (const r of liste || []) if (!m.has(r.id) || r.date > m.get(r.id)) m.set(r.id, r.date)
    return m
  }
  const instantsA = dernierInstant(actuel.reponses)
  const instantsI = dernierInstant(importe.reponses)

  const fichesA = actuel.fiches || {}
  const fichesI = importe.fiches || {}
  const fiches = {}
  for (const id of new Set([...Object.keys(fichesA), ...Object.keys(fichesI)])) {
    const a = fichesA[id]
    const i = fichesI[id]
    if (!a || !i) {
      fiches[id] = a || i
      continue
    }
    const retenue = (instantsI.get(id) ?? -1) > (instantsA.get(id) ?? -1) ? i : a
    fiches[id] = { ...retenue, echecs: Math.max(a.echecs || 0, i.echecs || 0) }
  }

  const vusExamens = new Set()
  const examens = []
  for (const e of [...(actuel.examens || []), ...(importe.examens || [])]) {
    const cle = `${e.date}@${e.score}`
    if (vusExamens.has(cle)) continue
    vusExamens.add(cle)
    examens.push(e)
  }
  examens.sort((a, b) => a.date - b.date)

  return { version: 1, reponses, fiches, examens }
}

/* ------------------------------------------------------------ FICHIERS */

/* Ces deux fonctions touchent au DOM, mais seulement a l'appel : le module
   reste importable hors navigateur, donc verifiable en Node. */

export function telecharger(nom, texte) {
  const url = URL.createObjectURL(new Blob([texte], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  // Revoquer dans la foulee annule le telechargement sur certains navigateurs.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function lireFichier(fichier) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader()
    lecteur.onload = () => resoudre(String(lecteur.result))
    lecteur.onerror = () => rejeter(new Error('Impossible de lire ce fichier.'))
    lecteur.readAsText(fichier)
  })
}
