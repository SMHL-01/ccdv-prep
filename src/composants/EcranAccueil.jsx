import IndicateurCouverture from './IndicateurCouverture.jsx'
import { NB_QUESTIONS_EXAMEN, DUREE_EXAMEN_MIN } from '../banque.js'

/* ============================================================
   ACCUEIL — ce qu'il y a a faire aujourd'hui, et ou en est la banque.
   ============================================================ */

export default function EcranAccueil({ couverture, nbDues, onExamen, onRevision, onEntrainement }) {
  return (
    <>
      <div className="entete">
        <div>
          <h1 className="titre-degrade">CCDV-F</h1>
          <span className="sous-titre">Claude Certified Developer — Foundations</span>
        </div>
      </div>

      <div className="carte">
        <div className="carte-titre">
          <h2>Aujourd’hui</h2>
        </div>
        {nbDues > 0 ? (
          <>
            <p>
              <strong style={{ color: 'var(--attention)' }}>{nbDues}</strong> question{nbDues > 1 ? 's' : ''} à revoir
              {nbDues > 1 ? ' sont dues' : ' est due'} aujourd’hui.
            </p>
            <button className="bouton bouton-principal" onClick={onRevision}>
              Réviser les {nbDues} questions dues
            </button>
          </>
        ) : (
          <p className="note" style={{ marginBottom: 0 }}>
            Aucune révision due aujourd’hui. Les questions ratées reviennent à J+2, puis à J+7 si elles sont réussies.
          </p>
        )}
      </div>

      <div className="carte">
        <div className="carte-titre">
          <h2>S’entraîner</h2>
        </div>
        <div className="pile">
          <button className="bouton bouton-principal" onClick={onExamen} disabled={couverture.nbQuestions === 0}>
            Examen blanc — {NB_QUESTIONS_EXAMEN} questions, {DUREE_EXAMEN_MIN} min
          </button>
          <button className="bouton" onClick={onEntrainement} disabled={couverture.nbQuestions === 0}>
            Entraînement par domaine
          </button>
        </div>
        {couverture.poidsCouvert < 100 && couverture.nbQuestions > 0 && (
          <p className="note" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
            L’examen blanc se rééquilibre sur les sous-domaines disponibles : les poids relatifs du blueprint sont
            respectés, mais {(100 - couverture.poidsCouvert).toFixed(1)} % du programme n’est pas encore représenté.
          </p>
        )}
      </div>

      <IndicateurCouverture couverture={couverture} />
    </>
  )
}
