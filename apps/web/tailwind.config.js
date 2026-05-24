/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    // Shared UI package — scanned so its Tailwind classes are generated.
    '../../packages/ui/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary brand (Lieferzonen green) ─────────────────────────────
        // Single-token form preserved for legacy `bg-primary` usage.
        primary: {
          DEFAULT: '#24A94A',
          50:  '#ecfdf3',
          100: '#d2f5dc',
          200: '#a8e9bb',
          300: '#74d997',
          400: '#3fc471',
          500: '#24A94A',
          600: '#1a8a3b',
          700: '#156d30',
          800: '#125627',
          900: '#0f4720',
        },
        // ── Brand alias (= primary) ───────────────────────────────────────
        // Kept for components that consume `bg-brand-*` / `text-brand-*`.
        brand: {
          DEFAULT: '#24A94A',
          50:  '#ecfdf3',
          100: '#d2f5dc',
          200: '#a8e9bb',
          300: '#74d997',
          400: '#3fc471',
          500: '#24A94A',
          600: '#1a8a3b',
          700: '#156d30',
          800: '#125627',
          900: '#0f4720',
        },

        // ── Secondary (warm accent for partner / pro surfaces) ────────────
        secondary: {
          DEFAULT: '#b54708',
          50:  '#fff8ed',
          100: '#ffefd4',
          200: '#fcd9a8',
          300: '#f9bd72',
          400: '#f3993b',
          500: '#e07816',
          600: '#b54708',
          700: '#8a3505',
          800: '#6e2a04',
          900: '#582203',
        },

        // ── Neutral ink scale ─────────────────────────────────────────────
        ink: {
          50:  '#f7f8f9',
          100: '#eef0f3',
          200: '#dee2e8',
          300: '#c4cad3',
          400: '#9aa2ae',
          500: '#6b7380',
          600: '#4b525d',
          700: '#343a43',
          800: '#1f242b',
          900: '#0f1216',
        },

        // ── Semantic states ───────────────────────────────────────────────
        success: {
          50:  '#ecfdf3',
          100: '#d7f0df',
          200: '#a8e9bb',
          300: '#74d997',
          400: '#3fc471',
          500: '#24a94a',
          600: '#067647',
          700: '#044e2b',
        },
        warning: {
          50:  '#fff8ed',
          100: '#ffefd4',
          200: '#f3d7ac',
          300: '#f9bd72',
          400: '#f3993b',
          500: '#e07816',
          600: '#b54708',
          700: '#8a3505',
        },
        danger: {
          50:  '#fff1f0',
          100: '#ffe1de',
          200: '#fda29b',
          300: '#f97066',
          400: '#f04438',
          500: '#d92d20',
          600: '#b42318',
          700: '#8c1a12',
        },
      },
      fontFamily: {
        italiana: ['Italiana', 'serif'],
      },
      boxShadow: {
        card:  '0 1px 2px rgba(15,18,22,0.04), 0 6px 18px rgba(15,18,22,0.06)',
        pop:   '0 10px 30px rgba(15,18,22,0.10)',
        focus: '0 0 0 3px rgba(36,169,74,0.18)',
      },
      borderRadius: {
        xl2: '14px',
        xl3: '18px',
      },
    },
  },
  plugins: [],
};
