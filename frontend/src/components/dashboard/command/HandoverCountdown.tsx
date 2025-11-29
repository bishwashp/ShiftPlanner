import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import { Timer, CaretRight } from '@phosphor-icons/react';

const HandoverCountdown: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState<string>('00:00:00');
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

            const hours = Math.floor(duration.asHours()).toString().padStart(2, '0');
            const minutes = duration.minutes().toString().padStart(2, '0');
            const seconds = duration.seconds().toString().padStart(2, '0');

            setTimeLeft(`${hours}:${minutes}:${seconds}`);
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
                {/* Large Timer */}
                <div className="text-4xl font-bold text-gray-900 dark:text-white leading-none [font-stretch:condensed]" style={{ fontStretch: 'condensed' }}>
                    {timeLeft}
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
