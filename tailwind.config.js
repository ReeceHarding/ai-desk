/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['Inter var', 'system-ui', 'sans-serif'],
  		},
  		fontSize: {
  			// Fluid typography
  			'display': ['clamp(2.5rem, 2rem + 3vw, 4rem)', { lineHeight: '1.1' }],
  			'h1': ['clamp(2rem, 1.8rem + 2vw, 3rem)', { lineHeight: '1.2' }],
  			'h2': ['clamp(1.5rem, 1.3rem + 1.5vw, 2.25rem)', { lineHeight: '1.2' }],
  			'h3': ['clamp(1.25rem, 1.1rem + 1vw, 1.75rem)', { lineHeight: '1.2' }],
  			'body': ['clamp(1rem, 0.95rem + 0.5vw, 1.125rem)', { lineHeight: '1.6' }],
  			'small': ['clamp(0.875rem, 0.85rem, 1rem)', { lineHeight: '1.6' }],
  		},
  		spacing: {
  			// Fluid spacing
  			'page': 'clamp(1rem, 3vw, 2rem)',
  			'section': 'clamp(2rem, 5vw, 4rem)',
  			'component': 'clamp(1rem, 2vw, 1.5rem)',
  			'element': 'clamp(0.5rem, 1vw, 0.75rem)',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				light: '#60A5FA',
  				dark: '#2563EB',
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			state: {
  				success: '#10B981',
  				warning: '#F59E0B',
  				error: '#EF4444',
  				info: '#3B82F6',
  			},
  		},
  		animation: {
  			'highlight': 'highlight 1s ease-in-out',
  		},
  		keyframes: {
  			highlight: {
  				'0%': { transform: 'translateX(-100%)' },
  				'100%': { transform: 'translateX(100%)' },
  			},
  		},
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
}

