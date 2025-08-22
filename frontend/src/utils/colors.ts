// Premium color system utilities matching inspiration design

export const eventColors = {
  MORNING: {
    bg: '#8b5a2b',
    glow: 'rgba(139, 90, 43, 0.3)',
    name: 'Meeting'
  },
  EVENING: {
    bg: '#ea580c', 
    glow: 'rgba(234, 88, 12, 0.3)',
    name: 'Presentation'
  },
  NIGHT: {
    bg: '#1e40af',
    glow: 'rgba(30, 64, 175, 0.3)', 
    name: 'Design'
  },
  WEEKEND: {
    bg: '#7c3aed',
    glow: 'rgba(124, 58, 237, 0.3)',
    name: 'Personal'
  }
} as const;

export const screenerColor = {
  bg: '#eab308',
  text: '#000000',
  glow: 'rgba(234, 179, 8, 0.4)'
} as const;

export const getShiftTypeColor = (shiftType: string): string => {
  return eventColors[shiftType as keyof typeof eventColors]?.bg || eventColors.MORNING.bg;
};

export const getShiftTypeGlow = (shiftType: string): string => {
  return eventColors[shiftType as keyof typeof eventColors]?.glow || eventColors.MORNING.glow;
};

export const getShiftTypeName = (shiftType: string): string => {
  return eventColors[shiftType as keyof typeof eventColors]?.name || 'Meeting';
};

// Premium background colors matching inspiration
export const premiumBackgrounds = {
  primary: '#1a1a1a',
  secondary: '#2d2d2d', 
  tertiary: '#404040',
  glass: 'rgba(45, 45, 45, 0.6)'
} as const;

// Premium text colors
export const premiumText = {
  primary: '#f8fafc',
  secondary: '#cbd5e1',
  tertiary: '#64748b'
} as const;