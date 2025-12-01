import React from 'react';
import { motion } from 'framer-motion';
import moment from 'moment';

interface NameBoxProps {
  name: string;
  shiftType: string;
  isScreener: boolean;
  date?: string; // YYYY-MM-DD format
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

export const NameBox: React.FC<NameBoxProps> = ({
  name,
  shiftType,
  isScreener,
  date,
  size = 'medium',
  onClick
}) => {
  // Determine if this is a weekend shift based on the date
  const isWeekendShift = date ? (() => {
    const dayOfWeek = moment(date).day();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  })() : false;

  // Helper to get initials
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 1) {
      // First letter of first and last name
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
      // First two letters of the single name
      return parts[0].substring(0, 2).toUpperCase();
    }
    return '??';
  };

  const initials = getInitials(name);

  // Generate accessible descriptions
  const getAccessibleDescription = () => {
    let description = `${name} - ${shiftType} shift`;
    if (isScreener) {
      description += ', screener role';
    }
    if (isWeekendShift) {
      description += ', weekend';
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
  const getShiftColor = (type: string, screener: boolean, isWeekend: boolean) => {
    // Weekend shifts should always be green (per legend), regardless of screener status
    if (isWeekend) {
      return {
        bg: 'bg-green-500/20',
        text: 'text-green-800 dark:text-green-200',
        border: 'border-green-400/30',
        glow: 'hover:shadow-green-500/20'
      };
    }

    // Screener takes priority for non-weekend shifts
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
      default:
        return {
          bg: 'bg-gray-500/20',
          text: 'text-gray-800 dark:text-gray-200',
          border: 'border-gray-400/30',
          glow: 'hover:shadow-gray-500/20'
        };
    }
  };

  // Size classes - adjusted for circular shape
  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'small':
        return 'text-[10px] w-6 h-6';
      case 'large':
        return 'text-sm w-10 h-10';
      case 'medium':
      default:
        return 'text-xs w-8 h-8';
    }
  };

  const colorScheme = getShiftColor(shiftType, isScreener, isWeekendShift);
  const sizeClasses = getSizeClasses(size);

  const MotionDiv = onClick ? motion.div : 'div';
  const motionProps = onClick ? {
    whileHover: { scale: 1.1 },
    whileTap: { scale: 0.95 },
    transition: { type: 'spring', stiffness: 400, damping: 20 }
  } : {};

  return (
    <MotionDiv
      className={`
        ${colorScheme.bg}
        ${colorScheme.text}
        ${colorScheme.border}
        ${sizeClasses}
        border rounded-full
        backdrop-blur-sm
        transition-all duration-200
        flex items-center justify-center relative flex-shrink-0
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
      <span className="font-bold leading-none select-none" aria-hidden="true">
        {initials}
      </span>
    </MotionDiv>
  );
};