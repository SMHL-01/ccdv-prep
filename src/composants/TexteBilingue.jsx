/* ============================================================
   TEXTE BILINGUE — un fragment anglais et sa traduction francaise.

   L'anglais est la reference : c'est la langue de l'examen, il garde
   la taille et la couleur du texte normal. Le francais vient dessous,
   plus petit et plus gris, comme une aide et non comme la version
   officielle. Tant que la traduction n'existe pas dans le fichier de
   questions, seul l'anglais s'affiche — aucun trou, aucun message.

   Des <span> en display:block, jamais des <p> : ce composant sert
   aussi a l'interieur d'un <button>, ou seul le contenu phrase est
   valide en HTML.
   ============================================================ */

export default function TexteBilingue({ en, fr, classe = '' }) {
  return (
    <span className={`bilingue ${classe}`.trim()}>
      <span className="bilingue-source" lang="en">
        {en}
      </span>
      {fr && (
        <span className="bilingue-traduction" lang="fr">
          {fr}
        </span>
      )}
    </span>
  )
}
