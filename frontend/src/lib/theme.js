export const THEMES = {
  dark: {
    label: 'Dark Mode',
    description: 'Default — dark charcoal · orange accent',
    preview: { bg: '#0D0D0F', surface: '#141416', accent: '#F97316', text: '#F0EFE8' },
    vars: {
      '--accent':        '#F97316',
      '--accent-dim':    '#C2570E',
      '--accent-glow':   'rgba(249, 115, 22, 0.15)',
      '--bg-base':       '#0D0D0F',
      '--bg-surface':    '#141416',
      '--bg-elevated':   '#1C1C1F',
      '--bg-border':     '#2A2A2E',
      '--text-primary':  '#F0EFE8',
      '--text-secondary':'#9A9890',
      '--text-muted':    '#5A5856',
      '--green':         '#22C55E',
      '--red':           '#EF4444',
      '--blue':          '#3B82F6',
      '--font-display':  "'Barlow Condensed', sans-serif",
      '--font-ui':       "'Barlow', sans-serif",
      '--font-mono':     "'JetBrains Mono', monospace",
    },
    fonts: 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  },

  light: {
    label: 'Light Mode',
    description: 'Clean white · orange accent',
    preview: { bg: '#F5F2ED', surface: '#EDEAE3', accent: '#EA6C00', text: '#1A1714' },
    vars: {
      '--accent':        '#EA6C00',
      '--accent-dim':    '#B85200',
      '--accent-glow':   'rgba(234, 108, 0, 0.12)',
      '--bg-base':       '#F5F2ED',
      '--bg-surface':    '#EDEAE3',
      '--bg-elevated':   '#E4E0D8',
      '--bg-border':     '#CCC8BF',
      '--text-primary':  '#1A1714',
      '--text-secondary':'#5C5650',
      '--text-muted':    '#9C9890',
      '--green':         '#16A34A',
      '--red':           '#DC2626',
      '--blue':          '#2563EB',
      '--font-display':  "'Barlow Condensed', sans-serif",
      '--font-ui':       "'Barlow', sans-serif",
      '--font-mono':     "'JetBrains Mono', monospace",
    },
    fonts: 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  },
}

export function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.dark
  const root = document.documentElement

  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  let fontLink = document.getElementById('theme-fonts')
  if (!fontLink) {
    fontLink = document.createElement('link')
    fontLink.id = 'theme-fonts'
    fontLink.rel = 'stylesheet'
    document.head.appendChild(fontLink)
  }
  fontLink.href = theme.fonts
}