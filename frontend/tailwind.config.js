/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Med-Essence brand colors - Navy blue with orange accent theme
        primary: {
          50: '#f8fafc', // Light gray-blue
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#7bb0e7', // Aero Blue (existing secondary)
          400: '#60a5e0',
          500: '#4c97d9',
          600: '#334155', // Darker navy
          700: '#1e293b', // Navy blue background (primary brand color)
          800: '#0f172a',
          900: '#020617',
        },
        // Orange accent colors (from brain logo)
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // Orange accent (main brand orange)
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Secondary brand colors
        secondary: {
          50: '#f0fafa',
          100: '#ccf2f0',
          200: '#99e5e0',
          300: '#4ecac2', // Medium turquoise
          400: '#3bb8af',
          500: '#2ba69c',
          600: '#228e84',
          700: '#1b6f66',
          800: '#145048',
          900: '#0d322b',
        },
        // Steel teal brand color
        steel: {
          50: '#f7f9f9',
          100: '#e6f0f1',
          200: '#cce1e3',
          300: '#5f8789', // Steel teal
          400: '#4f747a',
          500: '#3f616b',
          600: '#2f4e5c',
          700: '#1f3b4d',
          800: '#0f283e',
          900: '#00152f',
        },
        // Brand foundation colors
        navy: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b', // Main navy background
          900: '#0f172a',
        },
        orange: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // Main orange accent
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Keep medical as alias to primary for backward compatibility
        medical: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#7bb0e7', // Aero Blue
          400: '#60a5e0',
          500: '#4c97d9',
          600: '#334155',
          700: '#1e293b', // Navy blue
          800: '#0f172a',
          900: '#020617',
        },
        // Status colors
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        }
      },
      fontFamily: {
        'medical': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'recording': 'recording 1.5s ease-in-out infinite',
      },
      keyframes: {
        recording: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.05)', opacity: '0.8' }
        }
      }
    },
  },
  plugins: [],
}