import { useRef, useState } from 'react'
import IndicateurCouverture from './IndicateurCouverture.jsx'
import { DOMAINES } from '../banque.js'
import { lire, remplacer, statistiques, serieProgression, examens, reinitialiser } from '../stockage.js'
import {
  construireExport,
  fusionner,
  idsCites,
  lireExport,
  lireFichier,
  nomFichier,
  telecharger,
} from '../transfert.js'

/* ============================================================
   STATISTIQUES — ou sont les trous.

   Le score par domaine est pondere comme l'examen : un domaine a
   33 % ne se lit pas comme un domaine a 2,6 %, et c'est justement
   ce que la moyenne brute ferait disparaitre.
   ============================================================ */

export default function EcranStats({ couverture, banque, banqueActive, onChangement }) {
  const stats = statistiques(lire(banque), DOMAINES)
  const progression = serieProgression(lire(banque))
  const historiqueExamens = examens(lire(banque))

  // Transfert : un fichier choisi n'est jamais applique tout de suite. Il est
  // d'abord lu, resume, et pose ici — c'est ce resume qui permet de decider
  // entre fusionner et ecraser en connaissance de cause.
  const [enAttente, setEnAttente] = useState(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(null)
  const champFichier = useRef(null)

  /* L'export enrichit chaque reponse avec le concept et l'enonce de sa
     question. Ces textes ne sont pas dans le manifeste : il faut charger les
     fichiers des sous-domaines concernes, d'ou l'attente. */
  async function exporter() {
    setErreur(null)
    setMessage(null)
    setOccupe(true)
    try {
      const etat = lire(banque)
      const metas = idsCites(etat).map(banqueActive.metaParId).filter(Boolean)
      const questions = await banqueActive.chargerQuestions(metas)
      const doc = construireExport(etat, new Map(questions.map((q) => [q.id, q])))
      telecharger(nomFichier(), JSON.stringify(doc, null, 2))
      setMessage(`Export téléchargé : ${doc.reponses.length} réponses, ${doc.fiches.length} fiches de révision.`)
    } catch (e) {
      setErreur(`L’export a échoué : ${e.message}`)
    } finally {
      setOccupe(false)
    }
  }

  async function choisirFichier(evenement) {
    const fichier = evenement.target.files?.[0]
    // Remis a zero tout de suite : sans cela, rechoisir le meme fichier apres
    // une annulation ne declencherait aucun evenement.
    evenement.target.value = ''
    if (!fichier) return
    setErreur(null)
    setMessage(null)
    try {
      const lu = lireExport(await lireFichier(fichier))
      setEnAttente({ ...lu, nom: fichier.name })
    } catch (e) {
      setEnAttente(null)
      setErreur(e.message)
    }
  }

  function appliquer(mode) {
    const actuel = lire(banque)
    const rien = actuel.reponses.length === 0
    if (
      mode === 'remplacement' &&
      !rien &&
      !window.confirm(
        `Remplacer définitivement vos ${actuel.reponses.length} réponses enregistrées par le contenu de ce fichier ?`
      )
    ) {
      return
    }
    const resultat = mode === 'fusion' ? fusionner(actuel, enAttente.progression) : enAttente.progression
    remplacer(resultat, banque)
    setEnAttente(null)
    setMessage(
      mode === 'fusion'
        ? `Progression fusionnée : ${resultat.reponses.length} réponses au total.`
        : `Progression remplacée : ${resultat.reponses.length} réponses restaurées.`
    )
    onChangement?.()
  }

  return (
    <>
      <div className="entete">
        <h1>Statistiques</h1>
      </div>

      <div className="carte">
        <div className="carte-titre">
          <h2>Score pondéré</h2>
        </div>
        {stats.scorePondere === null ? (
          <p className="note" style={{ marginBottom: 0 }}>
            Aucune réponse enregistrée pour l’instant. Lancez une série pour commencer à mesurer.
          </p>
        ) : (
          <>
            <div className="couverture">
              <div className="couverture-case">
                <span className="couverture-chiffre">{Math.round(stats.scorePondere)} %</span>
                <span className="couverture-libelle">pondéré examen</span>
              </div>
              <div className="couverture-case">
                <span className="couverture-chiffre">{stats.totalRepondu}</span>
                <span className="couverture-libelle">questions vues</span>
              </div>
              <div className="couverture-case">
                <span className="couverture-chiffre">{stats.totalReponses}</span>
                <span className="couverture-libelle">réponses données</span>
              </div>
            </div>
            <p className="note" style={{ marginBottom: 0 }}>
              Calculé sur la dernière réponse à chaque question, et pondéré par le poids de chaque domaine à l’examen.
              Couvre {stats.poidsTravaille.toFixed(1)} % du blueprint travaillé à ce jour.
            </p>
          </>
        )}
      </div>

      <div className="carte">
        <div className="carte-titre">
          <h2>Par domaine</h2>
        </div>
        <table className="tableau">
          <thead>
            <tr>
              <th>Domaine</th>
              <th>Poids</th>
              <th>Réussite</th>
            </tr>
          </thead>
          <tbody>
            {stats.lignes.map((l) => (
              <tr key={l.nom}>
                <td>{l.nom}</td>
                <td className="nombre">{l.poids} %</td>
                <td className="nombre">
                  {l.taux === null ? (
                    <span className="note">jamais travaillé</span>
                  ) : (
                    <>
                      <span className="mini-jauge">
                        <span style={{ width: `${l.taux}%` }} />
                      </span>
                      {Math.round(l.taux)} % ({l.juste}/{l.repondu})
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {progression.length > 1 && (
        <div className="carte">
          <div className="carte-titre">
            <h2>Progression</h2>
          </div>
          <p className="note">Taux de réussite par tranches de dix réponses, de la plus ancienne à la plus récente.</p>
          <div className="sparkline" role="img" aria-label={`Progression : ${progression.join(', ')} pour cent`}>
            {progression.map((p, i) => (
              <span key={i} style={{ height: `${Math.max(4, p)}%` }} title={`${p} %`} />
            ))}
          </div>
        </div>
      )}

      {historiqueExamens.length > 0 && (
        <div className="carte">
          <div className="carte-titre">
            <h2>Examens blancs</h2>
          </div>
          <table className="tableau">
            <thead>
              <tr>
                <th>Date</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {[...historiqueExamens].reverse().slice(0, 10).map((e, i) => (
                <tr key={i}>
                  <td>{new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</td>
                  <td className="nombre">
                    {e.score} % ({e.juste}/{e.repondu})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="carte">
        <div className="carte-titre">
          <h2>Sauvegarder et partager</h2>
        </div>
        <p className="note">
          Votre progression ne vit que dans ce navigateur : un nettoyage de l’historique l’efface. L’export en fait un
          fichier JSON — chaque réponse avec son concept, son énoncé, la réponse donnée et la bonne — lisible tel quel,
          partageable pour analyse, et rechargeable ici même.
        </p>

        <div className="pile">
          <button
            className="bouton bouton-principal"
            onClick={exporter}
            disabled={occupe || stats.totalReponses === 0}
          >
            {occupe ? 'Préparation du fichier…' : 'Exporter mes résultats'}
          </button>
          <button className="bouton" onClick={() => champFichier.current?.click()} disabled={occupe}>
            Importer
          </button>
        </div>

        <input
          ref={champFichier}
          type="file"
          accept="application/json,.json"
          onChange={choisirFichier}
          style={{ display: 'none' }}
        />

        {stats.totalReponses === 0 && (
          <p className="note" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
            Rien à exporter pour l’instant — l’import, lui, reste disponible.
          </p>
        )}

        {erreur && (
          <div className="avertissement" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
            {erreur}
          </div>
        )}

        {enAttente && (
          <div className="avertissement" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
            <p style={{ marginTop: 0 }}>
              <strong>{enAttente.nom}</strong>, exporté le {dateLisible(enAttente.genere)} :{' '}
              {enAttente.resume.questionsRepondues} question
              {enAttente.resume.questionsRepondues > 1 ? 's' : ''} répondue
              {enAttente.resume.questionsRepondues > 1 ? 's' : ''}, {enAttente.resume.reponsesTotales} réponse
              {enAttente.resume.reponsesTotales > 1 ? 's' : ''}, {enAttente.resume.examensPasses} examen
              {enAttente.resume.examensPasses > 1 ? 's' : ''} blanc
              {enAttente.resume.examensPasses > 1 ? 's' : ''}.
            </p>
            <p>
              Ce navigateur en compte {stats.totalRepondu} répondue{stats.totalRepondu > 1 ? 's' : ''} pour{' '}
              {stats.totalReponses} réponse{stats.totalReponses > 1 ? 's' : ''}. Rien n’est encore écrit.
            </p>
            <div className="pile">
              <button className="bouton bouton-principal" onClick={() => appliquer('fusion')}>
                Fusionner avec ma progression
              </button>
              <button className="bouton" onClick={() => appliquer('remplacement')}>
                Remplacer ma progression
              </button>
              <button className="bouton" onClick={() => setEnAttente(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="note" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
            {message}
          </p>
        )}
      </div>

      <IndicateurCouverture couverture={couverture} detaille />

      <div className="carte">
        <div className="carte-titre">
          <h2>Réinitialiser</h2>
        </div>
        <p className="note">
          Efface la progression et l’historique de révision stockés dans ce navigateur. Les questions ne sont pas
          touchées.
        </p>
        <button
          className="bouton"
          onClick={() => {
            if (window.confirm('Effacer toute la progression enregistrée dans ce navigateur ?')) {
              reinitialiser(banque)
              onChangement?.()
            }
          }}
        >
          Effacer ma progression
        </button>
      </div>
    </>
  )
}

/** « 4 août 2025 » — la date de generation d'un export, telle qu'annoncee. */
function dateLisible(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'date inconnue'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
