import { useState, useMemo } from 'react'
import { QUESTIONS, DOMAINES, SOUS_DOMAINES } from '../banque.js'

/* ============================================================
   ENTRAINEMENT — choix du perimetre avant de lancer une serie.

   Les listes deroulantes ne montrent que ce qui existe reellement
   dans la banque : proposer un sous-domaine vide donnerait un
   ecran « aucune question » sans expliquer pourquoi.
   ============================================================ */

export default function EcranEntrainement({ onLancer }) {
  const [domaine, setDomaine] = useState('')
  const [sousDomaine, setSousDomaine] = useState('')
  const [difficulte, setDifficulte] = useState('')
  const [limite, setLimite] = useState(20)

  const domainesDispo = useMemo(() => {
    const avec = new Set(QUESTIONS.map((q) => q.domain))
    return DOMAINES.filter((d) => avec.has(d.nom))
  }, [])

  const sousDomainesDispo = useMemo(() => {
    const avec = new Set(QUESTIONS.map((q) => q.subdomain))
    return SOUS_DOMAINES.filter((sd) => avec.has(sd.nom)).filter((sd) => !domaine || sd.domaine === domaine)
  }, [domaine])

  const selection = useMemo(
    () =>
      QUESTIONS.filter(
        (q) =>
          (!domaine || q.domain === domaine) &&
          (!sousDomaine || q.subdomain === sousDomaine) &&
          (!difficulte || q.difficulty === difficulte)
      ),
    [domaine, sousDomaine, difficulte]
  )

  return (
    <>
      <div className="entete">
        <h1>Entraînement</h1>
      </div>

      <div className="carte">
        <div className="filtres">
          <div className="champ">
            <label htmlFor="f-domaine">Domaine</label>
            <select
              id="f-domaine"
              value={domaine}
              onChange={(e) => {
                setDomaine(e.target.value)
                setSousDomaine('')
              }}
            >
              <option value="">Tous les domaines</option>
              {domainesDispo.map((d) => (
                <option key={d.nom} value={d.nom}>
                  {d.nom} ({d.poids} %)
                </option>
              ))}
            </select>
          </div>

          <div className="champ">
            <label htmlFor="f-sous-domaine">Sous-domaine</label>
            <select id="f-sous-domaine" value={sousDomaine} onChange={(e) => setSousDomaine(e.target.value)}>
              <option value="">Tous les sous-domaines</option>
              {sousDomainesDispo.map((sd) => (
                <option key={sd.nom} value={sd.nom}>
                  {sd.nom} ({sd.poids} %)
                </option>
              ))}
            </select>
          </div>

          <div className="champ">
            <label htmlFor="f-difficulte">Difficulté</label>
            <select id="f-difficulte" value={difficulte} onChange={(e) => setDifficulte(e.target.value)}>
              <option value="">Toutes</option>
              <option value="facile">Facile</option>
              <option value="moyen">Moyen</option>
              <option value="difficile">Difficile</option>
            </select>
          </div>

          <div className="champ">
            <label htmlFor="f-limite">Nombre de questions</label>
            <select id="f-limite" value={limite} onChange={(e) => setLimite(Number(e.target.value))}>
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="note" style={{ marginTop: 'var(--e4)' }}>
          {selection.length} question{selection.length > 1 ? 's' : ''} correspond
          {selection.length > 1 ? 'ent' : ''} à cette sélection.
        </p>

        <button
          className="bouton bouton-principal"
          disabled={!selection.length}
          onClick={() => onLancer({ domaine, sousDomaine, difficulte, limite, questions: QUESTIONS })}
        >
          Lancer la série
        </button>
      </div>
    </>
  )
}
