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

    return (
        <motion.div
            className={cn(
                "glass rounded-xl p-6 relative overflow-hidden",
                (hoverEffect || isInteractive) && "transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer",
                className
            )}
            initial={false}
            whileTap={isInteractive ? { scale: 0.98 } : undefined}
            onClick={onClick}
        >
            {/* Subtle Sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </motion.div>
    );
};

export default GlassCard;
