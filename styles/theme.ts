export const typography = {
  fontFamily: 'Inter var, system-ui, sans-serif',
  features: 'ss01, ss02, cv01, cv02, cv03',
  scale: {
    display: 'clamp(2.5rem, 2rem + 3vw, 4rem)',
    h1: 'clamp(2rem, 1.8rem + 2vw, 3rem)',
    h2: 'clamp(1.5rem, 1.3rem + 1.5vw, 2.25rem)',
    h3: 'clamp(1.25rem, 1.1rem + 1vw, 1.75rem)',
    body: 'clamp(1rem, 0.95rem + 0.5vw, 1.125rem)',
    small: 'clamp(0.875rem, 0.85rem, 1rem)',
  },
  lineHeight: {
    display: '1.1',
    heading: '1.2',
    body: '1.6',
  },
} as const;

export const space = {
  page: 'clamp(1rem, 3vw, 2rem)',
  section: 'clamp(2rem, 5vw, 4rem)',
  component: 'clamp(1rem, 2vw, 1.5rem)',
  element: 'clamp(0.5rem, 1vw, 0.75rem)',
  grid: {
    container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
    gap: 'gap-4 md:gap-6 lg:gap-8',
    cols: 'grid-cols-4 md:grid-cols-8 lg:grid-cols-12',
  },
} as const;

export const colors = {
  brand: {
    primary: {
      light: '#60A5FA',
      default: '#3B82F6',
      dark: '#2563EB',
    },
    gradient: {
      primary: 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700',
      subtle: 'bg-gradient-to-r from-slate-50 to-slate-100',
      glass: 'bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-md',
    },
  },
  surface: {
    primary: 'bg-white dark:bg-slate-900',
    secondary: 'bg-slate-50 dark:bg-slate-800',
    tertiary: 'bg-slate-100 dark:bg-slate-700',
  },
  state: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
} as const;

export const animations = {
  pageTransition: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 30,
    },
  },
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 30,
    },
  },
  hover: {
    scale: 1.02,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 17,
    },
  },
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Type definitions
export type Typography = typeof typography;
export type Space = typeof space;
export type Colors = typeof colors;
export type Animations = typeof animations;
export type Breakpoints = typeof breakpoints;

export const theme = {
  typography,
  space,
  colors,
  animations,
  breakpoints,
} as const;

export type Theme = typeof theme;

export default theme; 