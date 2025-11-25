import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    enableRefraction?: boolean;
    onClick?: () => void;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', enableRefraction = false, onClick }) => {
    return (
        <motion.div
            className={`
        relative overflow-hidden rounded-xl border
        bg-white/40 dark:bg-gray-800/50
        border-gray-300/50 dark:border-white/10
        backdrop-blur-xl
        shadow-xl shadow-black/5 dark:shadow-black/20
        ${className}
      `}
            whileHover={{ scale: 1.02, boxShadow: '0 16px 48px rgba(0, 0, 0, 0.1)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={onClick}
        >
            {/* Optional SVG Refraction Effect */}
            {enableRefraction && (
                <svg className="absolute inset-0 w-0 h-0">
                    <defs>
                        <filter id="refractionFilter">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="0" />
                            <feColorMatrix type="saturate" values="1.2" />
                        </filter>
                    </defs>
                </svg>
            )}

            {/* Sheen overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 dark:from-white/5 to-transparent pointer-events-none" />

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </motion.div>
    );
};

export default GlassCard;
