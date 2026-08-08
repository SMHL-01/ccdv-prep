import { useState, useEffect, useRef, useCallback } from 'react'
import CarteQuestion from './CarteQuestion.jsx'
import ListeOptions from './ListeOptions.jsx'
import Correction from './Correction.jsx'
import RecapExamen from './RecapExamen.jsx'
import { enregistrerReponse, enregistrerExamen } from '../stockage.js'
import { DUREE_EXAMEN_MIN } from '../banque.js'

/* ============================================================
   SERIE — deroule une liste de questions, dans deux regimes.

   ENTRAINEMENT : on valide, on est corrige tout de suite, on
   avance. C'est la qu'on apprend, la correction immediate est le
   coeur du mode.

   EXAMEN BLANC : rien n'est corrige avant la soumission finale, et
   la navigation est libre — Precedent, Suivant, drapeau « a revoir »,
   recapitulatif, retour sur n'importe quelle question pour changer
   sa reponse. C'est le fonctionnement de Pearson VUE, et c'est aussi
   ce qui evite qu'un clic malheureux fige une reponse pour de bon.

   Toutes les reponses vivent ICI, dans un tableau parallele aux
   questions. La carte est un composant controle : c'est ce qui rend
   le retour en arriere possible.
   ============================================================ */

function formaterDuree(ms) {
  if (ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const deuxChiffres = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${deuxChiffres(m)}:${deuxChiffres(s)}` : `${deuxChiffres(m)}:${deuxChiffres(s)}`
}

function memeEnsemble(a, b) {
  if (a.length !== b.length) return false
  const reste = [...b]
  return a.every((x) => reste.includes(x))
}

function ardoiseVierge(questions) {
  return questions.map(() => ({ choix: [], marquee: false, valide: false }))
}

export default function Serie({ questions, mode = 'libre', titre, onQuitter }) {
  const examen = mode === 'examen'

  const [index, setIndex] = useState(0)
  const [reponses, setReponses] = useState(() => ardoiseVierge(questions))
  // 'question' | 'recap' | 'bilan' — le recapitulatif n'existe qu'en examen.
  const [vue, setVue] = useState('question')
  const [confirmation, setConfirmation] = useState(false)

  // Chronometre de l'examen blanc. La date de fin est figee une fois pour
  // toutes : se fier a un compteur decremente a chaque rendu deriverait des
  // que l'onglet passe en arriere-plan.
  const finRef = useRef(null)
  if (examen && finRef.current === null) finRef.current = Date.now() + DUREE_EXAMEN_MIN * 60 * 1000
  const [restant, setRestant] = useState(examen ? DUREE_EXAMEN_MIN * 60 * 1000 : 0)

  // La soumission enregistre dans le localStorage : une seule fois, quelle
  // que soit la porte empruntee (bouton ou chronometre a zero).
  const soumisRef = useRef(false)

  // Les ecritures de la soumission ne doivent PAS vivre dans un updater
  // setReponses : React reexecute les updaters (deux fois en mode strict), ce
  // qui doublerait chaque enregistrement. On lit donc l'etat courant par une
  // reference tenue a jour a chaque rendu.
  const reponsesRef = useRef(reponses)
  reponsesRef.current = reponses

  const soumettre = useCallback(() => {
    if (soumisRef.current) return
    soumisRef.current = true

    const etat = reponsesRef.current
    let juste = 0
    questions.forEach((q, i) => {
      const bonne = etat[i].choix.length > 0 && memeEnsemble(etat[i].choix, q.correct)
      if (bonne) juste++
      // Une question laissee sans reponse compte comme ratee : elle doit
      // revenir dans les revisions, c'est justement celle qu'on ne sait pas.
      enregistrerReponse(q.id, bonne, {
        domain: q.domain,
        subdomain: q.subdomain,
        difficulty: q.difficulty,
      })
    })

    enregistrerExamen({
      total: questions.length,
      repondu: etat.filter((r) => r.choix.length > 0).length,
      juste,
      score: Math.round((100 * juste) / questions.length),
    })

    setVue('bilan')
  }, [questions])

  useEffect(() => {
    if (!examen || vue === 'bilan') return
    const t = setInterval(() => {
      const reste = finRef.current - Date.now()
      setRestant(reste)
      if (reste <= 0) soumettre()
    }, 1000)
    return () => clearInterval(t)
  }, [examen, vue, soumettre])

  function basculer(cle) {
    setReponses((etat) => {
      const r = etat[index]
      // En entrainement, une reponse validee est figee : la correction est
      // deja sous les yeux, changer d'avis n'aurait plus de sens.
      if (r.valide) return etat
      const multi = questions[index].type === 'multi'
      const choix = multi
        ? r.choix.includes(cle)
          ? r.choix.filter((x) => x !== cle)
          : [...r.choix, cle]
        : [cle]
      const suivant = [...etat]
      suivant[index] = { ...r, choix }
      return suivant
    })
  }

  function marquer() {
    setReponses((etat) => {
      const suivant = [...etat]
      suivant[index] = { ...suivant[index], marquee: !suivant[index].marquee }
      return suivant
    })
  }

  /** Entrainement seulement : valide la question courante et la corrige. */
  function valider() {
    const q = questions[index]
    const r = reponses[index]
    if (!r.choix.length || r.valide) return
    const bonne = memeEnsemble(r.choix, q.correct)
    enregistrerReponse(q.id, bonne, {
      domain: q.domain,
      subdomain: q.subdomain,
      difficulty: q.difficulty,
    })
    setReponses((etat) => {
      const suivant = [...etat]
      suivant[index] = { ...suivant[index], valide: true }
      return suivant
    })
  }

  function suivante() {
    if (index + 1 >= questions.length) {
      // En examen on passe par le recapitulatif ; en entrainement, la serie
      // est finie et on affiche le bilan directement.
      if (examen) setVue('recap')
      else setVue('bilan')
    } else {
      setIndex((i) => i + 1)
    }
  }

  function precedente() {
    setIndex((i) => Math.max(0, i - 1))
  }

  function allerA(i) {
    setIndex(i)
    setVue('question')
  }

  if (!questions.length) {
    return (
      <div className="vide">
        <p>Aucune question ne correspond à cette sélection.</p>
        <button className="bouton" onClick={onQuitter}>
          Retour
        </button>
      </div>
    )
  }

  const resultats = questions.map((q, i) => ({
    question: q,
    choix: reponses[i].choix,
    juste: reponses[i].choix.length > 0 && memeEnsemble(reponses[i].choix, q.correct),
  }))

  if (vue === 'bilan') {
    return <Bilan resultats={resultats} examen={examen} onQuitter={onQuitter} />
  }

  const entete = (
    <div className="entete">
      <h1>{titre}</h1>
      {examen && (
        <span className={`chrono ${restant < 5 * 60 * 1000 ? 'chrono-urgent' : ''}`}>
          {formaterDuree(restant)}
        </span>
      )}
    </div>
  )

  if (vue === 'recap') {
    return (
      <>
        {entete}
        <RecapExamen
          questions={questions}
          reponses={reponses}
          onAller={allerA}
          onReprendre={() => setVue('question')}
          onSoumettre={soumettre}
          confirmation={confirmation}
          onDemanderConfirmation={() => setConfirmation(true)}
          onAnnulerConfirmation={() => setConfirmation(false)}
        />
      </>
    )
  }

  const courante = reponses[index]
  const q = questions[index]
  const multi = q.type === 'multi'

  return (
    <>
      {entete}

      <CarteQuestion
        question={q}
        indexAffiche={index + 1}
        total={questions.length}
        choix={courante.choix}
        onBasculer={basculer}
        revele={courante.valide}
        marquee={courante.marquee}
        onMarquer={examen ? marquer : undefined}
      />

      {examen ? (
        <>
          <div className="navigation">
            <button className="bouton" onClick={precedente} disabled={index === 0}>
              ← Précédent
            </button>
            <button className="bouton bouton-principal" onClick={suivante}>
              {index + 1 === questions.length ? 'Récapitulatif' : 'Suivant →'}
            </button>
          </div>
          {multi && (
            <p className="note note-centree">
              {courante.choix.length}/{q.correct.length} sélectionnée
              {q.correct.length > 1 ? 's' : ''}
            </p>
          )}
          <div className="pile" style={{ marginTop: 'var(--e4)' }}>
            <button className="bouton" onClick={() => setVue('recap')}>
              Voir le récapitulatif ({reponses.filter((r) => r.choix.length).length}/
              {questions.length} répondues)
            </button>
            <button className="bouton" onClick={onQuitter}>
              Abandonner
            </button>
          </div>
        </>
      ) : (
        <div className="pile" style={{ marginTop: 'var(--e4)' }}>
          {!courante.valide ? (
            <button
              className="bouton bouton-principal"
              onClick={valider}
              disabled={!courante.choix.length}
            >
              {multi
                ? `Valider (${courante.choix.length}/${q.correct.length} sélectionnées)`
                : 'Valider'}
            </button>
          ) : (
            <button className="bouton bouton-principal" onClick={suivante}>
              {index + 1 === questions.length ? 'Terminer' : 'Suivante'}
            </button>
          )}
          <button className="bouton" onClick={onQuitter}>
            Abandonner
          </button>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------ BILAN */

function Bilan({ resultats, examen, onQuitter }) {
  const total = resultats.length
  const juste = resultats.filter((r) => r.juste).length
  const repondues = resultats.filter((r) => r.choix.length > 0).length
  // Score sur le total, comme l'examen reel : une question laissee de cote
  // ne s'efface pas du bareme.
  const score = total ? Math.round((100 * juste) / total) : 0

  const parDomaine = new Map()
  for (const r of resultats) {
    const e = parDomaine.get(r.question.domain) || { total: 0, juste: 0 }
    e.total++
    if (r.juste) e.juste++
    parDomaine.set(r.question.domain, e)
  }

  const rates = resultats.filter((r) => !r.juste)

  return (
    <>
      <div className="entete">
        <h1>{examen ? 'Résultat de l’examen blanc' : 'Série terminée'}</h1>
      </div>

      <div className="carte">
        <div className="couverture">
          <div className="couverture-case">
            <span className="couverture-chiffre">{score} %</span>
            <span className="couverture-libelle">score</span>
          </div>
          <div className="couverture-case">
            <span className="couverture-chiffre">{juste}</span>
            <span className="couverture-libelle">bonnes réponses</span>
          </div>
          <div className="couverture-case">
            <span className="couverture-chiffre">
              {repondues}/{total}
            </span>
            <span className="couverture-libelle">répondues</span>
          </div>
        </div>
      </div>

      <div className="carte">
        <div className="carte-titre">
          <h2>Par domaine</h2>
        </div>
        <table className="tableau">
          <thead>
            <tr>
              <th>Domaine</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {[...parDomaine.entries()].map(([nom, e]) => {
              const taux = Math.round((100 * e.juste) / e.total)
              return (
                <tr key={nom}>
                  <td>{nom}</td>
                  <td className="nombre">
                    <span className="mini-jauge">
                      <span style={{ width: `${taux}%` }} />
                    </span>
                    {taux} % ({e.juste}/{e.total})
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rates.length > 0 && (
        <div className="carte">
          <div className="carte-titre">
            <h2>À revoir ({rates.length})</h2>
          </div>
          <p className="note">
            Les {rates.length} question{rates.length > 1 ? 's' : ''} que vous avez ratée
            {rates.length > 1 ? 's' : ''} {rates.length > 1 ? 'seront' : 'sera'} à revoir dans 2
            jours, dans le mode <strong>Révisions du jour</strong> de l’accueil — pas un nouvel
            examen complet. Si vous {rates.length > 1 ? 'les' : 'la'} réussissez,{' '}
            {rates.length > 1 ? 'elles reviendront' : 'elle reviendra'} une dernière fois 7 jours
            après, puis {rates.length > 1 ? 'seront considérées' : 'sera considérée'} comme
            acquise{rates.length > 1 ? 's' : ''}.
          </p>

          {rates.map((r) => (
            <details key={r.question.id} className="revoir">
              <summary>
                <span className="revoir-enonce" lang="en">
                  {r.question.question_en}
                </span>
                {r.question.question_fr && (
                  <span className="revoir-enonce-fr" lang="fr">
                    {r.question.question_fr}
                  </span>
                )}
              </summary>
              <div className="revoir-detail">
                <ListeOptions question={r.question} choix={r.choix} revele />
                <Correction question={r.question} choix={r.choix} />
              </div>
            </details>
          ))}
        </div>
      )}

      <button className="bouton bouton-principal" onClick={onQuitter}>
        Terminer
      </button>
    </>
  )
}
