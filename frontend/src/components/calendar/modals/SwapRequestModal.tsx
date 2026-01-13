import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Swap, Users, ArrowRight, CalendarCheck, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useAuth } from '../../../contexts/AuthContext';
import { Schedule } from '../../../services/api';
import { dateUtils } from '../../../utils/dateUtils';
import moment from 'moment';

interface SwapRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule | null; // The schedule that was clicked
    analysts: any[]; // List of available analysts
    userSchedules: Schedule[]; // Current user's swappable schedules
    onSuccess: () => void;
}

// Mini Calendar Component for selecting a shift to offer
const MiniCalendar: React.FC<{
    schedules: Schedule[];
    selectedDate: string | null;
    onSelect: (date: string) => void;
}> = ({ schedules, selectedDate, onSelect }) => {
    const [viewMonth, setViewMonth] = useState(moment());

    // Create a set of dates that have swappable shifts
    const swappableDates = useMemo(() => {
        const dates = new Set<string>();
        schedules.forEach(s => {
            const date = moment.utc(s.date).format('YYYY-MM-DD');
            const dayOfWeek = moment.utc(s.date).day();
            // Only weekend or screener shifts are swappable
            if (s.isScreener || dayOfWeek === 0 || dayOfWeek === 6) {
                dates.add(date);
            }
        });
        return dates;
    }, [schedules]);

    const generateCalendarDays = () => {
        const startOfMonth = viewMonth.clone().startOf('month');
        const endOfMonth = viewMonth.clone().endOf('month');
        const startDate = startOfMonth.clone().startOf('week');
        const endDate = endOfMonth.clone().endOf('week');

        const days: moment.Moment[] = [];
        let current = startDate.clone();

        while (current.isSameOrBefore(endDate)) {
            days.push(current.clone());
            current.add(1, 'day');
        }

        return days;
    };

    const days = generateCalendarDays();

    return (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={() => setViewMonth(viewMonth.clone().subtract(1, 'month'))}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                    <CaretLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {viewMonth.format('MMMM YYYY')}
                </span>
                <button
                    type="button"
                    onClick={() => setViewMonth(viewMonth.clone().add(1, 'month'))}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                    <CaretRight className="w-4 h-4" />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs text-gray-500 dark:text-gray-400 font-medium py-1">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                    const dateStr = day.format('YYYY-MM-DD');
                    const isCurrentMonth = day.month() === viewMonth.month();
                    const isSwappable = swappableDates.has(dateStr);
                    const isSelected = selectedDate === dateStr;
                    const isToday = day.isSame(moment(), 'day');
                    const isPast = day.isBefore(moment(), 'day');

                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={!isSwappable || isPast}
                            onClick={() => isSwappable && !isPast && onSelect(dateStr)}
                            className={`
                                w-8 h-8 text-xs rounded-full flex items-center justify-center transition-all
                                ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : ''}
                                ${isSwappable && !isPast
                                    ? isSelected
                                        ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 cursor-pointer font-medium'
                                    : 'text-gray-400 dark:text-gray-500 cursor-default'
                                }
                                ${isToday && !isSelected ? 'ring-1 ring-gray-300 dark:ring-gray-600' : ''}
                            `}
                        >
                            {day.date()}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700"></div>
                    <span>Your swappable shifts</span>
                </div>
            </div>
        </div>
    );
};

export default function SwapRequestModal({
    isOpen,
    onClose,
    schedule,
    analysts,
    userSchedules,
    onSuccess
}: SwapRequestModalProps) {
    const { user } = useAuth();
    const [swapType, setSwapType] = useState<'DIRECT' | 'BROADCAST'>('DIRECT');
    const [targetAnalystId, setTargetAnalystId] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [selectedOfferDate, setSelectedOfferDate] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Determine mode:
    // 1. schedule === null → "Standalone" mode (from SwapInbox button, user picks their shift)
    // 2. schedule.analystId === user.analystId → "Give away" mode (right-click own shift)
    // 3. schedule.analystId !== user.analystId → "I want this" mode (right-click other's shift)
    const currentUserAnalystId = user?.analystId;
    const clickedScheduleAnalystId = schedule?.analystId;

    // Standalone mode: opened from SwapInbox with no schedule context
    const isStandaloneMode = !schedule;
    // Give away mode: user clicked their own shift
    const isGiveAwayMode = !isStandaloneMode && currentUserAnalystId === clickedScheduleAnalystId;
    // I want this mode: user clicked someone else's shift
    const isIWantThisMode = !isStandaloneMode && currentUserAnalystId !== clickedScheduleAnalystId;

    // For "I want this" mode, the clicked schedule owner is the target
    const clickedScheduleOwner = useMemo(() => {
        if (!schedule) return null;
        return analysts.find(a => a.id === schedule.analystId);
    }, [schedule, analysts]);

    // Get current user's analyst for region filtering
    const currentUserAnalyst = useMemo(() => {
        return analysts.find(a => a.id === currentUserAnalystId);
    }, [analysts, currentUserAnalystId]);

    // Filter analysts for "give away" / "standalone" mode: Same region, exclude self
    const scheduleOwnerAnalyst = schedule ? analysts.find(a => a.id === clickedScheduleAnalystId) : currentUserAnalyst;
    const currentRegionId = scheduleOwnerAnalyst?.regionId;
    const eligibleAnalysts = analysts.filter(a =>
        a.id !== currentUserAnalystId &&
        a.regionId === currentRegionId &&
        a.isActive
    );

    // Reset state when modal opens/closes or mode changes
    useEffect(() => {
        if (isOpen) {
            setSwapType('DIRECT');
            setTargetAnalystId('');
            setTargetDate('');
            setSelectedOfferDate(null);
            setError(null);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            let payload: any;

            if (isStandaloneMode || isGiveAwayMode) {
                // "Standalone" or "Give away" mode: User picks their shift to give away
                const shiftDate = isStandaloneMode ? selectedOfferDate : dateUtils.toApiDate(schedule!.date);

                if (isStandaloneMode && !selectedOfferDate) {
                    throw new Error('Please select one of your shifts to give away');
                }

                payload = {
                    requestingShiftDate: shiftDate,
                    targetAnalystId: swapType === 'DIRECT' ? targetAnalystId : undefined,
                    targetShiftDate: (swapType === 'DIRECT' && targetDate) ? targetDate : undefined,
                    isBroadcast: swapType === 'BROADCAST'
                };
            } else {
                // "I want this" mode: I want their shift, offering one of mine
                if (!selectedOfferDate) {
                    throw new Error('Please select one of your shifts to offer');
                }
                payload = {
                    requestingShiftDate: selectedOfferDate, // My shift I'm offering
                    targetAnalystId: clickedScheduleAnalystId, // The person whose shift I want
                    targetShiftDate: dateUtils.toApiDate(schedule!.date), // The shift I want
                    isBroadcast: false
                };
            }

            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/shift-swaps', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to create swap request');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-200 dark:border-gray-700">
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        <Swap className="w-5 h-5 text-primary" />
                                        {isStandaloneMode ? 'Request Shift Swap' : (isGiveAwayMode ? 'Give Away Shift' : 'Request Shift Swap')}
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-gray-500 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </Dialog.Title>

                                <div className="mt-4">
                                    {/* Context: The shift being discussed (only show if we have a schedule) */}
                                    {schedule && (
                                        <div className={`p-3 rounded-lg border mb-6 ${isGiveAwayMode
                                            ? 'bg-muted/30 border-border'
                                            : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                            }`}>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                                {isGiveAwayMode ? 'Your Shift' : `${clickedScheduleOwner?.name}'s Shift (You Want This)`}
                                            </p>
                                            <div className="flex justify-between items-center font-medium">
                                                <span className="text-gray-900 dark:text-gray-100">
                                                    {dateUtils.formatDisplayDate(schedule.date, 'dddd, MMMM Do YYYY')}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs ${schedule.isScreener ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                                                    {schedule.isScreener ? 'Screener' : schedule.shiftType}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {/* ===== STANDALONE MODE ===== */}
                                        {isStandaloneMode && (
                                            <>
                                                {/* Step 1: Pick your shift to give away */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Select your shift to give away
                                                    </label>
                                                    <MiniCalendar
                                                        schedules={userSchedules}
                                                        selectedDate={selectedOfferDate}
                                                        onSelect={setSelectedOfferDate}
                                                    />
                                                    {selectedOfferDate && (
                                                        <div className="mt-3 p-2 bg-primary/10 rounded-md flex items-center gap-2 text-sm">
                                                            <CalendarCheck className="w-4 h-4 text-primary" />
                                                            <span className="text-gray-700 dark:text-gray-300">
                                                                You'll give away: <strong>{dateUtils.formatDisplayDate(selectedOfferDate!, 'ddd, MMM D')}</strong>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Step 2: Swap Type Toggle (only show after shift selected) */}
                                                {selectedOfferDate && (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-900/50 p-1 rounded-lg">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSwapType('DIRECT')}
                                                                className={`
                                                                    flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all
                                                                    ${swapType === 'DIRECT'
                                                                        ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                                                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                                                                `}
                                                            >
                                                                <Users className="w-4 h-4" />
                                                                Direct Swap
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSwapType('BROADCAST')}
                                                                className={`
                                                                    flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all
                                                                    ${swapType === 'BROADCAST'
                                                                        ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                                                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                                                                `}
                                                            >
                                                                <div className="relative">
                                                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                                                                    </span>
                                                                    <Swap className="w-4 h-4" />
                                                                </div>
                                                                Broadcast
                                                            </button>
                                                        </div>

                                                        {/* Direct Swap Fields */}
                                                        {swapType === 'DIRECT' && (
                                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                <div>
                                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                        Target Analyst
                                                                    </label>
                                                                    <select
                                                                        value={targetAnalystId}
                                                                        onChange={(e) => setTargetAnalystId(e.target.value)}
                                                                        required={swapType === 'DIRECT'}
                                                                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                                    >
                                                                        <option value="">Select an analyst...</option>
                                                                        {eligibleAnalysts.map(analyst => (
                                                                            <option key={analyst.id} value={analyst.id}>
                                                                                {analyst.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>

                                                                <div>
                                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                        Target Date (Optional)
                                                                        <span className="text-xs text-gray-500 ml-1 font-normal">- If they are giving a shift back</span>
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        value={targetDate}
                                                                        onChange={(e) => setTargetDate(e.target.value)}
                                                                        min={moment().format('YYYY-MM-DD')}
                                                                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Broadcast Info */}
                                                        {swapType === 'BROADCAST' && (
                                                            <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 rounded-lg text-sm text-sky-800 dark:text-sky-200 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                <p className="flex items-start gap-2">
                                                                    <span className="text-xl">📢</span>
                                                                    <span>
                                                                        This will post your request to the <strong>Marketplace</strong>.
                                                                        Any eligible analyst in your region can offer a swap, which you can then review and accept.
                                                                    </span>
                                                                </p>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        )}

                                        {/* ===== GIVE AWAY MODE ===== */}
                                        {isGiveAwayMode && (
                                            <>
                                                {/* Swap Type Toggle */}
                                                <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-900/50 p-1 rounded-lg">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSwapType('DIRECT')}
                                                        className={`
                                                            flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all
                                                            ${swapType === 'DIRECT'
                                                                ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                                                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                                                        `}
                                                    >
                                                        <Users className="w-4 h-4" />
                                                        Direct Swap
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSwapType('BROADCAST')}
                                                        className={`
                                                            flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all
                                                            ${swapType === 'BROADCAST'
                                                                ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                                                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                                                        `}
                                                    >
                                                        <div className="relative">
                                                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                                                            </span>
                                                            <Swap className="w-4 h-4" />
                                                        </div>
                                                        Broadcast
                                                    </button>
                                                </div>

                                                {/* Direct Swap Fields */}
                                                {swapType === 'DIRECT' && (
                                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                Target Analyst
                                                            </label>
                                                            <select
                                                                value={targetAnalystId}
                                                                onChange={(e) => setTargetAnalystId(e.target.value)}
                                                                required={swapType === 'DIRECT'}
                                                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                            >
                                                                <option value="">Select an analyst...</option>
                                                                {eligibleAnalysts.map(analyst => (
                                                                    <option key={analyst.id} value={analyst.id}>
                                                                        {analyst.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                Target Date (Optional)
                                                                <span className="text-xs text-gray-500 ml-1 font-normal">- If they are giving a shift back</span>
                                                            </label>
                                                            <input
                                                                type="date"
                                                                value={targetDate}
                                                                onChange={(e) => setTargetDate(e.target.value)}
                                                                min={moment().format('YYYY-MM-DD')}
                                                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Broadcast Info */}
                                                {swapType === 'BROADCAST' && (
                                                    <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 rounded-lg text-sm text-sky-800 dark:text-sky-200 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <p className="flex items-start gap-2">
                                                            <span className="text-xl">📢</span>
                                                            <span>
                                                                This will post your request to the <strong>Marketplace</strong>.
                                                                Any eligible analyst in your region can offer a swap, which you can then review and accept.
                                                            </span>
                                                        </p>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* ===== I WANT THIS MODE ===== */}
                                        {isIWantThisMode && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Select your shift to offer in exchange
                                                    </label>
                                                    <MiniCalendar
                                                        schedules={userSchedules}
                                                        selectedDate={selectedOfferDate}
                                                        onSelect={setSelectedOfferDate}
                                                    />
                                                    {selectedOfferDate && (
                                                        <div className="mt-3 p-2 bg-primary/10 rounded-md flex items-center gap-2 text-sm">
                                                            <CalendarCheck className="w-4 h-4 text-primary" />
                                                            <span className="text-gray-700 dark:text-gray-300">
                                                                You'll offer: <strong>{dateUtils.formatDisplayDate(selectedOfferDate!, 'ddd, MMM D')}</strong>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {error && (
                                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-md">
                                                {error}
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-3 mt-6">
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting || ((isStandaloneMode || isIWantThisMode) && !selectedOfferDate)}
                                                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSubmitting ? 'Submitting...' : (
                                                    <>
                                                        {(isGiveAwayMode || isStandaloneMode)
                                                            ? (swapType === 'DIRECT' ? 'Send Request' : 'Post to Marketplace')
                                                            : 'Send Swap Request'
                                                        }
                                                        <ArrowRight className="w-4 h-4" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
