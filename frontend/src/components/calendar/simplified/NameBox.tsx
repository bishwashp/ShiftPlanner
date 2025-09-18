import React from 'react';

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
  // Color mapping based on shift type (matching existing system)
  const getShiftColor = (type: string, screener: boolean) => {
    if (screener) {
      return 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700';
    }
    
    switch (type.toLowerCase()) {
      case 'morning':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700';
      case 'evening':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700';
      case 'weekend':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
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

  const colorClasses = getShiftColor(shiftType, isScreener);
  const sizeClasses = getSizeClasses(size);

  return (
    <div
      className={`
        ${colorClasses}
        ${sizeClasses}
        border rounded-md truncate font-medium
        transition-all duration-200
        flex items-center justify-center relative
        ${onClick ? 'cursor-pointer hover:opacity-80 hover:shadow-sm hover:scale-105 focus:scale-105 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1' : ''}
      `}
      onClick={onClick}
      onKeyDown={(e) => {
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
      <span className="truncate text-center leading-tight" aria-hidden="true">
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
    </div>
  );
};