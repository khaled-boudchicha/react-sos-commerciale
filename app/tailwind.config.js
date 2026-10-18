/** Les couleurs pointent sur les variables CSS de src/styles/tokens.css —
 *  source unique des tokens (règle : zéro hex hors tokens.css). */
/** @type {import('tailwindcss').Config} */
module.exports = {
  // le paquet @softly/report est compilé avec les utilitaires de l'application (noms de jetons communs)
  content: ['./index.html', './src/**/*.{ts,tsx}', '../packages/report/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)', 100: 'var(--brand-100)', 300: 'var(--brand-300)',
          500: 'var(--brand-500)', 700: 'var(--brand-700)', 900: 'var(--brand-900)',
        },
        gold: { 400: 'var(--gold-400)', 600: 'var(--gold-600)' },
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        raised: 'var(--surface-raised)',
        line: { DEFAULT: 'var(--line)', soft: 'var(--line-soft)' },
        ink: { DEFAULT: 'var(--text)', label: 'var(--text-label)', muted: 'var(--text-muted)' },
        ok: 'var(--success)',
        warn: 'var(--warning)',
        bad: 'var(--danger)',
        info: 'var(--info)',
        teal: 'var(--teal)',
        violet: 'var(--violet)',
        orange: 'var(--orange)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: 'var(--r-sm)', md: 'var(--r-md)', lg: 'var(--r-lg)' },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        lifted: 'var(--shadow-lifted)',
      },
    },
  },
  plugins: [],
};
