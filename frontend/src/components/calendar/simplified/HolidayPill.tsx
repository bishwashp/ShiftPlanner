import React, { useState } from 'react';
import { Star } from '@phosphor-icons/react';

interface HolidayPillProps {
    name: string;
    className?: string;
}

/**
 * Holiday indicator pill that shows a star icon by default
 * and expands to show only the holiday name on hover (star hides).
 */
export const HolidayPill: React.FC<HolidayPillProps> = ({ name, className = '' }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={`
        inline-flex items-center justify-center
        h-7 rounded-full cursor-default
        bg-[#F00046] text-white
        transition-all duration-300 ease-out
        overflow-hidden whitespace-nowrap
        ${isHovered ? 'px-2.5' : 'w-7'}
        ${className}
      `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={name}
            role="img"
            aria-label={`Holiday: ${name}`}
        >
            {/* Star icon - visible only when not hovered */}
            <Star
                weight="fill"
                className={`
          h-3.5 w-3.5 flex-shrink-0
          transition-all duration-300 ease-out
          ${isHovered ? 'opacity-0 w-0' : 'opacity-100'}
        `}
            />
            {/* Holiday name - visible only on hover */}
            <span
                className={`
          text-[10px] font-medium leading-none
          transition-all duration-300 ease-out
          ${isHovered ? 'opacity-100' : 'opacity-0 w-0'}
        `}
            >
                {name}
            </span>
        </div>
    );
};

export default HolidayPill;
