/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
      colors: {
        // Setup wizard palette — was the globals.css :root token set.
        canvas: '#faf6f1',
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f4eee5',
          hover: '#efe7da',
        },
        line: {
          DEFAULT: '#ece2d2',
          strong: '#d8c8ad',
        },
        ink: {
          DEFAULT: '#1c1917',
          soft: '#44403c',
          muted: '#78716c',
          faint: '#a8a29e',
        },
        accent: {
          DEFAULT: '#f97316',
          hover: '#ea580c',
          soft: '#fff1e6',
          border: '#fed7aa',
        },
        danger: {
          DEFAULT: '#dc2626',
          soft: '#fef2f2',
          border: '#fecaca',
        },
        success: {
          DEFAULT: '#15803d',
          soft: '#ecfdf5',
          border: '#bbf7d0',
        },
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        lg: '14px',
        xl: '18px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(28, 25, 23, 0.04)',
        DEFAULT:
          '0 6px 18px rgba(28, 25, 23, 0.05), 0 1px 2px rgba(28, 25, 23, 0.04)',
      },
    },
  },
  plugins: [],
};
