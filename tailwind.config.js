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

        'surface-tint-blue': '#f5f9fc',
        'surface-tint-indigo': '#f5f6ff',
        'surface-tint-emerald': '#f2faf6',
        'surface-tint-amber': '#fefbf2',
        'surface-tint-rose': '#fef5f5',
        'surface-tint-slate': '#f8fafc',
        'surface-tint-cyan': '#f0fdfa',
        'surface-tint-purple': '#faf5ff',

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
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      spacing: {
        '4.5': '1.125rem',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'card': '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 4px 12px -2px rgba(15, 23, 42, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.95)',
        'card-hover': '0 12px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 1)',
        'card-elevated': '0 16px 36px -6px rgba(15, 23, 42, 0.1), 0 6px 14px -3px rgba(15, 23, 42, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 1)',
        'glow-blue': '0 8px 24px -4px rgba(0, 99, 152, 0.18), 0 2px 6px -1px rgba(0, 99, 152, 0.08)',
        'glow-emerald': '0 8px 24px -4px rgba(5, 150, 105, 0.18), 0 2px 6px -1px rgba(5, 150, 105, 0.08)',
        'glow-amber': '0 8px 24px -4px rgba(217, 119, 6, 0.18), 0 2px 6px -1px rgba(217, 119, 6, 0.08)',
        'glow-indigo': '0 8px 24px -4px rgba(79, 70, 229, 0.18), 0 2px 6px -1px rgba(79, 70, 229, 0.08)',
        'glow-rose': '0 8px 24px -4px rgba(220, 38, 38, 0.18), 0 2px 6px -1px rgba(220, 38, 38, 0.08)',
        'glow-cyan': '0 8px 24px -4px rgba(8, 145, 178, 0.18), 0 2px 6px -1px rgba(8, 145, 178, 0.08)',
        'glow-purple': '0 8px 24px -4px rgba(147, 51, 234, 0.18), 0 2px 6px -1px rgba(147, 51, 234, 0.08)',
        'inner-bevel': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px 0 rgba(15, 23, 42, 0.03)',
        'inner-pressed': 'inset 0 2px 4px 0 rgba(15, 23, 42, 0.05)',
        'header': '0 4px 20px -4px rgba(15, 23, 42, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
