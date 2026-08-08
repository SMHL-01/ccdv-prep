/* ============================================================
   STOCKAGE — progression et repetition espacee, dans le localStorage.

   Pas de compte, pas de serveur : toute la progression vit dans le
   navigateur. Le format est versionne, pour qu'une evolution future
   n'efface pas silencieusement l'historique.
   ============================================================ */

const CLE = 'ccdv-prep:progression:v1'

/* Champs d'une reponse enregistree :
     id, juste, date, domain, subdomain, difficulty  — depuis l'origine
     choix, correct                                  — ajoutes ensuite
   Les deux derniers sont FACULTATIFS : les reponses enregistrees avant leur
   ajout n'en ont pas, et doivent rester lisibles. C'est pourquoi la version
   du format ne bouge pas — ajouter un champ ne casse rien, l'effacer si.
   Tout code qui les lit doit donc traiter undefined comme « non enregistre »,
   a distinguer de [] qui veut dire « question laissee sans reponse ». */

/* Repetition espacee, telle que demandee : une question ratee revient a J+2,
   puis a J+7 si elle est reussie a J+2. Un nouvel echec la ramene a J+2.
   Une question reussie du premier coup n'entre jamais dans le cycle. */
const PALIERS_JOURS = [2, 7]

const JOUR_MS = 24 * 60 * 60 * 1000

function aujourdhui() {
  // On raisonne en jours calendaires locaux : une revision « due aujourd'hui »
  // doit l'etre des minuit, pas 24 h apres la minute exacte de l'echec.
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dansNJours(n) {
  return aujourdhui() + n * JOUR_MS
}

function vide() {
  return { version: 1, reponses: [], fiches: {} }
}

export function lire() {
  try {
    const brut = localStorage.getItem(CLE)
    if (!brut) return vide()
    const etat = JSON.parse(brut)
    if (etat.version !== 1) return vide()
    return { ...vide(), ...etat }
  } catch {
    // Stockage corrompu ou desactive (navigation privee stricte) : on repart
    // d'un etat vide plutot que de planter l'application.
    return vide()
  }
}

function ecrire(etat) {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat))
  } catch {
    /* quota plein ou stockage refuse : la session reste utilisable en memoire */
  }
}

/* undefined reste undefined : JSON.stringify le supprime, et l'absence du
   champ garde son sens de « non enregistre ». */
function cles(v) {
  if (v === undefined || v === null) return undefined
  return Array.isArray(v) ? [...v] : [v]
}

/**
 * Enregistre une reponse et met a jour la fiche de repetition espacee.
 * @param {string} id identifiant de la question
 * @param {boolean} juste
 * @param {object} meta { domain, subdomain, difficulty, choix, correct }
 */
export function enregistrerReponse(id, juste, meta = {}) {
  const etat = lire()
  etat.reponses.push({
    id,
    juste,
    date: Date.now(),
    domain: meta.domain,
    subdomain: meta.subdomain,
    difficulty: meta.difficulty,
    // « juste: false » ne dit pas CE QU'ON A REPONDU. Sans ces deux champs,
    // un export ne permet pas d'analyser les erreurs — seulement de les compter.
    choix: cles(meta.choix),
    correct: cles(meta.correct),
  })

  const fiche = etat.fiches[id] || { palier: -1, prochaine: null, echecs: 0 }
  if (juste) {
    if (fiche.palier >= 0) {
      // Reussie pendant une revision : on avance d'un palier, et on sort du
      // cycle une fois le dernier palier franchi.
      const suivant = fiche.palier + 1
      if (suivant >= PALIERS_JOURS.length) {
        fiche.palier = suivant
        fiche.prochaine = null
      } else {
        fiche.palier = suivant
        fiche.prochaine = dansNJours(PALIERS_JOURS[suivant])
      }
      etat.fiches[id] = fiche
    }
    // Reussie du premier coup et jamais ratee : rien a planifier.
  } else {
    fiche.echecs += 1
    fiche.palier = 0
    fiche.prochaine = dansNJours(PALIERS_JOURS[0])
    etat.fiches[id] = fiche
  }

  ecrire(etat)
  return etat
}

/** Identifiants dus aujourd'hui ou en retard. */
export function idsDus(etat = lire()) {
  const limite = aujourdhui() + JOUR_MS - 1
  return Object.entries(etat.fiches)
    .filter(([, f]) => f.prochaine !== null && f.prochaine <= limite)
    .sort((a, b) => a[1].prochaine - b[1].prochaine)
    .map(([id]) => id)
}

/** Sauvegarde d'un resultat d'examen blanc, pour la courbe de progression. */
export function enregistrerExamen(resultat) {
  const etat = lire()
  etat.examens = etat.examens || []
  etat.examens.push({ date: Date.now(), ...resultat })
  ecrire(etat)
  return etat
}

export function examens(etat = lire()) {
  return etat.examens || []
}

/**
 * Statistiques par domaine, ponderees comme l'examen.
 * On ne compte que la DERNIERE reponse a chaque question : reviser trois fois
 * la meme question ne doit pas peser trois fois dans le score.
 */
export function statistiques(etat = lire(), domaines = []) {
  const derniere = new Map()
  for (const r of etat.reponses) derniere.set(r.id, r)

  const parDomaine = new Map()
  for (const r of derniere.values()) {
    if (!r.domain) continue
    const e = parDomaine.get(r.domain) || { repondu: 0, juste: 0 }
    e.repondu++
    if (r.juste) e.juste++
    parDomaine.set(r.domain, e)
  }

  const lignes = domaines.map((d) => {
    const e = parDomaine.get(d.nom) || { repondu: 0, juste: 0 }
    return {
      nom: d.nom,
      poids: d.poids,
      repondu: e.repondu,
      juste: e.juste,
      taux: e.repondu ? (100 * e.juste) / e.repondu : null,
    }
  })

  // Score pondere : moyenne des taux par domaine ponderee par le poids de
  // l'examen, en n'incluant que les domaines effectivement travailles.
  const travailles = lignes.filter((l) => l.taux !== null)
  const poidsTravaille = travailles.reduce((s, l) => s + l.poids, 0)
  const scorePondere = poidsTravaille
    ? travailles.reduce((s, l) => s + (l.taux * l.poids) / poidsTravaille, 0)
    : null

  return {
    lignes,
    scorePondere,
    poidsTravaille,
    totalRepondu: derniere.size,
    totalReponses: etat.reponses.length,
  }
}

/** Serie de scores dans le temps, pour la progression. */
export function serieProgression(etat = lire(), taille = 20) {
  const derniers = etat.reponses.slice(-taille * 10)
  const points = []
  const fenetre = 10
  for (let i = fenetre; i <= derniers.length; i += fenetre) {
    const tranche = derniers.slice(i - fenetre, i)
    const juste = tranche.filter((r) => r.juste).length
    points.push(Math.round((100 * juste) / tranche.length))
  }
  return points.slice(-taille)
}

/**
 * Remplace integralement la progression stockee. Utilise par l'import, seul
 * endroit ou l'on ecrit un etat qui ne vient pas d'une reponse donnee ici.
 */
export function remplacer(progression) {
  const etat = { ...vide(), ...progression, version: 1 }
  ecrire(etat)
  return etat
}

export function reinitialiser() {
  try {
    localStorage.removeItem(CLE)
  } catch {
    /* rien a faire */
  }
}
