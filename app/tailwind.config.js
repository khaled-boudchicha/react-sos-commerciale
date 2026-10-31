/** Les couleurs pointent sur les variables CSS de src/styles/tokens.css —
 *  source unique des tokens (règle : zéro hex hors tokens.css).
 *  Compatibilité : aucun nom existant n'est retiré (le paquet @softly/report est
 *  compilé avec cette configuration et en utilise une partie). */
const tones = ['success', 'warning', 'danger', 'info', 'teal', 'violet', 'orange', 'neutral'];
const roles = (t) => ({
  solid: `var(--${t}-solid)`, text: `var(--${t}-text)`, soft: `var(--${t}-soft)`, line: `var(--${t}-line)`,
});

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
          text: 'var(--brand-text)', soft: 'var(--brand-soft)', line: 'var(--brand-line)',
        },
        gold: { 400: 'var(--gold-400)', 600: 'var(--gold-600)', ink: 'var(--gold-ink)', text: 'var(--gold-text)' },
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        raised: 'var(--surface-raised)',
        sunken: 'var(--surface-sunken)',
        hover: 'var(--surface-hover)',
        active: 'var(--surface-active)',
        overlay: 'var(--overlay)',
        line: { DEFAULT: 'var(--line)', soft: 'var(--line-soft)', strong: 'var(--line-strong)' },
        ink: {
          DEFAULT: 'var(--text)', label: 'var(--text-label)', muted: 'var(--text-muted)',
          placeholder: 'var(--text-placeholder)', inverse: 'var(--text-inverse)',
        },
        // alias historiques (aplats) — lus aussi par @softly/report
        ok: 'var(--success)',
        warn: 'var(--warning)',
        bad: 'var(--danger)',
        info: { DEFAULT: 'var(--info)', ...roles('info') },
        teal: { DEFAULT: 'var(--teal)', ...roles('teal') },
        violet: { DEFAULT: 'var(--violet)', ...roles('violet') },
        orange: { DEFAULT: 'var(--orange)', ...roles('orange') },
        ...Object.fromEntries(tones.filter((t) => !['info', 'teal', 'violet', 'orange'].includes(t)).map((t) => [t, roles(t)])),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Échelle typographique nommée (charte v2 §3) — remplace les tailles arbitraires
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '16px'],
        sm: ['12px', '18px'],
        base: ['13px', '20px'],
        md: ['14px', '20px'],
        lg: ['16px', '22px'],
        xl: ['18px', '24px'],
        '2xl': ['20px', '26px'],
        '3xl': ['26px', '30px'],
        display: ['32px', '36px'],
        pos: ['50px', '52px'],
      },
      borderRadius: { xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)', lg: 'var(--r-lg)' },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        lifted: 'var(--shadow-lifted)',
        modal: 'var(--shadow-modal)',
      },
      zIndex: {
        sticky: '20', dropdown: '30', ribbon: '35', modal: '50', popover: '60', backstage: '70', tooltip: '80', toast: '100',
      },
      transitionDuration: { fast: '100ms', DEFAULT: '150ms', slow: '250ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(.2, .8, .2, 1)' },
      height: { 'control-sm': 'var(--control-sm)', 'control-md': 'var(--control-md)', 'control-lg': 'var(--control-lg)', 'control-xl': 'var(--control-xl)' },
      minHeight: { 'control-sm': 'var(--control-sm)', 'control-md': 'var(--control-md)', 'control-lg': 'var(--control-lg)', 'control-xl': 'var(--control-xl)' },
      keyframes: {
        'gc-shimmer': { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'gc-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'gc-pop-in': { from: { opacity: '0', transform: 'translateY(6px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
        'gc-slide-in': { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'none' } },
        'gc-spin': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        shimmer: 'gc-shimmer 1.4s ease-in-out infinite',
        'fade-in': 'gc-fade-in 150ms ease-out',
        'pop-in': 'gc-pop-in 180ms cubic-bezier(.2,.8,.2,1)',
        'slide-in': 'gc-slide-in 200ms cubic-bezier(.2,.8,.2,1)',
        spin: 'gc-spin .7s linear infinite',
      },
    },
  },
  plugins: [],
};
