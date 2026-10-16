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

// Helper to calculate amortization payment
function calculateInstallmentMonthly(principal: number, terms: number, apr: number = 0): number {
    // Guard against non-positive terms or principal
    if (terms <= 0 || principal <= 0) return 0;
    // Handle interest-free financing
    if (apr <= 0) return Math.round((principal / terms) * 100) / 100;
    // Monthly interest decimal
    const r = (apr / 100) / 12;
    // Compounding growth factor
    const factor = Math.pow(1 + r, terms);
    // Standard amortization formula
    const payment = principal * ((r * factor) / (factor - 1));
    // Return rounded result
    return Math.round(payment * 100) / 100;
}

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
    const { income, categories, currentMonth, currentYear, changeMonth, monthlySavingsDeposit, monthlyBudget } = useBudget();
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

    // Selected month keys for the mass change tool
    const [selectedBatchKeys, setSelectedBatchKeys] = useState<string[]>([]);
    // Active tab in mass change tool
    const [batchTab, setBatchTab] = useState<'savings_income' | 'update_expense' | 'add_expense' | 'installments'>('savings_income');

    // Batch form state: Income
    const [batchIncomeInput, setBatchIncomeInput] = useState<string>('');
    // Batch form state: Monthly Savings Contribution
    const [batchSavingsInput, setBatchSavingsInput] = useState<string>('');
    // Batch form state: Monthly Budget Limit
    const [batchBudgetInput, setBatchBudgetInput] = useState<string>('');

    // Batch form state: Target expense to update or delete
    const [batchTargetExpense, setBatchTargetExpense] = useState<string>('');
    // Batch form state: Action update amount or delete
    const [batchExpenseAction, setBatchExpenseAction] = useState<'update_amount' | 'remove'>('update_amount');
    // Batch form state: New amount
    const [batchNewAmount, setBatchNewAmount] = useState<string>('');

    // Batch form state: Add new bill name
    const [batchBillName, setBatchBillName] = useState<string>('');
    // Batch form state: Add new bill amount
    const [batchBillAmount, setBatchBillAmount] = useState<string>('');
    // Batch form state: Add new bill category
    const [batchBillCategoryId, setBatchBillCategoryId] = useState<string>(categories[0]?.id || '');

    // Batch form state: Installment item name
    const [instName, setInstName] = useState<string>('');
    // Batch form state: Installment principal total
    const [instTotal, setInstTotal] = useState<string>('');
    // Batch form state: Installment terms count
    const [instTerms, setInstTerms] = useState<string>('12');
    // Batch form state: Installment APR
    const [instApr, setInstApr] = useState<string>('0');
    // Batch form state: Installment category
    const [instCategoryId, setInstCategoryId] = useState<string>(categories[0]?.id || '');

    // Single month quick add expense state
    const [singleExpName, setSingleExpName] = useState<string>('');
    // Single month quick add expense amount
    const [singleExpAmount, setSingleExpAmount] = useState<string>('');
    // Single month quick add category
    const [singleExpCatId, setSingleExpCatId] = useState<string>(categories[0]?.id || '');

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

    // Initialize default batch selection to all months in horizon
    useEffect(() => {
        // Default select all months in range
        setSelectedBatchKeys(horizonSequence.map(item => item.key));
    }, [horizonSequence]);

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

    // Key representing the first month of the configured prediction range
    const firstMonthKey = `${startYear}-${startMonth}`;
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
        // Return metrics
        return {
            // Month income
            income: activeMonthData.income || 0,
            // Total expenses
            totalExpenses: Math.round(expensesSum * 100) / 100,
            // Net savings
            netSavings: Math.round(net * 100) / 100,
            // Monthly savings deposit
            savingsDeposit: activeMonthData.monthlySavingsDeposit || 0,
            // Monthly budget limit
            budget: activeMonthData.monthlyBudget || 0,
        // End of metrics object
        };
    // Re-evaluate when active month data changes
    }, [activeMonthData]);

    // Distinct list of expense names across all months in the horizon for easy batch selection
    const distinctExpenseNames = useMemo(() => {
        // Set to collect unique names
        const namesSet = new Set<string>();
        // Iterate through all months in horizon
        for (const item of horizonSequence) {
            // Retrieve simulated month data
            const mData = getSimulatedMonthData(item.key, item.month, item.year);
            // If month data exists
            if (mData && Array.isArray(mData.categories)) {
                // Iterate categories
                for (const cat of mData.categories) {
                    // Iterate expenses
                    for (const exp of cat.expenses || []) {
                        // Add trimmed name
                        if (exp.name) namesSet.add(exp.name.trim());
                    // End of name check
                    }
                // End of expenses loop
                }
            // End of categories check
            }
        // End of horizon sequence loop
        }
        // Return sorted array
        return Array.from(namesSet).sort();
    // Re-evaluate when sequence, simulation, or baseline change
    }, [horizonSequence, simulationMonths, rangeBaseline]);
    // Handler to update an inspected month's core metric (income, savings deposit, or budget)
    const handleUpdateSingleMonthField = (field: 'income' | 'monthlySavingsDeposit' | 'monthlyBudget', valueStr: string) => {
        // Return if active month data not loaded
        if (!activeMonthData) return;
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
        // Return if active month data not loaded
        if (!activeMonthData) return;
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
        // Return if active month data not loaded
        if (!activeMonthData) return;
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
        // Return if active month data not loaded or name empty
        if (!activeMonthData || !singleExpName.trim()) return;
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

    // Toggle a month in the mass change selection list
    const toggleBatchKey = (key: string) => {
        // Flip inclusion
        setSelectedBatchKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    // Select all months in horizon
    const handleSelectAllBatch = () => {
        // Assign all keys
        setSelectedBatchKeys(horizonSequence.map(item => item.key));
    };

    // Deselect all months
    const handleDeselectAllBatch = () => {
        // Clear list
        setSelectedBatchKeys([]);
    };

    // Batch Action 1: Apply Income, Savings Deposit, and/or Monthly Budget across selected months
    const handleApplyBatchSavingsIncome = async () => {
        // Guard at least one month selected
        if (selectedBatchKeys.length === 0) {
            addToast("Please select at least one month.", "error");
            return;
        }
        // Payload accumulator
        const batchPayload: Record<string, MonthData> = {};
        // Parse inputs
        const incomeVal = parseFloat(batchIncomeInput);
        const savingsVal = parseFloat(batchSavingsInput);
        const budgetVal = parseFloat(batchBudgetInput);

        // Iterate selected keys
        for (const key of selectedBatchKeys) {
            // Retrieve sequence item
            const item = horizonSequence.find(seq => seq.key === key);
            // Month index
            const mMonth = item ? item.month : startMonth;
            // Year
            const mYear = item ? item.year : startYear;
            // Retrieve simulated month data
            const existing = getSimulatedMonthData(key, mMonth, mYear);
            // Update fields if entered
            batchPayload[key] = {
                // Spread existing month
                ...existing,
                // Update income
                income: !isNaN(incomeVal) && incomeVal >= 0 ? incomeVal : existing.income,
                // Update monthly savings
                monthlySavingsDeposit: !isNaN(savingsVal) && savingsVal >= 0 ? savingsVal : existing.monthlySavingsDeposit,
                // Update monthly budget
                monthlyBudget: !isNaN(budgetVal) && budgetVal >= 0 ? budgetVal : existing.monthlyBudget,
            // End of batch month payload object
            };
        // End of selected batch loop
        }
        // Save to simulation state
        saveSimulationState(batchPayload);
        // Success toast
        addToast(`Updated income/savings across ${selectedBatchKeys.length} simulation months!`, 'success');
    // End of handleApplyBatchSavingsIncome definition
    };

    // Batch Action 2: Update amount or delete an expense across selected months
    const handleApplyBatchExpenseAction = async () => {
        // Guard conditions
        if (selectedBatchKeys.length === 0 || !batchTargetExpense) {
            addToast("Please select months and choose an expense name.", "error");
            return;
        }
        // Parse new amount if action is update
        const newAmt = parseFloat(batchNewAmount);
        if (batchExpenseAction === 'update_amount' && (isNaN(newAmt) || newAmt < 0)) {
            addToast("Please enter a valid expense amount.", "error");
            return;
        }
        // Payload accumulator
        const batchPayload: Record<string, MonthData> = {};
        // Iterate selected months
        for (const key of selectedBatchKeys) {
            // Retrieve sequence item
            const item = horizonSequence.find(seq => seq.key === key);
            // Month index
            const mMonth = item ? item.month : startMonth;
            // Year
            const mYear = item ? item.year : startYear;
            // Retrieve simulated month data
            const mData = getSimulatedMonthData(key, mMonth, mYear);
            // If categories exist
            if (mData && Array.isArray(mData.categories)) {
                // Update categories
                const updatedCategories = mData.categories.map(cat => {
                    // Action: remove expense
                    if (batchExpenseAction === 'remove') {
                        // Return category filtering out target expense
                        return {
                            // Spread category
                            ...cat,
                            // Filter expenses
                            expenses: cat.expenses.filter(e => e.name.toLowerCase() !== batchTargetExpense.toLowerCase()),
                        // End of category object
                        };
                    // End of remove action check
                    }
                    // Action: update expense amount
                    return {
                        // Spread category
                        ...cat,
                        // Map expenses with updated amount
                        expenses: cat.expenses.map(e => e.name.toLowerCase() === batchTargetExpense.toLowerCase() ? { ...e, amount: newAmt } : e),
                    // End of category object
                    };
                // End of categories mapping
                });
                // Assign updated month
                batchPayload[key] = { ...mData, categories: updatedCategories };
            // End of categories check
            }
        // End of selected batch loop
        }
        // Save to simulation state
        saveSimulationState(batchPayload);
        // Success toast
        addToast(`Applied expense action across ${selectedBatchKeys.length} simulation months!`, 'success');
    // End of handleApplyBatchExpenseAction definition
    };

    // Batch Action 3: Add new bill across selected months
    const handleApplyBatchAddBill = async () => {
        // Validate inputs
        if (selectedBatchKeys.length === 0 || !batchBillName.trim()) {
            addToast("Please select months and enter a bill name.", "error");
            return;
        }
        // Parse amount
        const amt = parseFloat(batchBillAmount);
        if (isNaN(amt) || amt <= 0) {
            addToast("Please enter a valid bill amount.", "error");
            return;
        }
        // Payload accumulator
        const batchPayload: Record<string, MonthData> = {};
        // Iterate selected months
        for (const key of selectedBatchKeys) {
            // Retrieve sequence item
            const item = horizonSequence.find(seq => seq.key === key);
            // Month index
            const mMonth = item ? item.month : startMonth;
            // Year
            const mYear = item ? item.year : startYear;
            // Retrieve simulated month data
            const mData = getSimulatedMonthData(key, mMonth, mYear);
            // If categories exist
            if (mData && Array.isArray(mData.categories)) {
                // Target category
                const catId = batchBillCategoryId || mData.categories[0]?.id;
                // Add expense
                const updatedCategories = mData.categories.map(cat => {
                    // Match target category
                    if (cat.id === catId) {
                        // Return category with appended new bill
                        return {
                            // Spread category
                            ...cat,
                            // Append new expense item
                            expenses: [
                                // Existing expenses
                                ...cat.expenses,
                                // New expense object
                                {
                                    // Unique ID
                                    id: Math.random().toString(36).substr(2, 9),
                                    // Name
                                    name: batchBillName.trim(),
                                    // Amount
                                    amount: amt,
                                    // Payment day
                                    paymentDay: 1,
                                    // Recurring flag
                                    isRecurring: true,
                                // End of new expense object
                                },
                            // End of expenses list
                            ],
                        // End of category object
                        };
                    // End of target category check
                    }
                    // Return unmodified category
                    return cat;
                // End of category mapping
                });
                // Assign updated month
                batchPayload[key] = { ...mData, categories: updatedCategories };
            // End of categories check
            }
        // End of selected batch loop
        }
        // Save to simulation state
        saveSimulationState(batchPayload);
        // Success toast
        addToast(`Added bill across ${selectedBatchKeys.length} simulation months!`, 'success');
        // Reset inputs
        setBatchBillName('');
        // Reset amount
        setBatchBillAmount('');
    // End of handleApplyBatchAddBill definition
    };

    // Batch Action 4: Distribute installment purchase across selected months
    const handleApplyBatchInstallment = async () => {
        // Validate inputs
        if (selectedBatchKeys.length === 0 || !instName.trim()) {
            addToast("Please select months and enter an installment item name.", "error");
            return;
        }
        // Parse principal
        const principal = parseFloat(instTotal);
        if (isNaN(principal) || principal <= 0) {
            addToast("Please enter a valid purchase price.", "error");
            return;
        }
        // Parse terms count
        const terms = parseInt(instTerms, 10);
        if (isNaN(terms) || terms <= 0) {
            addToast("Please enter a valid number of installments.", "error");
            return;
        }
        // Parse APR
        const apr = parseFloat(instApr) || 0;
        // Compute monthly payment
        const monthlyPayment = calculateInstallmentMonthly(principal, terms, apr);
        // Payload accumulator
        const batchPayload: Record<string, MonthData> = {};
        // Take up to `terms` months from the selected keys list
        const applicableKeys = selectedBatchKeys.slice(0, terms);

        // Iterate applicable keys
        applicableKeys.forEach((key, idx) => {
            // Retrieve sequence item
            const item = horizonSequence.find(seq => seq.key === key);
            // Month index
            const mMonth = item ? item.month : startMonth;
            // Year
            const mYear = item ? item.year : startYear;
            // Retrieve simulated month data
            const mData = getSimulatedMonthData(key, mMonth, mYear);
            // If categories exist
            if (mData && Array.isArray(mData.categories)) {
                // Category identifier
                const catId = instCategoryId || mData.categories[0]?.id;
                // Construct installment expense item
                const instExpense: Expense = {
                    // Unique ID
                    id: Math.random().toString(36).substr(2, 9),
                    // Formatted name with installment index
                    name: `${instName.trim()} (${idx + 1}/${terms})`,
                    // Monthly payment
                    amount: monthlyPayment,
                    // Payment day
                    paymentDay: 1,
                    // Recurring flag
                    isRecurring: true,
                    // Installment flag
                    isInstallment: true,
                    // Total principal
                    totalAmount: principal,
                    // Total installment count
                    totalInstallments: terms,
                    // Remaining count
                    remainingInstallments: terms - idx,
                    // Interest rate
                    annualInterestRate: apr,
                // End of installment expense
                };
                // Update categories
                const updatedCategories = mData.categories.map(cat => {
                    // Match category
                    if (cat.id === catId) {
                        // Return category with added installment expense
                        return { ...cat, expenses: [...cat.expenses, instExpense] };
                    // End of match
                    }
                    // Return unmodified category
                    return cat;
                // End of category mapping
                });
                // Assign updated month
                batchPayload[key] = { ...mData, categories: updatedCategories };
            // End of categories check
            }
        // End of applicable keys loop
        });
        // Save to simulation state
        saveSimulationState(batchPayload);
        // Success toast
        addToast(`Distributed installments across ${applicableKeys.length} simulation months!`, 'success');
        // Reset inputs
        setInstName('');
        // Reset principal
        setInstTotal('');
    // End of handleApplyBatchInstallment definition
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
                        {/* Simulation indicator badge */}
                        <span style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', borderRadius: '4px', background: 'rgba(124, 77, 255, 0.15)', color: '#b388ff', border: '1px solid rgba(124, 77, 255, 0.3)' }}>
                            🧪 Simulation Mode
                        </span>
                    </div>

                    {/* Core monthly metrics editing form */}
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
                            />
                        </div>

                        {/* Net projected result box */}
                        <div className={styles.formGroup} style={{ justifyContent: 'center' }}>
                            {/* Label */}
                            <span className={styles.label}>Net Balance:</span>
                            {/* Metric */}
                            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: inspectedMetrics.netSavings >= 0 ? '#00E676' : '#FF5252' }}>
                                {formatCurrency(inspectedMetrics.netSavings)}
                            </span>
                        </div>
                    </div>

                    {/* Quick Add Expense to this month */}
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

                    {/* Category and expenses breakdown list */}
                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        {/* Map categories */}
                        {activeMonthData.categories.map(cat => (
                            <div key={cat.id} className={styles.categoryBlock}>
                                {/* Category title row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Name and dot */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {/* Color dot */}
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color }} />
                                        {/* Name */}
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cat.name}</span>
                                    </div>
                                    {/* Category total */}
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {formatCurrency(cat.expenses.reduce((s, e) => s + (e.amount || 0), 0))}
                                    </span>
                                </div>

                                {/* Category expenses list */}
                                {cat.expenses.map(exp => (
                                    <div key={exp.id} className={styles.expenseRow}>
                                        {/* Expense title */}
                                        <span style={{ fontSize: '0.82rem' }}>{exp.name}</span>
                                        {/* Amount and delete */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {/* Amount input */}
                                            <input
                                                type="number"
                                                className={styles.inlineInput}
                                                value={exp.amount}
                                                onChange={(e) => handleUpdateSingleExpenseAmount(cat.id, exp.id, e.target.value)}
                                            />
                                            {/* Delete button */}
                                            <button
                                                type="button"
                                                className={styles.dangerButton}
                                                onClick={() => handleDeleteSingleExpense(cat.id, exp.id)}
                                                title="Delete expense from this month"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Mass Selection & Batch Data Change Tool Card */}
            <div className={styles.panelCard}>
                {/* Header */}
                <div className={styles.cardHeader}>
                    {/* Title */}
                    <div className={styles.cardTitle}>
                        {/* Lightning bolt icon */}
                        <span>⚡</span>
                        {/* Text */}
                        <span>Mass Data Change Tool ({selectedBatchKeys.length} Months Selected)</span>
                    </div>
                    {/* Select All and Deselect All buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {/* Select All */}
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleSelectAllBatch}
                        >
                            Select All
                        </button>
                        {/* Deselect All */}
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleDeselectAllBatch}
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>

                {/* Checkbox bar for months selection */}
                <div className={styles.checkboxBar}>
                    {/* Map horizon sequence */}
                    {horizonSequence.map(item => {
                        // Check if selected
                        const isChecked = selectedBatchKeys.includes(item.key);
                        // Return chip
                        return (
                            <label key={item.key} className={styles.checkboxChip}>
                                {/* Input */}
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleBatchKey(item.key)}
                                />
                                {/* Label */}
                                <span>{item.label}</span>
                            </label>
                        );
                    })}
                </div>

                {/* Batch operation tabs */}
                <div className={styles.batchTabs}>
                    {/* Tab 1: Income and Savings */}
                    <button
                        type="button"
                        className={`${styles.batchTabBtn} ${batchTab === 'savings_income' ? styles.batchTabBtnActive : ''}`}
                        onClick={() => setBatchTab('savings_income')}
                    >
                        💰 Income & Savings
                    </button>

                    {/* Tab 2: Update or Delete Expense */}
                    <button
                        type="button"
                        className={`${styles.batchTabBtn} ${batchTab === 'update_expense' ? styles.batchTabBtnActive : ''}`}
                        onClick={() => setBatchTab('update_expense')}
                    >
                        🔄 Update or Delete Expense (e.g. Gym, Rent)
                    </button>

                    {/* Tab 3: Add Bill */}
                    <button
                        type="button"
                        className={`${styles.batchTabBtn} ${batchTab === 'add_expense' ? styles.batchTabBtnActive : ''}`}
                        onClick={() => setBatchTab('add_expense')}
                    >
                        ➕ Add Recurring Bill (e.g. Electricity)
                    </button>

                    {/* Tab 4: Installments */}
                    <button
                        type="button"
                        className={`${styles.batchTabBtn} ${batchTab === 'installments' ? styles.batchTabBtnActive : ''}`}
                        onClick={() => setBatchTab('installments')}
                    >
                        🛋️ Distribute Installments (Financed Purchase)
                    </button>
                </div>

                {/* Batch Tab 1: Income & Savings */}
                {batchTab === 'savings_income' && (
                    <div>
                        {/* Instructions */}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.65rem' }}>
                            Update your income, monthly savings contribution, or total spending budget across all {selectedBatchKeys.length} selected months simultaneously. Leave any field blank to keep its existing values.
                        </span>
                        {/* Form grid */}
                        <div className={styles.formGrid}>
                            {/* Income */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>New Monthly Income</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Leave empty to keep"
                                    value={batchIncomeInput}
                                    onChange={(e) => setBatchIncomeInput(e.target.value)}
                                />
                            </div>

                            {/* Monthly savings deposit */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>New Monthly Savings Contribution</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Leave empty to keep"
                                    value={batchSavingsInput}
                                    onChange={(e) => setBatchSavingsInput(e.target.value)}
                                />
                            </div>

                            {/* Monthly budget */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>New Monthly Spending Budget</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Leave empty to keep"
                                    value={batchBudgetInput}
                                    onChange={(e) => setBatchBudgetInput(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Apply button */}
                        {/* Apply button */}
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handleApplyBatchSavingsIncome}
                        >
                            {/* Button label */}
                            Apply to {selectedBatchKeys.length} Selected Months
                        </button>
                    </div>
                )}

                {/* Batch Tab 2: Update or Delete Expense (Gym, Rent, etc.) */}
                {batchTab === 'update_expense' && (
                    <div>
                        {/* Instructions */}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.65rem' }}>
                            Pick an expense (such as your Gym membership or Rent). You can set its value once for all selected months, or remove it entirely (e.g. to stop gym billing after 2 months).
                        </span>
                        {/* Form grid */}
                        <div className={styles.formGrid}>
                            {/* Target expense select */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Choose Expense</label>
                                {/* Select control */}
                                <select
                                    className={styles.select}
                                    value={batchTargetExpense}
                                    onChange={(e) => setBatchTargetExpense(e.target.value)}
                                >
                                    {/* Default empty option */}
                                    <option value="">-- Select an Expense --</option>
                                    {/* Map distinct names */}
                                    {distinctExpenseNames.map((name, i) => (
                                        <option key={i} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Action selector */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Action</label>
                                {/* Select */}
                                <select
                                    className={styles.select}
                                    value={batchExpenseAction}
                                    onChange={(e) => setBatchExpenseAction(e.target.value as any)}
                                >
                                    <option value="update_amount">Set New Amount</option>
                                    <option value="remove">Remove / Cancel from Selected Months</option>
                                </select>
                            </div>

                            {/* New Amount input */}
                            {batchExpenseAction === 'update_amount' && (
                                <div className={styles.formGroup}>
                                    {/* Label */}
                                    <label className={styles.label}>New Amount ($)</label>
                                    {/* Input */}
                                    <input
                                        type="number"
                                        className={styles.input}
                                        placeholder="e.g. 8500 for new rent"
                                        value={batchNewAmount}
                                        onChange={(e) => setBatchNewAmount(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Apply button */}
                        {/* Apply button */}
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handleApplyBatchExpenseAction}
                        >
                            {/* Button label */}
                            {batchExpenseAction === 'remove' ? `Delete '${batchTargetExpense || 'Expense'}' from ${selectedBatchKeys.length} Months` : `Update '${batchTargetExpense || 'Expense'}' in ${selectedBatchKeys.length} Months`}
                        </button>
                    </div>
                )}

                {/* Batch Tab 3: Add Recurring Bill */}
                {batchTab === 'add_expense' && (
                    <div>
                        {/* Instructions */}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.65rem' }}>
                            Add a new expense or utility (e.g. Electricity, Internet) across all {selectedBatchKeys.length} selected months.
                        </span>
                        {/* Form grid */}
                        <div className={styles.formGrid}>
                            {/* Bill name */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Bill Name</label>
                                {/* Input */}
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="e.g. Electricity"
                                    value={batchBillName}
                                    onChange={(e) => setBatchBillName(e.target.value)}
                                />
                            </div>

                            {/* Bill amount */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Monthly Amount ($)</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="e.g. 650"
                                    value={batchBillAmount}
                                    onChange={(e) => setBatchBillAmount(e.target.value)}
                                />
                            </div>

                            {/* Category selector */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Category</label>
                                {/* Select */}
                                <select
                                    className={styles.select}
                                    value={batchBillCategoryId}
                                    onChange={(e) => setBatchBillCategoryId(e.target.value)}
                                >
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Apply button */}
                        {/* Apply button */}
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handleApplyBatchAddBill}
                        >
                            {/* Button label */}
                            Add to {selectedBatchKeys.length} Selected Months
                        </button>
                    </div>
                )}

                {/* Batch Tab 4: Distribute Installments */}
                {batchTab === 'installments' && (
                    <div>
                        {/* Instructions */}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.65rem' }}>
                            Distribute financed purchase installments (such as furniture) across consecutive selected months. Payment amount is computed automatically with optional APR.
                        </span>
                        {/* Form grid */}
                        <div className={styles.formGrid}>
                            {/* Item name */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Item Name</label>
                                {/* Input */}
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="e.g. Living Room Sofa"
                                    value={instName}
                                    onChange={(e) => setInstName(e.target.value)}
                                />
                            </div>

                            {/* Category selector */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Category</label>
                                {/* Select */}
                                <select
                                    className={styles.select}
                                    value={instCategoryId}
                                    onChange={(e) => setInstCategoryId(e.target.value)}
                                >
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Purchase total */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Total Price ($)</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="e.g. 1200"
                                    value={instTotal}
                                    onChange={(e) => setInstTotal(e.target.value)}
                                />
                            </div>

                            {/* Installments count */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>Number of Months</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="e.g. 12"
                                    value={instTerms}
                                    onChange={(e) => setInstTerms(e.target.value)}
                                />
                            </div>

                            {/* APR */}
                            <div className={styles.formGroup}>
                                {/* Label */}
                                <label className={styles.label}>APR Interest Rate (%)</label>
                                {/* Input */}
                                <input
                                    type="number"
                                    step="0.1"
                                    className={styles.input}
                                    placeholder="0 for interest free"
                                    value={instApr}
                                    onChange={(e) => setInstApr(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Live calculation info */}
                        {parseFloat(instTotal) > 0 && parseInt(instTerms, 10) > 0 && (
                            <div style={{ marginBottom: '0.85rem', fontSize: '0.85rem', color: '#64B5F6', fontWeight: 600 }}>
                                Monthly Charge: {formatCurrency(calculateInstallmentMonthly(parseFloat(instTotal), parseInt(instTerms, 10), parseFloat(instApr) || 0))}/month across {Math.min(selectedBatchKeys.length, parseInt(instTerms, 10))} months.
                            </div>
                        )}

                        {/* Apply button */}
                        {/* Apply button */}
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handleApplyBatchInstallment}
                        >
                            {/* Button label */}
                            Distribute across Selected Months
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
