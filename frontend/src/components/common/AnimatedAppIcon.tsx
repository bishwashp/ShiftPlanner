import React, { useState, useEffect } from 'react';

interface AnimatedAppIconProps {
    className?: string;
    staticIconPath?: string;
    gifPath?: string;
    /**
     * Duration of the GIF in milliseconds.
     * Default assumption: 2.5s (2500ms)
     */
    gifDurationMs?: number;
    /**
     * Duration of the crossfade transition in milliseconds.
     * "Last 20 frames" at 30fps is ~666ms.
     */
    fadeDurationMs?: number;
    /**
     * Visual scale factor for the GIF to match the static icon size.
     * Useful if the GIF has extra padding.
     */
    gifScale?: number;
}

const AnimatedAppIcon: React.FC<AnimatedAppIconProps> = ({
    className = "",
    staticIconPath = "/sine-icon.png",
    gifPath = "/sine-gif.gif",
    gifDurationMs = 4500,
    fadeDurationMs = 660,
    gifScale = 1.15, // Adjusted to match size
}) => {
    const [showStatic, setShowStatic] = useState(false);
    const [isFading, setIsFading] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [loopKey, setLoopKey] = useState(Date.now());

    useEffect(() => {
        // Reset state on mount (page refresh essentially)
        setShowStatic(false);
        setIsFading(false);
        setLoopKey(Date.now());

        // Calculate when to start the fade
        const fadeStartTime = Math.max(0, gifDurationMs - fadeDurationMs);

        const fadeTimer = setTimeout(() => {
            setIsFading(true);
        }, fadeStartTime);

        const completeTimer = setTimeout(() => {
            setShowStatic(true);
            setIsFading(false); // cleanup
        }, gifDurationMs);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(completeTimer);
        };
    }, [gifDurationMs, fadeDurationMs]);

    // Looping effect while hovering
    useEffect(() => {
        if (!isHovering) return;

        // When hover starts, ensure GIF is showing
        setShowStatic(false);
        setIsFading(false);
        // And restart the GIF logic
        setLoopKey(Date.now());

        const interval = setInterval(() => {
            setLoopKey(Date.now());
        }, gifDurationMs);

        return () => {
            clearInterval(interval);
        };
    }, [isHovering, gifDurationMs]);

    const handleMouseEnter = () => {
        setIsHovering(true);
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        // Start fade out sequence to return to static
        setIsFading(true);
        setTimeout(() => {
            setShowStatic(true);
            setIsFading(false);
        }, fadeDurationMs);
    };

    return (
        <div
            className={`relative ${className}`}
            style={{ isolation: 'isolate' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Static Icon */}
            <img
                src={staticIconPath}
                alt="Sine Logo Static"
                className={`absolute inset-0 w-full h-full object-contain transition-opacity ease-in-out`}
                style={{
                    opacity: (!isHovering && (isFading || showStatic)) ? 1 : 0,
                    transitionDuration: `${fadeDurationMs}ms`
                }}
            />

            {/* GIF */}
            {(!showStatic || isHovering) && (
                <img
                    // Key changes to force reload
                    key={loopKey}
                    src={`${gifPath}?t=${loopKey}`}
                    alt="Sine Logo Animation"
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity ease-in-out`}
                    style={{
                        opacity: (!isHovering && isFading) ? 0 : 1,
                        transitionDuration: `${fadeDurationMs}ms`,
                        transform: `scale(${gifScale})`
                    }}
                />
            )}
        </div>
    );
};

export default AnimatedAppIcon;
