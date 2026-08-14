import TexteBilingue from './TexteBilingue.jsx'
import ListeOptions from './ListeOptions.jsx'
import Correction from './Correction.jsx'
import BadgeSource from './BadgeSource.jsx'

/* ============================================================
   CARTE QUESTION — affichage d'une question et de sa correction.

   Composant CONTROLE : il ne retient rien. Le choix courant et le
   fait que la correction soit visible viennent de Serie, qui garde
   l'etat de toutes les questions. C'est ce qui rend possible le
   retour en arriere de l'examen blanc : revenir sur la question 12
   doit retrouver la reponse qu'on y avait laissee.

   L'enonce et les options restent en ANGLAIS, langue de l'examen ;
   leur traduction francaise s'affiche dessous, en gris et plus
   petit, comme une aide a la comprehension.
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

export default function CarteQuestion({
  question,
  indexAffiche,
  total,
  choix = [],
  onBasculer,
  revele = false,
  marquee = false,
  onMarquer,
}) {
  const multi = question.type === 'multi'

  return (
    <div className="carte">
      {indexAffiche !== undefined && (
        <div className="barre-progression">
          <span>
            Question {indexAffiche} / {total}
          </span>
          {onMarquer ? (
            <button
              type="button"
              className={`drapeau ${marquee ? 'drapeau-actif' : ''}`}
              onClick={onMarquer}
              aria-pressed={marquee}
            >
              <span aria-hidden="true">⚑</span> {marquee ? 'Marquée' : 'À revoir'}
            </button>
          ) : (
            <span>{question.subdomain}</span>
          )}
        </div>
      )}

      <div className="meta-question">
        <BadgeSource source={question.source} />
        <span className="etiquette etiquette-accent">{question.domain}</span>
        <span className="etiquette">{LIBELLE_NATURE[question.nature] || question.nature}</span>
        <span className="etiquette">
          {LIBELLE_DIFFICULTE[question.difficulty] || question.difficulty}
        </span>
        {multi && <span className="etiquette">{question.correct.length} réponses</span>}
      </div>

      <div className="enonce">
        <TexteBilingue en={question.question_en} fr={question.question_fr} />
      </div>

      <ListeOptions
        question={question}
        choix={choix}
        onBasculer={onBasculer}
        revele={revele}
      />

      {revele && <Correction question={question} choix={choix} />}
    </div>
  )
}
