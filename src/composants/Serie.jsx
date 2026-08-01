import { useState, useEffect, useRef } from 'react'
import CarteQuestion from './CarteQuestion.jsx'
import { enregistrerReponse, enregistrerExamen } from '../stockage.js'
import { DUREE_EXAMEN_MIN } from '../banque.js'

/* ============================================================
   SERIE — deroule une liste de questions.

   Un seul composant sert les trois modes, qui ne different que
   par deux choses : la presence d'un chronometre, et le moment
   ou la correction s'affiche (immediatement, ou a la fin pour
   l'examen blanc, comme le jour J).
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

export default function Serie({ questions, mode = 'libre', titre, onQuitter }) {
  const [index, setIndex] = useState(0)
  const [reponses, setReponses] = useState([])
  const [termine, setTermine] = useState(false)
  const examen = mode === 'examen'

  // Chronometre de l'examen blanc. La date de fin est figee une fois pour
  // toutes : se fier a un compteur decremente a chaque rendu deriverait des
  // que l'onglet passe en arriere-plan.
  const finRef = useRef(null)
  if (examen && finRef.current === null) finRef.current = Date.now() + DUREE_EXAMEN_MIN * 60 * 1000
  const [restant, setRestant] = useState(examen ? DUREE_EXAMEN_MIN * 60 * 1000 : 0)

  useEffect(() => {
    if (!examen || termine) return
    const t = setInterval(() => {
      const reste = finRef.current - Date.now()
      setRestant(reste)
      if (reste <= 0) setTermine(true)
    }, 1000)
    return () => clearInterval(t)
  }, [examen, termine])

  function repondu(question, juste, choix) {
    enregistrerReponse(question.id, juste, {
      domain: question.domain,
      subdomain: question.subdomain,
      difficulty: question.difficulty,
    })
    setReponses((r) => [...r, { question, juste, choix }])
  }

  function suivante() {
    if (index + 1 >= questions.length) setTermine(true)
    else setIndex((i) => i + 1)
  }

  // Enregistrement du resultat d'examen, une seule fois, a la fin.
  const enregistreRef = useRef(false)
  useEffect(() => {
    if (!termine || !examen || enregistreRef.current) return
    enregistreRef.current = true
    const juste = reponses.filter((r) => r.juste).length
    enregistrerExamen({
      total: questions.length,
      repondu: reponses.length,
      juste,
      score: reponses.length ? Math.round((100 * juste) / reponses.length) : 0,
    })
  }, [termine, examen, reponses, questions.length])

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

  if (termine) return <Bilan reponses={reponses} questions={questions} examen={examen} onQuitter={onQuitter} />

  return (
    <>
      <div className="entete">
        <h1>{titre}</h1>
        {examen && (
          <span className={`chrono ${restant < 5 * 60 * 1000 ? 'chrono-urgent' : ''}`}>{formaterDuree(restant)}</span>
        )}
      </div>

      <CarteQuestion
        question={questions[index]}
        indexAffiche={index + 1}
        total={questions.length}
        onRepondu={repondu}
        onSuivante={suivante}
        // Le jour de l'examen, on n'a pas la correction entre deux questions :
        // le blanc reproduit cette contrainte, la correction vient a la fin.
        masquerCorrection={examen}
      />

      <button className="bouton" onClick={onQuitter}>
        Abandonner
      </button>
    </>
  )
}

/* ------------------------------------------------------------ BILAN */

function Bilan({ reponses, questions, examen, onQuitter }) {
  const juste = reponses.filter((r) => r.juste).length
  const score = reponses.length ? Math.round((100 * juste) / reponses.length) : 0

  // Detail par domaine, comme le rapport de l'examen reel.
  const parDomaine = new Map()
  for (const r of reponses) {
    const e = parDomaine.get(r.question.domain) || { total: 0, juste: 0 }
    e.total++
    if (r.juste) e.juste++
    parDomaine.set(r.question.domain, e)
  }

  const rates = reponses.filter((r) => !r.juste)

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
            <span className="couverture-chiffre">{reponses.length}/{questions.length}</span>
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
            Ces questions reviendront automatiquement dans deux jours, puis sept jours après si elles sont réussies.
          </p>
          {rates.map((r) => (
            <details key={r.question.id} style={{ marginTop: 'var(--e3)' }}>
              <summary lang="en" style={{ cursor: 'pointer' }}>
                {r.question.question_en.slice(0, 110)}…
              </summary>
              <div className="correction">
                <p className="correction-verdict verdict-faux">
                  Votre réponse : {r.choix.join(' + ')} — attendue : {r.question.correct.join(' + ')}
                </p>
                <h3>Pourquoi c’est la bonne réponse</h3>
                <p>{r.question.explanation_fr}</p>
                {r.choix
                  .filter((c) => !r.question.correct.includes(c))
                  .map((c) => (
                    <p key={c}>
                      <strong>{c}.</strong> {r.question.distractors_fr?.[c]}
                    </p>
                  ))}
                {r.question.doc_ref && (
                  <a className="lien-doc" href={r.question.doc_ref} target="_blank" rel="noreferrer">
                    Documentation officielle ↗
                  </a>
                )}
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
