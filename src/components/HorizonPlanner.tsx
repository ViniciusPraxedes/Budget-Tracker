"use client";

// Import React core library and state/memo hooks
import React, { useState, useEffect, useMemo } from 'react';
// Import budget context consumer hook
import { useBudget } from '../context/BudgetContext';
// Import localization context consumer hook
import { useLocalization } from '../context/LocalizationContext';
// Import user authentication context hook
import { useAuth } from '../context/AuthContext';
// Import toast notification dispatcher hook
import { useToast } from '../context/ToastContext';
// Import Firestore database connection reference
import { db } from '../firebase';
// Import domain model interfaces
import { Category, Expense, MonthData } from '../types';
// Import component CSS module styles
import styles from './HorizonPlanner.module.css';

// Month names list for label formatting
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Month short abbreviations list
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Predefined category visual accent color swatches
const COLOR_PRESETS = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722', '#607D8B'];



// Generate sequence of month keys between start and end inclusive
function getHorizonSequence(startM: number, startY: number, endM: number, endY: number): { month: number, year: number, key: string, label: string }[] {
    // Result array
    const seq: { month: number, year: number, key: string, label: string }[] = [];
    // Current pointer month
    let curM = startM;
    // Current pointer year
    let curY = startY;
    // Maximum loop protection
    let count = 0;
    // Iterate until pointer surpasses target end date
    while (count < 36) {
        // Construct month key
        const key = `${curY}-${curM}`;
        // Construct readable label
        const label = `${MONTH_SHORT[curM]} ${curY}`;
        // Push current step
        seq.push({ month: curM, year: curY, key, label });
        // Check if destination reached
        if (curM === endM && curY === endY) break;
        // Increment month
        curM++;
        // Handle year wrap
        if (curM > 11) {
            // Reset month to zero
            curM = 0;
            // Increment year
            curY++;
        }
        // Increment guard counter
        count++;
    }
    // Return generated sequence
    return seq;
}

// Declare HorizonPlanner component
export default function HorizonPlanner() {
    // Retrieve budget variables from state hook
    const { income, categories, currentMonth, currentYear, changeMonth, monthlySavingsDeposit, monthlyBudget, totalSavings, savingsGoal } = useBudget();
    // Retrieve currency formatter from localization hook
    const { formatCurrency } = useLocalization();
    // Retrieve current user session from auth context
    const { user } = useAuth();
    // Retrieve toast notification handler
    const { addToast } = useToast();

    // Start month for the prediction range
    const [startMonth, setStartMonth] = useState<number>(currentMonth);
    // Start year for the prediction range
    const [startYear, setStartYear] = useState<number>(currentYear);
    // End month for the prediction range
    const [endMonth, setEndMonth] = useState<number>((currentMonth + 6) % 12);
    // End year for the prediction range
    const [endYear, setEndYear] = useState<number>(currentMonth + 6 >= 12 ? currentYear + 1 : currentYear);

    // State for all loaded real database months (read-only baseline reference)
    const [realMonths, setRealMonths] = useState<Record<string, MonthData>>({});
    // Local simulation storage key
    const simStorageKey = `budget_tracker_simulation_${user?.uid || 'guest'}`;
    // State for sandbox simulation months
    const [simulationMonths, setSimulationMonths] = useState<Record<string, MonthData>>({});
    // Selected month key in the in-widget browser inspector
    const [activeInspectorKey, setActiveInspectorKey] = useState<string>(`${currentYear}-${currentMonth}`);

    // Selected target month keys for the mass data tool
    const [selectedBatchKeys, setSelectedBatchKeys] = useState<string[]>([]);
    // Selected source base month key to copy data from
    const [copySourceKey, setCopySourceKey] = useState<string>(`${currentYear}-${currentMonth}`);
    // Checkbox state: whether to copy monthly parameters (income, savings, and budget limit)
    const [copyScopeIncomeSavings, setCopyScopeIncomeSavings] = useState<boolean>(true);
    // Checkbox state: whether to copy category structure and itemized expenses
    const [copyScopeCategories, setCopyScopeCategories] = useState<boolean>(true);

    // Single month quick add expense state
    const [singleExpName, setSingleExpName] = useState<string>('');
    // Single month quick add expense amount
    const [singleExpAmount, setSingleExpAmount] = useState<string>('');
    // Single month quick add category
    const [singleExpCatId, setSingleExpCatId] = useState<string>(categories[0]?.id || '');

    // State to toggle new category form visibility in inspected month
    const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
    // New category name input state
    const [newCatName, setNewCatName] = useState<string>('');
    // New category color input state
    const [newCatColor, setNewCatColor] = useState<string>('#4CAF50');
    // New category budget limit input state
    const [newCatBudget, setNewCatBudget] = useState<string>('');

    // ID of category currently in edit mode
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    // Edited category name input state
    const [editCatName, setEditCatName] = useState<string>('');
    // Edited category color input state
    const [editCatColor, setEditCatColor] = useState<string>('#4CAF50');
    // Edited category budget limit input state
    const [editCatBudget, setEditCatBudget] = useState<string>('');

    // Sequence of months in the configured horizon range
    const horizonSequence = useMemo(() => {
        // Return sequence array
        return getHorizonSequence(startMonth, startYear, endMonth, endYear);
    }, [startMonth, startYear, endMonth, endYear]);

    // Fetch existing real months data from mock DB or Firestore on mount as read-only baseline
    const reloadMonthsData = async () => {
        // Guard if no user session
        if (!user) return;
        // Test user environment
        if (user.uid === 'test-user') {
            // Attempt API call
            try {
                // Call mock DB API
                const res = await fetch('/api/mock-db?userId=test-user', { cache: 'no-store' });
                // Parse JSON
                const data = await res.json();
                // Store real months
                if (data && data.months) {
                    // Update real months state
                    setRealMonths(data.months);
                // End data check
                }
            // Catch errors
            } catch (err) {
                // Log error
                console.error("Error loading mock database months:", err);
            // End catch
            }
        // Firestore user environment
        } else {
            // Attempt Firestore query
            try {
                // Lazy load Firestore query methods
                const { collection, getDocs } = await import('firebase/firestore');
                // Months collection reference
                const monthsRef = collection(db, 'users', user.uid, 'months');
                // Fetch snapshot
                const snap = await getDocs(monthsRef);
                // Map documents
                const map: Record<string, MonthData> = {};
                // Iterate documents
                snap.forEach(d => {
                    // Assign data
                    map[d.id] = d.data() as MonthData;
                // End iteration
                });
                // Update real months state
                setRealMonths(map);
            // Catch error
            } catch (err) {
                // Log error
                console.error("Error loading Firestore months:", err);
            // End catch
            }
        // End environment check
        }
    // End reloadMonthsData definition
    };

    // Load initial real months data
    useEffect(() => {
        // Trigger load
        reloadMonthsData();
    // Re-run if user changes
    }, [user]);

    // Load simulation from localStorage on mount
    useEffect(() => {
        // Attempt localStorage read
        try {
            // Read stored JSON string
            const raw = localStorage.getItem(simStorageKey);
            // If string exists
            if (raw) {
                // Parse JSON payload
                const parsed = JSON.parse(raw);
                // Validate object structure
                if (parsed && typeof parsed === 'object') {
                    // Initialize simulation state
                    setSimulationMonths(parsed);
                // End object validation
                }
            // End raw check
            }
        // Catch parsing errors
        } catch (e) {
            // Log error
            console.error("Error reading simulation from localStorage:", e);
        // End catch
        }
    // Re-run if storage key changes
    }, [simStorageKey]);

    // Key representing the first month of the configured prediction range
    const firstMonthKey = `${startYear}-${startMonth}`;
    // Flag indicating whether active inspector month is the baseline starting month
    const isBaseMonth = activeInspectorKey === firstMonthKey;

    // Initialize default batch selection to all months in horizon excluding base month and copy source month
    useEffect(() => {
        // Default select only future simulation months that are not the copy source
        setSelectedBatchKeys(horizonSequence.filter(item => item.key !== firstMonthKey && item.key !== copySourceKey).map(item => item.key));
    }, [horizonSequence, firstMonthKey, copySourceKey]);

    // Helper to persist simulation updates to state and localStorage (isolated sandbox, never touches main database)
    const saveSimulationState = (updatedSim: Record<string, MonthData>) => {
        // Update functional state
        setSimulationMonths(prev => {
            // Merge existing simulation with updates
            const next = { ...prev, ...updatedSim };
            // Attempt persistence
            try {
                // Write serialized JSON to localStorage
                localStorage.setItem(simStorageKey, JSON.stringify(next));
            // Catch storage quotas or errors
            } catch (err) {
                // Log error
                console.error("Error saving simulation to localStorage:", err);
            // End catch
            }
            // Return next state
            return next;
        // End functional state updater
        });
    // End saveSimulationState definition
    };

    // Loaded real month record for the first month of the range if available
    const firstMonthData: MonthData | undefined = realMonths[firstMonthKey];

    // Reference baseline values derived strictly from the first month of the range
    const rangeBaseline = useMemo(() => {
        // If start month matches active month in context, prioritize current live data
        if (startMonth === currentMonth && startYear === currentYear) {
            // Return live context baseline
            return {
                // Live context income
                income,
                // Live context savings deposit
                monthlySavingsDeposit,
                // Live context budget
                monthlyBudget,
                // Live context categories with all expenses
                categories,
            // End live context baseline
            };
        // End live month check
        }
        // If the first month of the range exists in real database records
        if (firstMonthData) {
            // Return baseline constructed from real first month dataset
            return {
                // First month income
                income: firstMonthData.income ?? income,
                // First month savings deposit
                monthlySavingsDeposit: firstMonthData.monthlySavingsDeposit ?? monthlySavingsDeposit,
                // First month budget
                monthlyBudget: firstMonthData.monthlyBudget ?? monthlyBudget,
                // First month categories with all expenses
                categories: firstMonthData.categories ?? categories,
            // End of first month baseline object
            };
        // End of first month check
        }
        // Fallback to active month context baseline
        return {
            // Context income
            income,
            // Context savings deposit
            monthlySavingsDeposit,
            // Context budget
            monthlyBudget,
            // Context categories
            categories,
        // End of fallback baseline object
        };
    // Re-evaluate when first month data or active context updates
    }, [firstMonthData, startMonth, startYear, currentMonth, currentYear, income, monthlySavingsDeposit, monthlyBudget, categories]);

    // Helper to retrieve simulated month data, defaulting to the exact data of the first month of the range
    const getSimulatedMonthData = (key: string, itemMonth: number, itemYear: number): MonthData => {
        // Check if month already has customized simulation data
        if (simulationMonths[key]) {
            // Return customized simulation month data
            return simulationMonths[key];
        // End of simulation check
        }
        // If this is the start month of the range, return the baseline
        if (key === firstMonthKey) {
            // Return base month object
            return {
                // Month index
                month: itemMonth,
                // Year
                year: itemYear,
                // Income
                income: rangeBaseline.income,
                // Savings deposit
                monthlySavingsDeposit: rangeBaseline.monthlySavingsDeposit,
                // Budget
                monthlyBudget: rangeBaseline.monthlyBudget,
                // Categories
                categories: rangeBaseline.categories || [],
            // End of start month object
            };
        // End of start month check
        }
        // For all other months in the prediction range, return exact clone of first month
        return {
            // Target month
            month: itemMonth,
            // Target year
            year: itemYear,
            // Income equal to first month
            income: rangeBaseline.income,
            // Monthly savings deposit equal to first month
            monthlySavingsDeposit: rangeBaseline.monthlySavingsDeposit,
            // Monthly budget equal to first month
            monthlyBudget: rangeBaseline.monthlyBudget,
            // Categories cloned from first month with all expenses included
            categories: (rangeBaseline.categories || []).map(cat => ({
                // Category ID
                id: cat.id,
                // Name
                name: cat.name,
                // Color
                color: cat.color,
                // Order
                order: cat.order,
                // Budget ceiling
                budget: cat.budget,
                // Clone all expenses from first month
                expenses: (cat.expenses || []).map(exp => ({
                    // Unique expense ID
                    id: Math.random().toString(36).substr(2, 9),
                    // Expense name
                    name: exp.name,
                    // Amount
                    amount: exp.amount,
                    // Payment day
                    paymentDay: exp.paymentDay,
                    // Recurring flag
                    isRecurring: exp.isRecurring,
                    // Installment flag
                    isInstallment: exp.isInstallment,
                    // Total principal
                    totalAmount: exp.totalAmount,
                    // Total installments
                    totalInstallments: exp.totalInstallments,
                    // Remaining installments
                    remainingInstallments: exp.remainingInstallments,
                    // Interest rate
                    annualInterestRate: exp.annualInterestRate,
                    // Installment start month
                    installmentStartMonth: exp.installmentStartMonth,
                // End of expense mapping
                })),
            // End of category mapping
            })),
        // End of month data return
        };
    // End of getSimulatedMonthData definition
    };

    // Handler to seed / reset prediction simulation across the range with first month data
    const handleInitializeSimulation = () => {
        // Accumulator dictionary for fresh simulation months
        const batchPayload: Record<string, MonthData> = {};
        // Loop over each month in the selected horizon sequence
        for (const item of horizonSequence) {
            // Check if first month of range
            if (item.key === firstMonthKey) {
                // Assign first month baseline
                batchPayload[item.key] = { ...rangeBaseline, month: item.month, year: item.year };
            // End of first month check
            } else {
                // Clone exact first month data for all subsequent months
                batchPayload[item.key] = {
                    // Month
                    month: item.month,
                    // Year
                    year: item.year,
                    // Income
                    income: rangeBaseline.income,
                    // Savings deposit
                    monthlySavingsDeposit: rangeBaseline.monthlySavingsDeposit,
                    // Budget
                    monthlyBudget: rangeBaseline.monthlyBudget,
                    // Categories
                    categories: (rangeBaseline.categories || []).map(cat => ({
                        // Category ID
                        id: cat.id,
                        // Name
                        name: cat.name,
                        // Color
                        color: cat.color,
                        // Order
                        order: cat.order,
                        // Budget
                        budget: cat.budget,
                        // Expenses
                        expenses: (cat.expenses || []).map(exp => ({
                            // ID
                            id: Math.random().toString(36).substr(2, 9),
                            // Name
                            name: exp.name,
                            // Amount
                            amount: exp.amount,
                            // Day
                            paymentDay: exp.paymentDay,
                            // Recurring
                            isRecurring: exp.isRecurring,
                            // Installment
                            isInstallment: exp.isInstallment,
                            // Total
                            totalAmount: exp.totalAmount,
                            // Installments
                            totalInstallments: exp.totalInstallments,
                            // Remaining
                            remainingInstallments: exp.remainingInstallments,
                            // APR
                            annualInterestRate: exp.annualInterestRate,
                            // Start month
                            installmentStartMonth: exp.installmentStartMonth,
                        // End expense
                        })),
                    // End category
                    })),
                // End cloned month
                };
            // End of subsequent months branch
            }
        // End of sequence loop
        }
        // Update simulation state and localStorage
        saveSimulationState(batchPayload);
        // Show success toast
        addToast(`Simulation initialized with ${MONTH_SHORT[startMonth]} ${startYear} data!`, 'success');
    // End of handleInitializeSimulation definition
    };

    // Find active inspected month item in sequence
    const activeMonthItem = horizonSequence.find(item => item.key === activeInspectorKey);
    // Currently inspected month data, resolving to effective simulated data
    const activeMonthData: MonthData = useMemo(() => {
        // Target month index
        const itemMonth = activeMonthItem ? activeMonthItem.month : startMonth;
        // Target year
        const itemYear = activeMonthItem ? activeMonthItem.year : startYear;
        // Return resolved simulation month data
        return getSimulatedMonthData(activeInspectorKey, itemMonth, itemYear);
    // Re-evaluate when inspector key or data records change
    }, [activeInspectorKey, activeMonthItem, simulationMonths, rangeBaseline, firstMonthKey]);

    // Compute metrics for inspected month
    const inspectedMetrics = useMemo(() => {
        // Total expenses across all categories
        const expensesSum = (activeMonthData.categories || []).reduce((sum, cat) => {
            // Sum expenses in category
            return sum + (cat.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
        // End of category reduction
        }, 0);
        // Net savings balance
        const net = (activeMonthData.income || 0) - expensesSum;
        // Calculate net free cash after spending and savings deposit
        const freeCash = net - (activeMonthData.monthlySavingsDeposit || 0);
        // Calculate savings rate percentage of income
        const sRate = (activeMonthData.income || 0) > 0 ? Math.round(((activeMonthData.monthlySavingsDeposit || 0) / activeMonthData.income) * 100) : 0;
        // Calculate budget consumption percentage
        const bUsage = (activeMonthData.monthlyBudget || 0) > 0 ? Math.round((expensesSum / activeMonthData.monthlyBudget) * 100) : 0;
        // Calculate remaining budget headroom
        const bRemaining = (activeMonthData.monthlyBudget || 0) - expensesSum;
        // Find index of currently inspected month in the horizon sequence
        const inspectedIndex = horizonSequence.findIndex(item => item.key === activeInspectorKey);
        // Accumulated simulated monthly deposits up to this inspected month
        let cumulativeDeposits = 0;
        // Check if inspected month was found in sequence and is beyond starting baseline month
        if (inspectedIndex > 0) {
            // Loop through future months from index 1 up to inspected month
            for (let i = 1; i <= inspectedIndex; i++) {
                // Get sequence month item
                const seqItem = horizonSequence[i];
                // Get month simulation data
                const sData = getSimulatedMonthData(seqItem.key, seqItem.month, seqItem.year);
                // Accumulate monthly savings deposit
                cumulativeDeposits += (sData.monthlySavingsDeposit || 0);
            // End sequence accumulation loop
            }
        // End index check
        }
        // Calculate projected total savings in bank
        const projectedTotalSavings = (totalSavings || 0) + cumulativeDeposits;
        // Calculate progress percentage towards savings goal
        const goalPercent = (savingsGoal || 0) > 0 ? Math.round((projectedTotalSavings / (savingsGoal || 1)) * 100) : 0;
        // Return metrics
        return {
            // Month income
            income: activeMonthData.income || 0,
            // Total expenses
            totalExpenses: Math.round(expensesSum * 100) / 100,
            // Net savings
            netSavings: Math.round(net * 100) / 100,
            // Net free cash
            netFreeCash: Math.round(freeCash * 100) / 100,
            // Monthly savings deposit
            savingsDeposit: activeMonthData.monthlySavingsDeposit || 0,
            // Monthly budget limit
            budget: activeMonthData.monthlyBudget || 0,
            // Savings rate percentage
            savingsRate: sRate,
            // Budget consumption percentage
            budgetUsagePercent: bUsage,
            // Remaining budget
            budgetRemaining: Math.round(bRemaining * 100) / 100,
            // Projected cumulative total savings
            projectedTotalSavings,
            // Cumulative deposits in horizon
            cumulativeDeposits,
            // Savings goal percentage
            savingsGoalPercentage: goalPercent,
        // End of metrics object
        };
    // Re-evaluate when active month data, sequence, or baseline changes
    }, [activeMonthData, horizonSequence, activeInspectorKey, totalSavings, savingsGoal, simulationMonths, rangeBaseline, firstMonthKey]);

    // Precompute projected cumulative total savings for each month in horizon sequence
    const timelineSavingsMap = useMemo(() => {
        // Savings accumulator map
        const map: Record<string, number> = {};
        // Running savings total starting at current savings
        let runningTotal = totalSavings || 0;
        // Iterate horizon sequence
        horizonSequence.forEach((item, index) => {
            // Retrieve month simulation data
            const mData = getSimulatedMonthData(item.key, item.month, item.year);
            // If beyond base starting month, add monthly savings deposit
            if (index > 0) {
                // Increment running total by monthly savings deposit
                runningTotal += (mData.monthlySavingsDeposit || 0);
            // End index check
            }
            // Store projected savings for this month
            map[item.key] = runningTotal;
        // End iteration
        });
        // Return map
        return map;
    // Recompute when sequence, baseline, total savings, or simulations change
    }, [horizonSequence, totalSavings, simulationMonths, rangeBaseline, firstMonthKey]);


    // Handler to update an inspected month's core metric (income, savings deposit, or budget)
    const handleUpdateSingleMonthField = (field: 'income' | 'monthlySavingsDeposit' | 'monthlyBudget', valueStr: string) => {
        // Return if active month data not loaded or base month
        if (!activeMonthData || isBaseMonth) return;
        // Parse float value
        const val = parseFloat(valueStr) || 0;
        // Updated month object
        const updatedMonth: MonthData = {
            // Spread existing
            ...activeMonthData,
            // Override field
            [field]: val,
        // End of updated object
        };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
    // End of handleUpdateSingleMonthField definition
    };

    // Handler to update an expense amount in the currently inspected month
    const handleUpdateSingleExpenseAmount = (categoryId: string, expenseId: string, amountStr: string) => {
        // Return if active month data not loaded or base month
        if (!activeMonthData || isBaseMonth) return;
        // Parse numeric amount
        const newAmt = parseFloat(amountStr) || 0;
        // Update categories array
        const newCats = activeMonthData.categories.map(cat => {
            // Check matching category
            if (cat.id === categoryId) {
                // Map expenses
                return {
                    // Spread category
                    ...cat,
                    // Map target expense
                    expenses: cat.expenses.map(e => e.id === expenseId ? { ...e, amount: newAmt } : e),
                // End of category object
                };
            // End of matching check
            }
            // Return unchanged category
            return cat;
        // End of categories mapping
        });
        // Updated month
        const updatedMonth: MonthData = { ...activeMonthData, categories: newCats };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
    // End of handleUpdateSingleExpenseAmount definition
    };

    // Handler to remove an expense from the currently inspected month
    const handleDeleteSingleExpense = (categoryId: string, expenseId: string) => {
        // Return if active month data not loaded or base month
        if (!activeMonthData || isBaseMonth) return;
        // Update categories array filtering out target expense
        const newCats = activeMonthData.categories.map(cat => {
            // Check matching category
            if (cat.id === categoryId) {
                // Filter expenses
                return {
                    // Spread category
                    ...cat,
                    // Filter expenses list
                    expenses: cat.expenses.filter(e => e.id !== expenseId),
                // End of category object
                };
            // End of match
            }
            // Return unchanged category
            return cat;
        // End of categories map
        });
        // Updated month
        const updatedMonth: MonthData = { ...activeMonthData, categories: newCats };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
    // End of handleDeleteSingleExpense definition
    };

    // Handler to add a new expense to the currently inspected month
    const handleAddSingleExpense = () => {
        // Return if active month data not loaded, name empty, or base month
        if (!activeMonthData || !singleExpName.trim() || isBaseMonth) return;
        // Parse amount
        const amt = parseFloat(singleExpAmount);
        // Guard positive amount
        if (isNaN(amt) || amt <= 0) return;
        // Fallback category ID
        const targetCatId = singleExpCatId || activeMonthData.categories[0]?.id;
        // Create new expense object
        const newExp: Expense = {
            // Unique ID
            id: Math.random().toString(36).substr(2, 9),
            // Name
            name: singleExpName.trim(),
            // Amount
            amount: amt,
            // Payment day
            paymentDay: 1,
            // Recurring flag
            isRecurring: true,
        // End of expense definition
        };
        // Update categories array appending new expense
        const newCats = activeMonthData.categories.map(cat => {
            // Check matching category
            if (cat.id === targetCatId) {
                // Return category with new expense appended
                return { ...cat, expenses: [...cat.expenses, newExp] };
            // End of match
            }
            // Return unchanged category
            return cat;
        // End of map
        });
        // Updated month
        const updatedMonth: MonthData = { ...activeMonthData, categories: newCats };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Reset name
        setSingleExpName('');
        // Reset amount
        setSingleExpAmount('');
    // End of handleAddSingleExpense definition
    };

    // Handler to add a new category to the currently inspected month
    const handleAddSingleCategory = () => {
        // Return if active month data not loaded, name empty, or base month
        if (!activeMonthData || !newCatName.trim() || isBaseMonth) return;
        // Parse optional budget
        const budgetNum = parseFloat(newCatBudget);
        // Create new category object
        const newCategory: Category = {
            // Unique category ID
            id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            // Category name
            name: newCatName.trim(),
            // Category color
            color: newCatColor || '#4CAF50',
            // Optional budget limit
            budget: !isNaN(budgetNum) && budgetNum > 0 ? budgetNum : undefined,
            // Empty expenses array
            expenses: [],
        // End of category object
        };
        // Updated month with appended category
        const updatedMonth: MonthData = {
            // Spread existing
            ...activeMonthData,
            // Append category
            categories: [...activeMonthData.categories, newCategory],
        // End of updated month
        };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Reset name
        setNewCatName('');
        // Reset budget
        setNewCatBudget('');
        // Close form
        setIsAddingCategory(false);
        // Show success notification
        addToast(`Category "${newCategory.name}" added`, 'success');
    // End of handleAddSingleCategory definition
    };

    // Handler to initiate editing of a category
    const handleStartEditCategory = (cat: Category) => {
        // Set target category ID
        setEditingCatId(cat.id);
        // Pre-fill name
        setEditCatName(cat.name);
        // Pre-fill color
        setEditCatColor(cat.color || '#4CAF50');
        // Pre-fill budget
        setEditCatBudget(cat.budget ? cat.budget.toString() : '');
    // End of handleStartEditCategory definition
    };

    // Handler to save edits to an existing category
    const handleSaveEditCategory = (categoryId: string) => {
        // Return if active month data not loaded, name empty, or base month
        if (!activeMonthData || !editCatName.trim() || isBaseMonth) return;
        // Parse optional budget
        const budgetNum = parseFloat(editCatBudget);
        // Map categories array
        const newCats = activeMonthData.categories.map(cat => {
            // Check matching category
            if (cat.id === categoryId) {
                // Return updated category
                return {
                    // Spread existing
                    ...cat,
                    // Updated name
                    name: editCatName.trim(),
                    // Updated color
                    color: editCatColor || cat.color,
                    // Updated budget
                    budget: !isNaN(budgetNum) && budgetNum > 0 ? budgetNum : undefined,
                // End of updated category
                };
            // End of matching check
            }
            // Return unchanged category
            return cat;
        // End of categories mapping
        });
        // Updated month
        const updatedMonth: MonthData = { ...activeMonthData, categories: newCats };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Close edit mode
        setEditingCatId(null);
        // Show success notification
        addToast('Category updated', 'success');
    // End of handleSaveEditCategory definition
    };

    // Handler to remove a category from the currently inspected month
    const handleDeleteSingleCategory = (categoryId: string) => {
        // Return if active month data not loaded or base month
        if (!activeMonthData || isBaseMonth) return;
        // Filter out category
        const newCats = activeMonthData.categories.filter(cat => cat.id !== categoryId);
        // Updated month
        const updatedMonth: MonthData = { ...activeMonthData, categories: newCats };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Show notification
        addToast('Category removed', 'info');
    // End of handleDeleteSingleCategory definition
    };

    // Toggle a target month in the copy selection list
    const toggleBatchKey = (key: string) => {
        // Prevent selecting the base month or the source month
        if (key === firstMonthKey || key === copySourceKey) return;
        // Flip inclusion
        setSelectedBatchKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    // End toggleBatchKey definition
    };

    // Select all eligible target months excluding base month and source month
    const handleSelectAllBatch = () => {
        // Assign all eligible future keys
        setSelectedBatchKeys(horizonSequence.filter(item => item.key !== firstMonthKey && item.key !== copySourceKey).map(item => item.key));
    // End handleSelectAllBatch definition
    };

    // Clear all selected target months
    const handleDeselectAllBatch = () => {
        // Clear list
        setSelectedBatchKeys([]);
    // End handleDeselectAllBatch definition
    };

    // Execute copying data from selected source month to all selected target months
    const handleExecuteCopyData = () => {
        // Guard at least one target month selected
        if (selectedBatchKeys.length === 0) {
            // Show error notification
            addToast("Please select at least one target month.", "error");
            // Exit early
            return;
        // End target count check
        }
        // Guard at least one copy scope selected
        if (!copyScopeIncomeSavings && !copyScopeCategories) {
            // Show error notification
            addToast("Please select at least one data type to copy.", "error");
            // Exit early
            return;
        // End scope check
        }
        // Find source sequence item
        const sourceItem = horizonSequence.find(item => item.key === copySourceKey);
        // Source month index
        const sMonth = sourceItem ? sourceItem.month : startMonth;
        // Source year
        const sYear = sourceItem ? sourceItem.year : startYear;
        // Retrieve source month simulation data
        const sourceData = getSimulatedMonthData(copySourceKey, sMonth, sYear);
        // Guard valid source data
        if (!sourceData) {
            // Show error notification
            addToast("Unable to load base month data.", "error");
            // Exit early
            return;
        // End source check
        }
        // Batch payload accumulator
        const batchPayload: Record<string, MonthData> = {};
        // Iterate through all selected target month keys
        for (const targetKey of selectedBatchKeys) {
            // Skip base starting month or source month
            if (targetKey === firstMonthKey || targetKey === copySourceKey) continue;
            // Find target sequence item
            const targetItem = horizonSequence.find(seq => seq.key === targetKey);
            // Target month index
            const tMonth = targetItem ? targetItem.month : startMonth;
            // Target year
            const tYear = targetItem ? targetItem.year : startYear;
            // Retrieve target month current data
            const existingTarget = getSimulatedMonthData(targetKey, tMonth, tYear);
            // Prepare categories array
            let finalCategories = existingTarget.categories;
            // If copying categories structure and expenses
            if (copyScopeCategories) {
                // Deep clone categories with fresh IDs for itemized expenses
                finalCategories = (sourceData.categories || []).map(cat => ({
                    // Category ID
                    id: cat.id,
                    // Category name
                    name: cat.name,
                    // Category color
                    color: cat.color,
                    // Category order
                    order: cat.order,
                    // Category budget
                    budget: cat.budget,
                    // Clone expenses with fresh random unique IDs
                    expenses: (cat.expenses || []).map(exp => ({
                        // Spread expense attributes
                        ...exp,
                        // Assign fresh random unique ID
                        id: Math.random().toString(36).substr(2, 9),
                    // End expense mapping
                    })),
                // End category mapping
                }));
            // End category scope check
            }
            // Assemble updated target month object
            batchPayload[targetKey] = {
                // Spread existing target
                ...existingTarget,
                // Ensure target month index preserved
                month: tMonth,
                // Ensure target year preserved
                year: tYear,
                // Assign copied or existing income
                income: copyScopeIncomeSavings ? (sourceData.income || 0) : existingTarget.income,
                // Assign copied or existing monthly savings deposit
                monthlySavingsDeposit: copyScopeIncomeSavings ? (sourceData.monthlySavingsDeposit || 0) : existingTarget.monthlySavingsDeposit,
                // Assign copied or existing monthly budget limit
                monthlyBudget: copyScopeIncomeSavings ? (sourceData.monthlyBudget || 0) : existingTarget.monthlyBudget,
                // Assign copied or existing categories
                categories: finalCategories,
            // End target month payload
            };
        // End target keys iteration
        }
        // Save batch updates to simulation state and localStorage
        saveSimulationState(batchPayload);
        // Source month label
        const sourceLabel = sourceItem ? sourceItem.label : copySourceKey;
        // Show success notification
        addToast(`Copied ${sourceLabel} data to ${selectedBatchKeys.length} target months!`, 'success');
    // End handleExecuteCopyData definition
    };

    // Render component JSX markup
    return (
        // Container wrapper
        <div className={styles.container}>
            {/* Range Generator Setup Card */}
            <div className={styles.panelCard}>
                {/* Header row */}
                <div className={styles.cardHeader}>
                    {/* Title */}
                    <div className={styles.cardTitle}>
                        {/* Calendar icon */}
                        <span>🔮</span>
                        {/* Text */}
                        <span>Multi-Month Horizon Planner (Simulation Sandbox)</span>
                    </div>
                    {/* Action button to initialize/reset simulation */}
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleInitializeSimulation}
                    >
                        {/* Label */}
                        <span>Reset Range to Match {MONTH_SHORT[startMonth]} {startYear}</span>
                    </button>
                </div>

                {/* Form grid to configure range */}
                <div className={styles.formGrid}>
                    {/* Start month */}
                    <div className={styles.formGroup}>
                        {/* Label */}
                        <label className={styles.label}>Start Month</label>
                        {/* Select */}
                        <select
                            className={styles.select}
                            value={startMonth}
                            onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
                        >
                            {/* Map month names */}
                            {MONTH_NAMES.map((name, i) => (
                                <option key={i} value={i}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Start year */}
                    <div className={styles.formGroup}>
                        {/* Label */}
                        <label className={styles.label}>Start Year</label>
                        {/* Input */}
                        <input
                            type="number"
                            className={styles.input}
                            value={startYear}
                            onChange={(e) => setStartYear(parseInt(e.target.value, 10) || currentYear)}
                        />
                    </div>

                    {/* End month */}
                    <div className={styles.formGroup}>
                        {/* Label */}
                        <label className={styles.label}>End Month</label>
                        {/* Select */}
                        <select
                            className={styles.select}
                            value={endMonth}
                            onChange={(e) => setEndMonth(parseInt(e.target.value, 10))}
                        >
                            {/* Map month names */}
                            {MONTH_NAMES.map((name, i) => (
                                <option key={i} value={i}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* End year */}
                    <div className={styles.formGroup}>
                        {/* Label */}
                        <label className={styles.label}>End Year</label>
                        {/* Input */}
                        <input
                            type="number"
                            className={styles.input}
                            value={endYear}
                            onChange={(e) => setEndYear(parseInt(e.target.value, 10) || currentYear)}
                        />
                    </div>
                </div>
            </div>

            {/* In-Widget Simplified Month Browser Strip */}
            <div className={styles.panelCard}>
                {/* Header row */}
                <div className={styles.cardHeader}>
                    {/* Title */}
                    <div className={styles.cardTitle}>
                        {/* Eye icon */}
                        <span>📅</span>
                        {/* Text */}
                        <span>Horizon Timeline ({horizonSequence.length} Months)</span>
                    </div>
                    {/* Instruction text */}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Click any month to inspect and edit everything below.
                    </span>
                </div>

                {/* Horizontal scrollable pills strip */}
                <div className={styles.monthStrip}>
                    {/* Map horizon sequence */}
                    {horizonSequence.map(item => {
                        // Retrieve simulated month data
                        const mData = getSimulatedMonthData(item.key, item.month, item.year);
                        // Calculate total expenses
                        const expTotal = (mData.categories || []).reduce((sum, c) => sum + (c.expenses || []).reduce((s, e) => s + (e.amount || 0), 0), 0);
                        // Calculate net
                        const net = (mData.income || 0) - expTotal;
                        // Active state
                        const isActive = activeInspectorKey === item.key;

                        // Return pill markup
                        return (
                            <div
                                key={item.key}
                                className={`${styles.monthPill} ${isActive ? styles.monthPillActive : ''}`}
                                onClick={() => setActiveInspectorKey(item.key)}
                            >
                                {/* Month label */}
                                <div className={styles.monthPillTitle}>{item.label}</div>
                                {/* Income summary */}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    In: {formatCurrency(mData?.income || 0)}
                                </div>
                                {/* Outflow summary */}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    Out: {formatCurrency(expTotal)}
                                </div>
                                {/* Projected total savings */}
                                <div style={{ fontSize: '0.75rem', color: '#b388ff', fontWeight: 600 }}>
                                    Savings: {formatCurrency(timelineSavingsMap[item.key] ?? (totalSavings || 0))}
                                </div>
                                {/* Net savings badge */}
                                <div className={`${styles.pillSavingsBadge} ${net >= 0 ? styles.positiveValue : styles.negativeValue}`}>
                                    Net: {formatCurrency(net)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Single Month In-Widget Detailed Inspector & Editor */}
            {activeMonthData && (
                <div className={styles.panelCard}>
                    {/* Header */}
                    <div className={styles.cardHeader}>
                        {/* Title */}
                        <div className={styles.cardTitle}>
                            {/* Pencil icon */}
                            <span>✏️</span>
                            {/* Text with month label */}
                            <span>
                                Inspecting & Editing: {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}
                            </span>
                        </div>
                        {/* Simulation indicator or read-only baseline badge */}
                        <span
                            style={{
                                fontSize: '0.78rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '4px',
                                background: isBaseMonth ? 'rgba(255, 171, 0, 0.15)' : 'rgba(124, 77, 255, 0.15)',
                                color: isBaseMonth ? '#FFAB00' : '#b388ff',
                                border: isBaseMonth ? '1px solid rgba(255, 171, 0, 0.3)' : '1px solid rgba(124, 77, 255, 0.3)'
                            }}
                        >
                            {isBaseMonth ? '📌 Starting Month (Read-Only Baseline)' : '🧪 Simulation Mode'}
                        </span>
                    </div>

                    {/* Read-only base month notification banner */}
                    {isBaseMonth && (
                        <div
                            style={{
                                padding: '0.6rem 0.85rem',
                                marginBottom: '1rem',
                                borderRadius: '6px',
                                background: 'rgba(255, 171, 0, 0.1)',
                                border: '1px solid rgba(255, 171, 0, 0.25)',
                                color: '#FFD54F',
                                fontSize: '0.82rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {/* Banner icon */}
                            <span>ℹ️</span>
                            {/* Banner message text */}
                            <span>
                                This is the starting month of your planning horizon. It serves as your fixed baseline and cannot be modified within the simulation.
                            </span>
                        </div>
                    )}

                    {/* Financial Statistics Overview Grid */}
                    <div className={styles.statsGrid}>
                        {/* Stat Card 1: Money Spent */}
                        <div className={styles.statCard}>
                            {/* Card Header */}
                            <div className={styles.statHeader}>
                                {/* Header label */}
                                <span>💳 Money Spent</span>
                                {/* Check if budget limit is configured */}
                                {activeMonthData.monthlyBudget && activeMonthData.monthlyBudget > 0 ? (
                                    <span
                                        className={styles.statBadge}
                                        style={{
                                            background: inspectedMetrics.budgetUsagePercent <= 100 ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 82, 82, 0.15)',
                                            color: inspectedMetrics.budgetUsagePercent <= 100 ? '#00E676' : '#FF5252'
                                        }}
                                    >
                                        {/* Budget percentage text */}
                                        {inspectedMetrics.budgetUsagePercent}% of budget
                                    </span>
                                ) : null}
                            </div>
                            {/* Value display */}
                            <div className={styles.statValue}>
                                {formatCurrency(inspectedMetrics.totalExpenses)}
                            </div>
                            {/* Subtext description */}
                            <div className={styles.statSubtext}>
                                {/* Check if budget is active */}
                                {activeMonthData.monthlyBudget && activeMonthData.monthlyBudget > 0 ? (
                                    <span>
                                        {/* Remaining or over budget text */}
                                        {formatCurrency(Math.abs(inspectedMetrics.budgetRemaining))} {inspectedMetrics.budgetRemaining >= 0 ? 'remaining of' : 'over'} {formatCurrency(activeMonthData.monthlyBudget)}
                                    </span>
                                ) : (
                                    <span>
                                        {/* Total expenses label */}
                                        Total expenses across categories
                                    </span>
                                )}
                            </div>
                            {/* Progress bar when budget is configured */}
                            {activeMonthData.monthlyBudget && activeMonthData.monthlyBudget > 0 ? (
                                <div className={styles.statProgressBar}>
                                    <div
                                        className={styles.statProgressFill}
                                        style={{
                                            width: `${Math.min(inspectedMetrics.budgetUsagePercent, 100)}%`,
                                            background: inspectedMetrics.budgetUsagePercent <= 100 ? '#2196F3' : '#FF5252'
                                        }}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Stat Card 2: Monthly Savings */}
                        <div className={styles.statCard}>
                            {/* Card Header */}
                            <div className={styles.statHeader}>
                                {/* Header label */}
                                <span>📥 Monthly Savings</span>
                                {/* Savings rate badge */}
                                <span
                                    className={styles.statBadge}
                                    style={{
                                        background: 'rgba(33, 150, 243, 0.15)',
                                        color: '#64B5F6'
                                    }}
                                >
                                    {/* Savings rate percentage */}
                                    {inspectedMetrics.savingsRate}% saved
                                </span>
                            </div>
                            {/* Value display */}
                            <div className={styles.statValue}>
                                {formatCurrency(inspectedMetrics.savingsDeposit)}
                            </div>
                            {/* Subtext description */}
                            <div className={styles.statSubtext}>
                                <span>
                                    {/* Allocation description */}
                                    Allocated from {formatCurrency(activeMonthData.income || 0)} income
                                </span>
                            </div>
                        </div>

                        {/* Stat Card 3: Projected Total Savings */}
                        <div className={styles.statCard}>
                            {/* Card Header */}
                            <div className={styles.statHeader}>
                                {/* Header label */}
                                <span>🏦 Total Savings</span>
                                {/* Check if target savings goal is set */}
                                {savingsGoal && savingsGoal > 0 ? (
                                    <span
                                        className={styles.statBadge}
                                        style={{
                                            background: inspectedMetrics.savingsGoalPercentage >= 100 ? 'rgba(0, 230, 118, 0.15)' : 'rgba(124, 77, 255, 0.15)',
                                            color: inspectedMetrics.savingsGoalPercentage >= 100 ? '#00E676' : '#b388ff'
                                        }}
                                    >
                                        {/* Savings goal progress percentage text */}
                                        {inspectedMetrics.savingsGoalPercentage}% goal
                                    </span>
                                ) : null}
                            </div>
                            {/* Value display */}
                            <div className={styles.statValue}>
                                {formatCurrency(inspectedMetrics.projectedTotalSavings)}
                            </div>
                            {/* Subtext description */}
                            <div className={styles.statSubtext}>
                                {/* Check if savings goal exists */}
                                {savingsGoal && savingsGoal > 0 ? (
                                    <span>
                                        {/* Goal amount label */}
                                        Goal: {formatCurrency(savingsGoal)}
                                    </span>
                                ) : inspectedMetrics.cumulativeDeposits > 0 ? (
                                    <span>
                                        {/* Accumulated deposits label */}
                                        +{formatCurrency(inspectedMetrics.cumulativeDeposits)} accumulated
                                    </span>
                                ) : (
                                    <span>
                                        {/* Baseline balance label */}
                                        Starting baseline balance
                                    </span>
                                )}
                            </div>
                            {/* Goal progress bar */}
                            {savingsGoal && savingsGoal > 0 ? (
                                <div className={styles.statProgressBar}>
                                    <div
                                        className={styles.statProgressFill}
                                        style={{
                                            width: `${Math.min(inspectedMetrics.savingsGoalPercentage, 100)}%`,
                                            background: inspectedMetrics.savingsGoalPercentage >= 100 ? '#00E676' : '#b388ff'
                                        }}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Stat Card 4: Net Free Cash */}
                        <div className={styles.statCard}>
                            {/* Card Header */}
                            <div className={styles.statHeader}>
                                {/* Header label */}
                                <span>💵 Net Free Cash</span>
                                {/* Status badge */}
                                <span
                                    className={styles.statBadge}
                                    style={{
                                        background: inspectedMetrics.netFreeCash >= 0 ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 82, 82, 0.15)',
                                        color: inspectedMetrics.netFreeCash >= 0 ? '#00E676' : '#FF5252'
                                    }}
                                >
                                    {inspectedMetrics.netFreeCash >= 0 ? 'Surplus' : 'Deficit'}
                                </span>
                            </div>
                            {/* Value display with dynamic color */}
                            <div
                                className={styles.statValue}
                                style={{
                                    color: inspectedMetrics.netFreeCash >= 0 ? '#00E676' : '#FF5252'
                                }}
                            >
                                {formatCurrency(inspectedMetrics.netFreeCash)}
                            </div>
                            {/* Subtext description */}
                            <div className={styles.statSubtext}>
                                <span>Income − Expenses − Savings</span>
                            </div>
                        </div>
                    </div>

                    {/* Parameter Adjustment Inputs Subsection */}
                    <div style={{ marginBottom: '0.85rem' }}>
                        {/* Section header */}
                        <span className={styles.label} style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                            ⚙️ Adjust Monthly Parameters (Simulation Only)
                        </span>
                        {/* Form grid */}
                        <div className={styles.formGrid}>
                            {/* Income field */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Monthly Income</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={activeMonthData.income || ''}
                                    onChange={(e) => handleUpdateSingleMonthField('income', e.target.value)}
                                    disabled={isBaseMonth}
                                    style={isBaseMonth ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                                />
                            </div>

                            {/* Monthly savings contribution */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Monthly Savings Contribution</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={activeMonthData.monthlySavingsDeposit || ''}
                                    onChange={(e) => handleUpdateSingleMonthField('monthlySavingsDeposit', e.target.value)}
                                    disabled={isBaseMonth}
                                    style={isBaseMonth ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                                />
                            </div>

                            {/* Monthly spending budget limit */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Total Spending Budget Limit</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={activeMonthData.monthlyBudget || ''}
                                    onChange={(e) => handleUpdateSingleMonthField('monthlyBudget', e.target.value)}
                                    disabled={isBaseMonth}
                                    style={isBaseMonth ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick Add Expense to this month */}
                    {!isBaseMonth && (
                        <div style={{ marginTop: '0.75rem', marginBottom: '1rem', padding: '0.65rem 0.75rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '6px' }}>
                            {/* Section label */}
                            <span className={styles.label} style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                                + Add Expense to this Month
                            </span>
                            {/* Inline grid */}
                            <div className={styles.formGrid}>
                                {/* Name input */}
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Expense Name (e.g. Electricity)"
                                    value={singleExpName}
                                    onChange={(e) => setSingleExpName(e.target.value)}
                                />
                                {/* Amount input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Amount"
                                    value={singleExpAmount}
                                    onChange={(e) => setSingleExpAmount(e.target.value)}
                                />
                                {/* Category selector */}
                                <select
                                    className={styles.select}
                                    value={singleExpCatId}
                                    onChange={(e) => setSingleExpCatId(e.target.value)}
                                >
                                    {activeMonthData.categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                {/* Add button */}
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={handleAddSingleExpense}
                                >
                                    + Add Expense
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Categories and Expenses Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                        {/* Section Title */}
                        <span className={styles.label} style={{ fontWeight: 600 }}>
                            📁 Categories & Expenses Breakdown
                        </span>
                        {/* Add Category button when not base month */}
                        {!isBaseMonth && (
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem' }}
                                onClick={() => setIsAddingCategory(prev => !prev)}
                            >
                                {isAddingCategory ? '✕ Cancel' : '+ Add Category'}
                            </button>
                        )}
                    </div>

                    {/* Inline Add Category Form */}
                    {!isBaseMonth && isAddingCategory && (
                        <div className={styles.categoryFormBox}>
                            {/* Form Title */}
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                New Category
                            </span>
                            {/* Inputs row */}
                            <div className={styles.formGrid}>
                                {/* Name Input */}
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Category Name"
                                    value={newCatName}
                                    onChange={(e) => setNewCatName(e.target.value)}
                                />
                                {/* Budget Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Budget Limit (Optional)"
                                    value={newCatBudget}
                                    onChange={(e) => setNewCatBudget(e.target.value)}
                                />
                            </div>
                            {/* Color Selector Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {/* Label */}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Color:</span>
                                {/* Palette */}
                                <div className={styles.colorPalette}>
                                    {COLOR_PRESETS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`${styles.colorSwatch} ${newCatColor === color ? styles.colorSwatchActive : ''}`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setNewCatColor(color)}
                                        />
                                    ))}
                                </div>
                            </div>
                            {/* Action Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                                {/* Cancel Button */}
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                    onClick={() => {
                                        setIsAddingCategory(false);
                                        setNewCatName('');
                                        setNewCatBudget('');
                                    }}
                                >
                                    Cancel
                                </button>
                                {/* Create Category Button */}
                                <button
                                    type="button"
                                    className={styles.primaryButton}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                                    onClick={handleAddSingleCategory}
                                >
                                    Save Category
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Category and expenses breakdown list */}
                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        {/* Map categories */}
                        {activeMonthData.categories.map(cat => (
                            <div key={cat.id} className={styles.categoryBlock}>
                                {/* Category title and action row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Name, dot, and edit/delete actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {/* Color dot */}
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color }} />
                                        {/* Name */}
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cat.name}</span>
                                        {/* Category actions for non-base months */}
                                        {!isBaseMonth && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                                {/* Edit Category Button */}
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    title="Edit category"
                                                    onClick={() => handleStartEditCategory(cat)}
                                                >
                                                    ✎
                                                </button>
                                                {/* Delete Category Button */}
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    title="Delete category"
                                                    onClick={() => handleDeleteSingleCategory(cat.id)}
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {/* Category total */}
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {formatCurrency((cat.expenses || []).reduce((s, e) => s + (e.amount || 0), 0))}
                                    </span>
                                </div>

                                {/* Inline Edit Form when editing this category */}
                                {!isBaseMonth && editingCatId === cat.id && (
                                    <div className={styles.categoryFormBox} style={{ marginTop: '0.5rem' }}>
                                        {/* Inputs row */}
                                        <div className={styles.formGrid}>
                                            {/* Name Input */}
                                            <input
                                                type="text"
                                                className={styles.input}
                                                placeholder="Category Name"
                                                value={editCatName}
                                                onChange={(e) => setEditCatName(e.target.value)}
                                            />
                                            {/* Budget Input */}
                                            <input
                                                type="number"
                                                className={styles.input}
                                                placeholder="Budget Limit (Optional)"
                                                value={editCatBudget}
                                                onChange={(e) => setEditCatBudget(e.target.value)}
                                            />
                                        </div>
                                        {/* Color Selector Row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {/* Label */}
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Color:</span>
                                            {/* Palette */}
                                            <div className={styles.colorPalette}>
                                                {COLOR_PRESETS.map(color => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        className={`${styles.colorSwatch} ${editCatColor === color ? styles.colorSwatchActive : ''}`}
                                                        style={{ backgroundColor: color }}
                                                        onClick={() => setEditCatColor(color)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            {/* Cancel Button */}
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                                onClick={() => setEditingCatId(null)}
                                            >
                                                Cancel
                                            </button>
                                            {/* Save Button */}
                                            <button
                                                type="button"
                                                className={styles.primaryButton}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                                                onClick={() => handleSaveEditCategory(cat.id)}
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Category expenses list */}
                                {(cat.expenses || []).map(exp => (
                                    <div key={exp.id} className={styles.expenseRow}>
                                        {/* Expense title */}
                                        <span style={{ fontSize: '0.82rem' }}>{exp.name}</span>
                                        {/* Amount and delete */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {/* Amount display or input */}
                                            {isBaseMonth ? (
                                                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                                    {formatCurrency(exp.amount)}
                                                </span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    className={styles.inlineInput}
                                                    value={exp.amount}
                                                    onChange={(e) => handleUpdateSingleExpenseAmount(cat.id, exp.id, e.target.value)}
                                                />
                                            )}
                                            {/* Delete button only if not base month */}
                                            {!isBaseMonth && (
                                                <button
                                                    type="button"
                                                    className={styles.dangerButton}
                                                    onClick={() => handleDeleteSingleExpense(cat.id, exp.id)}
                                                    title="Delete expense from this month"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Empty state if no expenses in category */}
                                {(!cat.expenses || cat.expenses.length === 0) && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.25rem 0' }}>
                                        No expenses in this category
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Multi-Month Data Copy Tool Card */}
            <div className={styles.panelCard}>
                {/* Header */}
                <div className={styles.cardHeader}>
                    {/* Title */}
                    <div className={styles.cardTitle}>
                        {/* Copy icon */}
                        <span>📋</span>
                        {/* Text */}
                        <span>Month Data Copy Tool</span>
                    </div>
                    {/* Target count badge */}
                    <span style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', borderRadius: '4px', background: 'rgba(33, 150, 243, 0.15)', color: '#64B5F6', border: '1px solid rgba(33, 150, 243, 0.3)' }}>
                        {selectedBatchKeys.length} Target Months Selected
                    </span>
                </div>

                {/* Instructional subtitle */}
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '1rem' }}>
                    Select a base month to copy from, choose which data fields to replicate, and apply the changes across your chosen target months.
                </span>

                {/* Step 1: Base Month Selection Container */}
                <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {/* Step 1 Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        {/* Label */}
                        <span className={styles.label} style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            Step 1: Select Source Base Month (Copy From)
                        </span>
                        {/* Selected source label badge */}
                        <span style={{ fontSize: '0.75rem', color: '#64B5F6', fontWeight: 600 }}>
                            Source: {horizonSequence.find(i => i.key === copySourceKey)?.label || copySourceKey}
                        </span>
                    </div>

                    {/* Source Month Select Dropdown */}
                    <select
                        className={styles.select}
                        value={copySourceKey}
                        onChange={(e) => setCopySourceKey(e.target.value)}
                        style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                        {/* Map horizon months for source selection */}
                        {horizonSequence.map(item => (
                            <option key={item.key} value={item.key}>
                                {item.label} {item.key === firstMonthKey ? '(Starting Baseline)' : ''}
                            </option>
                        ))}
                    </select>

                    {/* Source Month Metrics Preview */}
                    {(() => {
                        // Find source sequence item
                        const sItem = horizonSequence.find(i => i.key === copySourceKey);
                        // Source month index
                        const sM = sItem ? sItem.month : startMonth;
                        // Source year
                        const sY = sItem ? sItem.year : startYear;
                        // Retrieve source month simulation data
                        const sData = getSimulatedMonthData(copySourceKey, sM, sY);
                        // Guard check
                        if (!sData) return null;
                        // Calculate total expenses for source month
                        const sExpTotal = (sData.categories || []).reduce((sum, c) => sum + (c.expenses || []).reduce((s, e) => s + (e.amount || 0), 0), 0);
                        // Return summary preview row
                        return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', padding: '0.45rem 0.65rem', borderRadius: '4px' }}>
                                {/* Income preview */}
                                <span>💰 Income: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(sData.income || 0)}</strong></span>
                                {/* Savings contribution preview */}
                                <span>📥 Savings Deposit: <strong style={{ color: '#b388ff' }}>{formatCurrency(sData.monthlySavingsDeposit || 0)}</strong></span>
                                {/* Budget limit preview */}
                                <span>🎯 Spending Budget: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(sData.monthlyBudget || 0)}</strong></span>
                                {/* Total expenses preview */}
                                <span>💳 Total Expenses: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(sExpTotal)}</strong></span>
                                {/* Category count preview */}
                                <span>📁 Categories: <strong style={{ color: 'var(--text-primary)' }}>{(sData.categories || []).length}</strong></span>
                            </div>
                        );
                    })()}
                </div>

                {/* Step 2: Select Target Months (Copy To) */}
                <div style={{ marginBottom: '1.25rem' }}>
                    {/* Header container for Step 2 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {/* Title container */}
                        <div>
                            {/* Step 2 heading */}
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                                {/* Title text */}
                                Step 2: Select Target Months (Copy To)
                            </span>
                            {/* Step 2 subtitle */}
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {/* Subtitle text */}
                                Choose the future horizon months that will receive data from the selected source.
                            </span>
                        </div>
                        {/* Quick selection action buttons */}
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {/* Select all eligible target months button */}
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={handleSelectAllBatch}
                            >
                                {/* Button label */}
                                Select All Future
                            </button>
                            {/* Clear target months selection button */}
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={handleDeselectAllBatch}
                            >
                                {/* Button label */}
                                Clear Selection
                            </button>
                            {/* Selection count badge */}
                            <span style={{ fontSize: '0.75rem', color: '#64B5F6', fontWeight: 600, marginLeft: '0.25rem' }}>
                                {/* Count display */}
                                {selectedBatchKeys.length} selected
                            </span>
                        </div>
                    </div>

                    {/* Target months selector bar */}
                    <div className={styles.checkboxBar}>
                        {/* Iterate over horizon sequence to render target selection chips */}
                        {horizonSequence.map(item => {
                            // Flag if item is base starting month
                            const isBase = item.key === firstMonthKey;
                            // Flag if item is the selected copy source
                            const isSource = item.key === copySourceKey;
                            // Flag if item is selected as target
                            const isSelected = selectedBatchKeys.includes(item.key);

                            // Render disabled badge for base starting month
                            if (isBase) {
                                // Return disabled baseline chip
                                return (
                                    <span
                                        key={item.key}
                                        className={styles.checkboxChip}
                                        style={{ opacity: 0.5, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' }}
                                        title="Base starting month cannot be overwritten"
                                    >
                                        {/* Lock icon and label */}
                                        🔒 {item.label} (Baseline)
                                    </span>
                                );
                            // End base check
                            }

                            // Render disabled badge for selected copy source month
                            if (isSource) {
                                // Return disabled source chip
                                return (
                                    <span
                                        key={item.key}
                                        className={styles.checkboxChip}
                                        style={{ opacity: 0.7, cursor: 'not-allowed', background: 'rgba(33, 150, 243, 0.1)', color: '#64B5F6', border: '1px solid rgba(33, 150, 243, 0.3)' }}
                                        title="Source month cannot copy into itself"
                                    >
                                        {/* Pin icon and label */}
                                        📌 {item.label} (Source)
                                    </span>
                                );
                            // End source check
                            }

                            // Return selectable target month checkbox chip
                            return (
                                <label
                                    key={item.key}
                                    className={styles.checkboxChip}
                                    style={{
                                        cursor: 'pointer',
                                        background: isSelected ? 'rgba(33, 150, 243, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                        border: isSelected ? '1px solid #2196F3' : '1px solid var(--border-color)',
                                        color: isSelected ? '#ffffff' : 'var(--text-secondary)'
                                    }}
                                >
                                    {/* Checkbox input */}
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleBatchKey(item.key)}
                                        style={{ accentColor: '#2196F3', cursor: 'pointer' }}
                                    />
                                    {/* Month label */}
                                    <span>{item.label}</span>
                                </label>
                            );
                        // End horizon sequence map
                        })}
                    </div>
                </div>

                {/* Step 3: Select What Data to Copy */}
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {/* Step 3 header */}
                    <div style={{ marginBottom: '0.65rem' }}>
                        {/* Step 3 title */}
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                            {/* Title text */}
                            Step 3: Select What Data to Copy
                        </span>
                        {/* Step 3 subtitle */}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {/* Subtitle text */}
                            Choose which components of the source month data to replicate across target months.
                        </span>
                    </div>

                    {/* Scope options container */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {/* Option 1: Income and Savings */}
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.84rem' }}>
                            {/* Checkbox input */}
                            <input
                                type="checkbox"
                                checked={copyScopeIncomeSavings}
                                onChange={(e) => setCopyScopeIncomeSavings(e.target.checked)}
                                style={{ accentColor: '#2196F3', marginTop: '0.15rem', cursor: 'pointer' }}
                            />
                            {/* Label text */}
                            <span>
                                {/* Parameter bold label */}
                                <strong style={{ color: 'var(--text-primary)' }}>💰 Monthly Parameters:</strong>
                                {/* Space separator */}
                                {' '}
                                {/* Description */}
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {/* Explanation */}
                                    Copies monthly income, monthly savings deposit, and overall spending budget ceiling.
                                </span>
                            </span>
                        </label>

                        {/* Option 2: Categories and Expenses */}
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.84rem' }}>
                            {/* Checkbox input */}
                            <input
                                type="checkbox"
                                checked={copyScopeCategories}
                                onChange={(e) => setCopyScopeCategories(e.target.checked)}
                                style={{ accentColor: '#2196F3', marginTop: '0.15rem', cursor: 'pointer' }}
                            />
                            {/* Label text */}
                            <span>
                                {/* Parameter bold label */}
                                <strong style={{ color: 'var(--text-primary)' }}>📁 Categories & Itemized Expenses:</strong>
                                {/* Space separator */}
                                {' '}
                                {/* Description */}
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {/* Explanation */}
                                    Clones all budget categories and itemized expense line items (with fresh unique IDs).
                                </span>
                            </span>
                        </label>
                    </div>
                </div>

                {/* Step 4: Execute Copy Action */}
                <div>
                    {/* Execute copy button */}
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleExecuteCopyData}
                        disabled={selectedBatchKeys.length === 0 || (!copyScopeIncomeSavings && !copyScopeCategories)}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            opacity: (selectedBatchKeys.length === 0 || (!copyScopeIncomeSavings && !copyScopeCategories)) ? 0.5 : 1,
                            cursor: (selectedBatchKeys.length === 0 || (!copyScopeIncomeSavings && !copyScopeCategories)) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {/* Button text */}
                        📋 Copy Data to {selectedBatchKeys.length} Selected Target Month{selectedBatchKeys.length === 1 ? '' : 's'}
                    </button>
                </div>
            </div>
        </div>
    );
}
