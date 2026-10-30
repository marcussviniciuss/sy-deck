import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        'bg-elev': 'hsl(var(--bg-elev))',
        'bg-elev-2': 'hsl(var(--bg-elev-2))',
        fg: 'hsl(var(--fg))',
        muted: 'hsl(var(--muted))',
        border: 'hsl(var(--border))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          fg: 'hsl(var(--primary-fg))',
        },
        danger: 'hsl(var(--danger))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '1': '8px',
        '2': '16px',
        '3': '32px',
        '4': '64px',
        '5': '96px',
        '6': '128px',
      },
      borderRadius: {
        DEFAULT: '12px',
        lg: '16px',
        xl: '20px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(.2, .7, .2, 1)',
      },
      maxWidth: {
        prose: '68ch',
        container: '1120px',
      },
    },
  },
  plugins: [],
};

export default config;
