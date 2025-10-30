/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Canoil Brand Colors - Industrial Blue & Professional Gray
        primary: {
          DEFAULT: '#003d7a',  // Deep Canoil Blue
          light: '#0056b3',    // Lighter blue for hover
          dark: '#002855',     // Darker blue for headers
          50: '#e6f0ff',
          100: '#cce0ff',
          200: '#99c2ff',
          300: '#66a3ff',
          400: '#3385ff',
          500: '#0066ff',
          600: '#003d7a',
          700: '#002855',
          800: '#001a3d',
          900: '#000d1f',
        },
        secondary: {
          DEFAULT: '#4a5568',  // Professional gray
          light: '#718096',
          dark: '#2d3748',
        },
        accent: {
          orange: '#ff6b35',   // Accent orange for CTAs
          blue: '#0099ff',     // Bright blue for highlights
        },
        background: '#f7fafc',
        surface: '#ffffff',
        error: '#f56565',
        success: '#48bb78',
        warning: '#ed8936',
        info: '#4299e1',
        // Additional grays for UI elements
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      },
      fontFamily: {
        'sans': [
          '-apple-system', 
          'BlinkMacSystemFont', 
          'Segoe UI', 
          'Roboto', 
          'Oxygen', 
          'Ubuntu', 
          'Cantarell', 
          'Fira Sans', 
          'Droid Sans', 
          'Helvetica Neue', 
          'sans-serif'
        ],
        'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
        'display': [
          '-apple-system', 
          'BlinkMacSystemFont', 
          'Segoe UI', 
          'Roboto', 
          'system-ui', 
          'sans-serif'
        ],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.1)',
        elevated: '0 4px 10px rgba(0, 0, 0, 0.15)',
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.08), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'canoil': '0 4px 6px -1px rgba(0, 61, 122, 0.1), 0 2px 4px -1px rgba(0, 61, 122, 0.06)',
        'canoil-lg': '0 10px 15px -3px rgba(0, 61, 122, 0.1), 0 4px 6px -2px rgba(0, 61, 122, 0.05)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        DEFAULT: '8px',
        'xl': '12px',
        '2xl': '16px',
      },
      animation: {
        'blob': 'blob 7s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        blob: {
          '0%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -50px) scale(1.1)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.9)',
          },
          '100%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      animationDelay: {
        '2000': '2s',
        '4000': '4s',
      },
    },
  },
  plugins: [],
} 