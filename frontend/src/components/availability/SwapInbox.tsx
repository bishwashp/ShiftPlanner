import React, { useState, useEffect, useMemo } from 'react';
import { apiService, ShiftSwap, Analyst, Schedule } from '../../services/api';
import moment from 'moment';
import {
    Tray,
    PaperPlaneRight,
    Storefront,
    CheckCircle,
    XCircle,
    Clock,
    ArrowRight,
    User,
    CalendarCheck,
    Plus,
    Swap
} from '@phosphor-icons/react';
import SwapRequestModal from '../calendar/modals/SwapRequestModal';
import { useAuth } from '../../contexts/AuthContext';

export default function SwapInbox() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'INCOMING' | 'OUTGOING' | 'MARKETPLACE'>('INCOMING');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        incoming: ShiftSwap[];
        outgoing: ShiftSwap[];
        history: ShiftSwap[];
        broadcasts: ShiftSwap[];
    }>({ incoming: [], outgoing: [], history: [], broadcasts: [] });

    const [offerModalOpen, setOfferModalOpen] = useState(false);
    const [selectedBroadcast, setSelectedBroadcast] = useState<ShiftSwap | null>(null);

    // For the Request Swap button modal
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [analysts, setAnalysts] = useState<Analyst[]>([]);
    const [userSchedules, setUserSchedules] = useState<Schedule[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [mySwaps, broadcasts, fetchedAnalysts, allSchedules] = await Promise.all([
                apiService.getMySwaps(),
                apiService.getBroadcasts(),
                apiService.getAnalysts(),
                apiService.getSchedules(
                    moment().format('YYYY-MM-DD'),
                    moment().add(3, 'months').format('YYYY-MM-DD')
                )
            ]);
            setData({ ...mySwaps, broadcasts });
            setAnalysts(fetchedAnalysts);
            // Filter for current user's schedules
            if (user?.analystId) {
                setUserSchedules(allSchedules.filter(s => s.analystId === user.analystId));
            }
        } catch (err) {
            console.error('Failed to fetch swaps:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user?.analystId]);

    const handleApprove = async (id: string) => {
        if (!window.confirm('Are you sure you want to approve this swap? This will update the schedule immediately.')) return;
        try {
            await apiService.approveSwap(id);
            fetchData(); // Refresh after action
        } catch (err) {
            alert('Failed to approve swap: ' + err);
        }
    };

    const handleMakeOffer = (broadcast: ShiftSwap) => {
        setSelectedBroadcast(broadcast);
        setOfferModalOpen(true);
    };

    const formatDate = (date: string) => moment(date).format('MMM Do, YYYY');

    const renderStatusPill = (status: string) => {
        const styles = {
            'PENDING_PARTNER': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
            'OPEN': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
            'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
            'CANCELLED': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
        } as any;

        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles['CANCELLED']}`}>
                {status.replace('_', ' ')}
            </span>
        );
    };

    const EmptyState = ({ message }: { message: string }) => (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Tray className="w-12 h-12 mb-2 opacity-50" />
            <p>{message}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Shift Swap Center</h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setRequestModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" weight="bold" />
                        Request Swap
                    </button>
                    <button
                        onClick={fetchData}
                        className="text-sm text-primary hover:underline"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                {[
                    { id: 'INCOMING', label: 'Incoming Requests', icon: Tray, count: data.incoming.length },
                    { id: 'OUTGOING', label: 'My Requests', icon: PaperPlaneRight, count: data.outgoing.length },
                    { id: 'MARKETPLACE', label: 'Marketplace', icon: Storefront, count: data.broadcasts.length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}
            `}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count > 0 && (
                            <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full text-xs">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading swaps...</div>
            ) : (
                <div className="animate-in fade-in duration-200">

                    {/* INCOMING TAB */}
                    {activeTab === 'INCOMING' && (
                        <div className="space-y-4">
                            {data.incoming.length === 0 ? <EmptyState message="No incoming requests" /> : (
                                data.incoming.map(swap => (
                                    <div key={swap.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {swap.offers && swap.offers.length > 0 ? 'Offer Received' : 'Swap Request'}
                                                </span>
                                                {renderStatusPill(swap.status)}
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                <span className="font-medium">{swap.requestingAnalyst?.name}</span>
                                                <span>wants to verify/give:</span>
                                                <span className="font-bold text-gray-900 dark:text-gray-200">{formatDate(swap.requestingShiftDate)}</span>
                                            </div>
                                            {swap.targetShiftDate && (
                                                <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1 ml-6">
                                                    <ArrowRight className="w-3 h-3 text-gray-400" />
                                                    <span>In exchange for your shift on:</span>
                                                    <span className="font-bold text-gray-900 dark:text-gray-200">{formatDate(swap.targetShiftDate)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(swap.id)}
                                                className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* OUTGOING TAB */}
                    {activeTab === 'OUTGOING' && (
                        <div className="space-y-4">
                            {data.outgoing.length === 0 ? <EmptyState message="You haven't made any requests" /> : (
                                data.outgoing.map(swap => (
                                    <div key={swap.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {swap.isBroadcast ? 'Broadcast Request' : 'Direct Request'}
                                                </span>
                                                {renderStatusPill(swap.status)}
                                            </div>
                                            <div className="text-xs text-gray-500">{moment(swap.createdAt).fromNow()}</div>
                                        </div>

                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            <p>Offering shift: <strong>{formatDate(swap.requestingShiftDate)}</strong></p>
                                            {swap.targetAnalyst && (
                                                <p className="mt-1">To: <strong>{swap.targetAnalyst.name}</strong></p>
                                            )}
                                        </div>

                                        {/* Show Offers for Broadcasts */}
                                        {swap.isBroadcast && swap.offers && swap.offers.length > 0 && (
                                            <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                                                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Received Offers</h4>
                                                <div className="space-y-2">
                                                    {swap.offers.map(offer => (
                                                        <div key={offer.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900 p-2 rounded">
                                                            <div>
                                                                <span className="font-medium">{offer.requestingAnalyst?.name}</span> offers <strong>{formatDate(offer.requestingShiftDate)}</strong>
                                                            </div>
                                                            <button
                                                                onClick={() => handleApprove(offer.id)}
                                                                className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90"
                                                            >
                                                                Accept
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* MARKETPLACE TAB */}
                    {activeTab === 'MARKETPLACE' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.broadcasts.length === 0 ? <div className="col-span-full"><EmptyState message="No active broadcasts in your region" /></div> : (
                                data.broadcasts.map(broadcast => (
                                    <div key={broadcast.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-sky-100 dark:border-sky-900 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-300">
                                                    <span className="font-bold text-xs">{broadcast.requestingAnalyst?.name?.substring(0, 2).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{broadcast.requestingAnalyst?.name}</p>
                                                    <p className="text-xs text-gray-500">needs coverage</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded mb-4 text-center">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Shift Date</p>
                                            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDate(broadcast.requestingShiftDate)}</p>
                                        </div>

                                        <button
                                            onClick={() => handleMakeOffer(broadcast)}
                                            className="w-full py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CalendarCheck className="w-4 h-4" />
                                            Make an Offer
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Request Swap Modal - Opens when user clicks "Request Swap" button */}
            {/* Pass null schedule to trigger "Give Away" mode where user picks their shift */}
            <SwapRequestModal
                isOpen={requestModalOpen}
                onClose={() => setRequestModalOpen(false)}
                schedule={null}
                analysts={analysts}
                userSchedules={userSchedules}
                onSuccess={() => {
                    setRequestModalOpen(false);
                    fetchData();
                }}
            />
        </div>
    );
}
