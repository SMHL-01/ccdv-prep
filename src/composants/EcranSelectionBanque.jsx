/* ============================================================
   SELECTION DE BANQUE — premier choix, avant tout le reste.

   Deux banques cloisonnees : doc officielle et Prep Course. Tant
   qu'aucune n'est choisie, rien d'autre ne s'affiche — examen blanc,
   entrainement, stats et repetition espacee ne travaillent QUE sur la
   banque retenue ici.
   ============================================================ */

export default function EcranSelectionBanque({ banques, onChoisir }) {
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
          <h2>Quelle banque de questions ?</h2>
        </div>
        <p className="note" style={{ marginBottom: 'var(--e4)' }}>
          Les deux banques sont indépendantes : examen blanc, entraînement, statistiques et
          révisions ne portent que sur celle choisie ici.
        </p>
        <div className="pile">
          {banques.map((b) => (
            <button
              key={b.id}
              className="bouton bouton-principal"
              onClick={() => onChoisir(b.id)}
              disabled={b.nbQuestions === 0}
            >
              {b.nom} — {b.nbQuestions} question{b.nbQuestions > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
