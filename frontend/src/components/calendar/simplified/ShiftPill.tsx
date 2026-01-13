import React from 'react';
import { motion } from 'framer-motion';
import { ShiftGroup } from '../../../utils/shiftGrouper';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

interface ShiftPillProps {
    group: ShiftGroup;
    gridColumnStart: number;
    gridColumnSpan: number;
    zIndex: number;
    onClick?: () => void;
}

export const ShiftPill: React.FC<ShiftPillProps> = ({
    group,
    gridColumnStart,
    gridColumnSpan,
    zIndex,
    onClick
}) => {
    // Color logic matching NameBox (weekend > screener > shift type)
    const getShiftColor = () => {
        // Weekend takes priority (green)
        if (group.isWeekend) {
            return {
                bg: 'bg-green-500/20',
                text: 'text-green-800 dark:text-green-200',
                border: 'border-green-400/30',
                glow: 'hover:shadow-green-500/20'
            };
        }

        // Screener second priority (amber)
        if (group.isScreener) {
            return {
                bg: 'bg-amber-500/20',
                text: 'text-amber-800 dark:text-amber-200',
                border: 'border-amber-400/30',
                glow: 'hover:shadow-amber-500/20'
            };
        }

        // Shift type based colors
        const normalized = group.shiftType.toLowerCase();

        if (normalized.includes('morning') || normalized.includes('am')) {
            return {
                bg: 'bg-blue-500/20',
                text: 'text-blue-800 dark:text-blue-200',
                border: 'border-blue-400/30',
                glow: 'hover:shadow-blue-500/20'
            };
        }

        if (normalized.includes('evening') || normalized.includes('pm')) {
            return {
                bg: 'bg-purple-500/20',
                text: 'text-purple-800 dark:text-purple-200',
                border: 'border-purple-400/30',
                glow: 'hover:shadow-purple-500/20'
            };
        }

        if (normalized.includes('ldn') || normalized.includes('london')) {
            return {
                bg: 'bg-sky-500/20',
                text: 'text-sky-800 dark:text-sky-200',
                border: 'border-sky-400/30',
                glow: 'hover:shadow-sky-500/20'
            };
        }

        return {
            bg: 'bg-gray-500/20',
            text: 'text-gray-800 dark:text-gray-200',
            border: 'border-gray-400/30',
            glow: 'hover:shadow-gray-500/20'
        };
    };

    const colorScheme = getShiftColor();

    return (
        <motion.div
            className={`
        ${colorScheme.bg}
        ${colorScheme.text}
        ${colorScheme.border}
        h-7 rounded-md border backdrop-blur-sm
        flex items-center justify-center
        transition-all duration-200
        ${onClick ? `cursor-pointer ${colorScheme.glow} hover:shadow-md` : ''}
        px-2 py-0.5
      `}
            style={{
                gridColumnStart,
                gridColumnEnd: gridColumnStart + gridColumnSpan,
                gridRow: zIndex + 1,
                zIndex
            }}
            onClick={onClick}
            whileHover={onClick ? { scale: 1.02 } : {}}
            whileTap={onClick ? { scale: 0.98 } : {}}
        >
            {/* Left overflow indicator */}
            {group.startsBeforeWeek && (
                <CaretLeft className="h-3 w-3 opacity-60 mr-1 flex-shrink-0" weight="bold" />
            )}

            {/* Analyst name - truncate if needed */}
            <span className="font-semibold text-xs truncate">
                {group.analystName}
            </span>

            {/* Right overflow indicator */}
            {group.extendsAfterWeek && (
                <CaretRight className="h-3 w-3 opacity-60 ml-1 flex-shrink-0" weight="bold" />
            )}
        </motion.div>
    );
};
