import { useState, useMemo, useCallback } from 'react'
import { BANQUES, NB_QUESTIONS_EXAMEN } from './banque.js'
import { tirerExamen, tirerEntrainement, melanger } from './tirage.js'
import { lire, idsDus } from './stockage.js'
import EcranSelectionBanque from './composants/EcranSelectionBanque.jsx'
import EcranAccueil from './composants/EcranAccueil.jsx'
import EcranEntrainement from './composants/EcranEntrainement.jsx'
import EcranStats from './composants/EcranStats.jsx'
import Serie from './composants/Serie.jsx'

/* ============================================================
   APP — choix de la banque, navigation par onglets, lancement des series.

   Le choix de banque ("doc" ou "prepcourse") precede tout le reste : tant
   qu'il n'est pas fait, aucun onglet ne s'affiche. Une fois choisi, TOUT
   ce qui suit — couverture, tirage, stockage de la progression — passe
   par BANQUES[banque], jamais par un import global qui melangerait les
   deux ensembles.

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

const BANQUES_DISPO = [
  { id: 'doc', nom: 'Doc officielle', nbQuestions: BANQUES.doc.METADONNEES.length },
  { id: 'prepcourse', nom: 'Prep Course', nbQuestions: BANQUES.prepcourse.METADONNEES.length },
]

export default function App() {
  // null tant que l'utilisateur n'a pas choisi sa banque : aucun ecran de
  // contenu ne s'affiche avant ce choix.
  const [banque, setBanque] = useState(null)
  const [onglet, setOnglet] = useState('accueil')
  const [serie, setSerie] = useState(null)
  const [chargement, setChargement] = useState(false)
  // Incremente apres chaque serie : force le recalcul des revisions dues et
  // des statistiques, qui vivent dans le localStorage et non dans l'etat React.
  const [revision, setRevision] = useState(0)

  const banqueActive = banque ? BANQUES[banque] : null

  const couverture = useMemo(() => banqueActive?.couverture(), [banqueActive])
  const metasDues = useMemo(() => {
    if (!banqueActive) return []
    return idsDus(lire(banque)).map(banqueActive.metaParId).filter(Boolean)
  }, [banque, banqueActive, revision])

  const rafraichir = useCallback(() => setRevision((r) => r + 1), [])

  function choisirBanque(id) {
    setBanque(id)
    setOnglet('accueil')
    setSerie(null)
    setRevision(0)
  }

  function changerBanque() {
    setBanque(null)
    setSerie(null)
    setOnglet('accueil')
  }

  function quitterSerie() {
    setSerie(null)
    rafraichir()
  }

  /** Charge les payloads des metadonnees tirees, puis ouvre la serie. */
  async function ouvrirSerie({ metas, mode, titre, info }) {
    if (!metas.length) return
    setChargement(true)
    try {
      const questions = await banqueActive.chargerQuestions(metas)
      setSerie({ mode, titre, questions, info })
    } finally {
      setChargement(false)
    }
  }

  function lancerExamen() {
    const tirage = tirerExamen(banqueActive, NB_QUESTIONS_EXAMEN)
    ouvrirSerie({ metas: tirage.metas, mode: 'examen', titre: 'Examen blanc', info: tirage })
  }

  function lancerRevision() {
    ouvrirSerie({ metas: melanger(metasDues), mode: 'libre', titre: 'Révisions du jour' })
  }

  function lancerEntrainement(filtres) {
    ouvrirSerie({ metas: tirerEntrainement(banqueActive, filtres), mode: 'libre', titre: 'Entraînement' })
  }

  if (!banque) {
    return (
      <div className="coque">
        <EcranSelectionBanque banques={BANQUES_DISPO} onChoisir={choisirBanque} />
      </div>
    )
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
        <Serie
          questions={serie.questions}
          mode={serie.mode}
          titre={serie.titre}
          banque={banque}
          onQuitter={quitterSerie}
        />
      </div>
    )
  }

  return (
    <>
      <div className="coque">
        <div className="barre-banque">
          <span>{banqueActive.nom}</span>
          <button type="button" className="lien-discret" onClick={changerBanque}>
            ← Changer de banque
          </button>
        </div>

        {onglet === 'accueil' && (
          <EcranAccueil
            couverture={couverture}
            nbDues={metasDues.length}
            onExamen={lancerExamen}
            onRevision={lancerRevision}
            onEntrainement={() => setOnglet('entrainement')}
          />
        )}
        {onglet === 'entrainement' && (
          <EcranEntrainement banqueActive={banqueActive} onLancer={lancerEntrainement} />
        )}
        {onglet === 'stats' && (
          <EcranStats
            couverture={couverture}
            banque={banque}
            banqueActive={banqueActive}
            onChangement={rafraichir}
          />
        )}
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
