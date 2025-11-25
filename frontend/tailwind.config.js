/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Base theme colors
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // Premium event colors matching inspiration
        'event-meeting': '#8b5a2b',
        'event-review': '#b91c1c',
        'event-presentation': '#ea580c',
        'event-design': '#1e40af',
        'event-collaboration': '#16a34a',
        'event-personal': '#7c3aed',
        'event-screener': '#eab308',
        // Premium background variants
        'background-primary': '#1a1a1a',
        'background-secondary': '#2d2d2d',
        'background-tertiary': '#404040',
        'background-glass': 'rgba(45, 45, 45, 0.6)',
        // Enhanced text colors
        'text-primary': '#f8fafc',
        'text-secondary': '#cbd5e1',
        'text-tertiary': '#64748b',
        // Premium border colors
        'border-subtle': 'rgba(255, 255, 255, 0.1)',
        'border-accent': 'rgba(255, 255, 255, 0.2)',
        // Liquid Glass System
        'glass-light': 'rgba(255, 255, 255, 0.1)',
        'glass-dark': 'rgba(20, 20, 20, 0.4)',
        'border-glass': 'rgba(255, 255, 255, 0.15)',
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 4px)",
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '18': '4.5rem',
        '22': '5.5rem',
      },

      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'glass': '12px', // Optimized for performance
      },
      boxShadow: {
        'premium': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'premium-lg': '0 8px 32px rgba(0, 0, 0, 0.15)',
        'glow': '0 0 20px rgba(255, 255, 255, 0.1)',
        'event': '0 2px 8px rgba(0, 0, 0, 0.12)',
        'event-hover': '0 4px 16px rgba(0, 0, 0, 0.18)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        'glass-hover': '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'slide-in-up': 'slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blob': 'blob 20s infinite',
      },
      keyframes: {
        slideInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
        scaleIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.95)'
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)'
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}