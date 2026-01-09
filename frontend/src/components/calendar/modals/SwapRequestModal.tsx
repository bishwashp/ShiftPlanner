import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Swap, Users, ArrowRight } from '@phosphor-icons/react';
// import { apiService } from '../../../services/api'; // Use existing apiService or create swapService
// For now, assume a swapService or generic axios call. I'll use standard fetch or creating a service later.
import { useAuth } from '../../../contexts/AuthContext';
import moment from 'moment';

interface SwapRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: any; // The schedule being swapped (Source)
    analysts: any[]; // List of available analysts
    onSuccess: () => void;
}

export default function SwapRequestModal({
    isOpen,
    onClose,
    schedule,
    analysts,
    onSuccess
}: SwapRequestModalProps) {
    const { user } = useAuth(); // Assuming useAuth gives us the current user/analyst context
    const [swapType, setSwapType] = useState<'DIRECT' | 'BROADCAST'>('DIRECT');
    const [targetAnalystId, setTargetAnalystId] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter analysts: Same region, exclude self
    // Note: schedule.resource likely contains the full schedule object which has analystId.
    // Actually, schedule passed here is the 'CalendarEvent' resource, which is the Schedule object.
    // But wait, CalendarEvent structure in CalendarGrid is { id, title, date, resource: Schedule }.
    // So 'schedule' prop here is likely the Schedule object directly if passed from handleRequestSwap(event.resource).

    const currentAnalystId = schedule?.analystId;
    const currentRegionId = schedule?.regionId;

    const eligibleAnalysts = analysts.filter(a =>
        a.id !== currentAnalystId &&
        a.regionId === currentRegionId &&
        a.isActive
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Construct API payload
            const payload = {
                requestingShiftDate: schedule.date, // The date of the shift I want to give away/swap
                targetAnalystId: swapType === 'DIRECT' ? targetAnalystId : undefined,
                targetShiftDate: (swapType === 'DIRECT' && targetDate) ? targetDate : undefined,
                isBroadcast: swapType === 'BROADCAST'
            };

            // Call API
            // Since I haven't updated the frontend API service yet, I'll use fetch directly or assume a service exists.
            // Better to create src/services/swapService.ts. 
            // For now, inline fetch to /api/shift-swaps (I defined route as /api/swaps? No, /api/shift-swaps in index.ts)

            const token = localStorage.getItem('token'); // Simplistic token retrieval
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

    if (!schedule) return null;

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
                                        Request Shift Swap
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-gray-500 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </Dialog.Title>

                                <div className="mt-4">
                                    <div className="bg-muted/30 p-3 rounded-lg border border-border mb-6">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Assignment</p>
                                        <div className="flex justify-between items-center font-medium">
                                            <span>{moment(schedule.date).format('MMMM Do YYYY')}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${schedule.isScreener ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {schedule.isScreener ? 'Screener' : schedule.shiftType}
                                            </span>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {/* Swap Type Section */}
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
                                                disabled={isSubmitting}
                                                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSubmitting ? 'Submitting...' : (
                                                    <>
                                                        {swapType === 'DIRECT' ? 'Send Request' : 'Post to Marketplace'}
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
