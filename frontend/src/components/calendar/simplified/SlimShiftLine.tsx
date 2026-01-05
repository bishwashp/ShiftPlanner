import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SlimShiftLineProps {
    id: string;
    name: string;
    shiftType: string;
    isScreener: boolean;
    isWeekend: boolean;
    isStart: boolean;
    isEnd: boolean;
    onClick?: () => void;
    isExpanded?: boolean;
}

export const SlimShiftLine: React.FC<SlimShiftLineProps> = ({
    id,
    name,
    shiftType,
    isScreener,
    isWeekend,
    isStart,
    isEnd,
    onClick,
    isExpanded = false
}) => {

    // Color mapping similar to NameBox but simpler
    const getColors = () => {
        if (isWeekend) return { bg: 'bg-green-500', text: 'text-green-900', border: 'border-green-600' };
        if (isScreener) return { bg: 'bg-amber-500', text: 'text-amber-900', border: 'border-amber-600' };

        switch (shiftType.toLowerCase()) {
            case 'morning': return { bg: 'bg-blue-500', text: 'text-blue-900', border: 'border-blue-600' };
            case 'evening': return { bg: 'bg-purple-500', text: 'text-purple-900', border: 'border-purple-600' };
            default: return { bg: 'bg-gray-500', text: 'text-gray-900', border: 'border-gray-600' };
        }
    };

    const colors = getColors();

    return (
        <motion.div
            layoutId={`shift-${id}`}
            className={`
        relative cursor-pointer transition-colors duration-200
        ${colors.bg} ${isExpanded ? 'bg-opacity-20 backdrop-blur-sm border' : 'bg-opacity-80'}
        ${isExpanded ? colors.border : 'border-transparent'}
        ${isExpanded ? 'text-gray-900 dark:text-gray-100' : 'text-transparent'}
      `}
            style={{
                height: isExpanded ? 24 : 8,
                borderRadius: 4,
                marginBottom: 2,
                // Visual continuity logic
                borderTopLeftRadius: isStart ? 4 : 0,
                borderBottomLeftRadius: isStart ? 4 : 0,
                borderTopRightRadius: isEnd ? 4 : 0,
                borderBottomRightRadius: isEnd ? 4 : 0,
                marginLeft: isStart ? 0 : -1, // Use -1px to overlap the border/gap
                marginRight: isEnd ? 0 : -1,
                width: isStart && isEnd ? 'auto' : 'calc(100% + 1px)', // Ensure it reaches the edge
                zIndex: isExpanded ? 50 : 1, // Bring to front when expanded
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            initial={false}
            animate={{
                height: isExpanded ? 24 : 8,
                opacity: 1
            }}
        >
            {/* Content only visible when expanded */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center h-full px-2 text-[10px] whitespace-nowrap overflow-hidden font-semibold"
                    >
                        <span className="truncate">{name}</span>
                        {isScreener && <span className="ml-1 opacity-70">(Screener)</span>}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
