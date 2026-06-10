import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Thmanyah Serif Display"', 'serif'],
        body: ['"Thmanyah Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
        'serif-text': ['"Thmanyah Serif Text"', 'serif'],
        arabic: ['"Thmanyah Serif Text"', 'serif'],
      },
      colors: {
        ink: '#083d44',
        'ink-deep': '#09272b',
        canvas: '#fcfcf8',
        'surface-sage': '#f3f6e4',
        'surface-cool': '#e8eced',
        'accent-chartreuse': '#e5ff97',
        'link-blue': '#0000ee',
      },
      borderRadius: {
        none: '0px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        pill: '100px',
      },
      spacing: {
        'xs': '4px',
        'base': '10px',
      },
    },
  },
} satisfies Config;
