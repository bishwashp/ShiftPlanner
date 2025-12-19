import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import { Timer, CaretRight } from '@phosphor-icons/react';

// Rolling digit component - uses a vertical strip of 0-9
// tabular-nums ensures monospaced behavior to prevent horizontal jitter
const RollingDigit: React.FC<{ digit: string }> = ({ digit }) => {
    const num = parseInt(digit, 10) || 0;

    return (
        <div className="relative inline-block h-[1.1em] overflow-hidden leading-none align-middle" style={{ width: '0.65em' }}>
            <div
                className="transition-transform duration-500 cubic-bezier(0.45, 0, 0.55, 1)"
                style={{ transform: `translateY(-${num * 10}%)` }}
            >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <div key={n} className="h-[1.1em] flex items-center justify-center">
                        {n}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Component to display time with rolling animation
const RollingTime: React.FC<{ value: string }> = ({ value }) => {
    return (
        <div className="flex items-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value.split('').map((char, index) => (
                char === ':' ? (
                    <span key={index} className="mx-0.5 opacity-40 font-display flex items-center justify-center" style={{ width: '0.3em', fontSize: '0.8em' }}>:</span>
                ) : (
                    <RollingDigit key={index} digit={char} />
                )
            ))}
        </div>
    );
};

const HandoverCountdown: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState({ hours: '00', minutes: '00', seconds: '00' });
    const [nextHandoverLabel, setNextHandoverLabel] = useState<string>('');
    const [targetTimeDisplay, setTargetTimeDisplay] = useState<string>('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = moment.tz('America/Chicago');

            // Handover times in CST
            const handovers = [
                { hour: 10, minute: 0, label: 'EMEA → AMR Morning' },
                { hour: 14, minute: 30, label: 'AMR Morning → AMR Evening' },
                { hour: 18, minute: 30, label: 'AMR Evening → APAC' }
            ];

            // Find next handover
            let nextHandover = null;
            for (const h of handovers) {
                const target = now.clone().hour(h.hour).minute(h.minute).second(0);
                if (target.isAfter(now)) {
                    nextHandover = { ...h, time: target };
                    break;
                }
            }

            // If no more handovers today, target first one tomorrow
            if (!nextHandover) {
                const h = handovers[0];
                const target = now.clone().add(1, 'day').hour(h.hour).minute(h.minute).second(0);
                nextHandover = { ...h, time: target };
            }

            const diff = nextHandover.time.diff(now);
            const duration = moment.duration(diff);

            setTimeLeft({
                hours: Math.floor(duration.asHours()).toString().padStart(2, '0'),
                minutes: duration.minutes().toString().padStart(2, '0'),
                seconds: duration.seconds().toString().padStart(2, '0')
            });
            setNextHandoverLabel(nextHandover.label);
            setTargetTimeDisplay(nextHandover.time.format('h:mm A z'));
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, []);

    const currentPhase = nextHandoverLabel.split(' → ')[0];
    const nextPhase = nextHandoverLabel.split(' → ')[1];

    return (
        <div className="flex flex-col h-full px-3 py-2">
            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
                <Timer className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">Next Handover</span>
            </div>

            {/* Main Content: Timer (left) + Phases (right) */}
            <div className="flex items-center justify-between flex-1">
                {/* Large Timer with Odometer Style Animation */}
                <div
                    className="text-4xl font-display font-bold text-gray-900 dark:text-white flex items-center leading-none"
                    style={{ fontVariationSettings: '"wdth" 85' }}
                >
                    <RollingTime value={timeLeft.hours} />
                    <span className="mx-0.5 opacity-40 flex items-center justify-center" style={{ width: '0.3em', fontSize: '0.8em', transform: 'translateY(-0.05em)' }}>:</span>
                    <RollingTime value={timeLeft.minutes} />
                    <span className="mx-0.5 opacity-40 flex items-center justify-center" style={{ width: '0.3em', fontSize: '0.8em' }}>:</span>
                    <RollingTime value={timeLeft.seconds} />
                </div>

                {/* Phase Transition (stacked on right) */}
                <div className="flex flex-col items-end gap-0.5 ml-2 min-w-0">
                    <span className="text-xs font-bold text-blue-500 truncate max-w-full">
                        {currentPhase}
                    </span>
                    <div className="flex items-center gap-1">
                        <CaretRight className="w-3 h-3 text-purple-500 flex-shrink-0" weight="bold" />
                        <span className="text-xs font-bold text-purple-500 truncate">
                            {nextPhase}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HandoverCountdown;
