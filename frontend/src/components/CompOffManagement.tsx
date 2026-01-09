import React, { useState, useEffect, useCallback } from 'react';
import { Coins, ArrowUp, ArrowDown, MagnifyingGlass, CalendarBlank, Warning, User, Eye, Pencil, Trash, X } from '@phosphor-icons/react';
import { compOffService, CompOffBalance, CompOffTransaction } from '../services/compOffService';
import { apiService, Analyst } from '../services/api';
import moment from 'moment-timezone';
import HeaderActionPortal from './layout/HeaderActionPortal';
import HeaderActionButton from './layout/HeaderActionButton';
import Button from './ui/Button';
import SpringDropdown from './ui/SpringDropdown';
import SegmentedControl from './ui/SegmentedControl';
import { useAuth } from '../contexts/AuthContext';
import { useRegion } from '../contexts/RegionContext';

interface CompOffManagementProps {
    mode?: 'admin' | 'analyst';
    analystId?: string;
}

const CompOffManagement: React.FC<CompOffManagementProps> = ({ mode = 'admin', analystId }) => {
    const { isManager, user } = useAuth();
    const { selectedRegionId } = useRegion();

    // State
    const [balances, setBalances] = useState<CompOffBalance[]>([]);
    const [analysts, setAnalysts] = useState<Analyst[]>([]);
    const [transactions, setTransactions] = useState<CompOffTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'balances' | 'transactions'>('balances');

    // Filters
    const [dateRange, setDateRange] = useState<'90days' | '6months' | '12months'>('90days');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAnalyst, setSelectedAnalyst] = useState<string | null>(null);

    // Modals
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const [creditForm, setCreditForm] = useState({ analystId: '', units: 1, reason: '' });

    // Edit/Delete Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ transactionId: '', amount: 0, reason: '' });
    const [transactionToDelete, setTransactionToDelete] = useState<CompOffTransaction | null>(null);

    // Liability stats
    const [liability, setLiability] = useState({ totalEarned: 0, totalUsed: 0, totalOutstanding: 0 });

    // Balance Adjustment Modal
    const [isBalanceAdjustModalOpen, setIsBalanceAdjustModalOpen] = useState(false);
    const [balanceAdjustForm, setBalanceAdjustForm] = useState({
        analystId: '',
        currentEarned: 0,
        currentUsed: 0,
        targetEarned: '',
        targetUsed: '',
        reason: ''
    });

    // Balance Deletion Modal
    const [balanceToDelete, setBalanceToDelete] = useState<string | null>(null);

    // Fetch balances
    const fetchBalances = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const regionFilter = selectedRegionId === 'global' ? undefined : selectedRegionId;
            const data = await compOffService.getAllBalances(regionFilter);
            setBalances(data);

            // Also fetch liability
            const liabilityData = await compOffService.getTotalLiability();
            setLiability(liabilityData);

            // Fetch all analysts for the credit dropdown
            const allAnalysts = await apiService.getAnalysts();
            // Filter analysts by region if a specific region is selected (and not global)
            const filteredAnalysts = regionFilter
                ? allAnalysts.filter(a => a.regionId === regionFilter)
                : allAnalysts;

            setAnalysts(filteredAnalysts);
        } catch (err) {
            console.error('Error fetching compoff data:', err);
            setError('Failed to load compoff data.');
        } finally {
            setLoading(false);
        }
    }, [selectedRegionId]);

    // Fetch transactions
    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const endDate = moment().format('YYYY-MM-DD');
            let startDate: string;
            switch (dateRange) {
                case '6months':
                    startDate = moment().subtract(6, 'months').format('YYYY-MM-DD');
                    break;
                case '12months':
                    startDate = moment().subtract(12, 'months').format('YYYY-MM-DD');
                    break;
                default:
                    startDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
            }

            const regionFilter = selectedRegionId === 'global' ? undefined : selectedRegionId;
            const data = await compOffService.getTransactionHistory({
                regionId: regionFilter,
                analystId: selectedAnalyst || undefined,
                startDate,
                endDate,
                limit: 100,
            });
            setTransactions(data.transactions);
        } catch (err) {
            console.error('Error fetching transactions:', err);
            setError('Failed to load transactions.');
        } finally {
            setLoading(false);
        }
    }, [selectedRegionId, dateRange, selectedAnalyst]);

    useEffect(() => {
        if (activeTab === 'balances') {
            fetchBalances();
        } else {
            fetchTransactions();
        }
    }, [activeTab, fetchBalances, fetchTransactions]);

    // Credit CompOff
    const handleCreditSubmit = async () => {
        if (!creditForm.analystId || !creditForm.units || !creditForm.reason) {
            setError('Please fill all fields');
            return;
        }

        try {
            await compOffService.creditCompOff(creditForm.analystId, creditForm.units, creditForm.reason);
            setIsCreditModalOpen(false);
            setCreditForm({ analystId: '', units: 1, reason: '' });
            fetchBalances();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to credit compoff');
        }
    };

    // Edit Transaction
    const openEditModal = (txn: CompOffTransaction) => {
        setEditForm({
            transactionId: txn.id,
            amount: txn.amount,
            reason: txn.reason
        });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async () => {
        if (!editForm.reason || editForm.amount === 0) {
            setError('Please provide valid amount and reason');
            return;
        }

        try {
            await compOffService.updateTransaction(editForm.transactionId, {
                amount: editForm.amount,
                reason: editForm.reason
            });
            setIsEditModalOpen(false);
            fetchTransactions();
            // Also refresh balances as they might have changed
            fetchBalances();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update transaction');
        }
    };

    // Delete Transaction
    const handleDeleteSubmit = async () => {
        if (!transactionToDelete) return;

        try {
            await compOffService.deleteTransaction(transactionToDelete.id);
            setTransactionToDelete(null);
            fetchTransactions();
            // Also refresh balances as they might have changed
            fetchBalances();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete transaction');
        }
    };

    // Filter balances by search
    const filteredBalances = balances.filter(b =>
        b.analystName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && balances.length === 0) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }



    // ... existing handlers ...

    // Adjust Balance Handlers
    const openBalanceAdjustModal = (balance: CompOffBalance) => {
        setBalanceAdjustForm({
            analystId: balance.analystId,
            currentEarned: balance.earned,
            currentUsed: balance.used,
            targetEarned: balance.earned.toString(),
            targetUsed: balance.used.toString(),
            reason: ''
        });
        setIsBalanceAdjustModalOpen(true);
    };

    const handleBalanceAdjustSubmit = async () => {
        if (!balanceAdjustForm.reason) {
            setError('Please provide a reason for the adjustment');
            return;
        }

        try {
            await compOffService.updateBalance(balanceAdjustForm.analystId, {
                earnedUnits: parseFloat(balanceAdjustForm.targetEarned),
                usedUnits: parseFloat(balanceAdjustForm.targetUsed),
                reason: balanceAdjustForm.reason
            });
            setIsBalanceAdjustModalOpen(false);
            fetchBalances();
            // Refresh transactions if current tab is transactions
            if (activeTab === 'transactions') {
                fetchTransactions();
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update balance');
        }
    };

    const handleBalanceDeleteSubmit = async () => {
        if (!balanceToDelete) return;

        try {
            await compOffService.deleteBalance(balanceToDelete);
            setBalanceToDelete(null);
            fetchBalances();
            // Refresh transactions if current tab is transactions
            if (activeTab === 'transactions') {
                fetchTransactions();
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete balance');
        }
    };

    // ... existing render ...

    return (
        <div className="p-6 space-y-6">
            {/* ... existing header ... */}

            {/* Header Actions & Navigation */}
            <HeaderActionPortal>
                {isManager && (
                    <HeaderActionButton
                        icon={ArrowUp}
                        label="Credit CompOff"
                        onClick={() => setIsCreditModalOpen(true)}
                    />
                )}
            </HeaderActionPortal>

            <HeaderActionPortal targetId="app-header-right-actions">
                <SegmentedControl
                    value={activeTab}
                    onChange={(val) => setActiveTab(val as 'balances' | 'transactions')}
                    options={[
                        { value: 'balances', label: 'Balances', icon: <User className="w-4 h-4" /> },
                        { value: 'transactions', label: 'History', icon: <Eye className="w-4 h-4" /> }
                    ]}
                    className="shadow-sm border border-gray-200/50 dark:border-white/10"
                />
            </HeaderActionPortal>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/40 dark:bg-gray-800/40 p-4 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-white/10">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <ArrowUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Earned</p>
                            <p className="text-2xl font-bold text-foreground">{liability.totalEarned.toFixed(1)} days</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/40 dark:bg-gray-800/40 p-4 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-white/10">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <ArrowDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Used</p>
                            <p className="text-2xl font-bold text-foreground">{liability.totalUsed.toFixed(1)} days</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/40 dark:bg-gray-800/40 p-4 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-white/10">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Coins className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
                            <p className="text-2xl font-bold text-foreground">{liability.totalOutstanding.toFixed(1)} days</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end mb-4">
                {/* Filters */}
                <div className="flex items-center space-x-3">
                    {activeTab === 'balances' && (
                        <div className="relative">
                            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search analyst..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                    )}

                    {activeTab === 'transactions' && (
                        <SpringDropdown
                            value={dateRange}
                            onChange={(val) => setDateRange(val as any)}
                            options={[
                                { value: '90days', label: 'Last 90 Days' },
                                { value: '6months', label: 'Last 6 Months' },
                                { value: '12months', label: 'Last 12 Months' },
                            ]}
                        />
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md">
                    <div className="flex items-center space-x-2">
                        <Warning className="h-5 w-5 text-red-600 dark:text-red-400" />
                        <span className="text-red-800 dark:text-red-200">{error}</span>
                    </div>
                </div>
            )}

            {/* Balances Table */}
            {activeTab === 'balances' && (
                <div className="relative overflow-hidden rounded-xl border bg-white/40 dark:bg-gray-800/50 border-gray-300/50 dark:border-white/10 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/10 dark:bg-black/10">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Analyst
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Region
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Earned
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Used
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Available
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Last Activity
                                    </th>
                                    {isManager && (
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredBalances.length === 0 ? (
                                    <tr>
                                        <td colSpan={isManager ? 7 : 6} className="px-6 py-12 text-center text-gray-700 dark:text-gray-200">
                                            <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p>No compoff balances found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredBalances.map((balance) => (
                                        <tr key={balance.analystId} className="hover:bg-muted/50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-foreground">{balance.analystName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                                    {balance.regionName}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                                                    {balance.earned.toFixed(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                                                    {balance.used.toFixed(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className={`text-sm font-bold ${balance.available > 0
                                                    ? 'text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-500 dark:text-gray-400'
                                                    }`}>
                                                    {balance.available.toFixed(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    {balance.lastTransaction
                                                        ? moment(balance.lastTransaction).format('MMM DD, YYYY')
                                                        : 'No activity'
                                                    }
                                                </span>
                                            </td>
                                            {isManager && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => openBalanceAdjustModal(balance)}
                                                            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                            title="Adjust Balance"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setBalanceToDelete(balance.analystId)}
                                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                            title="Reset Balance History"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Transactions Table (Existing code) */}
            {activeTab === 'transactions' && (
                <div className="relative overflow-hidden rounded-xl border bg-white/40 dark:bg-gray-800/50 border-gray-300/50 dark:border-white/10 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/10 dark:bg-black/10">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Analyst
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Change
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Reason
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                        Balance
                                    </th>
                                    {isManager && (
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={isManager ? 6 : 5} className="px-6 py-12 text-center text-gray-700 dark:text-gray-200">
                                            <CalendarBlank className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p>No transactions found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((txn) => (
                                        <tr key={txn.id} className="hover:bg-muted/50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-foreground">
                                                    {moment(txn.createdAt).format('MMM DD, YYYY')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-foreground">{txn.analystName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${txn.amount > 0
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                    }`}>
                                                    {txn.amount > 0 ? (
                                                        <><ArrowUp className="w-3 h-3 mr-1" />+{txn.amount.toFixed(1)}</>
                                                    ) : (
                                                        <><ArrowDown className="w-3 h-3 mr-1" />{txn.amount.toFixed(1)}</>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                                    {txn.reason.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-sm font-medium text-foreground">
                                                    {txn.runningBalance.toFixed(1)}
                                                </span>
                                            </td>
                                            {isManager && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => openEditModal(txn)}
                                                            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setTransactionToDelete(txn)}
                                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Credit Modal */}
            {isCreditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    {/* ... existing credit modal ... */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Credit CompOff</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Analyst</label>
                                <select
                                    value={creditForm.analystId}
                                    onChange={(e) => setCreditForm({ ...creditForm, analystId: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground"
                                >
                                    <option value="">Select analyst...</option>
                                    {analysts.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Units (days)</label>
                                <input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={creditForm.units}
                                    onChange={(e) => setCreditForm({ ...creditForm, units: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                                <select
                                    value={creditForm.reason}
                                    onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground"
                                >
                                    <option value="">Select reason...</option>
                                    <option value="HOLIDAY_COVERAGE">Holiday Coverage</option>
                                    <option value="ROLLING_WEEK_EXCEEDED">Rolling Week Exceeded (6+ days)</option>
                                    <option value="SPECIAL_EVENT">Special Event Coverage</option>
                                    <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                            <Button variant="secondary" onClick={() => setIsCreditModalOpen(false)}>Cancel</Button>
                            <Button variant="primary" onClick={handleCreditSubmit}>Credit CompOff</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Balance Adjustment Modal */}
            {isBalanceAdjustModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-foreground">Adjust Balance</h3>
                            <button onClick={() => setIsBalanceAdjustModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Current Balance</p>
                                <div className="flex justify-between">
                                    <div className="text-center">
                                        <div className="text-xs text-green-600 dark:text-green-400 uppercase font-bold">Earned</div>
                                        <div className="font-mono text-lg">{balanceAdjustForm.currentEarned.toFixed(1)}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-red-600 dark:text-red-400 uppercase font-bold">Used</div>
                                        <div className="font-mono text-lg">{balanceAdjustForm.currentUsed.toFixed(1)}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold">Available</div>
                                        <div className="font-mono text-lg">{(balanceAdjustForm.currentEarned - balanceAdjustForm.currentUsed).toFixed(1)}</div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                Set the new balance values directly. A reconciliation transaction will be automatically created.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        New Earned Total
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={balanceAdjustForm.targetEarned}
                                        onChange={(e) => setBalanceAdjustForm({ ...balanceAdjustForm, targetEarned: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        New Used Total
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={balanceAdjustForm.targetUsed}
                                        onChange={(e) => setBalanceAdjustForm({ ...balanceAdjustForm, targetUsed: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Adjustment Reason
                                </label>
                                <textarea
                                    value={balanceAdjustForm.reason}
                                    onChange={(e) => setBalanceAdjustForm({ ...balanceAdjustForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground h-20 resize-none"
                                    placeholder="Explain why this manual adjustment is necessary..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <Button variant="secondary" onClick={() => setIsBalanceAdjustModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={handleBalanceAdjustSubmit}>
                                Apply Adjustment
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal (Transactions) - Existing */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-foreground">Edit Transaction</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={editForm.amount}
                                    onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                                <select
                                    value={editForm.reason}
                                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground"
                                >
                                    <option value="">Select reason...</option>
                                    <option value="HOLIDAY_COVERAGE">Holiday Coverage</option>
                                    <option value="ROLLING_WEEK_EXCEEDED">Rolling Week Exceeded (6+ days)</option>
                                    <option value="SPECIAL_EVENT">Special Event Coverage</option>
                                    <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                                    <option value="ABSENCE_REDEMPTION">Absence Redemption</option>
                                    <option value="CORRECTION">Correction</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                            <Button variant="primary" onClick={handleEditSubmit}>Save Changes</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Transaction Confirmation Modal - Existing */}
            {transactionToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl border border-red-200 dark:border-red-800">
                        <div className="flex items-center space-x-3 mb-4 text-red-600 dark:text-red-400">
                            <Warning className="w-6 h-6" />
                            <h3 className="text-lg font-semibold">Delete Transaction</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete this transaction? This will automatically update the analyst's balance. This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <Button variant="secondary" onClick={() => setTransactionToDelete(null)}>Cancel</Button>
                            <Button variant="primary" className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500" onClick={handleDeleteSubmit}>Delete</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Balance Deletion Confirmation Modal */}
            {balanceToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl border border-red-200 dark:border-red-800">
                        <div className="flex items-center space-x-3 mb-4 text-red-600 dark:text-red-400">
                            <Warning className="w-6 h-6" />
                            <h3 className="text-lg font-semibold">Reset Balance History</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            Are you sure you want to <strong>permanently delete</strong> the entire comp-off history for this analyst?
                        </p>
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3 rounded-lg">
                            ⚠️ This will delete all associated transactions and reset their balance to zero. This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <Button variant="secondary" onClick={() => setBalanceToDelete(null)}>Cancel</Button>
                            <Button variant="primary" className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500" onClick={handleBalanceDeleteSubmit}>Delete Everything</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompOffManagement;
