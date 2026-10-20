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
    // State to toggle copy tool accordion expansion
    const [isCopyToolOpen, setIsCopyToolOpen] = useState<boolean>(false);
    // State to toggle copy tool confirmation modal
    const [showCopyConfirm, setShowCopyConfirm] = useState<boolean>(false);
    // State to track raw input string values for monthly parameters while editing
    const [editingMonthFields, setEditingMonthFields] = useState<Record<string, string>>({});
    // State to track raw input string values for itemized expense amounts while editing
    const [editingExpenseAmounts, setEditingExpenseAmounts] = useState<Record<string, string>>({});
    // State to track raw input string for start year while editing
    const [startYearInput, setStartYearInput] = useState<string | null>(null);
    // State to track raw input string for end year while editing
    const [endYearInput, setEndYearInput] = useState<string | null>(null);
    // State for tracked expanded category IDs in the breakdown list
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);

    // Helper to toggle category expansion in breakdown
    const toggleCategoryExpand = (catId: string) => {
        // Toggle category ID presence in expanded array
        setExpandedCategoryIds(prev =>
            // If already included then filter out otherwise append
            prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
            // Close updater
        );
        // Close toggleCategoryExpand
    };

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
                // Check if persisted simulation data exists in mock database
                if (data && data.simulationMonths && Object.keys(data.simulationMonths).length > 0) {
                    // Set simulation months state from mock database
                    setSimulationMonths(data.simulationMonths);
                    // Attempt local cache update
                    try {
                        // Write to localStorage
                        localStorage.setItem(simStorageKey, JSON.stringify(data.simulationMonths));
                        // End storage try
                    } catch (e) {
                        // Ignore local cache error
                    }
                    // End simulation check
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
                const { collection, getDocs, doc, getDoc } = await import('firebase/firestore');
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
                // Create document reference for user document in Firestore
                const userDocRef = doc(db, 'users', user.uid);
                // Fetch user document snapshot
                const userDocSnap = await getDoc(userDocRef);
                // Check if user document snapshot exists
                if (userDocSnap.exists()) {
                    // Retrieve snapshot data
                    const userData = userDocSnap.data();
                    // Extract raw simulation payload from snapshot
                    let simData = userData?.simulationMonths;
                    // Check if stored simulation payload is a stringified JSON string
                    if (typeof simData === 'string') {
                        // Attempt JSON parsing of simulation string
                        try {
                            // Parse JSON string into simulation months dictionary
                            simData = JSON.parse(simData);
                            // End string parse try
                        } catch (e) {
                            // Log error when JSON parsing fails
                            console.error("Error parsing simulation string:", e);
                            // End catch
                        }
                        // End string check
                    }
                    // Validate simulation payload exists and contains keys
                    if (simData && typeof simData === 'object' && Object.keys(simData).length > 0) {
                        // Update simulation months state from Firestore
                        setSimulationMonths(simData as Record<string, MonthData>);
                        // Attempt local storage cache update
                        try {
                            // Write to localStorage
                            localStorage.setItem(simStorageKey, JSON.stringify(simData));
                            // End storage try
                        } catch (e) {
                            // Ignore local storage error
                            console.error("Local storage error:", e);
                            // End storage catch
                        }
                        // End simulation state check
                    } else {
                        // Attempt fallback to local storage cache if Firestore has no simulation yet
                        try {
                            // Read local cache using user's key or fallback test-user key
                            const cachedRaw = localStorage.getItem(simStorageKey) || localStorage.getItem('budget_tracker_simulation_test-user');
                            // If local cache has data
                            if (cachedRaw) {
                                // Parse local cache
                                const parsedCached = JSON.parse(cachedRaw);
                                // If valid object with keys
                                if (parsedCached && typeof parsedCached === 'object' && Object.keys(parsedCached).length > 0) {
                                    // Set simulation months state immediately from local fallback
                                    setSimulationMonths(parsedCached as Record<string, MonthData>);
                                    // Lazy load setDoc
                                    const { setDoc } = await import('firebase/firestore');
                                    // Automatically push local simulation to production Firestore
                                    await setDoc(userDocRef, { simulationMonths: parsedCached }, { merge: true });
                                    // End push check
                                }
                                // End cached check
                            }
                            // Catch push error
                        } catch (pushErr) {
                            // Log push error
                            console.error("Error auto-uploading local simulation to Firestore:", pushErr);
                            // End catch
                        }
                        // End fallback else
                    }
                    // End doc existence check
                }
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

    // Reset active transient editing inputs when inspected month changes
    useEffect(() => {
        // Clear transient monthly parameter input strings
        setEditingMonthFields({});
        // Clear transient itemized expense amount input strings
        setEditingExpenseAmounts({});
        // React when inspector key changes
    }, [activeInspectorKey]);

    // Initialize default batch selection to all months in horizon excluding base month and copy source month
    useEffect(() => {
        // Default select only future simulation months that are not the copy source
        setSelectedBatchKeys(horizonSequence.filter(item => item.key !== firstMonthKey && item.key !== copySourceKey).map(item => item.key));
    }, [horizonSequence, firstMonthKey, copySourceKey]);

    // Helper to persist simulation updates to state, localStorage, and user database
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
            // Asynchronously persist simulation to database
            if (user) {
                // Check if local test user
                if (user.uid === 'test-user') {
                    // Post update to mock-db API
                    fetch('/api/mock-db', {
                        // HTTP POST
                        method: 'POST',
                        // JSON headers
                        headers: { 'Content-Type': 'application/json' },
                        // Request body
                        body: JSON.stringify({
                            // User ID
                            userId: 'test-user',
                            // Action
                            action: 'update_simulation',
                            // Simulation payload
                            simulation: next,
                            // End request body
                        }),
                        // End fetch options
                    }).catch(err => {
                        // Log error
                        console.error("Error saving simulation to mock DB:", err);
                        // End catch
                    });
                    // End test user branch
                } else {
                    // Save to Firestore asynchronously
                    import('firebase/firestore').then(({ doc, setDoc }) => {
                    // Create user document reference in Firestore
                    const userDocRef = doc(db, 'users', user.uid);
                    // Write simulation months directly to user profile document
                    setDoc(userDocRef, { simulationMonths: next }, { merge: true }).catch(err => {
                        // Log error
                        console.error("Error saving simulation to Firestore:", err);
                        // End catch
                    });
                        // End import then
                    }).catch(err => {
                        // Log import error
                        console.error("Error loading firestore for simulation save:", err);
                        // End catch
                    });
                    // End firestore branch
                }
                // End user check
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
        const bUsage = (activeMonthData.monthlyBudget || 0) > 0 ? Math.round((expensesSum / (activeMonthData.monthlyBudget || 1)) * 100) : 0;
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
        // Clean up transient input if active
        setEditingExpenseAmounts(prev => {
            // Clone map
            const next = { ...prev };
            // Delete expense key
            delete next[expenseId];
            // Return next map
            return next;
            // End updater
        });
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
                        {/* Horizon calendar vector icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#b388ff' }}>
                            {/* Calendar outline */}
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            {/* Calendar top line 1 */}
                            <line x1="16" y1="2" x2="16" y2="6" />
                            {/* Calendar top line 2 */}
                            <line x1="8" y1="2" x2="8" y2="6" />
                            {/* Calendar divider */}
                            <line x1="3" y1="10" x2="21" y2="10" />
                            {/* Closing svg */}
                        </svg>
                        {/* Text */}
                        <span>Month Simulation</span>
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
                            value={startYearInput !== null ? startYearInput : startYear}
                            onChange={(e) => {
                                // Raw string value
                                const val = e.target.value;
                                // Store raw string input
                                setStartYearInput(val);
                                // Parse integer year
                                const parsed = parseInt(val, 10);
                                // Check if valid year
                                if (!isNaN(parsed) && parsed > 0) {
                                    // Update start year state
                                    setStartYear(parsed);
                                    // End check
                                }
                                // End onChange
                            }}
                            onBlur={() => {
                                // Reset transient input on blur
                                setStartYearInput(null);
                                // End onBlur
                            }}
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
                            value={endYearInput !== null ? endYearInput : endYear}
                            onChange={(e) => {
                                // Raw string value
                                const val = e.target.value;
                                // Store raw string input
                                setEndYearInput(val);
                                // Parse integer year
                                const parsed = parseInt(val, 10);
                                // Check if valid year
                                if (!isNaN(parsed) && parsed > 0) {
                                    // Update end year state
                                    setEndYear(parsed);
                                    // End check
                                }
                                // End onChange
                            }}
                            onBlur={() => {
                                // Reset transient input on blur
                                setEndYearInput(null);
                                // End onBlur
                            }}
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
                        {/* Timeline clock vector icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64B5F6' }}>
                            {/* Clock circle */}
                            <circle cx="12" cy="12" r="10" />
                            {/* Clock hands polyline */}
                            <polyline points="12 6 12 12 16 14" />
                            {/* Closing svg */}
                        </svg>
                        {/* Text */}
                        <span>Timeline ({horizonSequence.length} Months)</span>
                    </div>
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
                                {/* Net savings badge */}
                                <div className={`${styles.pillSavingsBadge} ${net >= 0 ? styles.positiveValue : styles.negativeValue}`}>
                                    {formatCurrency(net)}
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
                            {/* Edit pencil vector icon */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FFB74D' }}>
                                {/* Pencil path */}
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                {/* Closing svg */}
                            </svg>
                            {/* Text with month label */}
                            <span>
                                {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}
                            </span>
                        </div>
                        {/* Simulation indicator badge for simulation months */}
                        {!isBaseMonth && (
                            // Simulation mode badge span
                            <span
                                style={{
                                    fontSize: '0.78rem',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '4px',
                                    background: 'rgba(124, 77, 255, 0.15)',
                                    color: '#b388ff',
                                    border: '1px solid rgba(124, 77, 255, 0.3)'
                                }}
                            >
                                {/* Simulation label container */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    {/* Flask simulation icon */}
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {/* Flask body */}
                                        <path d="M10 2v7.31L4.14 18.1A2 2 0 0 0 5.8 21h12.4a2 2 0 0 0 1.66-2.9L14 9.31V2" />
                                        {/* Flask lip */}
                                        <line x1="8.5" y1="2" x2="15.5" y2="2" />
                                        {/* Flask liquid line */}
                                        <line x1="6.8" y1="15" x2="17.2" y2="15" />
                                        {/* Closing svg */}
                                    </svg>
                                    {/* Label text */}
                                    <span>Simulation Mode</span>
                                    {/* Close badge span */}
                                </span>
                                {/* Close badge container */}
                            </span>
                        )}
                    </div>



                    {/* Financial Statistics Overview Grid */}
                    <div className={styles.statsGrid}>
                        {/* Stat Card 1: Money Spent */}
                        <div className={styles.statCard}>
                            {/* Card Header */}
                            <div className={styles.statHeader}>
                                {/* Header label */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    {/* Credit card icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#E57373' }}>
                                        {/* Card body */}
                                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                        {/* Card stripe */}
                                        <line x1="1" y1="10" x2="23" y2="10" />
                                        {/* Closing svg */}
                                    </svg>
                                    {/* Label text */}
                                    <span>Money Spent</span>
                                </span>
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
                                        {inspectedMetrics.budgetUsagePercent}%
                                    </span>
                                ) : null}
                            </div>
                            {/* Value display */}
                            <div className={styles.statValue}>
                                {formatCurrency(inspectedMetrics.totalExpenses)}
                            </div>
                        </div>

                        {/* Stat Card 2: Monthly Savings */}
                        <div className={styles.statCard}>
                            {/* Card Header */}
                            <div className={styles.statHeader}>
                                {/* Header label */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    {/* Savings deposit icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64B5F6' }}>
                                        {/* Box path */}
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        {/* Arrow head */}
                                        <polyline points="7 10 12 15 17 10" />
                                        {/* Arrow stem */}
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                        {/* Closing svg */}
                                    </svg>
                                    {/* Label text */}
                                    <span>Monthly Savings</span>
                                </span>
                                {/* Savings rate badge */}
                                <span
                                    className={styles.statBadge}
                                    style={{
                                        background: 'rgba(33, 150, 243, 0.15)',
                                        color: '#64B5F6'
                                    }}
                                >
                                    {/* Savings rate percentage */}
                                    {inspectedMetrics.savingsRate}%
                                </span>
                            </div>
                            {/* Value display */}
                            <div className={styles.statValue}>
                                {formatCurrency(inspectedMetrics.savingsDeposit)}
                            </div>
                        </div>

                        {/* Stat Card 3: Projected Total Savings */}
                        <div className={styles.statCard}>
                            {/* Card Header */}
                            <div className={styles.statHeader}>
                                {/* Header label */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    {/* Bank vault icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#b388ff' }}>
                                        {/* Bank roof */}
                                        <path d="m3 9 9-7 9 7v1H3v-1z" />
                                        {/* Pillar 1 */}
                                        <line x1="4" y1="10" x2="4" y2="18" />
                                        {/* Pillar 2 */}
                                        <line x1="9" y1="10" x2="9" y2="18" />
                                        {/* Pillar 3 */}
                                        <line x1="15" y1="10" x2="15" y2="18" />
                                        {/* Pillar 4 */}
                                        <line x1="20" y1="10" x2="20" y2="18" />
                                        {/* Bank base */}
                                        <line x1="2" y1="18" x2="22" y2="18" />
                                        {/* Bank bottom */}
                                        <line x1="2" y1="22" x2="22" y2="22" />
                                        {/* Closing svg */}
                                    </svg>
                                    {/* Label text */}
                                    <span>Total Savings</span>
                                </span>
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
                        </div>

                        {/* Stat Card 4: Net Free Cash */}
                        <div className={styles.statCard}>
                            {/* Card Header */}
                            <div className={styles.statHeader}>
                                {/* Header label */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    {/* Dollar icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#81C784' }}>
                                        {/* Dollar stem */}
                                        <line x1="12" y1="1" x2="12" y2="23" />
                                        {/* Dollar loop */}
                                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                        {/* Closing svg */}
                                    </svg>
                                    {/* Label text */}
                                    <span>Net Free Cash</span>
                                </span>
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
                        </div>
                    </div>

                    {/* Parameter Adjustment Inputs Subsection */}
                    <div style={{ marginBottom: '0.85rem' }}>
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
                                    placeholder="0"
                                    value={editingMonthFields['income'] !== undefined ? editingMonthFields['income'] : (activeMonthData.income === 0 ? '' : (activeMonthData.income || ''))}
                                    onChange={(e) => {
                                        // Raw string value from input
                                        const val = e.target.value;
                                        // Update transient editing state
                                        setEditingMonthFields(prev => ({ ...prev, income: val }));
                                        // Propagate to simulation update handler
                                        handleUpdateSingleMonthField('income', val);
                                        // End onChange
                                    }}
                                    onBlur={() => {
                                        // Clear transient field on blur
                                        setEditingMonthFields(prev => {
                                            // Clone map
                                            const next = { ...prev };
                                            // Delete key
                                            delete next.income;
                                            // Return updated map
                                            return next;
                                            // End reducer
                                        });
                                        // End onBlur
                                    }}
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
                                    placeholder="0"
                                    value={editingMonthFields['monthlySavingsDeposit'] !== undefined ? editingMonthFields['monthlySavingsDeposit'] : (activeMonthData.monthlySavingsDeposit === 0 ? '' : (activeMonthData.monthlySavingsDeposit || ''))}
                                    onChange={(e) => {
                                        // Raw string value from input
                                        const val = e.target.value;
                                        // Update transient editing state
                                        setEditingMonthFields(prev => ({ ...prev, monthlySavingsDeposit: val }));
                                        // Propagate to simulation update handler
                                        handleUpdateSingleMonthField('monthlySavingsDeposit', val);
                                        // End onChange
                                    }}
                                    onBlur={() => {
                                        // Clear transient field on blur
                                        setEditingMonthFields(prev => {
                                            // Clone map
                                            const next = { ...prev };
                                            // Delete key
                                            delete next.monthlySavingsDeposit;
                                            // Return updated map
                                            return next;
                                            // End reducer
                                        });
                                        // End onBlur
                                    }}
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
                                    placeholder="0"
                                    value={editingMonthFields['monthlyBudget'] !== undefined ? editingMonthFields['monthlyBudget'] : (activeMonthData.monthlyBudget === 0 ? '' : (activeMonthData.monthlyBudget || ''))}
                                    onChange={(e) => {
                                        // Raw string value from input
                                        const val = e.target.value;
                                        // Update transient editing state
                                        setEditingMonthFields(prev => ({ ...prev, monthlyBudget: val }));
                                        // Propagate to simulation update handler
                                        handleUpdateSingleMonthField('monthlyBudget', val);
                                        // End onChange
                                    }}
                                    onBlur={() => {
                                        // Clear transient field on blur
                                        setEditingMonthFields(prev => {
                                            // Clone map
                                            const next = { ...prev };
                                            // Delete key
                                            delete next.monthlyBudget;
                                            // Return updated map
                                            return next;
                                            // End reducer
                                        });
                                        // End onBlur
                                    }}
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
                        <span className={styles.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                            {/* Folder icon */}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64B5F6' }}>
                                {/* Folder outline */}
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                {/* Closing svg */}
                            </svg>
                            {/* Title text */}
                            <span>Categories</span>
                        </span>
                        {/* Add Category button when not base month */}
                        {!isBaseMonth && (
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                onClick={() => setIsAddingCategory(prev => !prev)}
                            >
                                {isAddingCategory ? (
                                    <>
                                        {/* Cross icon */}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                        <span>Cancel</span>
                                    </>
                                ) : (
                                    <>
                                        {/* Plus icon */}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        <span>Add Category</span>
                                    </>
                                )}
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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggleCategoryExpand(cat.id)}>
                                    {/* Name, dot, and edit/delete actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {/* Collapse chevron icon */}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandedCategoryIds.includes(cat.id) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-secondary)' }}>
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                        {/* Color dot */}
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color }} />
                                        {/* Name */}
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cat.name}</span>
                                        {/* Category actions for non-base months */}
                                        {!isBaseMonth && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }} onClick={(e) => e.stopPropagation()}>
                                                {/* Edit Category Button */}
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    title="Edit category"
                                                    onClick={() => handleStartEditCategory(cat)}
                                                >
                                                    {/* Edit pencil icon */}
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                                    </svg>
                                                </button>
                                                {/* Delete Category Button */}
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    title="Delete category"
                                                    onClick={() => handleDeleteSingleCategory(cat.id)}
                                                >
                                                    {/* Trash icon */}
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
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

                                {/* Render expenses list when category is expanded */}
                                {expandedCategoryIds.includes(cat.id) && (
                                    <>
                                        {/* Category expenses list */}
                                        {(cat.expenses || []).map(exp => (
                                            <div key={exp.id} className={styles.expenseRow}>
                                                {/* Expense title with text truncation guard */}
                                                <span style={{ fontSize: '0.82rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.name}</span>
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
                                                            placeholder="0"
                                                            value={editingExpenseAmounts[exp.id] !== undefined ? editingExpenseAmounts[exp.id] : (exp.amount === 0 ? '' : exp.amount)}
                                                            onChange={(e) => {
                                                                // Raw string value from input
                                                                const val = e.target.value;
                                                                // Update transient editing state
                                                                setEditingExpenseAmounts(prev => ({ ...prev, [exp.id]: val }));
                                                                // Propagate to simulation update handler
                                                                handleUpdateSingleExpenseAmount(cat.id, exp.id, val);
                                                                // End onChange
                                                            }}
                                                            onBlur={() => {
                                                                // Clear transient expense string on blur
                                                                setEditingExpenseAmounts(prev => {
                                                                    // Clone map
                                                                    const next = { ...prev };
                                                                    // Delete key
                                                                    delete next[exp.id];
                                                                    // Return updated map
                                                                    return next;
                                                                    // End reducer
                                                                });
                                                                // End onBlur
                                                            }}
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
                                                            {/* Cross delete icon */}
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                                <line x1="6" y1="6" x2="18" y2="18" />
                                                            </svg>
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
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Multi-Month Data Copy Tool Card */}
            <div className={styles.panelCard}>
                {/* Collapsible Card Header */}
                <div
                    className={styles.cardHeader}
                    style={{ cursor: 'pointer', marginBottom: isCopyToolOpen ? '1rem' : 0 }}
                    onClick={() => setIsCopyToolOpen(prev => !prev)}
                >
                    {/* Title */}
                    <div className={styles.cardTitle}>
                        {/* Copy vector icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64B5F6' }}>
                            {/* Copy icon back rect */}
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            {/* Copy icon front path */}
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            {/* Closing svg tag */}
                        </svg>
                        {/* Text */}
                        <span>Copy Month</span>
                    </div>
                    {/* Expand or collapse chevron button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {/* Status label */}
                        <span>{isCopyToolOpen ? 'Hide' : 'Configure'}</span>
                        {/* Chevron SVG */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCopyToolOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                </div>

                {/* Collapsible Content */}
                {isCopyToolOpen && (
                    // Collapsible Content Wrapper
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Source and Data Scope Columns Container */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            {/* Source Month Column */}
                            <div>
                                {/* Source Header Container */}
                                <div style={{ marginBottom: '0.4rem' }}>
                                    {/* Source Section Title */}
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {/* Source Title Text */}
                                        Source Month
                                        {/* Source Section Title End */}
                                    </span>
                                    {/* Source Header Container End */}
                                </div>
                                {/* Source Month Select Dropdown */}
                                <select
                                    className={styles.select}
                                    value={copySourceKey}
                                    onChange={(e) => setCopySourceKey(e.target.value)}
                                    style={{ width: '100%' }}
                                >
                                    {/* Map horizon months for source selection */}
                                    {horizonSequence.map(item => (
                                        // Option element
                                        <option key={item.key} value={item.key}>
                                            {/* Option label text */}
                                            {item.label} {item.key === firstMonthKey ? '(Baseline)' : ''}
                                            {/* Option element end */}
                                        </option>
                                        // Map close
                                    ))}
                                    {/* Select Dropdown End */}
                                </select>
                                {/* Source Month Column End */}
                            </div>

                            {/* Data Scope Column */}
                            <div>
                                {/* Data Scope Header Container */}
                                <div style={{ marginBottom: '0.4rem' }}>
                                    {/* Data Scope Section Title */}
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {/* Scope Title Text */}
                                        Data Scope
                                        {/* Data Scope Section Title End */}
                                    </span>
                                    {/* Data Scope Header Container End */}
                                </div>
                                {/* Scope Options Container */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', minHeight: '38px', alignItems: 'center' }}>
                                    {/* Scope Option 1: Monthly Parameters */}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                                        {/* Parameters Checkbox */}
                                        <input
                                            type="checkbox"
                                            checked={copyScopeIncomeSavings}
                                            onChange={(e) => setCopyScopeIncomeSavings(e.target.checked)}
                                            style={{ accentColor: '#2196F3', cursor: 'pointer' }}
                                        />
                                        {/* Parameters Label Text */}
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                            {/* Text */}
                                            Monthly Parameters
                                            {/* Parameters Label Text End */}
                                        </span>
                                        {/* Scope Option 1 End */}
                                    </label>
                                    {/* Scope Option 2: Categories & Expenses */}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                                        {/* Categories Checkbox */}
                                        <input
                                            type="checkbox"
                                            checked={copyScopeCategories}
                                            onChange={(e) => setCopyScopeCategories(e.target.checked)}
                                            style={{ accentColor: '#2196F3', cursor: 'pointer' }}
                                        />
                                        {/* Categories Label Text */}
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                            {/* Text */}
                                            Categories & Expenses
                                            {/* Categories Label Text End */}
                                        </span>
                                        {/* Scope Option 2 End */}
                                    </label>
                                    {/* Scope Options Container End */}
                                </div>
                                {/* Data Scope Column End */}
                            </div>
                            {/* Source and Data Scope Columns Container End */}
                        </div>

                        {/* Target Months Section */}
                        <div>
                            {/* Target Header Container */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                {/* Target Section Title */}
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {/* Title Text */}
                                    Target Months ({selectedBatchKeys.length} Selected)
                                    {/* Target Section Title End */}
                                </span>
                                {/* Quick Selection Actions */}
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    {/* Select All Eligible Months */}
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                        onClick={handleSelectAllBatch}
                                    >
                                        {/* Button Label */}
                                        Select All
                                        {/* Select All Button End */}
                                    </button>
                                    {/* Clear All Selection */}
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                        onClick={handleDeselectAllBatch}
                                    >
                                        {/* Button Label */}
                                        Clear
                                        {/* Clear Button End */}
                                    </button>
                                    {/* Quick Selection Actions End */}
                                </div>
                                {/* Target Header Container End */}
                            </div>

                            {/* Target Months Chip Selector Strip */}
                            <div className={styles.checkboxBar} style={{ padding: '0.4rem', background: 'rgba(0, 0, 0, 0.15)', borderRadius: '6px' }}>
                                {/* Iterate over horizon sequence */}
                                {horizonSequence.map(item => {
                                    // Flag for baseline month
                                    const isBase = item.key === firstMonthKey;
                                    // Flag for copy source month
                                    const isSource = item.key === copySourceKey;
                                    // Flag for selected target month
                                    const isSelected = selectedBatchKeys.includes(item.key);

                                    // Render disabled chip for baseline starting month
                                    if (isBase) {
                                        // Return disabled baseline chip
                                        return (
                                            // Disabled chip element
                                            <span
                                                key={item.key}
                                                className={styles.checkboxChip}
                                                style={{ opacity: 0.45, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)', fontSize: '0.75rem' }}
                                                title="Baseline starting month cannot be overwritten"
                                            >
                                                {/* Chip Text */}
                                                {item.label} (Base)
                                                {/* Disabled chip element end */}
                                            </span>
                                            // Return end
                                        );
                                        // Baseline check end
                                    }

                                    // Render disabled chip for active source month
                                    if (isSource) {
                                        // Return disabled source chip
                                        return (
                                            // Disabled source chip element
                                            <span
                                                key={item.key}
                                                className={styles.checkboxChip}
                                                style={{ opacity: 0.65, cursor: 'not-allowed', background: 'rgba(33, 150, 243, 0.1)', color: '#64B5F6', fontSize: '0.75rem' }}
                                                title="Source month cannot copy into itself"
                                            >
                                                {/* Chip Text */}
                                                {item.label} (Source)
                                                {/* Disabled source chip element end */}
                                            </span>
                                            // Return end
                                        );
                                        // Source check end
                                    }

                                    // Return selectable target month chip
                                    return (
                                        // Label chip element
                                        <label
                                            key={item.key}
                                            className={styles.checkboxChip}
                                            style={{
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
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
                                                style={{ accentColor: '#2196F3', cursor: 'pointer', width: '12px', height: '12px' }}
                                            />
                                            {/* Month label */}
                                            <span>{item.label}</span>
                                            {/* Label chip element end */}
                                        </label>
                                        // Return end
                                    );
                                    // Map end
                                })}
                                {/* Target Months Chip Selector Strip End */}
                            </div>
                            {/* Target Months Section End */}
                        </div>

                        {/* Execute Action Row */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                            {/* Execute copy button */}
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => setShowCopyConfirm(true)}
                                disabled={selectedBatchKeys.length === 0 || (!copyScopeIncomeSavings && !copyScopeCategories)}
                                style={{
                                    padding: '0.55rem 1.25rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    opacity: (selectedBatchKeys.length === 0 || (!copyScopeIncomeSavings && !copyScopeCategories)) ? 0.5 : 1,
                                    cursor: (selectedBatchKeys.length === 0 || (!copyScopeIncomeSavings && !copyScopeCategories)) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {/* Copy vector icon in button */}
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Copy icon back rect */}
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    {/* Copy icon front path */}
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    {/* Closing svg */}
                                </svg>
                                {/* Button label text */}
                                <span>Copy to {selectedBatchKeys.length} Month{selectedBatchKeys.length === 1 ? '' : 's'}</span>
                                {/* Execute copy button end */}
                            </button>
                            {/* Execute Action Row End */}
                        </div>
                        {/* Collapsible Content Wrapper End */}
                    </div>
                )}
            </div>

            {/* Confirmation Dialog Modal */}
            {showCopyConfirm && (
                // Modal overlay backdrop
                <div
                    onClick={() => setShowCopyConfirm(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        padding: '1rem'
                    }}
                >
                    {/* Modal card content container */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#1e222d',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            maxWidth: '440px',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.1rem',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        {/* Modal Header Container */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            {/* Warning alert icon badge */}
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255, 183, 77, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#FFB74D' }}>
                                {/* Alert triangle/circle vector icon */}
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Alert circle */}
                                    <circle cx="12" cy="12" r="10" />
                                    {/* Alert upper line */}
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    {/* Alert lower dot */}
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                    {/* Closing svg */}
                                </svg>
                                {/* Warning alert icon badge end */}
                            </div>
                            {/* Modal Title and subtitle container */}
                            <div>
                                {/* Modal heading */}
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {/* Title text */}
                                    Confirm Month Data Copy
                                    {/* Heading end */}
                                </h3>
                                {/* Subtitle warning note */}
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    {/* Warning text */}
                                    This action will overwrite target simulation data.
                                    {/* Subtitle end */}
                                </p>
                                {/* Title container end */}
                            </div>
                            {/* Modal Header Container End */}
                        </div>

                        {/* Modal Summary Details Box */}
                        <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                            {/* Source Month Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                {/* Label */}
                                <span>Source Month:</span>
                                {/* Value */}
                                <strong style={{ color: 'var(--text-primary)' }}>
                                    {/* Interpolated source month label */}
                                    {horizonSequence.find(i => i.key === copySourceKey)?.label || copySourceKey}
                                    {/* Value end */}
                                </strong>
                                {/* Source Month Row End */}
                            </div>
                            {/* Target Months Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                {/* Label */}
                                <span>Target Months:</span>
                                {/* Value */}
                                <strong style={{ color: '#64B5F6' }}>
                                    {/* Selected batch keys count label */}
                                    {selectedBatchKeys.length} month{selectedBatchKeys.length === 1 ? '' : 's'}
                                    {/* Value end */}
                                </strong>
                                {/* Target Months Row End */}
                            </div>
                            {/* Scope Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                {/* Label */}
                                <span>Data Scope:</span>
                                {/* Value */}
                                <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>
                                    {/* Formatted scope summary string */}
                                    {[copyScopeIncomeSavings ? 'Parameters' : '', copyScopeCategories ? 'Categories & Expenses' : ''].filter(Boolean).join(' + ')}
                                    {/* Value end */}
                                </span>
                                {/* Scope Row End */}
                            </div>
                            {/* Modal Summary Details Box End */}
                        </div>

                        {/* Action Buttons Row */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.25rem' }}>
                            {/* Cancel Button */}
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setShowCopyConfirm(false)}
                                style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                            >
                                {/* Cancel label */}
                                Cancel
                                {/* Cancel button end */}
                            </button>
                            {/* Confirm Action Button */}
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => {
                                    // Close confirm modal dialog
                                    setShowCopyConfirm(false);
                                    // Trigger copy data execution
                                    handleExecuteCopyData();
                                }}
                                style={{ padding: '0.55rem 1.15rem', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                {/* Checkmark SVG icon */}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Check polyline */}
                                    <polyline points="20 6 9 17 4 12" />
                                    {/* Closing svg */}
                                </svg>
                                {/* Button confirm label text */}
                                <span>Confirm & Copy</span>
                                {/* Confirm button end */}
                            </button>
                            {/* Action Buttons Row End */}
                        </div>
                        {/* Modal card content container end */}
                    </div>
                    {/* Modal overlay backdrop end */}
                </div>
            )}
        </div>
    );
}
