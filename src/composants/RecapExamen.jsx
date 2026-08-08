/* ============================================================
   RECAPITULATIF D'EXAMEN — la vue d'ensemble avant de soumettre.

   Reproduit l'ecran de revue de Pearson VUE : la grille de toutes
   les questions, leur etat, et un acces direct a chacune. C'est le
   seul endroit d'ou l'on soumet, et la soumission demande une
   confirmation chiffree — un clic accidentel ne doit pas terminer
   un examen de deux heures.
   ============================================================ */

export default function RecapExamen({
  questions,
  reponses,
  onAller,
  onReprendre,
  onSoumettre,
  confirmation,
  onDemanderConfirmation,
  onAnnulerConfirmation,
}) {
  const repondues = reponses.filter((r) => r.choix.length > 0).length
  const marquees = reponses.filter((r) => r.marquee).length
  const sansReponse = questions.length - repondues

  function classeCase(i) {
    const r = reponses[i]
    const classes = ['case-question']
    if (r.choix.length > 0) classes.push('case-repondue')
    if (r.marquee) classes.push('case-marquee')
    return classes.join(' ')
  }

  return (
    <>
      <div className="carte">
        <div className="carte-titre">
          <h2>Récapitulatif</h2>
        </div>

        <div className="couverture">
          <div className="couverture-case">
            <span className="couverture-chiffre">
              {repondues}/{questions.length}
            </span>
            <span className="couverture-libelle">répondues</span>
          </div>
          <div className="couverture-case">
            <span className="couverture-chiffre">{sansReponse}</span>
            <span className="couverture-libelle">sans réponse</span>
          </div>
          <div className="couverture-case">
            <span className="couverture-chiffre">{marquees}</span>
            <span className="couverture-libelle">marquées</span>
          </div>
        </div>

        <p className="note">
          Touchez un numéro pour revenir à la question et changer votre réponse. Rien n’est corrigé
          tant que vous n’avez pas soumis.
        </p>

        <div className="grille-questions">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              className={classeCase(i)}
              onClick={() => onAller(i)}
              aria-label={`Question ${i + 1}${reponses[i].choix.length ? ', répondue' : ', sans réponse'}${reponses[i].marquee ? ', marquée à revoir' : ''}`}
            >
              {i + 1}
              {reponses[i].marquee && (
                <span className="case-drapeau" aria-hidden="true">
                  ⚑
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="legende">
          <span>
            <i className="pastille-legende pastille-repondue" /> répondue
          </span>
          <span>
            <i className="pastille-legende pastille-vide" /> sans réponse
          </span>
          <span>
            <i className="pastille-legende pastille-marquee" /> marquée
          </span>
        </div>
      </div>

      {confirmation ? (
        <div className="carte carte-confirmation">
          <h2>Soumettre l’examen ?</h2>
          <p>
            Vous avez répondu à <strong>{repondues}</strong> question
            {repondues > 1 ? 's' : ''} sur {questions.length}
            {marquees > 0 ? (
              <>
                , dont <strong>{marquees}</strong> marquée{marquees > 1 ? 's' : ''} à revoir
              </>
            ) : null}
            .
            {sansReponse > 0 && (
              <>
                {' '}
                <strong>
                  {sansReponse} question{sansReponse > 1 ? 's' : ''} sans réponse
                </strong>{' '}
                {sansReponse > 1 ? 'seront comptées' : 'sera comptée'} comme fausse
                {sansReponse > 1 ? 's' : ''}.
              </>
            )}
          </p>
          <p className="note">
            La correction complète — score, détail par domaine et explication de chaque question —
            s’affiche juste après. Vous ne pourrez plus modifier vos réponses.
          </p>
          <div className="pile">
            <button className="bouton bouton-principal" onClick={onSoumettre}>
              Oui, soumettre
            </button>
            <button className="bouton" onClick={onAnnulerConfirmation}>
              Non, continuer l’examen
            </button>
          </div>
        </div>
      ) : (
        <div className="pile">
          <button className="bouton" onClick={onReprendre}>
            Reprendre l’examen
          </button>
          <button className="bouton bouton-principal" onClick={onDemanderConfirmation}>
            Terminer l’examen
          </button>
        </div>
      )}
    </>
  )
}
