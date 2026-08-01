import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le dossier questions/ est a la racine du projet, a cote de src/ : c'est ce
// qui permet a src/banque.js de l'aspirer avec import.meta.glob sans sortir de
// la racine Vite, et donc sans liste de fichiers codee en dur.
export default defineConfig({
  plugins: [react()],
})
