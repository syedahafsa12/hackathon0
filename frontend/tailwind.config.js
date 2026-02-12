/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'pink-soft': '#FFD1DC',
        'purple-soft': '#E6E6FA',
        'mint-soft': '#98FF98',
        'peach-soft': '#FFE5B4',
        'lavender-soft': '#E6E6FA',
      },
      backgroundImage: {
        'gradient-pink-purple': 'linear-gradient(135deg, #FF69B4, #9370DB)',
        'gradient-mint-peach': 'linear-gradient(135deg, #98FF98, #FFE5B4)',
      }
    },
  },
  plugins: [],
}