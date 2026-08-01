import IndicateurCouverture from './IndicateurCouverture.jsx'
import { DOMAINES } from '../banque.js'
import { statistiques, serieProgression, examens, reinitialiser } from '../stockage.js'

/* ============================================================
   STATISTIQUES — ou sont les trous.

   Le score par domaine est pondere comme l'examen : un domaine a
   33 % ne se lit pas comme un domaine a 2,6 %, et c'est justement
   ce que la moyenne brute ferait disparaitre.
   ============================================================ */

export default function EcranStats({ couverture, onChangement }) {
  const stats = statistiques(undefined, DOMAINES)
  const progression = serieProgression()
  const historiqueExamens = examens()

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
              reinitialiser()
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
