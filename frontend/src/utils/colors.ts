// Premium color system utilities matching inspiration design

export const eventColors = {
  MORNING: {
    bg: '#3b82f6', // Blue to match legend
    glow: 'rgba(59, 130, 246, 0.3)',
    name: 'Morning Shift'
  },
  EVENING: {
    bg: '#8b5cf6', // Purple to match legend
    glow: 'rgba(139, 92, 246, 0.3)',
    name: 'Evening Shift'
  },
  NIGHT: {
    bg: '#1e40af', // Keep existing blue for night
    glow: 'rgba(30, 64, 175, 0.3)',
    name: 'Night Shift'
  },
  WEEKEND: {
    bg: '#22c55e', // Green to match legend
    glow: 'rgba(34, 197, 94, 0.3)',
    name: 'Weekend Shift'
  }
} as const;

export const screenerColor = {
  bg: '#f59e0b', // Amber to match legend
  text: '#000000',
  glow: 'rgba(245, 158, 11, 0.4)'
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