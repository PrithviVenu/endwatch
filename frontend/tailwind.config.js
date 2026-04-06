/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        card: '#111111',
        hover: '#1a1a1a',
        accent: '#3b82f6',
        up: '#22c55e',
        down: '#ef4444',
        'border-custom': '#222222',
      },
    },
  },
  plugins: [],
}
