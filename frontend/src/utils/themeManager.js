// Theme Manager utility for custom base and accent colors across 5 themes

export const THEME_CONFIGS = {
  dark: {
    name: 'Dark Mode (Sleek Slate)',
    supportsBase: true,
    supportsAccent: true,
    defaultBase: 'slate',
    defaultAccent: 'blue',
    bases: [
      { id: 'slate', name: 'Sleek Slate', bg: '#0f172a', card: 'rgba(30, 41, 59, 0.7)', input: 'rgba(15, 23, 42, 0.6)', cardSolid: '#1e293b' },
      { id: 'midnight', name: 'Midnight', bg: '#0b0f19', card: 'rgba(18, 26, 43, 0.75)', input: 'rgba(11, 15, 25, 0.8)', cardSolid: '#121a2b' },
      { id: 'amber', name: 'Warm Amber Dark', bg: '#1c120c', card: 'rgba(43, 26, 15, 0.75)', input: 'rgba(28, 18, 12, 0.8)', cardSolid: '#2a190f' },
      { id: 'charcoal', name: 'Charcoal', bg: '#121212', card: 'rgba(28, 28, 28, 0.75)', input: 'rgba(18, 18, 18, 0.8)', cardSolid: '#1e1e1e' },
      { id: 'purple', name: 'Deep Purple', bg: '#130f26', card: 'rgba(32, 23, 61, 0.75)', input: 'rgba(19, 15, 38, 0.8)', cardSolid: '#20173d' },
      { id: 'navy', name: 'Deep Navy', bg: '#0f1c2e', card: 'rgba(23, 42, 69, 0.75)', input: 'rgba(15, 28, 46, 0.8)', cardSolid: '#172a45' },
      { id: 'forest', name: 'Deep Forest', bg: '#0a1c14', card: 'rgba(18, 46, 34, 0.75)', input: 'rgba(10, 28, 20, 0.8)', cardSolid: '#122e22' }
    ],
    accents: [
      { id: 'blue', name: 'Electric Blue', hex: '#3b82f6', hover: '#2563eb', rgb: '59, 130, 246' },
      { id: 'purple', name: 'Royal Purple', hex: '#8b5cf6', hover: '#7c3aed', rgb: '139, 92, 246' },
      { id: 'emerald', name: 'Emerald', hex: '#10b981', hover: '#059669', rgb: '16, 185, 129' },
      { id: 'crimson', name: 'Crimson', hex: '#ef4444', hover: '#dc2626', rgb: '239, 68, 68' },
      { id: 'amber', name: 'Amber', hex: '#f59e0b', hover: '#d97706', rgb: '245, 158, 11' },
      { id: 'rose', name: 'Vibrant Rose', hex: '#ec4899', hover: '#db2777', rgb: '236, 72, 153' },
      { id: 'cyan', name: 'Cyber Cyan', hex: '#06b6d4', hover: '#0891b2', rgb: '6, 182, 212' },
      { id: 'indigo', name: 'Deep Indigo', hex: '#6366f1', hover: '#4f46e5', rgb: '99, 102, 241' }
    ]
  },

  light: {
    name: 'Light Mode (Clean Harmonious)',
    supportsBase: true,
    supportsAccent: true,
    defaultBase: 'slate',
    defaultAccent: 'blue',
    bases: [
      { id: 'slate', name: 'Slate Light', bg: '#e2e8f0', card: 'rgba(255, 255, 255, 0.3)', input: 'rgba(255, 255, 255, 0.9)', cardSolid: '#ffffff', text: '#0f172a', textMuted: '#334155' },
      { id: 'amber', name: 'Warm Amber Light', bg: '#ffedd5', card: 'rgba(255, 255, 255, 0.3)', input: 'rgba(255, 255, 255, 0.9)', cardSolid: '#ffffff', text: '#7c2d12', textMuted: '#9a3412' },
      { id: 'cream', name: 'Warm Cream', bg: '#fef08a', card: 'rgba(255, 255, 255, 0.3)', input: 'rgba(255, 255, 255, 0.9)', cardSolid: '#ffffff', text: '#713f12', textMuted: '#854d0e' },
      { id: 'sand', name: 'Soft Sand', bg: '#e5e5dc', card: 'rgba(255, 255, 255, 0.3)', input: 'rgba(255, 255, 255, 0.9)', cardSolid: '#ffffff', text: '#1c1917', textMuted: '#44403c' },
      { id: 'ice', name: 'Ice Blue', bg: '#bfdbfe', card: 'rgba(255, 255, 255, 0.3)', input: 'rgba(255, 255, 255, 0.9)', cardSolid: '#ffffff', text: '#1e3a8a', textMuted: '#1d4ed8' },
      { id: 'mint', name: 'Mint Light', bg: '#bbf7d0', card: 'rgba(255, 255, 255, 0.3)', input: 'rgba(255, 255, 255, 0.9)', cardSolid: '#ffffff', text: '#064e3b', textMuted: '#047857' },
      { id: 'rose', name: 'Rose Light', bg: '#fecdd3', card: 'rgba(255, 255, 255, 0.3)', input: 'rgba(255, 255, 255, 0.9)', cardSolid: '#ffffff', text: '#881337', textMuted: '#be123c' },
      { id: 'white', name: 'Pure Light', bg: '#f8fafc', card: 'rgba(255, 255, 255, 0.95)', input: 'rgba(241, 245, 249, 0.9)', cardSolid: '#ffffff', text: '#0f172a', textMuted: '#475569' }
    ],
    accents: [
      { id: 'blue', name: 'Electric Blue', hex: '#3b82f6', hover: '#2563eb', rgb: '59, 130, 246' },
      { id: 'purple', name: 'Royal Purple', hex: '#8b5cf6', hover: '#7c3aed', rgb: '139, 92, 246' },
      { id: 'emerald', name: 'Emerald', hex: '#10b981', hover: '#059669', rgb: '16, 185, 129' },
      { id: 'crimson', name: 'Crimson', hex: '#ef4444', hover: '#dc2626', rgb: '239, 68, 68' },
      { id: 'amber', name: 'Amber', hex: '#d97706', hover: '#b45309', rgb: '217, 119, 6' },
      { id: 'rose', name: 'Vibrant Rose', hex: '#ec4899', hover: '#db2777', rgb: '236, 72, 153' },
      { id: 'cyan', name: 'Cyber Cyan', hex: '#06b6d4', hover: '#0891b2', rgb: '6, 182, 212' },
      { id: 'indigo', name: 'Deep Indigo', hex: '#6366f1', hover: '#4f46e5', rgb: '99, 102, 241' }
    ]
  },

  oled: {
    name: 'OLED Mode (Pure Ink Black)',
    supportsBase: false, // OLED retains solid black base
    supportsAccent: true,
    defaultBase: 'black',
    defaultAccent: 'blue',
    bases: [
      { id: 'black', name: 'Solid Ink Black', bg: '#000000', card: 'rgba(10, 10, 10, 0.85)', input: 'rgba(0, 0, 0, 0.9)', cardSolid: '#000000' }
    ],
    accents: [
      { id: 'blue', name: 'Electric Blue', hex: '#3b82f6', hover: '#2563eb', rgb: '59, 130, 246' },
      { id: 'purple', name: 'Royal Purple', hex: '#8b5cf6', hover: '#7c3aed', rgb: '139, 92, 246' },
      { id: 'emerald', name: 'Emerald', hex: '#10b981', hover: '#059669', rgb: '16, 185, 129' },
      { id: 'crimson', name: 'Crimson', hex: '#ef4444', hover: '#dc2626', rgb: '239, 68, 68' },
      { id: 'amber', name: 'Amber', hex: '#f59e0b', hover: '#d97706', rgb: '245, 158, 11' },
      { id: 'rose', name: 'Vibrant Rose', hex: '#ec4899', hover: '#db2777', rgb: '236, 72, 153' },
      { id: 'cyan', name: 'Cyber Cyan', hex: '#06b6d4', hover: '#0891b2', rgb: '6, 182, 212' },
      { id: 'indigo', name: 'Deep Indigo', hex: '#6366f1', hover: '#4f46e5', rgb: '99, 102, 241' }
    ]
  },

  colourful: {
    name: 'Colourful (Vibrant & Bold)',
    supportsBase: true,
    supportsAccent: true,
    defaultBase: 'cyberpunk',
    defaultAccent: 'cyan',
    bases: [
      { id: 'cyberpunk', name: 'Cyberpunk Sunset', bgGradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%) fixed', bg: '#0f0c29', card: 'rgba(255, 255, 255, 0.05)', input: 'rgba(36, 36, 62, 0.85)', cardSolid: '#24243e', border: 'rgba(255, 0, 204, 0.4)' },
      { id: 'amber-sunset', name: 'Amber Sunset', bgGradient: 'linear-gradient(135deg, #381200 0%, #6e2700 50%, #4a1500 100%) fixed', bg: '#381200', card: 'rgba(255, 255, 255, 0.05)', input: 'rgba(110, 39, 0, 0.85)', cardSolid: '#4a1500', border: 'rgba(255, 140, 0, 0.4)' },
      { id: 'aurora', name: 'Aurora Borealis', bgGradient: 'linear-gradient(135deg, #051923 0%, #003554 50%, #006494 100%) fixed', bg: '#051923', card: 'rgba(255, 255, 255, 0.05)', input: 'rgba(0, 53, 84, 0.85)', cardSolid: '#003554', border: 'rgba(0, 255, 170, 0.4)' },
      { id: 'violet', name: 'Violet Night', bgGradient: 'linear-gradient(135deg, #1f002b 0%, #3a0057 50%, #580080 100%) fixed', bg: '#1f002b', card: 'rgba(255, 255, 255, 0.05)', input: 'rgba(58, 0, 87, 0.85)', cardSolid: '#3a0057', border: 'rgba(191, 0, 255, 0.4)' },
      { id: 'sunset', name: 'Solar Flare', bgGradient: 'linear-gradient(135deg, #2b0c0f 0%, #632b30 50%, #4e243e 100%) fixed', bg: '#2b0c0f', card: 'rgba(255, 255, 255, 0.05)', input: 'rgba(99, 43, 48, 0.85)', cardSolid: '#4e243e', border: 'rgba(255, 85, 0, 0.4)' },
      { id: 'ocean', name: 'Deep Ocean', bgGradient: 'linear-gradient(135deg, #0c1f29 0%, #1a3c40 50%, #142834 100%) fixed', bg: '#0c1f29', card: 'rgba(255, 255, 255, 0.05)', input: 'rgba(26, 60, 64, 0.85)', cardSolid: '#1a3c40', border: 'rgba(0, 204, 255, 0.4)' }
    ],
    accents: [
      { id: 'cyan', name: 'Electric Cyan', hex: '#00ffff', hover: '#00cccc', rgb: '0, 255, 255', btnGrad: 'linear-gradient(135deg, #ff00cc 0%, #00ffff 100%)' },
      { id: 'magenta', name: 'Hot Pink / Magenta', hex: '#ff00cc', hover: '#cc00a3', rgb: '255, 0, 204', btnGrad: 'linear-gradient(135deg, #00ffff 0%, #ff00cc 100%)' },
      { id: 'yellow', name: 'Electric Yellow', hex: '#fffc00', hover: '#cccc00', rgb: '255, 252, 0', btnGrad: 'linear-gradient(135deg, #ff0055 0%, #fffc00 100%)' },
      { id: 'neon-green', name: 'Lime Neon', hex: '#00ff66', hover: '#00cc52', rgb: '0, 255, 102', btnGrad: 'linear-gradient(135deg, #00ffff 0%, #00ff66 100%)' },
      { id: 'hot-orange', name: 'Solar Orange', hex: '#ff5500', hover: '#cc4400', rgb: '255, 85, 0', btnGrad: 'linear-gradient(135deg, #ff00cc 0%, #ff5500 100%)' },
      { id: 'bright-purple', name: 'Bright Violet', hex: '#bf00ff', hover: '#9900cc', rgb: '191, 0, 255', btnGrad: 'linear-gradient(135deg, #00ffff 0%, #bf00ff 100%)' }
    ]
  },

  retro: {
    name: 'Retro (Vintage Terminal)',
    supportsBase: true,
    supportsAccent: true, // Accent maps to Terminal Phosphor color
    defaultBase: 'classic-black',
    defaultAccent: 'green',
    bases: [
      { id: 'classic-black', name: 'Classic Terminal Black', bg: '#050505' },
      { id: 'amber-glow', name: 'Amber CRT Dark', bg: '#120b00' },
      { id: 'pure-black', name: 'Pitch Black CRT', bg: '#000000' },
      { id: 'deep-navy', name: 'Mainframe Navy', bg: '#020714' },
      { id: 'scanline-gray', name: 'Scanline Gray', bg: '#0d0d0d' }
    ],
    accents: [
      { id: 'green', name: 'Matrix Green (VT100)', hex: '#33ff00', textMuted: '#22aa00', border: '#115500', card: 'rgba(0, 25, 0, 0.8)', input: 'rgba(0, 20, 0, 0.85)', cardSolid: '#001100', hover: '#66ff33', rgb: '51, 255, 0' },
      { id: 'amber', name: 'Amber CRT (DEC VT220)', hex: '#ffb000', textMuted: '#cc8800', border: '#664400', card: 'rgba(25, 16, 0, 0.8)', input: 'rgba(20, 12, 0, 0.85)', cardSolid: '#140d00', hover: '#ffc43d', rgb: '255, 176, 0' },
      { id: 'cyan', name: 'IBM Cyan (3270 Terminal)', hex: '#00f0ff', textMuted: '#00a4b0', border: '#005058', card: 'rgba(0, 24, 28, 0.8)', input: 'rgba(0, 18, 22, 0.85)', cardSolid: '#001317', hover: '#55f6ff', rgb: '0, 240, 255' },
      { id: 'white', name: 'Apple II Monochrome White', hex: '#e0e0e0', textMuted: '#a0a0a0', border: '#555555', card: 'rgba(20, 20, 20, 0.8)', input: 'rgba(16, 16, 16, 0.85)', cardSolid: '#101010', hover: '#ffffff', rgb: '224, 224, 224' },
      { id: 'pink', name: 'Cyberpunk Pink Phosphor', hex: '#ff33aa', textMuted: '#cc2288', border: '#661144', card: 'rgba(25, 0, 16, 0.8)', input: 'rgba(20, 0, 12, 0.85)', cardSolid: '#14000d', hover: '#ff66c4', rgb: '255, 51, 170' },
      { id: 'red', name: 'VT100 Blood Red', hex: '#ff3333', textMuted: '#cc2222', border: '#661111', card: 'rgba(25, 0, 0, 0.8)', input: 'rgba(20, 0, 0, 0.85)', cardSolid: '#140000', hover: '#ff6666', rgb: '255, 51, 51' }
    ]
  }
};

/**
 * Reads stored theme configuration from localStorage
 */
export function getStoredThemeConfig() {
  const theme = localStorage.getItem('theme') || 'dark';
  const config = THEME_CONFIGS[theme] || THEME_CONFIGS.dark;

  const baseId = localStorage.getItem(`theme_base_${theme}`) || config.defaultBase;
  const accentId = localStorage.getItem(`theme_accent_${theme}`) || config.defaultAccent;

  return { theme, baseId, accentId };
}

/**
 * Applies custom theme CSS variables to document.documentElement
 */
export function applyTheme(themeName, baseId, accentId) {
  const root = document.documentElement;
  const config = THEME_CONFIGS[themeName] || THEME_CONFIGS.dark;

  // Set class on <html> element
  root.className = 'theme-' + themeName;

  // Find active base and accent objects
  const baseObj = config.bases.find(b => b.id === baseId) || config.bases.find(b => b.id === config.defaultBase) || config.bases[0];
  const accentObj = config.accents.find(a => a.id === accentId) || config.accents.find(a => a.id === config.defaultAccent) || config.accents[0];

  // Helper to clear existing custom CSS variables on root element
  const varsToReset = [
    '--bg-dark', '--bg-card', '--bg-input', '--bg-card-solid',
    '--accent', '--accent-hover', '--accent-bg', '--accent-border',
    '--text-main', '--text-muted', '--text-h', '--border-color', '--border',
    '--dot-tv', '--tooltip-border', '--tooltip-text', '--plex-brand'
  ];
  varsToReset.forEach(v => root.style.removeProperty(v));

  if (!accentObj) return;

  const rgb = accentObj.rgb;

  if (themeName === 'dark' || themeName === 'light' || themeName === 'oled') {
    // Accent overrides
    root.style.setProperty('--accent', accentObj.hex);
    root.style.setProperty('--accent-hover', accentObj.hover);
    root.style.setProperty('--accent-bg', `rgba(${rgb}, ${themeName === 'light' ? '0.08' : '0.12'})`);
    root.style.setProperty('--accent-border', `rgba(${rgb}, ${themeName === 'light' ? '0.3' : '0.4'})`);
    root.style.setProperty('--dot-tv', accentObj.hex);

    // Base overrides
    if (baseObj) {
      if (baseObj.bg) root.style.setProperty('--bg-dark', baseObj.bg);
      if (baseObj.card) root.style.setProperty('--bg-card', baseObj.card);
      if (baseObj.input) root.style.setProperty('--bg-input', baseObj.input);
      if (baseObj.cardSolid) root.style.setProperty('--bg-card-solid', baseObj.cardSolid);
      if (baseObj.text) root.style.setProperty('--text-main', baseObj.text);
      if (baseObj.textMuted) root.style.setProperty('--text-muted', baseObj.textMuted);
    }
  } else if (themeName === 'colourful') {
    // Accent overrides
    root.style.setProperty('--accent', accentObj.hex);
    root.style.setProperty('--accent-hover', accentObj.hover);
    root.style.setProperty('--accent-bg', `rgba(${rgb}, 0.2)`);
    root.style.setProperty('--accent-border', accentObj.hex);
    root.style.setProperty('--dot-tv', accentObj.hex);
    root.style.setProperty('--tooltip-border', accentObj.hex);
    root.style.setProperty('--plex-brand', accentObj.hex);

    // Base overrides
    if (baseObj) {
      if (baseObj.bgGradient) {
        document.body.style.background = baseObj.bgGradient;
      }
      if (baseObj.bg) root.style.setProperty('--bg-dark', baseObj.bg);
      if (baseObj.card) root.style.setProperty('--bg-card', baseObj.card);
      if (baseObj.input) root.style.setProperty('--bg-input', baseObj.input);
      if (baseObj.cardSolid) root.style.setProperty('--bg-card-solid', baseObj.cardSolid);
      if (baseObj.border) root.style.setProperty('--border-color', baseObj.border);
    }
  } else if (themeName === 'retro') {
    // Terminal style overrides (Accent drives phosphor color in retro)
    if (accentObj) {
      root.style.setProperty('--accent', accentObj.hex);
      root.style.setProperty('--accent-hover', accentObj.hover);
      root.style.setProperty('--accent-bg', `rgba(${rgb}, 0.15)`);
      root.style.setProperty('--accent-border', `rgba(${rgb}, 0.5)`);
      root.style.setProperty('--text-main', accentObj.hex);
      root.style.setProperty('--text-h', accentObj.hex);
      root.style.setProperty('--text-muted', accentObj.textMuted || accentObj.hex);
      root.style.setProperty('--border-color', accentObj.border || accentObj.hex);
      root.style.setProperty('--border', accentObj.border || accentObj.hex);
      root.style.setProperty('--bg-card', accentObj.card || 'rgba(0, 25, 0, 0.8)');
      root.style.setProperty('--bg-input', accentObj.input || 'rgba(0, 20, 0, 0.85)');
      root.style.setProperty('--bg-card-solid', accentObj.cardSolid || '#001100');
      root.style.setProperty('--dot-tv', accentObj.hex);
      root.style.setProperty('--tooltip-border', accentObj.hex);
      root.style.setProperty('--tooltip-text', accentObj.hex);
      root.style.setProperty('--plex-brand', accentObj.hex);
    }
    if (baseObj && baseObj.bg) {
      root.style.setProperty('--bg-dark', baseObj.bg);
    }
  }

  // Clear body inline background for non-colourful themes
  if (themeName !== 'colourful') {
    document.body.style.background = '';
  }
}

/**
 * Saves theme configuration and applies it immediately
 */
export function saveThemeConfig(themeName, baseId, accentId) {
  localStorage.setItem('theme', themeName);
  if (baseId) localStorage.setItem(`theme_base_${themeName}`, baseId);
  if (accentId) localStorage.setItem(`theme_accent_${themeName}`, accentId);

  applyTheme(themeName, baseId, accentId);
}
