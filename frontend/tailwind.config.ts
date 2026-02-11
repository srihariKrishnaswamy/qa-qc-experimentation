import type { Config } from 'tailwindcss'
import type { PluginAPI } from 'tailwindcss/types/config'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#86CDDF',
          hover: '#6BB8CC',
          light: '#D4EEF4',
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }: PluginAPI) {
      addUtilities({
        '.border-dashed-custom': {
          '--dash-length': '8px',
          '--dash-gap': '8px',
          '--dash-width': '1px',
          '--dash-color': 'currentColor',
          border: 'none',
          'background-color': 'transparent',
          'background-image': `repeating-linear-gradient(to right, var(--dash-color) 0, var(--dash-color) var(--dash-length), transparent var(--dash-length), transparent calc(var(--dash-length) + var(--dash-gap))),
            repeating-linear-gradient(to bottom, var(--dash-color) 0, var(--dash-color) var(--dash-length), transparent var(--dash-length), transparent calc(var(--dash-length) + var(--dash-gap))),
            repeating-linear-gradient(to right, var(--dash-color) 0, var(--dash-color) var(--dash-length), transparent var(--dash-length), transparent calc(var(--dash-length) + var(--dash-gap))),
            repeating-linear-gradient(to bottom, var(--dash-color) 0, var(--dash-color) var(--dash-length), transparent var(--dash-length), transparent calc(var(--dash-length) + var(--dash-gap)))`,
          'background-size': `100% var(--dash-width), var(--dash-width) 100%, 100% var(--dash-width), var(--dash-width) 100%`,
          'background-position': '0 0, 100% 0, 100% 100%, 0 100%',
          'background-repeat': 'repeat-x, repeat-y, repeat-x, repeat-y',
        },
      })
    },
  ],
}
export default config
