import TexteBilingue from './TexteBilingue.jsx'

/* ============================================================
   LISTE D'OPTIONS — les quatre propositions, dans les deux etats.

   Un seul composant pour la saisie et pour la correction, parce que
   l'utilisateur doit retrouver exactement la meme liste aux deux
   moments : meme ordre, meme texte entier, meme traduction. Ce qui
   change est le marqueur et la couleur.

   En correction, chaque option porte un signe ET un mot : « ✓ bonne
   reponse », « ✗ votre choix ». La couleur seule ne suffirait pas a
   un daltonien, et un signe seul ne dit pas de qui il parle.
   ============================================================ */

export default function ListeOptions({ question, choix = [], onBasculer, revele = false }) {
  const multi = question.type === 'multi'
  const interactif = !revele && typeof onBasculer === 'function'

  function etat(cle) {
    if (!revele) return choix.includes(cle) ? 'choisie' : 'neutre'
    const juste = question.correct.includes(cle)
    const cochee = choix.includes(cle)
    if (juste) return 'juste'
    if (cochee) return 'fausse'
    return 'neutre'
  }

  const CLASSE = {
    neutre: 'option',
    choisie: 'option option-choisie',
    juste: 'option option-juste',
    fausse: 'option option-fausse',
  }

  const SIGNE = { neutre: null, choisie: null, juste: '✓', fausse: '✗' }

  const MENTION = {
    juste: 'bonne réponse',
    fausse: 'votre choix, incorrect',
    neutre: null,
    choisie: null,
  }

  return (
    <div className="options" role={revele ? 'list' : multi ? 'group' : 'radiogroup'}>
      {question.options.map((o) => {
        const e = etat(o.key)
        // La pastille montre la lettre tant qu'on choisit, le verdict ensuite.
        const pastille = SIGNE[e] || o.key
        const contenu = (
          <>
            <span className="option-cle" aria-hidden="true">
              {pastille}
            </span>
            <span className="option-corps">
              <TexteBilingue en={o.text_en} fr={o.text_fr} />
              {MENTION[e] && <span className={`option-mention mention-${e}`}>{MENTION[e]}</span>}
            </span>
          </>
        )

        if (!interactif) {
          return (
            <div key={o.key} className={CLASSE[e]} role="listitem">
              {contenu}
            </div>
          )
        }

        return (
          <button
            key={o.key}
            type="button"
            className={CLASSE[e]}
            onClick={() => onBasculer(o.key)}
            aria-pressed={choix.includes(o.key)}
          >
            {contenu}
          </button>
        )
      })}
    </div>
  )
}
