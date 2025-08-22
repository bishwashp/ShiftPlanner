import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface PremiumEventCardProps {
  title: string;
  shiftType: 'MORNING' | 'EVENING' | 'NIGHT' | 'WEEKEND';
  isScreener?: boolean;
  analystName?: string;
  isHovered?: boolean;
  className?: string;
  variant?: 'standard' | 'rotated';
}

const getShiftTypeColor = (shiftType: string) => {
  const colors = {
    MORNING: 'bg-event-meeting', // #8b5a2b - matches inspiration
    EVENING: 'bg-event-presentation', // #ea580c
    NIGHT: 'bg-event-design', // #1e40af  
    WEEKEND: 'bg-event-personal', // #7c3aed
  };
  return colors[shiftType as keyof typeof colors] || 'bg-event-meeting';
};

const getShiftTypeGlow = (shiftType: string) => {
  const glows = {
    MORNING: 'shadow-[0_0_20px_rgba(139,90,43,0.3)]',
    EVENING: 'shadow-[0_0_20px_rgba(234,88,12,0.3)]', 
    NIGHT: 'shadow-[0_0_20px_rgba(30,64,175,0.3)]',
    WEEKEND: 'shadow-[0_0_20px_rgba(124,58,237,0.3)]',
  };
  return glows[shiftType as keyof typeof glows] || 'shadow-[0_0_20px_rgba(139,90,43,0.3)]';
};

export const PremiumEventCard: React.FC<PremiumEventCardProps> = ({
  title,
  shiftType,
  isScreener = false,
  analystName,
  isHovered = false,
  className,
  variant = 'standard'
}) => {
  const baseClasses = clsx(
    // Base styling matching inspiration
    'relative overflow-hidden rounded-2xl border border-white/10',
    'backdrop-blur-sm transition-all duration-200 ease-out',
    'hover:scale-[1.02] hover:border-white/20',
    // Color based on shift type
    getShiftTypeColor(shiftType),
    // Hover glow effect
    isHovered && getShiftTypeGlow(shiftType),
    className
  );

  const contentClasses = clsx(
    'relative z-10 p-3 text-white',
    variant === 'rotated' && 'writing-mode-vertical-rl text-orientation-mixed'
  );

  if (variant === 'rotated') {
    return (
      <motion.div
        className={baseClasses}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Gradient overlay for premium look */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        
        <div className={clsx(contentClasses, 'transform rotate-180')}>
          <div className="flex flex-col items-center justify-center h-full space-y-2">
            <span className="text-xs font-semibold truncate writing-mode-vertical-rl text-orientation-mixed transform rotate-180">
              {analystName || title}
            </span>
            
            {isScreener && (
              <div className="bg-event-screener text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full writing-mode-horizontal-tb transform rotate-90">
                S
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={baseClasses}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Gradient overlay for premium look */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      
      {/* Glassmorphism effect */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      
      <div className={contentClasses}>
        <div className="flex items-center justify-between w-full">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white/90 truncate mb-0.5">
              {analystName || title}
            </div>
            <div className="text-[10px] text-white/70 uppercase tracking-wide">
              {shiftType.toLowerCase()}
            </div>
          </div>
          
          {isScreener && (
            <motion.div
              className="bg-event-screener text-black text-xs font-bold px-2 py-1 rounded-full ml-2 shadow-sm"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
            >
              SCREENER
            </motion.div>
          )}
        </div>
        
        {/* Premium border accent */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>
    </motion.div>
  );
};

export default PremiumEventCard;