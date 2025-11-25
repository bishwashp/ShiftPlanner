import React from 'react';
import { motion } from 'framer-motion';

interface NameBoxProps {
  name: string;
  shiftType: string;
  isScreener: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

export const NameBox: React.FC<NameBoxProps> = ({
  name,
  shiftType,
  isScreener,
  size = 'medium',
  onClick
}) => {
  // Generate accessible descriptions
  const getAccessibleDescription = () => {
    let description = `${name} - ${shiftType} shift`;
    if (isScreener) {
      description += ', screener role';
    }
    return description;
  };

  // Generate ARIA label for screen readers
  const getAriaLabel = () => {
    const baseLabel = `${name}, ${shiftType} shift`;
    if (isScreener) {
      return `${baseLabel}, screener role`;
    }
    return baseLabel;
  };

  // Glass-compatible color mapping with semi-transparent backgrounds
  const getShiftColor = (type: string, screener: boolean) => {
    if (screener) {
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-800 dark:text-amber-200',
        border: 'border-amber-400/30',
        glow: 'hover:shadow-amber-500/20'
      };
    }

    switch (type.toLowerCase()) {
      case 'morning':
        return {
          bg: 'bg-blue-500/20',
          text: 'text-blue-800 dark:text-blue-200',
          border: 'border-blue-400/30',
          glow: 'hover:shadow-blue-500/20'
        };
      case 'evening':
        return {
          bg: 'bg-purple-500/20',
          text: 'text-purple-800 dark:text-purple-200',
          border: 'border-purple-400/30',
          glow: 'hover:shadow-purple-500/20'
        };
      case 'weekend':
        return {
          bg: 'bg-green-500/20',
          text: 'text-green-800 dark:text-green-200',
          border: 'border-green-400/30',
          glow: 'hover:shadow-green-500/20'
        };
      default:
        return {
          bg: 'bg-gray-500/20',
          text: 'text-gray-800 dark:text-gray-200',
          border: 'border-gray-400/30',
          glow: 'hover:shadow-gray-500/20'
        };
    }
  };

  // Size classes
  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'small':
        return 'text-xs px-1 py-0.5 min-h-[16px]';
      case 'large':
        return 'text-sm px-3 py-2 min-h-[32px]';
      case 'medium':
      default:
        return 'text-xs px-2 py-1 min-h-[20px]';
    }
  };

  const colorScheme = getShiftColor(shiftType, isScreener);
  const sizeClasses = getSizeClasses(size);

  const MotionDiv = onClick ? motion.div : 'div';
  const motionProps = onClick ? {
    whileHover: { scale: 1.05, y: -1 },
    whileTap: { scale: 0.98 },
    transition: { type: 'spring', stiffness: 400, damping: 20 }
  } : {};

  return (
    <MotionDiv
      className={`
        ${colorScheme.bg}
        ${colorScheme.text}
        ${colorScheme.border}
        ${sizeClasses}
        border rounded-md truncate font-medium
        backdrop-blur-sm
        transition-all duration-200
        flex items-center justify-center relative
        ${onClick ? `cursor-pointer ${colorScheme.glow} hover:shadow-md focus:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1` : ''}
      `}
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      title={getAccessibleDescription()}
      aria-label={getAriaLabel()}
      role={onClick ? 'button' : 'text'}
      tabIndex={onClick ? 0 : -1}
      aria-describedby={isScreener ? `screener-${name.replace(/\s+/g, '-').toLowerCase()}` : undefined}
      {...(motionProps as any)}
    >
      {/* Hidden description for screen readers */}
      {isScreener && (
        <span
          id={`screener-${name.replace(/\s+/g, '-').toLowerCase()}`}
          className="sr-only"
        >
          This person has screener responsibilities for this shift
        </span>
      )}
      <span className="truncate text-center leading-tight font-semibold" aria-hidden="true">
        {name}
      </span>

      {/* Screener indicator */}
      {isScreener && size !== 'small' && (
        <span
          className="ml-1 text-[10px] opacity-75"
          aria-label="Screener role indicator"
          role="img"
        >
          📋
        </span>
      )}

      {/* Accessibility enhancements for small size screeners */}
      {isScreener && size === 'small' && (
        <span className="sr-only">
          (Screener)
        </span>
      )}
    </MotionDiv>
  );
};