import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: React.ElementType;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, icon: Icon, children, disabled, ...props }, ref) => {

        // Base styles for the inner content container
        const baseContentStyles = "relative flex items-center justify-center w-full h-full rounded-full backdrop-blur-sm transition-all duration-300";

        // Variant-specific styles for the inner content
        const variantContentStyles = {
            primary: "bg-white/90 dark:bg-gray-900/90 backdrop-blur-md", // High opacity glass
            secondary: "bg-white/50 dark:bg-gray-800/50 backdrop-blur-md hover:bg-white/70 dark:hover:bg-gray-800/70", // Lighter glass
            danger: "bg-white/90 dark:bg-gray-900/90 backdrop-blur-md",
            ghost: "bg-transparent hover:bg-indigo-50 dark:hover:bg-indigo-900/20",
            disabled: "bg-gray-100 dark:bg-gray-800",
        };

        // Text styles (separate to handle gradients)
        const variantTextStyles = {
            primary: "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent font-bold",
            secondary: "text-gray-700 dark:text-gray-200 font-medium",
            danger: "bg-gradient-to-r from-[#F00046] to-red-600 bg-clip-text text-transparent font-bold",
            ghost: "text-indigo-600 dark:text-indigo-400 font-medium",
            disabled: "text-[#ADADAD] dark:text-[#ADADAD]",
        };

        // Wrapper styles (for the gradient border effect)
        const baseWrapperStyles = "group relative inline-flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

        // Variant-specific wrapper styles (gradients/borders)
        const variantWrapperStyles = {
            primary: "p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-sm hover:shadow-md hover:scale-[1.02] focus:ring-indigo-500",
            secondary: "border border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md focus:ring-gray-400",
            danger: "p-[1px] bg-gradient-to-br from-[#F00046] to-red-600 shadow-sm hover:shadow-md hover:scale-[1.02] focus:ring-red-500",
            ghost: "p-0 focus:ring-indigo-500",
            disabled: "p-0",
        };

        // Size styles (applied to the wrapper)
        const sizeStyles = {
            sm: "text-xs",
            md: "text-sm",
            lg: "text-base",
            icon: "h-10 w-10",
        };

        // Padding for the inner content
        const contentPadding = {
            sm: "px-3 py-1.5",
            md: "px-4 py-2",
            lg: "px-6 py-3",
            icon: "p-0",
        };

        // Define gradients for icons
        const Gradients = () => (
            <svg width="0" height="0" className="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <defs>
                    <linearGradient id="btn-gradient-primary" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4f46e5" /> {/* indigo-600 */}
                        <stop offset="50%" stopColor="#9333ea" /> {/* purple-600 */}
                        <stop offset="100%" stopColor="#db2777" /> {/* pink-600 */}
                    </linearGradient>
                    <linearGradient id="btn-gradient-danger" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#F00046" />
                        <stop offset="100%" stopColor="#dc2626" /> {/* red-600 */}
                    </linearGradient>
                </defs>
            </svg>
        );

        const getIconStyle = (variant: string) => {
            if (variant === 'primary') return { stroke: 'url(#btn-gradient-primary)', fill: 'url(#btn-gradient-primary)' };
            if (variant === 'danger') return { stroke: 'url(#btn-gradient-danger)', fill: 'url(#btn-gradient-danger)' };
            return {};
        };

        const effectiveVariant = disabled ? 'disabled' : variant;

        return (
            <button
                ref={ref}
                className={cn(
                    baseWrapperStyles,
                    // @ts-ignore - dynamic access
                    variantWrapperStyles[effectiveVariant],
                    sizeStyles[size],
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                <Gradients />
                <div className={cn(baseContentStyles,
                    // @ts-ignore - dynamic access
                    variantContentStyles[effectiveVariant],
                    contentPadding[size]
                )}>
                    <span className={cn(
                        "flex items-center justify-center", // Ensure content is centered within the span
                        size !== 'icon' && "gap-2", // Add gap only if not an icon button
                        // @ts-ignore - dynamic access
                        variantTextStyles[effectiveVariant]
                    )}>
                        {isLoading ? (
                            <svg
                                className={cn(
                                    "animate-spin h-4 w-4 shrink-0",
                                    (effectiveVariant === 'primary' || effectiveVariant === 'danger') ? "" : "text-current" // Remove text-white, let it use gradient or current
                                )}
                                style={getIconStyle(effectiveVariant)} // Apply gradient to spinner too!
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : Icon ? (
                            <Icon
                                className={cn(
                                    "w-4 h-4 transition-transform duration-300 group-hover:scale-110 shrink-0",
                                    size !== 'icon' && "mr-0", // Remove margin if gap is used or if it's an icon button
                                    (effectiveVariant === 'primary' || effectiveVariant === 'danger') ? "" : "text-current" // Force white for gradient variants, else use current text color
                                )}
                                style={getIconStyle(effectiveVariant)}
                            />
                        ) : null}
                        {children}
                    </span>
                </div>
            </button>
        );
    }
);

Button.displayName = "Button";

export default Button;
