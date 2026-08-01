import { useState, useEffect } from 'react'

/* ============================================================
   CARTE QUESTION — affichage d'une question, saisie, correction.

   L'enonce et les options sont en ANGLAIS, langue de l'examen ;
   tout le reste de l'interface est en francais. Apres validation,
   la correction montre l'explication de la bonne reponse ET la
   raison pour laquelle l'option choisie etait fausse.
   ============================================================ */

const LIBELLE_NATURE = {
  judgment: 'jugement',
  factual_semantic: 'factuel',
  factual_magnitude: 'chiffres',
}

const LIBELLE_DIFFICULTE = {
  facile: 'facile',
  moyen: 'moyen',
  difficile: 'difficile',
}

function memeEnsemble(a, b) {
  if (a.length !== b.length) return false
  const t = [...b]
  return a.every((x) => t.includes(x))
}

export default function CarteQuestion({ question, onRepondu, onSuivante, masquerCorrection = false, indexAffiche, total }) {
  const [choix, setChoix] = useState([])
  const [valide, setValide] = useState(false)

  // Nouvelle question : on repart d'une ardoise vierge. Sans cela, le choix de
  // la question precedente resterait selectionne.
  useEffect(() => {
    setChoix([])
    setValide(false)
  }, [question.id])

  const multi = question.type === 'multi'
  const nbAttendu = question.correct.length

  function basculer(cle) {
    if (valide) return
    if (multi) {
      setChoix((c) => (c.includes(cle) ? c.filter((x) => x !== cle) : [...c, cle]))
    } else {
      setChoix([cle])
    }
  }

  function valider() {
    if (!choix.length) return
    const juste = memeEnsemble(choix, question.correct)
    setValide(true)
    onRepondu?.(question, juste, choix)
  }

  const juste = valide && memeEnsemble(choix, question.correct)
  // En examen blanc, masquer l'explication ne servirait a rien si les options
  // se coloraient quand meme : la bonne reponse serait lisible d'un coup d'oeil.
  // Rien n'est revele avant le bilan final.
  const revele = valide && !masquerCorrection

  function classeOption(cle) {
    const classes = ['option']
    if (!revele) {
      if (choix.includes(cle)) classes.push('option-choisie')
      return classes.join(' ')
    }
    // Correction visible : la bonne reponse est signalee meme si elle n'a pas
    // ete choisie — c'est la que se fait l'apprentissage.
    if (question.correct.includes(cle)) classes.push('option-juste')
    else if (choix.includes(cle)) classes.push('option-fausse')
    return classes.join(' ')
  }

  function signe(cle) {
    if (!revele) return cle
    if (question.correct.includes(cle)) return '✓'
    if (choix.includes(cle)) return '✗'
    return cle
  }

  // Explications des options fausses que l'utilisateur a effectivement cochees.
  const mauvaisChoix = valide ? choix.filter((c) => !question.correct.includes(c)) : []
  // Sur une question a reponses multiples, on peut se tromper sans cocher
  // aucune option fausse : il suffit d'en oublier une. Sans cette liste,
  // l'ecran ne dirait pas ce qui manquait. Sur une question a reponse unique
  // ce serait redondant : la bonne reponse est deja nommee dans le verdict.
  const oubliees = valide && multi ? question.correct.filter((c) => !choix.includes(c)) : []

  return (
    <div className="carte">
      {(indexAffiche !== undefined) && (
        <div className="barre-progression">
          <span>
            Question {indexAffiche} / {total}
          </span>
          <span>{question.subdomain}</span>
        </div>
      )}

      <div className="meta-question">
        <span className="etiquette etiquette-accent">{question.domain}</span>
        <span className="etiquette">{LIBELLE_NATURE[question.nature] || question.nature}</span>
        <span className="etiquette">{LIBELLE_DIFFICULTE[question.difficulty] || question.difficulty}</span>
        {multi && <span className="etiquette">{nbAttendu} réponses</span>}
      </div>

      <p className="enonce" lang="en">
        {question.question_en}
      </p>

      <div className="options" role={multi ? 'group' : 'radiogroup'}>
        {question.options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={classeOption(o.key)}
            onClick={() => basculer(o.key)}
            disabled={valide}
            aria-pressed={choix.includes(o.key)}
          >
            <span className="option-cle" aria-hidden="true">
              {signe(o.key)}
            </span>
            <span lang="en">{o.text_en}</span>
          </button>
        ))}
      </div>

      {!valide && (
        <div className="pile" style={{ marginTop: 'var(--e4)' }}>
          <button className="bouton bouton-principal" onClick={valider} disabled={!choix.length}>
            {multi ? `Valider (${choix.length}/${nbAttendu} sélectionnées)` : 'Valider'}
          </button>
        </div>
      )}

      {valide && !masquerCorrection && (
        <div className="correction">
          <p className={`correction-verdict ${juste ? 'verdict-juste' : 'verdict-faux'}`}>
            {juste ? '✓ Correct' : `✗ Incorrect — bonne réponse : ${question.correct.join(' + ')}`}
          </p>

          <h3>Pourquoi c'est la bonne réponse</h3>
          <p>{question.explanation_fr}</p>

          {mauvaisChoix.length > 0 && (
            <>
              <h3>Pourquoi votre choix était faux</h3>
              {mauvaisChoix.map((c) => (
                <p key={c}>
                  <strong>{c}.</strong> {question.distractors_fr?.[c] || 'Pas d’explication enregistrée pour cette option.'}
                </p>
              ))}
            </>
          )}

          {oubliees.length > 0 && (
            <>
              <h3>Ce que vous avez oublié de cocher</h3>
              {oubliees.map((c) => (
                <p key={c}>
                  <strong>{c}.</strong>{' '}
                  <span lang="en">{question.options.find((o) => o.key === c)?.text_en}</span>
                </p>
              ))}
            </>
          )}

          {question.doc_ref && (
            <a className="lien-doc" href={question.doc_ref} target="_blank" rel="noreferrer">
              Documentation officielle ↗
            </a>
          )}
        </div>
      )}

      {valide && (
        <div className="pile" style={{ marginTop: 'var(--e4)' }}>
          <button className="bouton bouton-principal" onClick={onSuivante}>
            Suivante
          </button>
        </div>
      )}
    </div>
  )
}
