import { useState, useMemo, useCallback } from 'react'
import {
  couverture as calculerCouverture,
  metaParId,
  chargerQuestions,
  NB_QUESTIONS_EXAMEN,
} from './banque.js'
import { tirerExamen, tirerEntrainement, melanger } from './tirage.js'
import { idsDus } from './stockage.js'
import EcranAccueil from './composants/EcranAccueil.jsx'
import EcranEntrainement from './composants/EcranEntrainement.jsx'
import EcranStats from './composants/EcranStats.jsx'
import Serie from './composants/Serie.jsx'

/* ============================================================
   APP — navigation par onglets et lancement des series.

   Pas de routeur : trois onglets et un ecran de serie qui se
   superpose. Une dependance de moins, et le bouton « retour » du
   telephone ne casse pas une serie en cours.

   Les series sont ASYNCHRONES : le tirage se fait sur les
   metadonnees, puis les questions completes des seuls fichiers
   concernes sont chargees avant d'afficher la premiere question.
   ============================================================ */

const ONGLETS = [
  { cle: 'accueil', libelle: 'Accueil', icone: '◉' },
  { cle: 'entrainement', libelle: 'Entraînement', icone: '◈' },
  { cle: 'stats', libelle: 'Statistiques', icone: '◧' },
]

export default function App() {
  const [onglet, setOnglet] = useState('accueil')
  const [serie, setSerie] = useState(null)
  const [chargement, setChargement] = useState(false)
  // Incremente apres chaque serie : force le recalcul des revisions dues et
  // des statistiques, qui vivent dans le localStorage et non dans l'etat React.
  const [revision, setRevision] = useState(0)

  const couverture = useMemo(() => calculerCouverture(), [])
  const metasDues = useMemo(() => idsDus().map(metaParId).filter(Boolean), [revision])

  const rafraichir = useCallback(() => setRevision((r) => r + 1), [])

  function quitterSerie() {
    setSerie(null)
    rafraichir()
  }

  /** Charge les payloads des metadonnees tirees, puis ouvre la serie. */
  async function ouvrirSerie({ metas, mode, titre, info }) {
    if (!metas.length) return
    setChargement(true)
    try {
      const questions = await chargerQuestions(metas)
      setSerie({ mode, titre, questions, info })
    } finally {
      setChargement(false)
    }
  }

  function lancerExamen() {
    const tirage = tirerExamen(NB_QUESTIONS_EXAMEN)
    ouvrirSerie({ metas: tirage.metas, mode: 'examen', titre: 'Examen blanc', info: tirage })
  }

  function lancerRevision() {
    ouvrirSerie({ metas: melanger(metasDues), mode: 'libre', titre: 'Révisions du jour' })
  }

  function lancerEntrainement(filtres) {
    ouvrirSerie({ metas: tirerEntrainement(filtres), mode: 'libre', titre: 'Entraînement' })
  }

  if (chargement) {
    return (
      <div className="coque">
        <div className="vide">
          <p>Chargement des questions…</p>
        </div>
      </div>
    )
  }

  if (serie) {
    return (
      <div className="coque">
        {serie.info && !serie.info.complet && (
          <div className="avertissement">
            La banque n’a fourni que {serie.questions.length} questions sur les {NB_QUESTIONS_EXAMEN} d’un examen réel.
            Les poids relatifs du blueprint sont respectés sur {serie.info.poidsCouvert.toFixed(1)} % du programme.
          </div>
        )}
        <Serie questions={serie.questions} mode={serie.mode} titre={serie.titre} onQuitter={quitterSerie} />
      </div>
    )
  }

  return (
    <>
      <div className="coque">
        {onglet === 'accueil' && (
          <EcranAccueil
            couverture={couverture}
            nbDues={metasDues.length}
            onExamen={lancerExamen}
            onRevision={lancerRevision}
            onEntrainement={() => setOnglet('entrainement')}
          />
        )}
        {onglet === 'entrainement' && <EcranEntrainement onLancer={lancerEntrainement} />}
        {onglet === 'stats' && <EcranStats couverture={couverture} onChangement={rafraichir} />}
      </div>

      <nav className="barre-onglets">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            className={`onglet ${onglet === o.cle ? 'onglet-actif' : ''}`}
            onClick={() => setOnglet(o.cle)}
            aria-current={onglet === o.cle ? 'page' : undefined}
          >
            <span aria-hidden="true" style={{ fontSize: '1.05rem' }}>
              {o.icone}
            </span>
            {o.libelle}
            {o.cle === 'accueil' && metasDues.length > 0 && (
              <span className="onglet-pastille">{metasDues.length}</span>
            )}
          </button>
        ))}
      </nav>
    </>
  )
}
