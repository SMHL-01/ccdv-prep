/* ============================================================
   BANQUE — chargement des questions et etat de couverture.

   Contrainte structurante : AUCUNE liste de fichiers codee en dur.
   import.meta.glob aspire tout questions/*.json au moment du build,
   donc chaque sous-domaine genere plus tard apparait tout seul au
   prochain build, sans toucher une ligne d'application.
   ============================================================ */

import blueprint from '../blueprint.json'

// eager: true incorpore les JSON dans le bundle plutot que de les charger en
// differe. C'est voulu : la banque fait quelques centaines de kilo-octets, et
// l'app doit pouvoir calculer sa couverture et tirer un examen des le premier
// ecran, sans cascade de requetes.
//
// Le motif negatif exclut les fichiers de meta (index des concepts, exemples de
// calibrage) DES LE BUILD. Les filtrer seulement a l'execution les laisserait
// dans le bundle en poids mort.
const modules = import.meta.glob(['../questions/*.json', '!../questions/_*.json'], { eager: true })

/** Nom de fichier depuis un chemin de glob. */
function nomFichier(chemin) {
  return chemin.split('/').pop()
}

/**
 * Deux formes de fichier sont acceptees :
 *   - { subdomain, weight, questions: [...] }  (fichiers de sous-domaine)
 *   - [ ... ]                                  (tableau nu)
 * Les fichiers prefixes d'un souligne sont de la meta (index des concepts,
 * exemples de calibrage) et ne sont pas de la matiere de revision.
 */
function extraire(module) {
  const contenu = module.default ?? module
  if (Array.isArray(contenu)) return contenu
  if (Array.isArray(contenu.questions)) return contenu.questions
  return []
}

export const QUESTIONS = Object.entries(modules)
  .filter(([chemin]) => !nomFichier(chemin).startsWith('_'))
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([chemin, module]) =>
    extraire(module).map((q) => ({
      ...q,
      fichier: nomFichier(chemin),
      // Valeurs de repli : un fichier ancien peut ne pas porter tous les champs
      // ajoutes ensuite. Mieux vaut une question affichable qu'un ecran blanc.
      difficulty: q.difficulty || 'moyen',
      nature: q.nature || 'judgment',
      type: q.type || (q.correct && q.correct.length > 1 ? 'multi' : 'single'),
    }))
  )

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

// --- Index -----------------------------------------------------------------

const parSousDomaine = new Map()
for (const sd of SOUS_DOMAINES) parSousDomaine.set(sd.nom, [])
for (const q of QUESTIONS) {
  // Une question dont le sous-domaine ne figure pas au blueprint serait
  // invisible dans les statistiques : on la rattache quand meme, en creant
  // l'entree, pour qu'elle apparaisse plutot que de disparaitre en silence.
  if (!parSousDomaine.has(q.subdomain)) parSousDomaine.set(q.subdomain, [])
  parSousDomaine.get(q.subdomain).push(q)
}

export function questionsDe(nomSousDomaine) {
  return parSousDomaine.get(nomSousDomaine) || []
}

export function questionsDuDomaine(nomDomaine) {
  return QUESTIONS.filter((q) => q.domain === nomDomaine)
}

export function questionParId(id) {
  return QUESTIONS.find((q) => q.id === id)
}

// --- Couverture ------------------------------------------------------------

/**
 * Etat de la banque par rapport au blueprint. C'est l'indicateur permanent
 * demande : combien de questions, combien de sous-domaines sur 25, et surtout
 * quelle PART DU POIDS de l'examen est couverte — le chiffre qui dit vraiment
 * ce qui manque, puisque les sous-domaines ne pesent pas pareil.
 */
export function couverture() {
  const details = SOUS_DOMAINES.map((sd) => ({
    ...sd,
    nbQuestions: questionsDe(sd.nom).length,
  }))
  const couverts = details.filter((d) => d.nbQuestions > 0)
  const poidsCouvert = couverts.reduce((s, d) => s + d.poids, 0)
  return {
    nbQuestions: QUESTIONS.length,
    nbSousDomainesCouverts: couverts.length,
    nbSousDomainesTotal: SOUS_DOMAINES.length,
    poidsCouvert,
    details,
    manquants: details.filter((d) => d.nbQuestions === 0).sort((a, b) => b.poids - a.poids),
  }
}
