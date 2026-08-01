/* ============================================================
   BANQUE — metadonnees au demarrage, questions completes a la demande.

   Contrainte structurante : AUCUNE liste de fichiers codee en dur.
   import.meta.glob aspire tout questions/*.json, donc chaque
   sous-domaine genere plus tard apparait au prochain build.

   Deuxieme contrainte, de poids : a 400 questions les enonces, les
   options et les explications font plusieurs mega-octets. On ne
   charge au demarrage que le MANIFESTE — id, domaine, sous-domaine,
   difficulte, nature, type, fichier — de quoi calculer la couverture,
   remplir les filtres et tirer un examen. Les payloads complets
   n'arrivent qu'au lancement d'une serie, fichier par fichier.
   ============================================================ */

import blueprint from '../blueprint.json'
import manifeste from '../questions/_manifeste.json'

// eager: false — chaque entree est une FONCTION qui importe le fichier a la
// demande. Vite en fait autant de chunks separes, charges seulement quand on
// les appelle. Le motif negatif ecarte les fichiers de meta (manifeste, index
// des concepts, exemples) des la compilation.
const chargeurs = import.meta.glob(['../questions/*.json', '!../questions/_*.json'])

/** Metadonnees de toutes les questions. Disponibles immediatement. */
export const METADONNEES = manifeste.questions

// --- Blueprint aplati ------------------------------------------------------

/** Les 25 feuilles, chacune portant son domaine parent. */
export const SOUS_DOMAINES = blueprint.domaines.flatMap((d) =>
  d.sousDomaines.map((sd) => ({
    nom: sd.nom,
    poids: sd.poids,
    domaine: d.domaine,
    poidsDomaine: d.poids,
  }))
)

export const DOMAINES = blueprint.domaines.map((d) => ({
  nom: d.domaine,
  poids: d.poids,
  sousDomaines: d.sousDomaines.map((sd) => sd.nom),
}))

export const NB_QUESTIONS_EXAMEN = blueprint.questions_examen_blanc
export const DUREE_EXAMEN_MIN = blueprint.duree_minutes

// --- Index des metadonnees -------------------------------------------------

const parSousDomaine = new Map()
for (const sd of SOUS_DOMAINES) parSousDomaine.set(sd.nom, [])
for (const m of METADONNEES) {
  // Un sous-domaine absent du blueprint serait invisible dans les statistiques :
  // on cree l'entree plutot que de laisser la question disparaitre en silence.
  if (!parSousDomaine.has(m.subdomain)) parSousDomaine.set(m.subdomain, [])
  parSousDomaine.get(m.subdomain).push(m)
}

const parId = new Map(METADONNEES.map((m) => [m.id, m]))

export function metaDe(nomSousDomaine) {
  return parSousDomaine.get(nomSousDomaine) || []
}

export function metaParId(id) {
  return parId.get(id)
}

// --- Chargement a la demande ------------------------------------------------

// Un fichier charge reste en memoire : reviser deux fois le meme sous-domaine
// ne doit pas le retelecharger.
const cacheFichiers = new Map()

function cheminDe(fichier) {
  return Object.keys(chargeurs).find((c) => c.endsWith('/' + fichier))
}

/** Charge un fichier de sous-domaine et renvoie ses questions completes. */
async function chargerFichier(fichier) {
  if (cacheFichiers.has(fichier)) return cacheFichiers.get(fichier)
  const chemin = cheminDe(fichier)
  if (!chemin) {
    console.warn(`Fichier de questions introuvable : ${fichier}`)
    cacheFichiers.set(fichier, [])
    return []
  }
  const module = await chargeurs[chemin]()
  const contenu = module.default ?? module
  const lot = Array.isArray(contenu) ? contenu : contenu.questions || []
  const questions = lot.map((q) => ({
    ...q,
    fichier,
    difficulty: q.difficulty || 'moyen',
    nature: q.nature || 'judgment',
    type: q.type || (q.correct && q.correct.length > 1 ? 'multi' : 'single'),
  }))
  cacheFichiers.set(fichier, questions)
  return questions
}

/**
 * Prend une liste de METADONNEES et renvoie les questions completes
 * correspondantes, dans le meme ordre.
 *
 * Les fichiers necessaires sont charges en parallele, et une seule fois
 * chacun : un examen blanc qui pioche dans dix sous-domaines declenche dix
 * requetes, pas cinquante-trois.
 */
export async function chargerQuestions(metas) {
  const fichiers = [...new Set(metas.map((m) => m.fichier))]
  const lots = await Promise.all(fichiers.map(chargerFichier))
  const index = new Map()
  for (const lot of lots) for (const q of lot) index.set(q.id, q)
  return metas.map((m) => index.get(m.id)).filter(Boolean)
}

// --- Couverture ------------------------------------------------------------

/**
 * Etat de la banque par rapport au blueprint. C'est l'indicateur permanent :
 * combien de questions, combien de sous-domaines sur 25, et surtout quelle
 * PART DU POIDS de l'examen est couverte — le seul chiffre qui dise vraiment
 * ce qui manque, puisque les sous-domaines ne pesent pas pareil.
 *
 * Calcule sur le manifeste seul : aucun fichier de questions n'est charge.
 */
export function couverture() {
  const details = SOUS_DOMAINES.map((sd) => ({
    ...sd,
    nbQuestions: metaDe(sd.nom).length,
  }))
  const couverts = details.filter((d) => d.nbQuestions > 0)
  const poidsCouvert = couverts.reduce((s, d) => s + d.poids, 0)
  return {
    nbQuestions: METADONNEES.length,
    nbSousDomainesCouverts: couverts.length,
    nbSousDomainesTotal: SOUS_DOMAINES.length,
    poidsCouvert,
    details,
    manquants: details.filter((d) => d.nbQuestions === 0).sort((a, b) => b.poids - a.poids),
  }
}
