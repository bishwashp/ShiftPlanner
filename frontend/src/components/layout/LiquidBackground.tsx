import React from 'react';

const LiquidBackground = () => {
    return (
        <div className="fixed inset-0 -z-50 overflow-hidden bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50 dark:from-black dark:via-gray-950 dark:to-slate-950">
            {/* Large animated gradient blobs - big enough to overlap, small enough to see movement */}

            {/* Blob 1 - Purple (top left) */}
            <div className="absolute -top-20 -left-20 w-[60%] h-[60%] bg-purple-300 dark:bg-purple-900/50 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 dark:opacity-30 animate-blob" />

            {/* Blob 2 - Orange/Yellow (top right) */}
            <div className="absolute -top-20 -right-20 w-[65%] h-[65%] bg-orange-300 dark:bg-amber-900/50 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 dark:opacity-30 animate-blob animation-delay-2000" />

            {/* Blob 3 - Pink (bottom left) */}
            <div className="absolute -bottom-20 left-20 w-[70%] h-[70%] bg-pink-300 dark:bg-pink-900/50 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 dark:opacity-30 animate-blob animation-delay-4000" />

            {/* Blob 4 - Blue (bottom right) */}
            <div className="absolute -bottom-20 right-20 w-[65%] h-[65%] bg-blue-300 dark:bg-blue-900/50 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 dark:opacity-30 animate-blob animation-delay-6000" />

            {/* Noise texture overlay */}
            <div
                className="absolute inset-0 opacity-[0.015] dark:opacity-[0.02]"
                style={{
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulature type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'repeat',
                }}
            />
        </div>
    );
};

export default LiquidBackground;
