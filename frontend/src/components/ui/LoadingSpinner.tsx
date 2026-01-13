import React from 'react';

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large' | 'xl';
    fullScreen?: boolean;
    className?: string;
    text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'medium',
    fullScreen = false,
    className = '',
    text
}) => {
    const sizeClasses = {
        small: 'h-8 w-8',
        medium: 'h-16 w-16',
        large: 'h-24 w-24',
        xl: 'h-32 w-32'
    };

    const content = (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <div
                className={`${sizeClasses[size]} relative overflow-hidden`}
                style={{
                    maskImage: 'url("/sine-gif-full.gif")',
                    WebkitMaskImage: 'url("/sine-gif-full.gif")',
                    maskSize: 'contain',
                    WebkitMaskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    WebkitMaskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskPosition: 'center'
                }}
            >
                {/* 
                    Use a vibrant animated gradient that mimics the liquid background colors.
                    We use a larger container (-inset-full) to allow for movement if we want, 
                    or just a rich gradient that fills the mask.
                */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 animate-pulse" />
            </div>
            {text && (
                <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300 animate-pulse">
                    {text}
                </p>
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                {content}
            </div>
        );
    }

    return content;
};
