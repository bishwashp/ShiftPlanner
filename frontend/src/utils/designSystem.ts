export const colors = {
    fairness: {
        excellent: 'from-green-400 to-emerald-600',
        good: 'from-blue-400 to-cyan-600',
        warning: 'from-yellow-400 to-orange-600',
        poor: 'from-red-400 to-rose-600'
    },
    metrics: {
        workload: 'from-green-500 to-emerald-600',
        screener: 'from-blue-500 to-cyan-600',
        weekend: 'from-pink-500 to-rose-600',
        overall: 'from-purple-500 to-pink-600'
    },
    gradients: {
        green: 'from-green-500/10 to-emerald-500/10 border-green-500/20',
        blue: 'from-blue-500/10 to-cyan-500/10 border-blue-500/20',
        purple: 'from-purple-500/10 to-pink-500/10 border-purple-500/20',
        yellow: 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20',
        red: 'from-red-500/10 to-rose-500/10 border-red-500/20',
    }
};

export const animations = {
    spring: {
        type: "spring",
        stiffness: 300,
        damping: 30
    },
    smooth: {
        duration: 1.5,
        ease: [0.16, 1, 0.3, 1]
    }
};
