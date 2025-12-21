/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          orange: '#f97316',
          yellow: '#fbbf24',
          teal: '#14b8a6',
          blue: '#3b82f6',
          green: '#10b981',
          red: '#ef4444',
        },
        status: {
          error: '#ef4444',
          success: '#10b981',
          warning: '#f59e0b',
          info: '#3b82f6',
        },
        text: {
          primary: '#111827',
          secondary: '#6b7280',
          light: '#9ca3af',
        },
        background: {
          light: '#f9fafb',
        },
        border: {
          light: '#e5e7eb',
        },
      },
      boxShadow: {
        soft: '0 2px 4px rgba(0, 0, 0, 0.05)',
        medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
        large: '0 10px 15px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}

