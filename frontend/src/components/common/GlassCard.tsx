import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverEffect?: boolean;
    interactive?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className,
    onClick,
    hoverEffect = false,
    interactive = false
}) => {
    const isInteractive = interactive || !!onClick;

    const baseClassName = cn(
        "glass rounded-xl p-6 relative overflow-hidden",
        (hoverEffect || isInteractive) && "cursor-pointer",
        className
    );

    // Shared content for both variants
    const cardContent = (
        <>
            {/* Subtle Sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </>
    );

    // Only use motion.div when we need animation (performance optimization)
    if (isInteractive) {
        return (
            <motion.div
                className={baseClassName}
                initial={false}
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                onClick={onClick}
            >
                {cardContent}
            </motion.div>
        );
    }

    // Static card - no motion wrapper needed
    return (
        <div className={baseClassName} onClick={onClick}>
            {cardContent}
        </div>
    );
};

export default GlassCard;
