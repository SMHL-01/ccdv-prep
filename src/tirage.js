/* ============================================================
   TIRAGE — composition d'un examen blanc pondere par le blueprint.

   La banque se remplit sous-domaine par sous-domaine. Le tirage doit
   donc rester juste quand une partie du blueprint n'a pas encore de
   questions : on repartit sur ce qui EXISTE, en respectant les poids
   relatifs, et l'application affiche a cote quelle part du blueprint
   est reellement couverte ce jour-la.
   ============================================================ */

import { SOUS_DOMAINES, questionsDe, NB_QUESTIONS_EXAMEN } from './banque.js'

/** Melange de Fisher-Yates. Sur une copie : la banque ne doit pas bouger. */
export function melanger(tableau) {
  const t = [...tableau]
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[t[i], t[j]] = [t[j], t[i]]
  }
  return t
}

/**
 * Repartit `total` questions entre les sous-domaines disponibles,
 * proportionnellement a leur poids, par la methode des plus forts restes :
 * on attribue d'abord la partie entiere du quota, puis on distribue les
 * places restantes aux plus grandes decimales. Sans cela, arrondir chaque
 * quota separement fait perdre ou gagner deux ou trois questions.
 */
function repartir(disponibles, total) {
  const poidsTotal = disponibles.reduce((s, d) => s + d.poids, 0)
  if (poidsTotal === 0) return new Map()

  const quotas = disponibles.map((d) => {
    const exact = (total * d.poids) / poidsTotal
    return { nom: d.nom, exact, entier: Math.floor(exact), reste: exact - Math.floor(exact), max: d.nbDispo }
  })

  // On ne peut pas demander plus de questions qu'il n'en existe.
  for (const q of quotas) q.entier = Math.min(q.entier, q.max)

  let restant = total - quotas.reduce((s, q) => s + q.entier, 0)
  const parReste = [...quotas].sort((a, b) => b.reste - a.reste)
  // Plusieurs passes : un sous-domaine peut etre sature avant que tout soit
  // distribue, et il faut alors reporter sur les autres.
  let progresse = true
  while (restant > 0 && progresse) {
    progresse = false
    for (const q of parReste) {
      if (restant === 0) break
      if (q.entier < q.max) {
        q.entier++
        restant--
        progresse = true
      }
    }
  }

  return new Map(quotas.map((q) => [q.nom, q.entier]))
}

/**
 * Compose un examen blanc.
 * Renvoie { questions, repartition, poidsCouvert, complet } — `complet` est
 * faux si la banque n'a pas fourni le compte demande, ce que l'ecran signale
 * plutot que de le masquer.
 */
export function tirerExamen(total = NB_QUESTIONS_EXAMEN) {
  const disponibles = SOUS_DOMAINES.map((sd) => ({ ...sd, nbDispo: questionsDe(sd.nom).length })).filter(
    (sd) => sd.nbDispo > 0
  )

  const quotas = repartir(disponibles, total)

  const questions = []
  const repartition = []
  for (const sd of disponibles) {
    const n = quotas.get(sd.nom) || 0
    if (n === 0) continue
    questions.push(...melanger(questionsDe(sd.nom)).slice(0, n))
    repartition.push({ nom: sd.nom, domaine: sd.domaine, poids: sd.poids, n })
  }

  const poidsCouvert = disponibles.reduce((s, d) => s + d.poids, 0)
  return {
    questions: melanger(questions),
    repartition: repartition.sort((a, b) => b.n - a.n),
    poidsCouvert,
    complet: questions.length === total,
  }
}

/** Tirage libre pour l'entrainement : filtres, puis melange. */
export function tirerEntrainement({ domaine, sousDomaine, difficulte, questions, limite = 20 }) {
  let lot = questions
  if (domaine) lot = lot.filter((q) => q.domain === domaine)
  if (sousDomaine) lot = lot.filter((q) => q.subdomain === sousDomaine)
  if (difficulte) lot = lot.filter((q) => q.difficulty === difficulte)
  return melanger(lot).slice(0, limite)
}
