/* ============================================================
   BADGE SOURCE — d'ou vient cette question, en un coup d'oeil.

   Lit directement question.source : ce champ vit deja sur chaque
   question complete (doc et prepcourse), pas besoin de savoir quelle
   banque est active pour l'afficher.
   ============================================================ */

const LIBELLES = {
  doc: 'Doc',
  prepcourse: 'Prep Course',
}

export default function BadgeSource({ source }) {
  if (!source) return null
  const accent = source === 'prepcourse'
  return (
    <span className={`etiquette ${accent ? 'etiquette-accent' : ''}`}>
      {LIBELLES[source] || source}
    </span>
  )
}
