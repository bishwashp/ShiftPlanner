import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CircleNotch } from '@phosphor-icons/react';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: React.ElementType;
    leftIcon?: React.ElementType;
    rightIcon?: React.ElementType;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, icon, leftIcon, rightIcon, children, disabled, ...props }, ref) => {

        // Resolve Icon (support legacy 'icon' prop as leftIcon)
        const IconLeft = leftIcon || icon;
        const IconRight = rightIcon;

        const baseStyles = "relative inline-flex items-center justify-center rounded-xl font-medium transition-[background-color,box-shadow,transform] duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95";

        const variants = {
            primary: "bg-primary text-primary-foreground shadow-lg hover:shadow-primary/25 hover:bg-primary/90 border border-transparent",
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent",
            danger: "bg-destructive text-destructive-foreground shadow-lg hover:shadow-destructive/25 hover:bg-destructive/90 border border-transparent",
            ghost: "bg-transparent text-foreground hover:bg-muted",
            outline: "bg-transparent border border-input hover:bg-accent hover:text-accent-foreground",
        };

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 text-sm",
            lg: "h-12 px-6 text-base",
            icon: "h-10 w-10 p-0",
        };

        return (
            <button
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <CircleNotch className="w-4 h-4 animate-spin mr-2" />
                ) : IconLeft ? (
                    <IconLeft className={cn("w-4 h-4", children ? "mr-2" : "")} weight="bold" />
                ) : null}

                {children}

                {IconRight && !isLoading && (
                    <IconRight className={cn("w-4 h-4", children ? "ml-2" : "")} weight="bold" />
                )}
            </button>
        );
    }
);

Button.displayName = "Button";

export default Button;
