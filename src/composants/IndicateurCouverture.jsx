/* ============================================================
   INDICATEUR DE COUVERTURE — present en permanence.

   La banque se construit sous-domaine par sous-domaine ; il faut
   savoir a tout moment ce qui manque, et surtout combien PESE ce
   qui manque, puisque les sous-domaines ne pesent pas pareil.
   ============================================================ */

export default function IndicateurCouverture({ couverture, detaille = false }) {
  const { nbQuestions, nbSousDomainesCouverts, nbSousDomainesTotal, poidsCouvert, manquants } = couverture

  return (
    <div className="carte">
      <div className="carte-titre">
        <h2>Couverture du blueprint</h2>
      </div>

      <div className="couverture">
        <div className="couverture-case">
          <span className="couverture-chiffre">{nbQuestions}</span>
          <span className="couverture-libelle">questions</span>
        </div>
        <div className="couverture-case">
          <span className="couverture-chiffre">
            {nbSousDomainesCouverts}/{nbSousDomainesTotal}
          </span>
          <span className="couverture-libelle">sous-domaines</span>
        </div>
        <div className="couverture-case">
          <span className="couverture-chiffre">{poidsCouvert.toFixed(1)} %</span>
          <span className="couverture-libelle">du poids de l’examen</span>
        </div>
      </div>

      <div className="jauge" role="img" aria-label={`${poidsCouvert.toFixed(1)} pour cent du poids du blueprint couvert`}>
        <div className="jauge-remplissage" style={{ width: `${poidsCouvert}%` }} />
      </div>

      {detaille && manquants.length > 0 && (
        <>
          <h3 style={{ marginTop: 'var(--e4)', color: 'var(--texte-doux)' }}>
            Sans questions à ce jour ({manquants.length}), du plus lourd au plus léger
          </h3>
          <table className="tableau">
            <tbody>
              {manquants.map((m) => (
                <tr key={m.nom}>
                  <td>
                    {m.nom}
                    <br />
                    <span className="note">{m.domaine}</span>
                  </td>
                  <td className="nombre">{m.poids.toFixed(1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!detaille && manquants.length > 0 && (
        <p className="note" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
          {manquants.length} sous-domaine{manquants.length > 1 ? 's' : ''} sans questions, soit{' '}
          {(100 - poidsCouvert).toFixed(1)} % du poids de l’examen. Le plus lourd :{' '}
          <strong>{manquants[0].nom}</strong> ({manquants[0].poids.toFixed(1)} %).
        </p>
      )}
    </div>
  )
}
