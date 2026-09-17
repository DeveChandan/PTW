/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Google Stitch & SAP Horizon Light Theme Tokens
        'surface-canvas': '#f8f9ff',
        'surface-card': '#ffffff',
        'surface-low': '#eff4ff',
        'surface-container': '#e2e8f0',
        'surface-hover': '#f1f5f9',
        'on-surface': '#0b1c30',
        'on-surface-muted': '#64748b',
        'on-surface-subtle': '#94a3b8',

        'brand-blue': '#006398',
        'brand-blue-hover': '#004f7a',
        'brand-blue-light': '#e0f2fe',
        
        'hazard-amber': '#d97706',
        'hazard-amber-light': '#fef3c7',
        
        'safety-green': '#059669',
        'safety-green-light': '#ecfdf5',
        
        'danger-red': '#dc2626',
        'danger-red-light': '#fef2f2',

        sap: {
          shell: '#ffffff',
          accent: '#006398',
          hover: '#004f7a',
          bg: '#f8f9ff',
          surface: '#ffffff',
          border: '#e2e8f0',
          success: '#059669',
          warning: '#d97706',
          danger: '#dc2626',
          info: '#0284c7'
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
        'header': '0 1px 4px 0 rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
