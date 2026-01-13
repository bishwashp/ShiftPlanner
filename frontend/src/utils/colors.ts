// Premium color system utilities matching inspiration design

export const eventColors = {
  MORNING: {
    bg: '#3b82f6', // Blue to match legend
    glow: 'rgba(59, 130, 246, 0.3)',
    name: 'Morning Shift'
  },
  AM: {
    bg: '#3b82f6', // Blue (Same as Morning)
    glow: 'rgba(59, 130, 246, 0.3)',
    name: 'AM Shift'
  },
  EVENING: {
    bg: '#8b5cf6', // Purple to match legend
    glow: 'rgba(139, 92, 246, 0.3)',
    name: 'Evening Shift'
  },
  PM: {
    bg: '#8b5cf6', // Purple (Same as Evening)
    glow: 'rgba(139, 92, 246, 0.3)',
    name: 'PM Shift'
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
  },
  LDN: {
    bg: '#0ea5e9', // Sky Blue for London
    glow: 'rgba(14, 165, 233, 0.3)',
    name: 'London Shift'
  }
} as const;

export const screenerColor = {
  bg: '#f59e0b', // Amber to match legend
  text: '#000000',
  glow: 'rgba(245, 158, 11, 0.4)'
} as const;

export const getShiftTypeColor = (shiftType: string): string => {
  if (!shiftType) return eventColors.MORNING.bg;

  const normalized = shiftType.toUpperCase();
  // Exact match
  if (normalized in eventColors) {
    return eventColors[normalized as keyof typeof eventColors].bg;
  }

  // Partial match
  if (normalized.includes('MORNING') || normalized.includes('AM')) return eventColors.MORNING.bg;
  if (normalized.includes('EVENING') || normalized.includes('PM')) return eventColors.EVENING.bg;
  if (normalized.includes('WEEKEND')) return eventColors.WEEKEND.bg;
  if (normalized.includes('NIGHT')) return eventColors.NIGHT.bg;
  if (normalized.includes('LDN') || normalized.includes('LONDON')) return eventColors.LDN.bg;

  return eventColors.MORNING.bg;
};

export const getShiftTypeGlow = (shiftType: string): string => {
  if (!shiftType) return eventColors.MORNING.glow;

  const normalized = shiftType.toUpperCase();
  if (normalized in eventColors) {
    return eventColors[normalized as keyof typeof eventColors].glow;
  }

  // Partial matches with fallbacks
  if (normalized.includes('MORNING') || normalized.includes('AM')) return eventColors.MORNING.glow;
  if (normalized.includes('EVENING') || normalized.includes('PM')) return eventColors.EVENING.glow;
  if (normalized.includes('WEEKEND')) return eventColors.WEEKEND.glow;

  return eventColors.MORNING.glow;
};

export const getShiftTypeName = (shiftType: string): string => {
  if (!shiftType) return 'Meeting';
  const normalized = shiftType.toUpperCase();
  if (normalized in eventColors) {
    return eventColors[normalized as keyof typeof eventColors].name;
  }
  return shiftType; // Return original if no fancy name map found
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