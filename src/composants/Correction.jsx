import TexteBilingue from './TexteBilingue.jsx'

/* ============================================================
   CORRECTION — tout ce qui s'affiche une fois la reponse connue.

   Un seul composant sert la correction immediate de l'entrainement
   et le bilan de fin d'examen. C'est deliberé : les deux ecrans
   doivent dire exactement la meme chose, et l'ancienne version du
   bilan avait derive (enonce tronque, options reduites a leurs
   lettres) precisement parce qu'elle reecrivait la correction de
   son cote.

   Ce composant n'affiche PAS les quatre options : elles sont rendues
   juste au-dessus par ListeOptions, dans les deux ecrans. Les
   afficher ici aussi doublerait quatre blocs de texte sur un ecran
   de telephone.
   ============================================================ */

// Les citations de doc sont enchassees en anglais dans une explication
// francaise, entre guillemets. On les repere pour glisser leur traduction
// juste apres, sans toucher au texte enregistre.
const MOTIF_CITATION = /«[^»]*»/g

/**
 * Decoupe une explication en fragments de prose et citations.
 * @param {string} texte explication_fr
 * @param {string[]} traductions citations_fr, dans l'ordre d'apparition
 */
export function fragmenterExplication(texte, traductions = []) {
  const fragments = []
  let curseur = 0
  let rang = 0

  for (const trouve of texte.matchAll(MOTIF_CITATION)) {
    if (trouve.index > curseur) {
      fragments.push({ type: 'prose', contenu: texte.slice(curseur, trouve.index) })
    }
    fragments.push({
      type: 'citation',
      contenu: trouve[0],
      traduction: traductions[rang] || null,
    })
    rang++
    curseur = trouve.index + trouve[0].length
  }

  if (curseur < texte.length) {
    fragments.push({ type: 'prose', contenu: texte.slice(curseur) })
  }
  return fragments
}

function Explication({ texte, citations }) {
  if (!texte) return null
  const fragments = fragmenterExplication(texte, citations)

  return (
    <p>
      {fragments.map((f, i) =>
        f.type === 'prose' ? (
          <span key={i}>{f.contenu}</span>
        ) : (
          <span key={i}>
            <span lang="en">{f.contenu}</span>
            {f.traduction && (
              <span className="citation-traduction" lang="fr">
                {' '}
                ({f.traduction})
              </span>
            )}
          </span>
        )
      )}
    </p>
  )
}

export default function Correction({ question, choix = [] }) {
  const multi = question.type === 'multi'
  const sansReponse = choix.length === 0
  const juste =
    !sansReponse &&
    choix.length === question.correct.length &&
    choix.every((c) => question.correct.includes(c))

  // Les distracteurs que l'utilisateur a effectivement coches.
  const mauvaisChoix = choix.filter((c) => !question.correct.includes(c))
  // Sur une question a reponses multiples on peut se tromper sans cocher
  // aucune option fausse : il suffit d'en oublier une.
  const oubliees = multi ? question.correct.filter((c) => !choix.includes(c)) : []

  function verdict() {
    if (sansReponse) return `Sans réponse — attendue : ${question.correct.join(' + ')}`
    if (juste) return '✓ Correct'
    return `✗ Incorrect — votre réponse : ${choix.join(' + ')} · attendue : ${question.correct.join(' + ')}`
  }

  return (
    <div className="correction">
      <p className={`correction-verdict ${juste ? 'verdict-juste' : 'verdict-faux'}`}>{verdict()}</p>

      <h3>Pourquoi c'est la bonne réponse</h3>
      <Explication texte={question.explanation_fr} citations={question.citations_fr} />

      {question.principe_fr && (
        <div className="principe">
          <h3 className="principe-titre">Le principe</h3>
          <p>{question.principe_fr}</p>
        </div>
      )}

      {mauvaisChoix.length > 0 && (
        <>
          <h3>Pourquoi votre choix était faux</h3>
          {mauvaisChoix.map((c) => (
            <p key={c}>
              <strong>{c}.</strong>{' '}
              {question.distractors_fr?.[c] || 'Pas d’explication enregistrée pour cette option.'}
            </p>
          ))}
        </>
      )}

      {oubliees.length > 0 && (
        <>
          <h3>Ce que vous avez oublié de cocher</h3>
          {oubliees.map((c) => {
            const o = question.options.find((x) => x.key === c)
            return (
              <p key={c} className="oubliee">
                <strong>{c}.</strong> <TexteBilingue en={o?.text_en} fr={o?.text_fr} />
              </p>
            )
          })}
        </>
      )}

      {question.doc_ref && (
        <a className="lien-doc" href={question.doc_ref} target="_blank" rel="noreferrer">
          Documentation officielle ↗
        </a>
      )}
    </div>
  )
}
