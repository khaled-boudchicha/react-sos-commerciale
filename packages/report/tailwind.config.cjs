/**
 * Génère `dist/report.css` : uniquement les utilitaires utilisés par les composants du paquet, tous préfixés
 * `.gcr-root` (important: '.gcr-root'), sans preflight global. Les couleurs pointent sur les variables `--gcr-*`
 * (valeurs par défaut dans src/ui/styles/tokens.css) : l'hôte les surcharge pour adopter sa charte graphique.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  important: '.gcr-root',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        surface: 'var(--gcr-surface)',
        line: { DEFAULT: 'var(--gcr-line)', soft: 'var(--gcr-line-soft)' },
        ink: { DEFAULT: 'var(--gcr-text)', label: 'var(--gcr-text-label)', muted: 'var(--gcr-text-muted)' },
        brand: { 700: 'var(--gcr-brand-700)' },
      },
      fontFamily: { mono: ['var(--gcr-font-mono)'] },
      borderRadius: { sm: 'var(--gcr-r-sm)', md: 'var(--gcr-r-md)', lg: 'var(--gcr-r-lg)' },
      boxShadow: { soft: 'var(--gcr-shadow-soft)', card: 'var(--gcr-shadow-card)', lifted: 'var(--gcr-shadow-lifted)' },
    },
  },
};
