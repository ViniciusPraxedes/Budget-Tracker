"use client";

// Import React core library and state/memo/ref hooks
import React, { useState, useEffect, useMemo, useRef } from 'react';
// Import createPortal to render modal dialog outside parent overflow/filter boundaries
import { createPortal } from 'react-dom';
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
// Import Firestore SDK document, snapshot, collection, and query utilities
import { doc, onSnapshot, setDoc, getDocs, collection } from 'firebase/firestore';
// Import Firestore payload sanitizer
import { sanitizeForFirestore } from '../context/useFirestoreSync';
// Import domain model interfaces
import { Category, Expense, MonthData } from '../types';
// Import component CSS module styles
import styles from './HorizonPlanner.module.css';
// Import AI spending and horizon simulation analysis assistant
import AiAnalysis from './AiAnalysis';

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
    const { income, categories, currentMonth, currentYear, changeMonth, monthlySavingsDeposit, monthlyBudget, totalSavings, savingsGoal, updateTotalSavings, setIncome, setMonthlySavingsDeposit, setMonthlyBudget } = useBudget();
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
    // Local simulation range storage key
    const simRangeStorageKey = `budget_tracker_simulation_range_${user?.uid || 'guest'}`;
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

    // State to toggle new expense form visibility in inspected month
    const [isAddingExpense, setIsAddingExpense] = useState<boolean>(false);
    // Reference to the horizon planner inline expense form container
    const addHorizonExpenseRef = useRef<HTMLDivElement>(null);
    // Reference to the horizon planner expense name input element
    const horizonExpNameInputRef = useRef<HTMLInputElement>(null);

    // Automatically scroll to and focus the new expense form when opened
    useEffect(() => {
        // Verify if expense form is open
        if (isAddingExpense) {
            // Scroll expense form container smoothly into view
            addHorizonExpenseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // Set timeout to ensure DOM focus triggers after scroll transition
            setTimeout(() => {
                // Focus expense name input field for immediate typing
                horizonExpNameInputRef.current?.focus();
            }, 100);
        }
    }, [isAddingExpense]);

    // State to toggle new category form visibility in inspected month
    const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
    // Reference to the horizon planner inline category form container
    const addHorizonCategoryRef = useRef<HTMLDivElement>(null);
    // Reference to the horizon planner category name input element
    const horizonCatNameInputRef = useRef<HTMLInputElement>(null);

    // Automatically scroll to and focus the new category form when opened
    useEffect(() => {
        // Verify if category form is open
        if (isAddingCategory) {
            // Scroll category form container smoothly into view
            addHorizonCategoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // Set timeout to ensure DOM focus triggers after scroll transition
            setTimeout(() => {
                // Focus category name input field for immediate typing
                horizonCatNameInputRef.current?.focus();
            }, 100);
        }
    }, [isAddingCategory]);
    // New category name input state
    const [newCatName, setNewCatName] = useState<string>('');
    // New category color input state
    const [newCatColor, setNewCatColor] = useState<string>('#4CAF50');
    // New category budget limit input state
    const [newCatBudget, setNewCatBudget] = useState<string>('');

    // ID of category currently in edit mode
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    // Category pending deletion confirmation dialog
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
    // Edited category name input state
    const [editCatName, setEditCatName] = useState<string>('');
    // Edited category color input state
    const [editCatColor, setEditCatColor] = useState<string>('#4CAF50');
    // Edited category budget limit input state
    const [editCatBudget, setEditCatBudget] = useState<string>('');
    // State to toggle copy month modal dialog visibility
    const [isCopyDialogOpen, setIsCopyDialogOpen] = useState<boolean>(false);
    // State for copy month modal view mode
    const [copyDialogView, setCopyDialogView] = useState<'configure' | 'confirm'>('configure');

    // Hook effect to lock background scrolling when modal is active
    useEffect(() => {
        // Guard check for document availability
        if (typeof document === 'undefined') return;
        // Check if copy dialog is open
        if (isCopyDialogOpen) {
            // Cache previous body overflow setting
            const prevOverflow = document.body.style.overflow;
            // Prevent background page scrolling
            document.body.style.overflow = 'hidden';
            // Return cleanup teardown handler
            return () => {
                // Re-enable original body scrolling behavior
                document.body.style.overflow = prevOverflow;
                // Close cleanup arrow function block
            };
            // Close conditional block
        }
        // Track modal display state dependency
    }, [isCopyDialogOpen]);
    // State to track raw input string values for monthly parameters while editing
    const [editingMonthFields, setEditingMonthFields] = useState<Record<string, string>>({});
    // State to track raw input string values for itemized expense amounts while editing
    const [editingExpenseAmounts, setEditingExpenseAmounts] = useState<Record<string, string>>({});
    // State to track raw input string for start year while editing
    const [startYearInput, setStartYearInput] = useState<string | null>(null);
    // State to track raw input string for end year while editing
    const [endYearInput, setEndYearInput] = useState<string | null>(null);
    // State to track raw input string for starting total savings while editing
    const [startTotalSavingsInput, setStartTotalSavingsInput] = useState<string | null>(null);
    // State for tracked expanded category IDs in the breakdown list
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
    // State to track currently active category opened in modal dialog
    const [activeCategoryModalId, setActiveCategoryModalId] = useState<string | null>(null);
    // State for new expense name inside active category modal dialog
    const [catModalExpName, setCatModalExpName] = useState<string>('');
    // State for new expense amount inside active category modal dialog
    const [catModalExpAmount, setCatModalExpAmount] = useState<string>('');
    // State to track current sub-view mode inside active category modal ('details' | 'edit' | 'delete')
    const [categoryModalView, setCategoryModalView] = useState<'details' | 'edit' | 'delete'>('details');

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

    // Helper to persist simulation range updates across local storage and database
    const saveSimulationRange = (newRange: { startMonth: number; startYear: number; endMonth: number; endYear: number }) => {
        // Attempt local storage persistence
        try {
            // Write JSON stringified range to localStorage
            localStorage.setItem(simRangeStorageKey, JSON.stringify(newRange));
            // Catch storage error
        } catch (e) {
            // Log local error
            console.error("Error saving range to localStorage:", e);
            // End catch
        }
        // Check if user session exists
        if (user) {
            // Check if test-user session
            if (user.uid === 'test-user') {
                // Post updated range to mock database
                fetch('/api/mock-db', {
                    // POST request
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
                        simulation: simulationMonths,
                        // Simulation range payload
                        simulationRange: newRange,
                        // End request body
                    }),
                    // End fetch options
                }).catch(err => {
                    // Log error
                    console.error("Error saving range to mock DB:", err);
                    // End catch
                });
                // End test user branch
            } else {
                // Firestore user document reference
                const userDocRef = doc(db, 'users', user.uid);
                // Persist range to Firestore user profile document
                setDoc(userDocRef, { simulationRange: newRange }, { merge: true }).catch(err => {
                    // Log error
                    console.error("Error saving range to Firestore:", err);
                    // End catch
                });
                // End Firestore branch
            }
            // End user session check
        }
        // End saveSimulationRange definition
    };

    // Real-time synchronization of months baseline and simulation across devices
    useEffect(() => {
        // Guard if no user session
        if (!user) return;
        // Test user environment
        if (user.uid === 'test-user') {
            // Function to load mock database data
            const loadMockData = async () => {
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
                    } else {
                        // Check local storage fallback
                        try {
                            // Read fallback from local storage
                            const cachedRaw = localStorage.getItem(simStorageKey);
                            // If local cache has data
                            if (cachedRaw) {
                                // Parse local cache
                                const parsed = JSON.parse(cachedRaw);
                                // If valid object
                                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                                    // Set state
                                    setSimulationMonths(parsed);
                                    // Post to mock DB
                                    fetch('/api/mock-db', {
                                        // POST method
                                        method: 'POST',
                                        // Headers
                                        headers: { 'Content-Type': 'application/json' },
                                        // Body
                                        body: JSON.stringify({ userId: 'test-user', action: 'update_simulation', simulation: parsed }),
                                    // End fetch
                                    }).catch(e => console.error("Error auto-uploading to mock-db:", e));
                                }
                            }
                        } catch (e) {
                            // Ignore error
                        }
                    }
                    // Check if simulation range is configured in mock database
                    if (data && data.simulationRange) {
                        // Check startMonth
                        if (typeof data.simulationRange.startMonth === 'number') setStartMonth(data.simulationRange.startMonth);
                        // Check startYear
                        if (typeof data.simulationRange.startYear === 'number') setStartYear(data.simulationRange.startYear);
                        // Check endMonth
                        if (typeof data.simulationRange.endMonth === 'number') setEndMonth(data.simulationRange.endMonth);
                        // Check endYear
                        if (typeof data.simulationRange.endYear === 'number') setEndYear(data.simulationRange.endYear);
                        // End range check
                    }
                // Catch errors
                } catch (err) {
                    // Log error
                    console.error("Error loading mock database months:", err);
                    // End catch
                }
            };
            // Initial call
            loadMockData();
            // Re-sync on window focus
            window.addEventListener('focus', loadMockData);
            // Cleanup focus listener
            return () => {
                // Remove window listener
                window.removeEventListener('focus', loadMockData);
            };
        // Firestore user environment
        } else {
            // Months collection reference for real months baseline
            const monthsRef = collection(db, 'users', user.uid, 'months');
            // Query baseline months once
            getDocs(monthsRef).then(snap => {
                // Map dictionary
                const map: Record<string, MonthData> = {};
                // Iterate snapshot documents
                snap.forEach(d => {
                    // Assign month data
                    map[d.id] = d.data() as MonthData;
                });
                // Update real months state
                setRealMonths(map);
            }).catch(err => {
                // Log query error
                console.error("Error loading Firestore months baseline:", err);
            });
            // User document reference for real-time simulation syncing
            const userDocRef = doc(db, 'users', user.uid);
            // Subscribe to real-time changes on user profile document
            const unsubscribe = onSnapshot(userDocRef, (userDocSnap) => {
                // Return if document doesn't exist
                if (!userDocSnap.exists()) return;
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
                                // Automatically push sanitized local simulation to production Firestore
                                setDoc(userDocRef, { simulationMonths: sanitizeForFirestore(parsedCached) }, { merge: true }).catch(err => {
                                    // Log error
                                    console.error("Error auto-uploading local simulation to Firestore:", err);
                                });
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
                // Check if simulation range configuration exists in Firestore
                if (userData?.simulationRange) {
                    // Retrieve range object
                    const r = userData.simulationRange;
                    // Check startMonth
                    if (typeof r.startMonth === 'number') setStartMonth(r.startMonth);
                    // Check startYear
                    if (typeof r.startYear === 'number') setStartYear(r.startYear);
                    // Check endMonth
                    if (typeof r.endMonth === 'number') setEndMonth(r.endMonth);
                    // Check endYear
                    if (typeof r.endYear === 'number') setEndYear(r.endYear);
                    // Attempt caching range to localStorage
                    try {
                        // Store serialized range
                        localStorage.setItem(simRangeStorageKey, JSON.stringify(r));
                    } catch (e) {
                        // Ignore storage error
                    }
                }
            }, (snapshotErr) => {
                // Log snapshot listener error
                console.error("Firestore onSnapshot error for simulation:", snapshotErr);
            });
            // Cleanup onSnapshot subscription on unmount or user change
            return () => {
                // Unsubscribe listener
                unsubscribe();
            };
        }
    }, [user, simStorageKey, simRangeStorageKey]);

    // Load simulation and range from localStorage on mount or storage key change
    useEffect(() => {
        // Attempt localStorage read for simulation months
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
        // Attempt localStorage read for simulation range
        try {
            // Read stored range string
            const rawRange = localStorage.getItem(simRangeStorageKey);
            // If range string exists
            if (rawRange) {
                // Parse JSON range payload
                const parsedRange = JSON.parse(rawRange);
                // Validate parsed range object
                if (parsedRange && typeof parsedRange === 'object') {
                    // Check startMonth property
                    if (typeof parsedRange.startMonth === 'number') setStartMonth(parsedRange.startMonth);
                    // Check startYear property
                    if (typeof parsedRange.startYear === 'number') setStartYear(parsedRange.startYear);
                    // Check endMonth property
                    if (typeof parsedRange.endMonth === 'number') setEndMonth(parsedRange.endMonth);
                    // Check endYear property
                    if (typeof parsedRange.endYear === 'number') setEndYear(parsedRange.endYear);
                    // End range validation
                }
                // End rawRange check
            }
            // Catch range parse errors
        } catch (e) {
            // Log error
            console.error("Error reading simulation range from localStorage:", e);
            // End catch
        }
        // Re-run if storage key changes
    }, [simStorageKey, simRangeStorageKey]);

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
                // Current simulation range configuration
                const currentRange = { startMonth, startYear, endMonth, endYear };
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
                            // Simulation range payload
                            simulationRange: currentRange,
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
                    // Create user document reference in Firestore
                    const userDocRef = doc(db, 'users', user.uid);
                    // Sanitize simulation payload recursively to remove all undefined properties
                    const sanitizedNext = sanitizeForFirestore(next);
                    // Write sanitized simulation months and range directly to user profile document
                    setDoc(userDocRef, { simulationMonths: sanitizedNext, simulationRange: currentRange }, { merge: true }).catch(err => {
                        // Log error
                        console.error("Error saving simulation to Firestore:", err);
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
        // If the start month has customized simulation data, use it as baseline
        if (simulationMonths[firstMonthKey]) {
            // Return baseline constructed from customized start month
            return {
                // Customized income
                income: simulationMonths[firstMonthKey].income ?? income,
                // Customized savings deposit
                monthlySavingsDeposit: simulationMonths[firstMonthKey].monthlySavingsDeposit ?? monthlySavingsDeposit,
                // Customized budget
                monthlyBudget: simulationMonths[firstMonthKey].monthlyBudget ?? monthlyBudget,
                // Customized categories
                categories: simulationMonths[firstMonthKey].categories ?? categories,
            // End customized start month baseline
            };
        // End customized simulation check
        }
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
        // Re-evaluate when first month data, simulation months, or active context updates
    }, [simulationMonths, firstMonthKey, firstMonthData, startMonth, startYear, currentMonth, currentYear, income, monthlySavingsDeposit, monthlyBudget, categories]);

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
                // Total savings baseline
                totalSavings: totalSavings,
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

    // Retrieve currently selected category for the dialog view
    const activeDialogCategory = useMemo(() => {
        // Locate target category from active month data
        const matchedCategory = activeMonthData?.categories.find(c => c.id === activeCategoryModalId);
        // Guard if category is not found
        if (!matchedCategory) return null;
        // Deduplicate expenses array by unique expense id
        const uniqueExpenses = (matchedCategory.expenses || []).filter((exp, idx, arr) => {
            // Check if current expense index matches first occurrence index
            return arr.findIndex(e => e.id === exp.id) === idx;
            // End filter check
        });
        // Return category with deduplicated expenses
        return { ...matchedCategory, expenses: uniqueExpenses };
        // End useMemo dependencies
    }, [activeMonthData, activeCategoryModalId]);

    // Calculate total expenses spent for currently selected dialog category
    const activeDialogCategorySpent = useMemo(() => {
        // Guard if no active dialog category
        if (!activeDialogCategory) return 0;
        // Calculate sum of category expenses
        return (activeDialogCategory.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
        // End useMemo dependencies
    }, [activeDialogCategory]);

    // State to toggle sync confirmation dialog for inspected month
    const [isConfirmSyncOpen, setIsConfirmSyncOpen] = useState(false);
    // State to toggle the date range selector dialog box
    const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState<boolean>(false);
    // State to toggle the edit values dialog box
    const [isEditValuesDialogOpen, setIsEditValuesDialogOpen] = useState(false);
    // Temporary editing form state inside the edit dialog box
    const [tempDialogValues, setTempDialogValues] = useState<{
        // Income string
        income: string;
        // Monthly savings deposit string
        monthlySavingsDeposit: string;
        // Monthly budget limit string
        monthlyBudget: string;
        // Total savings string
        totalSavings: string;
    }>({
        // Default income
        income: '',
        // Default deposit
        monthlySavingsDeposit: '',
        // Default budget
        monthlyBudget: '',
        // Default savings
        totalSavings: '',
    });
    // Specific field to target for editing in the dialog box
    const [dialogEditingField, setDialogEditingField] = useState<'income' | 'monthlySavingsDeposit' | 'monthlyBudget' | 'totalSavings' | null>(null);

    // Handler to open the edit values dialog modal pre-filled for a specific value
    const handleOpenEditValuesDialog = (targetField: 'income' | 'monthlySavingsDeposit' | 'monthlyBudget' | 'totalSavings') => {
        // Guard if active month data not loaded
        if (!activeMonthData) return;
        // Pre-fill temporary editing state
        setTempDialogValues({
            // Pre-fill monthly income
            income: (activeMonthData.income ?? 0).toString(),
            // Pre-fill monthly savings deposit
            monthlySavingsDeposit: (activeMonthData.monthlySavingsDeposit ?? 0).toString(),
            // Pre-fill monthly budget limit
            monthlyBudget: activeMonthData.monthlyBudget !== undefined ? activeMonthData.monthlyBudget.toString() : '',
            // Pre-fill total savings
            totalSavings: isBaseMonth
                ? (totalSavings ?? 0).toString()
                : (activeMonthData.totalSavings !== undefined ? activeMonthData.totalSavings.toString() : Math.round(inspectedMetrics.projectedTotalSavings).toString()),
        });
        // Set target editing field
        setDialogEditingField(targetField);
        // Open edit dialog modal
        setIsEditValuesDialogOpen(true);
    };

    // Handler to save the specific edited value from the dialog box
    const handleSaveEditValuesDialog = () => {
        // Guard if active month data not loaded or no target field specified
        if (!activeMonthData || !dialogEditingField) return;
        // Construct updated month data object copying current active data
        const updatedMonth: MonthData = {
            // Spread current active month data
            ...activeMonthData,
        };
        // Check if user is editing monthly income
        if (dialogEditingField === 'income') {
            // Parse float income
            const parsedIncome = parseFloat(tempDialogValues.income) || 0;
            // Update context income if inspecting base month
            if (isBaseMonth) setIncome(parsedIncome);
            // Assign updated income to month record
            updatedMonth.income = parsedIncome;
            // Display toast feedback notification
            addToast('Monthly income updated successfully!', 'success');
        // Check if user is editing monthly savings contribution
        } else if (dialogEditingField === 'monthlySavingsDeposit') {
            // Parse float monthly savings deposit
            const parsedDeposit = parseFloat(tempDialogValues.monthlySavingsDeposit) || 0;
            // Update context savings deposit if inspecting base month
            if (isBaseMonth) setMonthlySavingsDeposit(parsedDeposit);
            // Assign updated savings deposit to month record
            updatedMonth.monthlySavingsDeposit = parsedDeposit;
            // Display toast feedback notification
            addToast('Monthly savings contribution updated successfully!', 'success');
        // Check if user is editing total spending budget limit
        } else if (dialogEditingField === 'monthlyBudget') {
            // Parse optional float monthly budget
            const parsedBudget = tempDialogValues.monthlyBudget.trim() !== '' ? parseFloat(tempDialogValues.monthlyBudget) : undefined;
            // Update context monthly budget if inspecting base month and budget is set
            if (isBaseMonth && parsedBudget !== undefined) setMonthlyBudget(parsedBudget);
            // Assign updated monthly budget to month record
            updatedMonth.monthlyBudget = parsedBudget;
            // Display toast feedback notification
            addToast('Spending budget limit updated successfully!', 'success');
        // Check if user is editing total savings balance
        } else if (dialogEditingField === 'totalSavings') {
            // Parse float total savings
            const parsedTotalSavings = parseFloat(tempDialogValues.totalSavings) || 0;
            // Update context total savings if inspecting base month
            if (isBaseMonth) updateTotalSavings(parsedTotalSavings);
            // Assign updated total savings override to month record
            updatedMonth.totalSavings = parsedTotalSavings;
            // Display toast feedback notification
            addToast('Total savings updated successfully!', 'success');
        }
        // Persist updated month record to simulation storage
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Close dialog modal
        setIsEditValuesDialogOpen(false);
    };

    // Resolve actual non-simulation database record for the currently inspected month
    const actualMonthData: MonthData | undefined = useMemo(() => {
        // Check if inspected month matches live budget context month
        if (activeInspectorKey === `${currentYear}-${currentMonth}`) {
            // Check if live context has any recorded data
            if (categories.length > 0 || income > 0 || (monthlyBudget !== undefined && monthlyBudget > 0)) {
                // Return live context record
                return {
                    // Month index
                    month: currentMonth,
                    // Year number
                    year: currentYear,
                    // Income
                    income,
                    // Savings deposit
                    monthlySavingsDeposit,
                    // Budget limit
                    monthlyBudget,
                    // Categories list
                    categories,
                // End live context record
                };
            // End live check
            }
        // End live month key check
        }
        // Retrieve record from cached real months dictionary
        const dbData = realMonths[activeInspectorKey];
        // Check if real database record exists and has non-empty content
        if (dbData && ((dbData.categories && dbData.categories.length > 0) || (dbData.income && dbData.income > 0) || typeof dbData.monthlyBudget === 'number')) {
            // Return real database record
            return dbData;
        // End db data validation
        }
        // Return undefined when no actual data exists
        return undefined;
    // Recompute when active key, live context, or real months change
    }, [activeInspectorKey, currentMonth, currentYear, income, monthlySavingsDeposit, monthlyBudget, categories, realMonths]);

    // Handler to execute sync from actual month data into simulation
    const handleSyncFromActualMonth = () => {
        // Guard if no actual data exists
        if (!actualMonthData) return;
        // Deep clone actual month categories and expenses to ensure isolated state
        const clonedCategories = (actualMonthData.categories || []).map(cat => ({
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
            // Expenses array
            expenses: (cat.expenses || []).map(exp => ({
                // Expense ID
                id: exp.id || Math.random().toString(36).substr(2, 9),
                // Name
                name: exp.name,
                // Amount
                amount: exp.amount,
                // Payment day
                paymentDay: exp.paymentDay,
                // Recurring flag
                isRecurring: exp.isRecurring,
                // Installment flag
                isInstallment: exp.isInstallment,
                // Total amount
                totalAmount: exp.totalAmount,
                // Total installments
                totalInstallments: exp.totalInstallments,
                // Remaining installments
                remainingInstallments: exp.remainingInstallments,
                // Annual interest rate
                annualInterestRate: exp.annualInterestRate,
                // Installment start month
                installmentStartMonth: exp.installmentStartMonth,
            // End expense mapping
            })),
        // End category mapping
        }));
        // Target month index
        const itemMonth = activeMonthItem ? activeMonthItem.month : startMonth;
        // Target year number
        const itemYear = activeMonthItem ? activeMonthItem.year : startYear;
        // Construct updated simulation month data
        const updatedMonth: MonthData = {
            // Month index
            month: itemMonth,
            // Year number
            year: itemYear,
            // Actual income
            income: actualMonthData.income ?? 0,
            // Actual monthly savings deposit
            monthlySavingsDeposit: actualMonthData.monthlySavingsDeposit ?? 0,
            // Actual monthly budget limit
            monthlyBudget: actualMonthData.monthlyBudget,
            // Cloned categories list
            categories: clonedCategories,
        // End updatedMonth
        };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Close confirmation dialog
        setIsConfirmSyncOpen(false);
        // Show success notification
        addToast(`Simulation updated with actual ${MONTH_NAMES[itemMonth]} ${itemYear} data!`, 'success');
    // End handleSyncFromActualMonth
    };

    // Synchronize quick-add category selector with valid categories in inspected month
    useEffect(() => {
        // Guard if categories are loaded and non-empty
        if (activeMonthData?.categories && activeMonthData.categories.length > 0) {
            // Check if selected category ID exists in active month's categories
            const isCatValid = activeMonthData.categories.some(cat => cat.id === singleExpCatId);
            // Fallback to first available category if missing or empty
            if (!isCatValid) {
                // Update selected category ID to first category of active month
                setSingleExpCatId(activeMonthData.categories[0].id);
                // End fallback condition
            }
            // End categories guard
        }
        // React when inspector month or active month categories change
    }, [activeInspectorKey, activeMonthData?.categories, singleExpCatId]);

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
            // Check if month has explicit total savings override
            if (mData.totalSavings !== undefined) {
                // Adopt explicit total savings override
                runningTotal = mData.totalSavings;
            // Otherwise if beyond base starting month, accumulate monthly savings deposit
            } else if (index > 0) {
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

    // Compute metrics for inspected month
    const inspectedMetrics = useMemo(() => {
        // Total expenses across all categories
        const expensesSum = (activeMonthData.categories || []).reduce((sum, cat) => {
            // Sum expenses in category
            return sum + (cat.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
            // End of category reduction
        }, 0);
        // Calculate effective monthly budget target amount preserving zero
        const effectiveMonthlyBudget = activeMonthData.monthlyBudget !== undefined 
            // Adopt explicit monthly budget if set
            ? activeMonthData.monthlyBudget 
            // Fallback to sum of individual category budgets
            : (activeMonthData.categories || []).reduce((sum, cat) => sum + (cat.budget || 0), 0);
        // Sum of all individual category budgets
        const categoryBudgetsTotal = (activeMonthData.categories || []).reduce((sum, cat) => sum + (cat.budget || 0), 0);
        // Calculate total planned budgeted expenses or actual expenses if higher
        const plannedExpenses = activeMonthData.monthlyBudget !== undefined 
            // Use max of budget and total expenses if custom budget is defined
            ? Math.max(activeMonthData.monthlyBudget, expensesSum) 
            // Otherwise calculate planned expenses based on individual category budgets
            : (activeMonthData.categories || []).reduce((sum, cat) => sum + (cat.budget !== undefined ? Math.max(cat.budget, (cat.expenses || []).reduce((s, e) => s + (e.amount || 0), 0)) : (cat.expenses || []).reduce((s, e) => s + (e.amount || 0), 0)), 0);
        // Net savings balance
        const net = (activeMonthData.income || 0) - expensesSum;
        // Calculate free operational cash remaining after budgeted expenses and savings deposit
        const freeCash = (activeMonthData.income || 0) - plannedExpenses - (activeMonthData.monthlySavingsDeposit || 0);
        // Calculate savings rate percentage of income
        const sRate = (activeMonthData.income || 0) > 0 ? Math.round(((activeMonthData.monthlySavingsDeposit || 0) / activeMonthData.income) * 100) : 0;
        // Calculate percentage of budget consumed by actual expenses
        const budgetUsedPercentage = effectiveMonthlyBudget > 0 ? (expensesSum / effectiveMonthlyBudget) * 100 : 0;
        // Clamp displayed bar width to 100% so overspend doesn't overflow the track
        const budgetBarWidth = Math.min(budgetUsedPercentage, 100);
        // Choose progress bar color based on how close to or over budget
        const budgetBarColor = budgetUsedPercentage >= 100
            // Red indicator when budget exceeded
            ? 'var(--firebase-red)'
            // Yellow indicator when approaching budget limit
            : budgetUsedPercentage >= 80
                // Warning yellow color
                ? 'var(--firebase-yellow)'
                // Green indicator when well within budget
                : '#00E676';
        // Calculate budget consumption percentage rounded for display
        const bUsage = Math.round(budgetUsedPercentage);
        // Calculate remaining budget headroom
        const bRemaining = effectiveMonthlyBudget - expensesSum;
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
        // Calculate projected total savings in bank from timeline map
        const projectedTotalSavings = timelineSavingsMap[activeInspectorKey] !== undefined ? timelineSavingsMap[activeInspectorKey] : (totalSavings || 0) + cumulativeDeposits;
        // Calculate progress percentage towards savings goal
        const goalPercent = (savingsGoal || 0) > 0 ? (projectedTotalSavings / (savingsGoal || 1)) * 100 : 0;
        // Clamp displayed savings goal bar width to 100% once reached
        const savingsGoalBarWidth = Math.min(goalPercent, 100);
        // Highlight bar in green once goal is reached or exceeded, otherwise card accent blue
        const savingsGoalBarColor = goalPercent >= 100 ? '#00E676' : '#2196F3';
        // Return metrics
        return {
            // Month income
            income: activeMonthData.income || 0,
            // Total expenses
            totalExpenses: Math.round(expensesSum * 100) / 100,
            // Effective monthly budget target
            effectiveMonthlyBudget,
            // Category budgets total sum
            categoryBudgetsTotal,
            // Planned expenses
            plannedExpenses,
            // Net savings
            netSavings: Math.round(net * 100) / 100,
            // Net free cash
            netFreeCash: Math.round(freeCash * 100) / 100,
            // Monthly savings deposit
            savingsDeposit: activeMonthData.monthlySavingsDeposit || 0,
            // Monthly budget limit
            budget: activeMonthData.monthlyBudget ?? 0,
            // Savings rate percentage
            savingsRate: sRate,
            // Budget consumption percentage
            budgetUsagePercent: bUsage,
            // Budget used percentage unrounded
            budgetUsedPercentage,
            // Budget bar width clamp
            budgetBarWidth,
            // Budget bar dynamic color
            budgetBarColor,
            // Remaining budget
            budgetRemaining: Math.round(bRemaining * 100) / 100,
            // Projected cumulative total savings
            projectedTotalSavings,
            // Cumulative deposits in horizon
            cumulativeDeposits,
            // Savings goal percentage
            savingsGoalPercentage: Math.round(goalPercent),
            // Savings goal bar width clamp
            savingsGoalBarWidth,
            // Savings goal bar dynamic color
            savingsGoalBarColor,
            // End of metrics object
        };
        // Re-evaluate when active month data, sequence, timeline map, or baseline changes
    }, [activeMonthData, horizonSequence, activeInspectorKey, totalSavings, savingsGoal, simulationMonths, rangeBaseline, firstMonthKey, timelineSavingsMap]);

    // Handler to update an inspected month's core metric (income, savings deposit, budget, or total savings)
    const handleUpdateSingleMonthField = (field: 'income' | 'monthlySavingsDeposit' | 'monthlyBudget' | 'totalSavings', valueStr: string) => {
        // Return if active month data not loaded
        if (!activeMonthData) return;
        // Check if updating total savings
        if (field === 'totalSavings') {
            // Check if active month is the baseline month
            if (isBaseMonth) {
                // Parse float value from string
                const val = parseFloat(valueStr) || 0;
                // Update global total savings in context
                updateTotalSavings(val);
                // Construct updated month data object preserving overrides
                const updatedMonth: MonthData = {
                    // Spread active month data
                    ...activeMonthData,
                    // Persist total savings override
                    totalSavings: val,
                // End updatedMonth definition
                };
                // Save updated month into simulation state
                saveSimulationState({ [activeInspectorKey]: updatedMonth });
                // Return early
                return;
                // End base month check
            }
            // Check if string is empty to clear override
            if (valueStr.trim() === '') {
                // Shallow clone active month data
                const updatedMonth: MonthData = { ...activeMonthData };
                // Delete total savings override
                delete updatedMonth.totalSavings;
                // Persist updated simulation month
                saveSimulationState({ [activeInspectorKey]: updatedMonth });
                // Return early
                return;
                // End empty string check
            }
            // Parse numeric float value
            const val = parseFloat(valueStr) || 0;
            // Updated month object with total savings override
            const updatedMonth: MonthData = {
                // Spread existing month data
                ...activeMonthData,
                // Set total savings override
                totalSavings: val,
                // End of updated month object
            };
            // Persist updated simulation month
            saveSimulationState({ [activeInspectorKey]: updatedMonth });
            // Return early
            return;
            // End total savings check
        }
        // Check if value string is empty to delete override
        if (valueStr.trim() === '') {
            // Clone existing month object
            const updatedMonth: MonthData = {
                // Spread existing month data
                ...activeMonthData,
            // End of updatedMonth clone
            };
            // Delete target field override
            delete (updatedMonth as any)[field];
            // Save cleared override state to simulation
            saveSimulationState({ [activeInspectorKey]: updatedMonth });
            // Return early
            return;
        // End of empty string check
        }
        // Parse float value from input string
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
        // Locate matching category before removal
        const targetCategory = activeMonthData.categories.find(c => c.id === categoryId);
        // Locate deleted expense record for reversal
        const deletedExpense = targetCategory?.expenses.find(e => e.id === expenseId);
        // Record deleted expense position within category
        const deletedExpenseIndex = targetCategory ? targetCategory.expenses.findIndex(e => e.id === expenseId) : -1;
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
        // Trigger revertable notification if deleted expense was identified
        if (deletedExpense) {
            // Enqueue deletion toast with revert action callback
            addToast(`Expense "${deletedExpense.name}" was deleted`, 'info', {
                // Revert button text
                label: 'Revert',
                // Action callback function
                onClick: () => {
                    // Re-insert deleted expense back into the post-deletion categories snapshot
                    const restoredCats = updatedMonth.categories.map(cat => {
                        // Match target category
                        if (cat.id === categoryId) {
                            // Guard against duplicate insertion if expense already restored
                            if (cat.expenses.some(e => e.id === deletedExpense.id)) {
                                // Return category unchanged
                                return cat;
                                // End duplicate guard check
                            }
                            // Clone expenses array
                            const restoredExpenses = [...cat.expenses];
                            // Insert at original index if valid, otherwise append to end
                            if (deletedExpenseIndex >= 0 && deletedExpenseIndex <= restoredExpenses.length) {
                                // Splice item back at original index
                                restoredExpenses.splice(deletedExpenseIndex, 0, deletedExpense);
                                // End index check
                            } else {
                                // Append item to end of array
                                restoredExpenses.push(deletedExpense);
                                // End else
                            }
                            // Return updated category with restored item
                            return { ...cat, expenses: restoredExpenses };
                            // End matching category check
                        }
                        // Return unchanged category
                        return cat;
                        // End categories map
                    });
                    // Construct restored month from updated month snapshot
                    const restoredMonth: MonthData = { ...updatedMonth, categories: restoredCats };
                    // Persist restored month data in simulation state
                    saveSimulationState({ [activeInspectorKey]: restoredMonth });
                    // Show confirmation notification
                    addToast(`Restored "${deletedExpense.name}"`, 'success');
                    // End revert action
                }
                // End action config
            });
            // End deletedExpense check
        }
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
        // Resolve target category ID from valid category or first available category
        const targetCatId = activeMonthData.categories.some(cat => cat.id === singleExpCatId)
            // Use selected category ID if found
            ? singleExpCatId
            // Fallback to first category ID
            : activeMonthData.categories[0]?.id;
        // Declare updated categories array
        let newCats: Category[] = [];
        // Check if no category was found or available
        if (!targetCatId) {
            // Generated category ID
            const fallbackCatId = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            // Create default category
            const defaultCat: Category = {
                // Category ID
                id: fallbackCatId,
                // Category name
                name: 'General',
                // Category color
                color: '#4CAF50',
                // Category expenses
                expenses: [newExp],
                // End category object
            };
            // Set categories array with default category
            newCats = [defaultCat];
            // Automatically expand the created category
            setExpandedCategoryIds(prev => [...prev, fallbackCatId]);
            // End no category check
        } else {
            // Update categories array appending new expense
            newCats = activeMonthData.categories.map(cat => {
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
            // Automatically expand target category if collapsed
            setExpandedCategoryIds(prev => prev.includes(targetCatId) ? prev : [...prev, targetCatId]);
            // End else
        }
        // Updated month
        const updatedMonth: MonthData = { ...activeMonthData, categories: newCats };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Reset name
        setSingleExpName('');
        // Reset amount
        setSingleExpAmount('');
        // Close inline add expense form
        setIsAddingExpense(false);
        // Show success notification
        addToast(`Added "${newExp.name}" to simulation`, 'success');
        // End of handleAddSingleExpense definition
    };

    // Helper to add a new expense inside the active category modal dialog
    const handleAddExpenseToActiveCategory = (categoryId: string) => {
        // Guard if no active month data or invalid expense input
        if (!activeMonthData || !catModalExpName.trim() || !catModalExpAmount) return;
        // Parse numerical expense amount
        const amountNum = parseFloat(catModalExpAmount);
        // Guard against NaN or negative
        if (isNaN(amountNum) || amountNum < 0) return;
        // Construct new expense object
        const newExp: Expense = {
            // Unique timestamp ID
            id: 'exp_' + Date.now().toString(),
            // Expense name
            name: catModalExpName.trim(),
            // Expense amount
            amount: amountNum,
            // Payment day
            paymentDay: 1,
            // Recurring flag
            isRecurring: true,
            // End of expense object
        };
        // Update categories array
        const newCats = activeMonthData.categories.map(cat => {
            // Check matching category
            if (cat.id === categoryId) {
                // Return category with new expense appended
                return { ...cat, expenses: [...(cat.expenses || []), newExp] };
                // End match
            }
            // Return unchanged category
            return cat;
            // End map
        });
        // Updated month
        const updatedMonth: MonthData = { ...activeMonthData, categories: newCats };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Clear modal expense name input
        setCatModalExpName('');
        // Clear modal expense amount input
        setCatModalExpAmount('');
        // Show toast notification
        addToast(`Added "${newExp.name}" to simulation`, 'success');
        // End handleAddExpenseToActiveCategory
    };

    // Handler to add a new category to the currently inspected month
    const handleAddSingleCategory = () => {
        // Return if active month data not loaded or name empty
        if (!activeMonthData || !newCatName.trim()) return;
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
        // Update quick add category to newly created category
        setSingleExpCatId(newCategory.id);
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
        // Return if active month data not loaded or name empty
        if (!activeMonthData || !editCatName.trim()) return;
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
        // Reset category dialog view to details if editing active category in place
        setCategoryModalView('details');
        // Show success notification
        addToast('Category updated', 'success');
        // End of handleSaveEditCategory definition
    };

    // Handler to remove a category from the currently inspected month
    const handleDeleteSingleCategory = (categoryId: string) => {
        // Return if active month data not loaded
        if (!activeMonthData) return;
        // Filter out category
        const newCats = activeMonthData.categories.filter(cat => cat.id !== categoryId);
        // Updated month
        const updatedMonth: MonthData = { ...activeMonthData, categories: newCats };
        // Save to simulation state
        saveSimulationState({ [activeInspectorKey]: updatedMonth });
        // Reset category pending deletion state
        setCategoryToDelete(null);
        // Also close category dialog if deleting active category
        if (activeCategoryModalId === categoryId) {
            // Close active category modal
            setActiveCategoryModalId(null);
            // Reset category dialog view to details
            setCategoryModalView('details');
            // End category dialog close check
        }
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
                monthlyBudget: copyScopeIncomeSavings ? sourceData.monthlyBudget : existingTarget.monthlyBudget,
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
        // Close copy month dialog
        setIsCopyDialogOpen(false);
        // Reset copy dialog view back to configure
        setCopyDialogView('configure');
        // Show success notification
        addToast(`Copied ${sourceLabel} data to ${selectedBatchKeys.length} target months!`, 'success');
        // End handleExecuteCopyData definition
    };

    // Render component JSX markup
    return (
        // Container wrapper
        <div className={styles.container}>
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
                    {/* Action button to open date range dialog */}
                    <button
                        type="button"
                        className={styles.cardPencilBtn}
                        onClick={() => setIsDateRangeDialogOpen(true)}
                        title="Configure simulation date range"
                        aria-label="Configure simulation date range"
                    >
                        {/* Pencil SVG icon */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                            {/* Bottom line path */}
                            <path d="M12 20h9" />
                            {/* Pencil tip path */}
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            {/* Closing svg tag */}
                        </svg>
                        {/* Closing button tag */}
                    </button>
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

            {/* Date Range Selector Modal Dialog */}
            {isDateRangeDialogOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className={styles.confirmOverlay}
                    onClick={() => setIsDateRangeDialogOpen(false)}
                >
                    {/* Modal container */}
                    <div
                        className={styles.editValuesModal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header Row */}
                        <div className={styles.modalHeaderRow}>
                            {/* Title */}
                            <div className={styles.confirmTitle}>
                                {/* Calendar vector icon */}
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#b388ff' }}>
                                    {/* Calendar outline */}
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    {/* Calendar pin 1 */}
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    {/* Calendar pin 2 */}
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    {/* Calendar horizontal line */}
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                    {/* Closing svg */}
                                </svg>
                                {/* Title text */}
                                <span>Simulation Date Range</span>
                            </div>
                            {/* Close button */}
                            <button
                                type="button"
                                className={styles.modalCloseBtn}
                                onClick={() => setIsDateRangeDialogOpen(false)}
                                title="Close dialog"
                            >
                                {/* Cross icon */}
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Diagonal line 1 */}
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    {/* Diagonal line 2 */}
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                    {/* Closing svg */}
                                </svg>
                            </button>
                        </div>

                        {/* Modal Subtitle explanation */}
                        <p className={styles.confirmSubtext}>
                            Configure the starting and ending months for the simulation projection sequence.
                        </p>

                        {/* Form grid to configure range */}
                        <div className={styles.modalFormGrid}>
                            {/* Start month form group */}
                            <div className={styles.formGroup}>
                                {/* Label with indicator */}
                                <label className={styles.modalFieldLabel}>
                                    {/* Indicator bar */}
                                    <span style={{ width: '3px', height: '12px', background: '#b388ff', borderRadius: '2px', display: 'inline-block' }} />
                                    {/* Label text */}
                                    <span>Start Month</span>
                                </label>
                                {/* Select dropdown */}
                                <select
                                    className={styles.modalInput}
                                    value={startMonth}
                                    onChange={(e) => {
                                        // Parse integer month value from select event
                                        const val = parseInt(e.target.value, 10);
                                        // Update start month state
                                        setStartMonth(val);
                                        // Persist updated range configuration
                                        saveSimulationRange({ startMonth: val, startYear, endMonth, endYear });
                                    }}
                                >
                                    {/* Map month names */}
                                    {MONTH_NAMES.map((name, i) => (
                                        <option key={i} value={i}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Start year form group */}
                            <div className={styles.formGroup}>
                                {/* Label with indicator */}
                                <label className={styles.modalFieldLabel}>
                                    {/* Indicator bar */}
                                    <span style={{ width: '3px', height: '12px', background: '#b388ff', borderRadius: '2px', display: 'inline-block' }} />
                                    {/* Label text */}
                                    <span>Start Year</span>
                                </label>
                                {/* Input field */}
                                <input
                                    type="number"
                                    className={styles.modalInput}
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
                                            // Persist updated range configuration
                                            saveSimulationRange({ startMonth, startYear: parsed, endMonth, endYear });
                                        }
                                    }}
                                    onBlur={() => {
                                        // Reset transient input on blur
                                        setStartYearInput(null);
                                    }}
                                />
                            </div>

                            {/* End month form group */}
                            <div className={styles.formGroup}>
                                {/* Label with indicator */}
                                <label className={styles.modalFieldLabel}>
                                    {/* Indicator bar */}
                                    <span style={{ width: '3px', height: '12px', background: '#b388ff', borderRadius: '2px', display: 'inline-block' }} />
                                    {/* Label text */}
                                    <span>End Month</span>
                                </label>
                                {/* Select dropdown */}
                                <select
                                    className={styles.modalInput}
                                    value={endMonth}
                                    onChange={(e) => {
                                        // Parse integer month value from select event
                                        const val = parseInt(e.target.value, 10);
                                        // Update end month state
                                        setEndMonth(val);
                                        // Persist updated range configuration
                                        saveSimulationRange({ startMonth, startYear, endMonth: val, endYear });
                                    }}
                                >
                                    {/* Map month names */}
                                    {MONTH_NAMES.map((name, i) => (
                                        <option key={i} value={i}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* End year form group */}
                            <div className={styles.formGroup}>
                                {/* Label with indicator */}
                                <label className={styles.modalFieldLabel}>
                                    {/* Indicator bar */}
                                    <span style={{ width: '3px', height: '12px', background: '#b388ff', borderRadius: '2px', display: 'inline-block' }} />
                                    {/* Label text */}
                                    <span>End Year</span>
                                </label>
                                {/* Input field */}
                                <input
                                    type="number"
                                    className={styles.modalInput}
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
                                            // Persist updated range configuration
                                            saveSimulationRange({ startMonth, startYear, endMonth, endYear: parsed });
                                        }
                                    }}
                                    onBlur={() => {
                                        // Reset transient input on blur
                                        setEndYearInput(null);
                                    }}
                                />
                            </div>

                            {/* Starting total savings form group */}
                            <div className={styles.formGroup}>
                                {/* Label with indicator */}
                                <label className={styles.modalFieldLabel}>
                                    {/* Indicator bar */}
                                    <span style={{ width: '3px', height: '12px', background: '#2196F3', borderRadius: '2px', display: 'inline-block' }} />
                                    {/* Label text */}
                                    <span>Starting Total Savings</span>
                                </label>
                                {/* Input field */}
                                <input
                                    type="number"
                                    className={styles.modalInput}
                                    placeholder="0"
                                    value={startTotalSavingsInput !== null ? startTotalSavingsInput : (totalSavings === 0 ? '' : totalSavings)}
                                    onChange={(e) => {
                                        // Raw string value from input
                                        const val = e.target.value;
                                        // Store raw string input in state
                                        setStartTotalSavingsInput(val);
                                        // Parse float amount
                                        const parsed = parseFloat(val);
                                        // Check if parsed number is valid
                                        if (!isNaN(parsed)) {
                                            // Update total savings in budget context
                                            updateTotalSavings(parsed);
                                        }
                                    }}
                                    onBlur={() => {
                                        // Reset transient starting savings input on blur
                                        setStartTotalSavingsInput(null);
                                    }}
                                />
                            </div>
                        </div>


                        {/* Modal Action Buttons */}
                        <div className={styles.confirmActions} style={{ marginTop: '1rem' }}>
                            {/* Close/Done button */}
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => setIsDateRangeDialogOpen(false)}
                            >
                                {/* Button label */}
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Single Month In-Widget Detailed Inspector & Editor */}
            {activeMonthData && (
                <div className={styles.panelCard}>
                    {/* Header */}
                    <div className={styles.cardHeader}>
                        {/* Title */}
                        <div className={styles.cardTitle}>
                            {/* Decorative edit pencil vector icon */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FFB74D' }}>
                                {/* Pencil path */}
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                {/* Closing svg */}
                            </svg>
                            {/* Text with month label */}
                            <span>
                                {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}
                            </span>
                            {/* Closing cardTitle div */}
                        </div>
                        {/* Action buttons group positioned on the right */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {/* Copy month data button */}
                            <button
                                type="button"
                                className={styles.syncMonthBtn}
                                onClick={() => {
                                    // Set copy source to current inspected month
                                    setCopySourceKey(activeInspectorKey);
                                    // Set initial view to configure
                                    setCopyDialogView('configure');
                                    // Open copy month dialog
                                    setIsCopyDialogOpen(true);
                                }}
                                title="Copy simulation data to/from other months"
                            >
                                {/* Copy vector icon */}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Copy icon back rect */}
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    {/* Copy icon front path */}
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    {/* Closing svg */}
                                </svg>
                                {/* Button label text */}
                                <span>Copy</span>
                                {/* Closing copy button */}
                            </button>
                            {/* Sync actual month data button positioned on the right */}
                            <button
                                type="button"
                                className={styles.syncMonthBtn}
                                onClick={() => setIsConfirmSyncOpen(true)}
                                disabled={!actualMonthData}
                                title={actualMonthData ? "Sync and override simulation data with actual database records" : "No actual database records exist for this month"}
                            >
                                {/* Sync circular arrows icon */}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Top arrow arc */}
                                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                                    {/* Closing svg */}
                                </svg>
                                {/* Button label text */}
                                <span>Sync</span>
                                {/* Closing button */}
                            </button>
                            {/* Closing action buttons group */}
                        </div>
                        {/* Closing cardHeader div */}
                    </div>

                    {/* Confirmation dialog for syncing actual month data */}
                    {isConfirmSyncOpen && typeof document !== 'undefined' && createPortal(
                        <div className={styles.confirmOverlay} onClick={() => setIsConfirmSyncOpen(false)}>
                            <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
                                {/* Dialog title */}
                                <div className={styles.confirmTitle}>
                                    {/* Sync circular arrows icon */}
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64B5F6' }}>
                                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                                    </svg>
                                    <span>Sync from Actual Month Data</span>
                                </div>
                                {/* Confirmation description text */}
                                <p className={styles.confirmText}>
                                    Are you sure you want to override the simulation data for <strong>{MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}</strong> with the actual data from the database?
                                </p>
                                {/* Warning subtext */}
                                <p className={styles.confirmSubtext}>
                                    This will replace this month's simulated income, savings contribution, budget limit, and expenses with your actual non-simulation records.
                                </p>
                                {/* Dialog action buttons row */}
                                <div className={styles.confirmActions}>
                                    {/* Cancel button */}
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => setIsConfirmSyncOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    {/* Confirm override button */}
                                    <button
                                        type="button"
                                        className={styles.primaryButton}
                                        style={{ background: '#2196F3', borderColor: '#1E88E5', color: '#fff' }}
                                        onClick={handleSyncFromActualMonth}
                                    >
                                        Yes, Override Simulation
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}



                    {/* Financial Statistics Overview Grid */}
                    <div className={styles.statsGrid}>
                        {/* Stat Card 1: Monthly Income */}
                        <div className={styles.statCard}>
                            {/* Card Header label */}
                            <span className={styles.statHeader}>
                                Monthly Income
                            </span>
                            {/* Card Value with inline pencil trigger */}
                            <div className={styles.statValue} style={{ color: 'var(--firebase-yellow)' }}>
                                {/* Value amount text */}
                                <span>{formatCurrency(inspectedMetrics.income)}</span>
                                {/* Edit pencil button for monthly income */}
                                <button
                                    type="button"
                                    className={styles.cardPencilBtn}
                                    onClick={() => handleOpenEditValuesDialog('income')}
                                    title="Edit Monthly Income"
                                >
                                    {/* Pencil SVG icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                        {/* Bottom line path */}
                                        <path d="M12 20h9" />
                                        {/* Pencil tip path */}
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        {/* Closing svg tag */}
                                    </svg>
                                    {/* Closing button tag */}
                                </button>
                                {/* Closing value div */}
                            </div>
                            {/* Explanatory subtext description */}
                            <span className={styles.statSubtext}>
                                {activeMonthData.income !== undefined ? 'Custom income set' : 'Monthly revenue available'}
                            </span>
                            {/* Closing card div */}
                        </div>

                        {/* Stat Card 2: Monthly Expenses */}
                        <div className={styles.statCard}>
                            {/* Card Header label */}
                            <span className={styles.statHeader}>
                                Monthly Expenses
                            </span>
                            {/* Card Value with inline pencil trigger */}
                            <div className={styles.statValue} style={{ color: '#29B6F6' }}>
                                {/* Value amount text */}
                                <span>{formatCurrency(inspectedMetrics.totalExpenses)}</span>
                                {/* Edit pencil button for spending budget limit */}
                                <button
                                    type="button"
                                    className={styles.cardPencilBtn}
                                    onClick={() => handleOpenEditValuesDialog('monthlyBudget')}
                                    title="Edit Spending Budget Limit"
                                >
                                    {/* Pencil SVG icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                        {/* Bottom line path */}
                                        <path d="M12 20h9" />
                                        {/* Pencil tip path */}
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        {/* Closing svg tag */}
                                    </svg>
                                    {/* Closing button tag */}
                                </button>
                                {/* Closing value div */}
                            </div>
                            {/* Budgeted subtext info */}
                            <span className={styles.statSubtext}>
                                Budgeted: {formatCurrency(inspectedMetrics.effectiveMonthlyBudget)}{inspectedMetrics.effectiveMonthlyBudget > 0 ? ` (${Math.round(inspectedMetrics.budgetUsedPercentage)}%)` : ''}
                            </span>
                            {/* Budget progress bar conditional check */}
                            {inspectedMetrics.effectiveMonthlyBudget > 0 && (
                                <div
                                    className={styles.statProgressBar}
                                    title={`${Math.round(inspectedMetrics.budgetUsedPercentage)}% of budget used`}
                                >
                                    {/* Budget progress bar fill */}
                                    <div
                                        className={styles.statProgressFill}
                                        style={{
                                            width: `${inspectedMetrics.budgetBarWidth}%`,
                                            background: inspectedMetrics.budgetBarColor
                                        }}
                                    />
                                </div>
                            )}
                            {/* Closing card div */}
                        </div>

                        {/* Stat Card: Category Budgets Total */}
                        <div className={styles.statCard}>
                            {/* Card Header label */}
                            <span className={styles.statHeader}>
                                Category Budgets Total
                            </span>
                            {/* Card Value display */}
                            <div className={styles.statValue} style={{ color: '#29B6F6' }}>
                                {/* Value amount text */}
                                <span>{formatCurrency(inspectedMetrics.categoryBudgetsTotal)}</span>
                                {/* Closing value div */}
                            </div>
                            {/* Explanatory subtext description */}
                            <span className={styles.statSubtext}>
                                Sum of all category budgets
                            </span>
                            {/* Closing card div */}
                        </div>

                        {/* Stat Card 3: Monthly Savings Deposit */}
                        <div className={styles.statCard}>
                            {/* Card Header label */}
                            <span className={styles.statHeader}>
                                Monthly Savings
                            </span>
                            {/* Card Value with inline pencil trigger */}
                            <div className={styles.statValue} style={{ color: '#AB47BC' }}>
                                {/* Value amount text */}
                                <span>{formatCurrency(inspectedMetrics.savingsDeposit)}</span>
                                {/* Edit pencil button for savings deposit */}
                                <button
                                    type="button"
                                    className={styles.cardPencilBtn}
                                    onClick={() => handleOpenEditValuesDialog('monthlySavingsDeposit')}
                                    title="Edit Monthly Savings Deposit"
                                >
                                    {/* Pencil SVG icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                        {/* Bottom line path */}
                                        <path d="M12 20h9" />
                                        {/* Pencil tip path */}
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        {/* Closing svg tag */}
                                    </svg>
                                    {/* Closing button tag */}
                                </button>
                                {/* Closing value div */}
                            </div>
                            {/* Savings rate subtext description */}
                            <span className={styles.statSubtext}>
                                {inspectedMetrics.savingsRate}% savings rate
                            </span>
                            {/* Closing card div */}
                        </div>

                        {/* Stat Card 4: Net Free Cash */}
                        <div className={styles.statCard}>
                            {/* Card Header label */}
                            <span className={styles.statHeader}>
                                Net Free Cash
                            </span>
                            {/* Value display with dynamic color */}
                            <div
                                className={styles.statValue}
                                style={{
                                    color: inspectedMetrics.netFreeCash < 0 ? 'var(--firebase-red)' : '#00E676'
                                }}
                            >
                                {/* Formatted net free cash figure */}
                                {formatCurrency(inspectedMetrics.netFreeCash)}
                                {/* Closing value div */}
                            </div>
                            {/* Explanatory subtext description */}
                            <span className={styles.statSubtext}>
                                {inspectedMetrics.netFreeCash >= 0 ? 'Unallocated income available' : 'Expenses exceed income'}
                            </span>
                            {/* Closing card div */}
                        </div>

                        {/* Stat Card 5: Total Savings */}
                        <div className={styles.statCard}>
                            {/* Card Header label */}
                            <span className={styles.statHeader}>
                                Total Savings
                            </span>
                            {/* Card Value with inline pencil trigger */}
                            <div className={styles.statValue} style={{ color: '#2196F3' }}>
                                {/* Value amount text */}
                                <span>{formatCurrency(inspectedMetrics.projectedTotalSavings)}</span>
                                {/* Edit pencil button for total savings */}
                                <button
                                    type="button"
                                    className={styles.cardPencilBtn}
                                    onClick={() => handleOpenEditValuesDialog('totalSavings')}
                                    title="Edit Total Savings"
                                >
                                    {/* Pencil SVG icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                        {/* Bottom line path */}
                                        <path d="M12 20h9" />
                                        {/* Pencil tip path */}
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        {/* Closing svg tag */}
                                    </svg>
                                    {/* Closing button tag */}
                                </button>
                                {/* Closing value div */}
                            </div>
                            {/* Subtext display showing monthly deposit and goal progress */}
                            <span className={styles.statSubtext}>
                                +{formatCurrency(inspectedMetrics.savingsDeposit)} this month{savingsGoal && savingsGoal > 0 ? ` · Goal: ${formatCurrency(savingsGoal)} (${Math.round(inspectedMetrics.savingsGoalPercentage)}%)` : ''}
                            </span>
                            {/* Savings goal progress bar conditional check */}
                            {savingsGoal && savingsGoal > 0 ? (
                                <div
                                    className={styles.statProgressBar}
                                    title={`${Math.round(inspectedMetrics.savingsGoalPercentage)}% of savings goal reached`}
                                >
                                    {/* Savings goal progress bar fill */}
                                    <div
                                        className={styles.statProgressFill}
                                        style={{
                                            width: `${inspectedMetrics.savingsGoalBarWidth}%`,
                                            background: inspectedMetrics.savingsGoalBarColor
                                        }}
                                    />
                                </div>
                            ) : null}
                            {/* Closing card div */}
                        </div>
                    </div>

                    {/* Edit Values Modal Dialog */}
                    {isEditValuesDialogOpen && typeof document !== 'undefined' && createPortal(
                        <div
                            className={styles.confirmOverlay}
                            onClick={() => setIsEditValuesDialogOpen(false)}
                        >
                            {/* Modal container */}
                            <div
                                className={styles.editValuesModal}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header Row */}
                                <div className={styles.modalHeaderRow}>
                                    {/* Modal Title */}
                                    <div className={styles.confirmTitle}>
                                        {/* Edit pencil SVG icon with dynamic thematic color */}
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{
                                                color: dialogEditingField === 'income'
                                                    ? 'var(--firebase-yellow)'
                                                    : dialogEditingField === 'monthlyBudget'
                                                    ? 'var(--firebase-red)'
                                                    : dialogEditingField === 'monthlySavingsDeposit'
                                                    ? '#00E676'
                                                    : '#2196F3'
                                            }}
                                        >
                                            {/* Pencil body */}
                                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                            {/* Closing svg */}
                                        </svg>
                                        {/* Title text */}
                                        <span>
                                            {dialogEditingField === 'income' && `Edit Monthly Income – ${MONTH_NAMES[activeMonthData.month]} ${activeMonthData.year}`}
                                            {dialogEditingField === 'monthlyBudget' && `Edit Spending Budget Limit – ${MONTH_NAMES[activeMonthData.month]} ${activeMonthData.year}`}
                                            {dialogEditingField === 'monthlySavingsDeposit' && `Edit Monthly Savings Deposit – ${MONTH_NAMES[activeMonthData.month]} ${activeMonthData.year}`}
                                            {dialogEditingField === 'totalSavings' && `Edit Total Savings – ${MONTH_NAMES[activeMonthData.month]} ${activeMonthData.year}`}
                                        </span>
                                    </div>
                                    {/* Close button */}
                                    <button
                                        type="button"
                                        className={styles.modalCloseBtn}
                                        onClick={() => setIsEditValuesDialogOpen(false)}
                                        title="Close dialog"
                                    >
                                        {/* Cross icon */}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Diagonal line 1 */}
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            {/* Diagonal line 2 */}
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                            {/* Closing svg */}
                                        </svg>
                                    </button>
                                </div>

                                {/* Modal Subtitle explanation */}
                                <p className={styles.confirmSubtext}>
                                    {dialogEditingField === 'income' && `Update the monthly income for ${MONTH_NAMES[activeMonthData.month]} ${activeMonthData.year}.`}
                                    {dialogEditingField === 'monthlyBudget' && `Update the total spending budget limit for ${MONTH_NAMES[activeMonthData.month]} ${activeMonthData.year}.`}
                                    {dialogEditingField === 'monthlySavingsDeposit' && `Update the monthly savings contribution for ${MONTH_NAMES[activeMonthData.month]} ${activeMonthData.year}.`}
                                    {dialogEditingField === 'totalSavings' && `Update the total savings balance for ${MONTH_NAMES[activeMonthData.month]} ${activeMonthData.year}.`}
                                </p>

                                {/* Modal Form */}
                                <form
                                    onSubmit={(e) => {
                                        // Prevent standard browser form submission
                                        e.preventDefault();
                                        // Execute save handler
                                        handleSaveEditValuesDialog();
                                    }}
                                >
                                    {/* Form Inputs Grid */}
                                    <div className={styles.modalFormGrid}>
                                        {/* Conditional render for Monthly Income Field */}
                                        {dialogEditingField === 'income' && (
                                            <div className={styles.formGroup}>
                                                {/* Label with icon */}
                                                <label className={styles.modalFieldLabel}>
                                                    {/* Income indicator bar */}
                                                    <span style={{ width: '3px', height: '12px', background: 'var(--firebase-yellow)', borderRadius: '2px', display: 'inline-block' }} />
                                                    {/* Label text */}
                                                    <span>Monthly Income</span>
                                                </label>
                                                {/* Input */}
                                                <input
                                                    type="number"
                                                    className={styles.modalInput}
                                                    placeholder="0"
                                                    value={tempDialogValues.income}
                                                    onChange={(e) => setTempDialogValues(prev => ({ ...prev, income: e.target.value }))}
                                                    autoFocus
                                                />
                                            </div>
                                        )}

                                        {/* Conditional render for Monthly Savings Deposit Field */}
                                        {dialogEditingField === 'monthlySavingsDeposit' && (
                                            <div className={styles.formGroup}>
                                                {/* Label with icon */}
                                                <label className={styles.modalFieldLabel}>
                                                    {/* Deposit indicator bar */}
                                                    <span style={{ width: '3px', height: '12px', background: '#00E676', borderRadius: '2px', display: 'inline-block' }} />
                                                    {/* Label text */}
                                                    <span>Monthly Savings Contribution</span>
                                                </label>
                                                {/* Input */}
                                                <input
                                                    type="number"
                                                    className={styles.modalInput}
                                                    placeholder="0"
                                                    value={tempDialogValues.monthlySavingsDeposit}
                                                    onChange={(e) => setTempDialogValues(prev => ({ ...prev, monthlySavingsDeposit: e.target.value }))}
                                                    autoFocus
                                                />
                                            </div>
                                        )}

                                        {/* Conditional render for Total Spending Budget Limit Field */}
                                        {dialogEditingField === 'monthlyBudget' && (
                                            <div className={styles.formGroup}>
                                                {/* Label with icon */}
                                                <label className={styles.modalFieldLabel}>
                                                    {/* Budget indicator bar */}
                                                    <span style={{ width: '3px', height: '12px', background: 'var(--firebase-red)', borderRadius: '2px', display: 'inline-block' }} />
                                                    {/* Label text */}
                                                    <span>Total Spending Budget Limit</span>
                                                </label>
                                                {/* Input */}
                                                <input
                                                    type="number"
                                                    className={styles.modalInput}
                                                    placeholder="0"
                                                    value={tempDialogValues.monthlyBudget}
                                                    onChange={(e) => setTempDialogValues(prev => ({ ...prev, monthlyBudget: e.target.value }))}
                                                    autoFocus
                                                />
                                            </div>
                                        )}

                                        {/* Conditional render for Total Savings Field */}
                                        {dialogEditingField === 'totalSavings' && (
                                            <div className={styles.formGroup}>
                                                {/* Label with icon */}
                                                <label className={styles.modalFieldLabel}>
                                                    {/* Savings indicator bar */}
                                                    <span style={{ width: '3px', height: '12px', background: '#2196F3', borderRadius: '2px', display: 'inline-block' }} />
                                                    {/* Label text */}
                                                    <span>Total Savings (Bank Balance)</span>
                                                </label>
                                                {/* Input */}
                                                <input
                                                    type="number"
                                                    className={styles.modalInput}
                                                    placeholder="0"
                                                    value={tempDialogValues.totalSavings}
                                                    onChange={(e) => setTempDialogValues(prev => ({ ...prev, totalSavings: e.target.value }))}
                                                    autoFocus
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Modal Action Buttons */}
                                    <div className={styles.confirmActions}>
                                        {/* Cancel button */}
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => setIsEditValuesDialogOpen(false)}
                                        >
                                            {/* Cancel text */}
                                            Cancel
                                        </button>
                                        {/* Save button */}
                                        <button
                                            type="submit"
                                            className={styles.primaryButton}
                                        >
                                            {/* Save text */}
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Categories and Expenses Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
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
                        {/* Action buttons row for adding expenses and categories */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {/* Add Expense button */}
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                onClick={() => setIsAddingExpense(true)}
                            >
                                {/* Plus icon */}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Vertical line */}
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    {/* Horizontal line */}
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    {/* Closing svg */}
                                </svg>
                                {/* Button text */}
                                <span>Add Expense</span>
                            </button>
                            {/* Add Category button */}
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                onClick={() => setIsAddingCategory(true)}
                            >
                                {/* Plus icon */}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Vertical line */}
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    {/* Horizontal line */}
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    {/* Closing svg */}
                                </svg>
                                {/* Add Category button text */}
                                <span>Add Category</span>
                            </button>
                        </div>
                    </div>

                    {/* Add Expense Modal Dialog */}
                    {isAddingExpense && typeof document !== 'undefined' && createPortal(
                        <div
                            className={styles.confirmOverlay}
                            onClick={() => setIsAddingExpense(false)}
                        >
                            {/* Modal container */}
                            <div
                                className={styles.editValuesModal}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header Row */}
                                <div className={styles.modalHeaderRow}>
                                    {/* Modal Title */}
                                    <div className={styles.confirmTitle}>
                                        {/* Plus circle icon */}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00E676' }}>
                                            {/* Plus circle outline */}
                                            <circle cx="12" cy="12" r="10" />
                                            {/* Vertical line */}
                                            <line x1="12" y1="8" x2="12" y2="16" />
                                            {/* Horizontal line */}
                                            <line x1="8" y1="12" x2="16" y2="12" />
                                            {/* Closing svg */}
                                        </svg>
                                        {/* Title text */}
                                        <span>Add Expense – {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}</span>
                                    </div>
                                    {/* Close button */}
                                    <button
                                        type="button"
                                        className={styles.modalCloseBtn}
                                        onClick={() => setIsAddingExpense(false)}
                                        title="Close dialog"
                                    >
                                        {/* Cross icon */}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Diagonal line 1 */}
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            {/* Diagonal line 2 */}
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                            {/* Closing svg */}
                                        </svg>
                                    </button>
                                </div>

                                {/* Modal Subtitle explanation */}
                                <p className={styles.confirmSubtext}>
                                    Add a new simulated expense item to {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}.
                                </p>

                                {/* Expense Form */}
                                <form
                                    onSubmit={(e) => {
                                        // Prevent default browser form submission
                                        e.preventDefault();
                                        // Execute add expense handler
                                        handleAddSingleExpense();
                                    }}
                                >
                                    {/* Form Inputs Grid */}
                                    <div className={styles.modalFormGrid}>
                                        {/* Expense Name Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: '#00E676', borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Expense Name</span>
                                            </label>
                                            {/* Input */}
                                            <input
                                                autoFocus
                                                type="text"
                                                className={styles.modalInput}
                                                placeholder="e.g. Electricity, Groceries"
                                                value={singleExpName}
                                                onChange={(e) => setSingleExpName(e.target.value)}
                                            />
                                        </div>

                                        {/* Expense Amount Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: '#00E676', borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Amount</span>
                                            </label>
                                            {/* Input */}
                                            <input
                                                type="number"
                                                className={styles.modalInput}
                                                placeholder="0"
                                                value={singleExpAmount}
                                                onChange={(e) => setSingleExpAmount(e.target.value)}
                                            />
                                        </div>

                                        {/* Category Select Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: '#64B5F6', borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Category</span>
                                            </label>
                                            {/* Select dropdown */}
                                            <select
                                                className={styles.modalInput}
                                                value={activeMonthData.categories.some(c => c.id === singleExpCatId) ? singleExpCatId : (activeMonthData.categories[0]?.id || '')}
                                                onChange={(e) => setSingleExpCatId(e.target.value)}
                                            >
                                                {/* Map categories to select options */}
                                                {activeMonthData.categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Modal Action Buttons */}
                                    <div className={styles.confirmActions} style={{ marginTop: '1rem' }}>
                                        {/* Cancel button */}
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => setIsAddingExpense(false)}
                                        >
                                            {/* Cancel text */}
                                            Cancel
                                        </button>
                                        {/* Save button */}
                                        <button
                                            type="submit"
                                            className={styles.primaryButton}
                                        >
                                            {/* Save text */}
                                            + Add Expense
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Add Category Modal Dialog */}
                    {isAddingCategory && typeof document !== 'undefined' && createPortal(
                        <div
                            className={styles.confirmOverlay}
                            onClick={() => {
                                // Close modal and reset fields
                                setIsAddingCategory(false);
                                setNewCatName('');
                                setNewCatBudget('');
                            }}
                        >
                            {/* Modal container */}
                            <div
                                className={styles.editValuesModal}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header Row */}
                                <div className={styles.modalHeaderRow}>
                                    {/* Modal Title */}
                                    <div className={styles.confirmTitle}>
                                        {/* Folder icon */}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64B5F6' }}>
                                            {/* Folder outline */}
                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                            {/* Closing svg */}
                                        </svg>
                                        {/* Title text */}
                                        <span>New Category – {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}</span>
                                    </div>
                                    {/* Close button */}
                                    <button
                                        type="button"
                                        className={styles.modalCloseBtn}
                                        onClick={() => {
                                            // Close modal and reset fields
                                            setIsAddingCategory(false);
                                            setNewCatName('');
                                            setNewCatBudget('');
                                        }}
                                        title="Close dialog"
                                    >
                                        {/* Cross icon */}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Diagonal line 1 */}
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            {/* Diagonal line 2 */}
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                            {/* Closing svg */}
                                        </svg>
                                    </button>
                                </div>

                                {/* Modal Subtitle explanation */}
                                <p className={styles.confirmSubtext}>
                                    Create a new expense category with an optional monthly spending budget limit.
                                </p>

                                {/* Category Form */}
                                <form
                                    onSubmit={(e) => {
                                        // Prevent default browser form submission
                                        e.preventDefault();
                                        // Execute add category handler
                                        handleAddSingleCategory();
                                    }}
                                >
                                    {/* Form Inputs Grid */}
                                    <div className={styles.modalFormGrid}>
                                        {/* Category Name Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: newCatColor, borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Category Name</span>
                                            </label>
                                            {/* Input */}
                                            <input
                                                autoFocus
                                                type="text"
                                                className={styles.modalInput}
                                                placeholder="Category Name"
                                                value={newCatName}
                                                onChange={(e) => setNewCatName(e.target.value)}
                                            />
                                        </div>

                                        {/* Budget Limit Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: 'var(--firebase-red)', borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Budget Limit (Optional)</span>
                                            </label>
                                            {/* Input */}
                                            <input
                                                type="number"
                                                className={styles.modalInput}
                                                placeholder="0"
                                                value={newCatBudget}
                                                onChange={(e) => setNewCatBudget(e.target.value)}
                                            />
                                        </div>

                                        {/* Color Palette Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: newCatColor, borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Theme Color</span>
                                            </label>
                                            {/* Color Palette container */}
                                            <div className={styles.colorPalette} style={{ marginTop: '0.25rem' }}>
                                                {/* Map preset color swatches */}
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
                                    </div>

                                    {/* Modal Action Buttons */}
                                    <div className={styles.confirmActions} style={{ marginTop: '1rem' }}>
                                        {/* Cancel button */}
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => {
                                                // Close modal and reset fields
                                                setIsAddingCategory(false);
                                                setNewCatName('');
                                                setNewCatBudget('');
                                            }}
                                        >
                                            {/* Cancel text */}
                                            Cancel
                                        </button>
                                        {/* Save button */}
                                        <button
                                            type="submit"
                                            className={styles.primaryButton}
                                        >
                                            {/* Save text */}
                                            Save Category
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Category list where each category row opens its details dialog */}
                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        {/* Map categories */}
                        {activeMonthData.categories.map(cat => (
                            <div
                                key={cat.id}
                                className={styles.categoryRowCard}
                                onClick={() => {
                                    // Open category modal for target category
                                    setActiveCategoryModalId(cat.id);
                                    // Initialize in-place view mode to details
                                    setCategoryModalView('details');
                                }}
                            >
                                {/* Left column: color dot, category name, and count */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                    {/* Color dot */}
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cat.color || '#4CAF50', flexShrink: 0 }} />
                                    {/* Name and expense count container */}
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        {/* Category name */}
                                        <span style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {cat.name}
                                        </span>
                                        {/* Expense count */}
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                            {(cat.expenses || []).length} { (cat.expenses || []).length === 1 ? 'expense' : 'expenses' }
                                        </span>
                                    </div>
                                </div>
                                {/* Right column: total spent, optional budget, and chevron */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                                    {/* Amount and budget limit container */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        {/* Spent amount */}
                                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                            {formatCurrency((cat.expenses || []).reduce((s, e) => s + (e.amount || 0), 0))}
                                        </span>
                                        {/* Budget limit if configured */}
                                        {cat.budget !== undefined && cat.budget > 0 && (
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                Budget: {formatCurrency(cat.budget)}
                                            </span>
                                        )}
                                    </div>
                                    {/* Navigation chevron icon */}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                                        {/* Right chevron polyline */}
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </div>
                            </div>
                        ))}
                        {/* Empty state when no categories exist */}
                        {activeMonthData.categories.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                No categories created yet. Click &quot;Add Category&quot; to begin.
                            </div>
                        )}
                    </div>

                    {/* Active Category Detail Modal Dialog */}
                    {activeCategoryModalId !== null && activeDialogCategory && typeof document !== 'undefined' && createPortal(
                        <div
                            className={styles.confirmOverlay}
                            onClick={() => {
                                // Close active category modal on backdrop click
                                setActiveCategoryModalId(null);
                                // Reset sub-view to details
                                setCategoryModalView('details');
                            }}
                        >
                            {/* Modal card container */}
                            <div
                                className={styles.categoryDetailModal}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* In-place Edit Category View */}
                                {categoryModalView === 'edit' && (
                                    <>
                                        {/* Modal Header Row */}
                                        <div className={styles.modalHeaderRow}>
                                            {/* Edit mode title with pencil icon */}
                                            <div className={styles.confirmTitle}>
                                                {/* Edit pencil icon */}
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: editCatColor || '#64B5F6' }}>
                                                    {/* Pencil body */}
                                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                                </svg>
                                                {/* Title text */}
                                                <span>Edit Category</span>
                                            </div>
                                            {/* Close button returning to details */}
                                            <button
                                                type="button"
                                                className={styles.modalCloseBtn}
                                                onClick={() => setCategoryModalView('details')}
                                                title="Back to category details"
                                            >
                                                {/* Cross icon */}
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    {/* Line 1 */}
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    {/* Line 2 */}
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Modal Subtitle explanation */}
                                        <p className={styles.confirmSubtext}>
                                            Update the category settings for {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}.
                                        </p>

                                        {/* Edit Category Form */}
                                        <form
                                            onSubmit={(e) => {
                                                // Prevent default browser form submission
                                                e.preventDefault();
                                                // Execute save category edits handler
                                                handleSaveEditCategory(activeDialogCategory.id);
                                            }}
                                        >
                                            {/* Form Inputs Grid */}
                                            <div className={styles.modalFormGrid}>
                                                {/* Category Name Field */}
                                                <div className={styles.formGroup}>
                                                    {/* Label with icon */}
                                                    <label className={styles.modalFieldLabel}>
                                                        {/* Indicator bar */}
                                                        <span style={{ width: '3px', height: '12px', background: editCatColor, borderRadius: '2px', display: 'inline-block' }} />
                                                        {/* Label text */}
                                                        <span>Category Name</span>
                                                    </label>
                                                    {/* Input */}
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className={styles.modalInput}
                                                        placeholder="Category Name"
                                                        value={editCatName}
                                                        onChange={(e) => setEditCatName(e.target.value)}
                                                    />
                                                </div>

                                                {/* Budget Limit Field */}
                                                <div className={styles.formGroup}>
                                                    {/* Label with icon */}
                                                    <label className={styles.modalFieldLabel}>
                                                        {/* Indicator bar */}
                                                        <span style={{ width: '3px', height: '12px', background: 'var(--firebase-red)', borderRadius: '2px', display: 'inline-block' }} />
                                                        {/* Label text */}
                                                        <span>Budget Limit (Optional)</span>
                                                    </label>
                                                    {/* Input */}
                                                    <input
                                                        type="number"
                                                        className={styles.modalInput}
                                                        placeholder="0"
                                                        value={editCatBudget}
                                                        onChange={(e) => setEditCatBudget(e.target.value)}
                                                    />
                                                </div>

                                                {/* Color Palette Field */}
                                                <div className={styles.formGroup}>
                                                    {/* Label with icon */}
                                                    <label className={styles.modalFieldLabel}>
                                                        {/* Indicator bar */}
                                                        <span style={{ width: '3px', height: '12px', background: editCatColor, borderRadius: '2px', display: 'inline-block' }} />
                                                        {/* Label text */}
                                                        <span>Theme Color</span>
                                                    </label>
                                                    {/* Color Palette container */}
                                                    <div className={styles.colorPalette} style={{ marginTop: '0.25rem' }}>
                                                        {/* Map preset color swatches */}
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
                                            </div>

                                            {/* Modal Action Buttons */}
                                            <div className={styles.confirmActions} style={{ marginTop: '1rem' }}>
                                                {/* Cancel button */}
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    onClick={() => setCategoryModalView('details')}
                                                >
                                                    {/* Cancel text */}
                                                    Cancel
                                                </button>
                                                {/* Save button */}
                                                <button
                                                    type="submit"
                                                    className={styles.primaryButton}
                                                >
                                                    {/* Save text */}
                                                    Save Changes
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                )}

                                {/* In-place Delete Category Confirmation View */}
                                {categoryModalView === 'delete' && (
                                    <>
                                        {/* Modal Header Row */}
                                        <div className={styles.modalHeaderRow}>
                                            {/* Danger trash title */}
                                            <div className={styles.confirmTitle}>
                                                {/* Danger trash icon */}
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--firebase-red)' }}>
                                                    {/* Trash top line */}
                                                    <polyline points="3 6 5 6 21 6" />
                                                    {/* Trash can body */}
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                                {/* Title text */}
                                                <span>Delete Category</span>
                                            </div>
                                            {/* Close button returning to details */}
                                            <button
                                                type="button"
                                                className={styles.modalCloseBtn}
                                                onClick={() => setCategoryModalView('details')}
                                                title="Back to category details"
                                            >
                                                {/* Cross icon */}
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    {/* Line 1 */}
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    {/* Line 2 */}
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Confirmation description text */}
                                        <p className={styles.confirmText}>
                                            Are you sure you want to delete the category <strong>&quot;{activeDialogCategory.name}&quot;</strong> for <strong>{MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}</strong>?
                                        </p>
                                        {/* Warning subtext */}
                                        <p className={styles.confirmSubtext}>
                                            This will also remove all itemized expenses ({activeDialogCategory.expenses?.length || 0}) listed under this category for this simulation month.
                                        </p>

                                        {/* Modal Action Buttons */}
                                        <div className={styles.confirmActions} style={{ marginTop: '1rem' }}>
                                            {/* Cancel button */}
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                onClick={() => setCategoryModalView('details')}
                                            >
                                                {/* Cancel text */}
                                                Cancel
                                            </button>
                                            {/* Delete confirmation button */}
                                            <button
                                                type="button"
                                                className={styles.dangerButton}
                                                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                                                onClick={() => handleDeleteSingleCategory(activeDialogCategory.id)}
                                            >
                                                {/* Delete button text */}
                                                Delete Category
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Standard Category Details View */}
                                {categoryModalView === 'details' && (
                                    <>
                                        {/* Modal Header Row */}
                                        <div className={styles.modalHeaderRow}>
                                            {/* Left title with category color indicator */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                                {/* Category color indicator dot */}
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: activeDialogCategory.color || '#4CAF50', flexShrink: 0 }} />
                                                {/* Category Title Heading */}
                                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {activeDialogCategory.name}
                                                </h3>
                                            </div>
                                            {/* Header action buttons */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                {/* Edit Category settings button */}
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    title="Edit category settings"
                                                    onClick={() => {
                                                        // Pre-fill name
                                                        setEditCatName(activeDialogCategory.name);
                                                        // Pre-fill color
                                                        setEditCatColor(activeDialogCategory.color || '#4CAF50');
                                                        // Pre-fill budget
                                                        setEditCatBudget(activeDialogCategory.budget ? activeDialogCategory.budget.toString() : '');
                                                        // Transition view to edit in-place
                                                        setCategoryModalView('edit');
                                                    }}
                                                >
                                                    {/* Edit pencil icon */}
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        {/* Pencil path */}
                                                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                                    </svg>
                                                </button>
                                                {/* Delete Category button */}
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    title="Delete category"
                                                    onClick={() => {
                                                        // Transition view to delete in-place
                                                        setCategoryModalView('delete');
                                                    }}
                                                >
                                                    {/* Trash can icon */}
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--firebase-red)' }}>
                                                        {/* Top line */}
                                                        <polyline points="3 6 5 6 21 6" />
                                                        {/* Body */}
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                </button>
                                                {/* Close modal cross button */}
                                                <button
                                                    type="button"
                                                    className={styles.modalCloseBtn}
                                                    onClick={() => {
                                                        // Close active category modal
                                                        setActiveCategoryModalId(null);
                                                        // Reset view mode to details
                                                        setCategoryModalView('details');
                                                    }}
                                                    title="Close dialog"
                                                >
                                                    {/* Cross icon */}
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        {/* Diagonal 1 */}
                                                        <line x1="18" y1="6" x2="6" y2="18" />
                                                        {/* Diagonal 2 */}
                                                        <line x1="6" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Month context subtitle */}
                                        <p className={styles.confirmSubtext} style={{ marginTop: '-0.3rem', marginBottom: 0 }}>
                                            Simulated expenses for {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}
                                        </p>

                                        {/* Category Budget & Spending Summary Card */}
                                        <div className={styles.catDialogSummaryCard}>
                                            {/* Top row with spent and optional budget numbers */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                {/* Total Spent Column */}
                                                <div>
                                                    {/* Small label */}
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        Total Spent
                                                    </div>
                                                    {/* Spent value */}
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                                        {formatCurrency(activeDialogCategorySpent)}
                                                    </div>
                                                </div>
                                                {/* Budget Limit Column if present */}
                                                {activeDialogCategory.budget !== undefined && activeDialogCategory.budget > 0 && (
                                                    <div style={{ textAlign: 'right' }}>
                                                        {/* Small label */}
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            Budget Limit
                                                        </div>
                                                        {/* Budget value */}
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: activeDialogCategorySpent > activeDialogCategory.budget ? 'var(--firebase-red)' : 'var(--text-secondary)', marginTop: '2px' }}>
                                                            {formatCurrency(activeDialogCategory.budget)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Budget progress bar row if budget limit configured */}
                                            {activeDialogCategory.budget !== undefined && activeDialogCategory.budget > 0 && (
                                                <div style={{ marginTop: '0.6rem' }}>
                                                    {/* Progress bar background */}
                                                    <div style={{ height: '6px', width: '100%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        {/* Progress bar fill */}
                                                        <div
                                                            style={{
                                                                height: '100%',
                                                                width: `${Math.min(100, Math.round((activeDialogCategorySpent / activeDialogCategory.budget) * 100))}%`,
                                                                background: activeDialogCategorySpent > activeDialogCategory.budget ? 'var(--firebase-red)' : (activeDialogCategory.color || '#4CAF50'),
                                                                transition: 'width 0.3s ease',
                                                                borderRadius: '3px'
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Progress bar percentage and remaining description */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                        {/* Percentage used */}
                                                        <span>{Math.round((activeDialogCategorySpent / activeDialogCategory.budget) * 100)}% used</span>
                                                        {/* Remaining or over budget label */}
                                                        <span>
                                                            {activeDialogCategory.budget >= activeDialogCategorySpent
                                                                ? `${formatCurrency(activeDialogCategory.budget - activeDialogCategorySpent)} remaining`
                                                                : `${formatCurrency(activeDialogCategorySpent - activeDialogCategory.budget)} over budget`}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Add Expense section form */}
                                        <form
                                            onSubmit={(e) => {
                                                // Prevent default page reload
                                                e.preventDefault();
                                                // Execute add expense to active category
                                                handleAddExpenseToActiveCategory(activeDialogCategory.id);
                                            }}
                                            className={styles.catQuickAddForm}
                                        >
                                            {/* Expense name input */}
                                            <input
                                                type="text"
                                                placeholder="New expense name..."
                                                value={catModalExpName}
                                                onChange={(e) => setCatModalExpName(e.target.value)}
                                                className={styles.catQuickInputName}
                                            />
                                            {/* Expense amount input */}
                                            <input
                                                type="number"
                                                placeholder="$0"
                                                value={catModalExpAmount}
                                                onChange={(e) => setCatModalExpAmount(e.target.value)}
                                                className={styles.catQuickInputAmount}
                                            />
                                            {/* Submit add button */}
                                            <button
                                                type="submit"
                                                className={styles.catQuickAddBtn}
                                                disabled={!catModalExpName.trim() || !catModalExpAmount}
                                            >
                                                + Add
                                            </button>
                                        </form>

                                        {/* Scrollable list of expenses */}
                                        <div className={styles.catExpensesScrollArea}>
                                            {/* Map category expense items */}
                                            {(activeDialogCategory.expenses || []).map(exp => (
                                                <div key={exp.id} className={styles.expenseRow}>
                                                    {/* Expense title with text truncation guard */}
                                                    <span style={{ fontSize: '0.85rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {exp.name}
                                                    </span>
                                                    {/* Amount input and delete action button container */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        {/* Amount input */}
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
                                                                handleUpdateSingleExpenseAmount(activeDialogCategory.id, exp.id, val);
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
                                                        {/* Delete expense button */}
                                                        <button
                                                            type="button"
                                                            className={styles.dangerButton}
                                                            onClick={() => handleDeleteSingleExpense(activeDialogCategory.id, exp.id)}
                                                            title="Delete expense from this month"
                                                        >
                                                            {/* Cross delete icon */}
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                {/* Line 1 */}
                                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                                {/* Line 2 */}
                                                                <line x1="6" y1="6" x2="18" y2="18" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* Empty state when no expenses exist */}
                                            {(!activeDialogCategory.expenses || activeDialogCategory.expenses.length === 0) && (
                                                <div style={{ textAlign: 'center', padding: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                                    No expenses in this category yet.
                                                </div>
                                            )}
                                        </div>

                                        {/* Modal footer action row */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                                            {/* Done button */}
                                            <button
                                                type="button"
                                                className={styles.primaryButton}
                                                style={{ width: '100%', justifyContent: 'center' }}
                                                onClick={() => {
                                                    // Close active category modal
                                                    setActiveCategoryModalId(null);
                                                    // Reset view mode to details
                                                    setCategoryModalView('details');
                                                }}
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Edit Category Modal Dialog */}
                    {editingCatId !== null && typeof document !== 'undefined' && createPortal(
                        <div
                            className={styles.confirmOverlay}
                            onClick={() => setEditingCatId(null)}
                        >
                            {/* Modal container */}
                            <div
                                className={styles.editValuesModal}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header Row */}
                                <div className={styles.modalHeaderRow}>
                                    {/* Modal Title */}
                                    <div className={styles.confirmTitle}>
                                        {/* Edit pencil icon */}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: editCatColor || '#64B5F6' }}>
                                            {/* Pencil body */}
                                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                            {/* Closing svg */}
                                        </svg>
                                        {/* Title text */}
                                        <span>Edit Category</span>
                                    </div>
                                    {/* Close button */}
                                    <button
                                        type="button"
                                        className={styles.modalCloseBtn}
                                        onClick={() => setEditingCatId(null)}
                                        title="Close dialog"
                                    >
                                        {/* Cross icon */}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Diagonal line 1 */}
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            {/* Diagonal line 2 */}
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                            {/* Closing svg */}
                                        </svg>
                                    </button>
                                </div>

                                {/* Modal Subtitle explanation */}
                                <p className={styles.confirmSubtext}>
                                    Update the category settings for {MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}.
                                </p>

                                {/* Edit Category Form */}
                                <form
                                    onSubmit={(e) => {
                                        // Prevent default browser form submission
                                        e.preventDefault();
                                        // Execute save category edits handler
                                        handleSaveEditCategory(editingCatId);
                                    }}
                                >
                                    {/* Form Inputs Grid */}
                                    <div className={styles.modalFormGrid}>
                                        {/* Category Name Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: editCatColor, borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Category Name</span>
                                            </label>
                                            {/* Input */}
                                            <input
                                                autoFocus
                                                type="text"
                                                className={styles.modalInput}
                                                placeholder="Category Name"
                                                value={editCatName}
                                                onChange={(e) => setEditCatName(e.target.value)}
                                            />
                                        </div>

                                        {/* Budget Limit Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: 'var(--firebase-red)', borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Budget Limit (Optional)</span>
                                            </label>
                                            {/* Input */}
                                            <input
                                                type="number"
                                                className={styles.modalInput}
                                                placeholder="0"
                                                value={editCatBudget}
                                                onChange={(e) => setEditCatBudget(e.target.value)}
                                            />
                                        </div>

                                        {/* Color Palette Field */}
                                        <div className={styles.formGroup}>
                                            {/* Label with icon */}
                                            <label className={styles.modalFieldLabel}>
                                                {/* Indicator bar */}
                                                <span style={{ width: '3px', height: '12px', background: editCatColor, borderRadius: '2px', display: 'inline-block' }} />
                                                {/* Label text */}
                                                <span>Theme Color</span>
                                            </label>
                                            {/* Color Palette container */}
                                            <div className={styles.colorPalette} style={{ marginTop: '0.25rem' }}>
                                                {/* Map preset color swatches */}
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
                                    </div>

                                    {/* Modal Action Buttons */}
                                    <div className={styles.confirmActions} style={{ marginTop: '1rem' }}>
                                        {/* Cancel button */}
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => setEditingCatId(null)}
                                        >
                                            {/* Cancel text */}
                                            Cancel
                                        </button>
                                        {/* Save button */}
                                        <button
                                            type="submit"
                                            className={styles.primaryButton}
                                        >
                                            {/* Save text */}
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Delete Category Confirmation Dialog */}
                    {categoryToDelete && typeof document !== 'undefined' && createPortal(
                        <div
                            className={styles.confirmOverlay}
                            onClick={() => setCategoryToDelete(null)}
                        >
                            {/* Modal container */}
                            <div
                                className={styles.confirmModal}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header Row */}
                                <div className={styles.confirmTitle}>
                                    {/* Danger trash icon */}
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--firebase-red)' }}>
                                        {/* Trash top line */}
                                        <polyline points="3 6 5 6 21 6" />
                                        {/* Trash can body */}
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        {/* Closing svg */}
                                    </svg>
                                    {/* Title text */}
                                    <span>Delete Category</span>
                                </div>
                                {/* Confirmation description text */}
                                <p className={styles.confirmText}>
                                    Are you sure you want to delete the category <strong>&quot;{categoryToDelete.name}&quot;</strong> for <strong>{MONTH_NAMES[activeMonthData.month]} {activeMonthData.year}</strong>?
                                </p>
                                {/* Warning subtext */}
                                <p className={styles.confirmSubtext}>
                                    This will also remove all itemized expenses ({categoryToDelete.expenses?.length || 0}) listed under this category for this simulation month.
                                </p>
                                {/* Modal Action Buttons */}
                                <div className={styles.confirmActions}>
                                    {/* Cancel button */}
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => setCategoryToDelete(null)}
                                    >
                                        {/* Cancel text */}
                                        Cancel
                                    </button>
                                    {/* Delete confirmation button */}
                                    <button
                                        type="button"
                                        className={styles.dangerButton}
                                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                                        onClick={() => handleDeleteSingleCategory(categoryToDelete.id)}
                                    >
                                        {/* Delete button text */}
                                        Delete Category
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
            )}

            {/* Horizon AI Analysis Section */}
            <div style={{ marginTop: '1.25rem' }}>
                {/* Mount AiAnalysis with Horizon Simulation Data */}
                <AiAnalysis
                    customTriggerLabel="Analyze Horizon Trajectory with AI"
                    horizonData={{
                        horizonSequenceCount: horizonSequence.length,
                        projectedTotalSavings: timelineSavingsMap[horizonSequence[horizonSequence.length - 1]?.key] ?? totalSavings,
                        savingsGoal: savingsGoal || 0,
                        targetLabel: horizonSequence[horizonSequence.length - 1]?.label || 'Horizon Target'
                    }}
                />
            {/* Close Horizon AI Analysis container */}
            </div>

            {/* Copy Month Modal Dialog */}
            {isCopyDialogOpen && typeof document !== 'undefined' && createPortal(
                // Modal overlay backdrop
                <div
                    className={styles.confirmOverlay}
                    onClick={() => {
                        // Close copy dialog
                        setIsCopyDialogOpen(false);
                        // Reset view back to configure
                        setCopyDialogView('configure');
                    }}
                >
                    {/* Modal card content container */}
                    <div
                        className={styles.copyModal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Configure View Condition */}
                        {copyDialogView === 'configure' && (
                            <>
                                {/* Modal header with title and close button */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Title group with icon */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {/* Copy vector icon */}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64B5F6' }}>
                                            {/* Copy icon back rect */}
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            {/* Copy icon front path */}
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        {/* Closing svg tag */}
                                        </svg>
                                        {/* Dialog title */}
                                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            Copy Month
                                        </h3>
                                    {/* Title group end */}
                                    </div>
                                    {/* Close button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Close copy dialog
                                            setIsCopyDialogOpen(false);
                                            // Reset view back to configure
                                            setCopyDialogView('configure');
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            padding: '0.25rem',
                                            fontSize: '1.1rem',
                                            lineHeight: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Close dialog"
                                    >
                                        ✕
                                    </button>
                                {/* Header row end */}
                                </div>

                                {/* Subtitle description */}
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    Duplicate simulation parameters and category expenses to target months in your horizon timeline.
                                </p>

                                {/* Source month selector section */}
                                <div>
                                    {/* Source section title */}
                                    <div style={{ marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Source Month
                                    </div>
                                    {/* Source month select dropdown */}
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
                                        ))}
                                    {/* Select Dropdown End */}
                                    </select>
                                {/* Source month selector section end */}
                                </div>

                                {/* Data scope selection section */}
                                <div>
                                    {/* Scope section title */}
                                    <div style={{ marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Data Scope
                                    </div>
                                    {/* Scope checkboxes container */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                                        {/* Parameters checkbox label */}
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                                            {/* Parameters input */}
                                            <input
                                                type="checkbox"
                                                checked={copyScopeIncomeSavings}
                                                onChange={(e) => setCopyScopeIncomeSavings(e.target.checked)}
                                                style={{ accentColor: '#2196F3', cursor: 'pointer' }}
                                            />
                                            {/* Parameters label text */}
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                Monthly Parameters
                                            </span>
                                        {/* Parameters checkbox label end */}
                                        </label>
                                        {/* Categories checkbox label */}
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                                            {/* Categories input */}
                                            <input
                                                type="checkbox"
                                                checked={copyScopeCategories}
                                                onChange={(e) => setCopyScopeCategories(e.target.checked)}
                                                style={{ accentColor: '#2196F3', cursor: 'pointer' }}
                                            />
                                            {/* Categories label text */}
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                Categories & Expenses
                                            </span>
                                        {/* Categories checkbox label end */}
                                        </label>
                                    {/* Scope checkboxes container end */}
                                    </div>
                                {/* Data scope selection section end */}
                                </div>

                                {/* Target months section */}
                                <div>
                                    {/* Target header container with title and select all / clear buttons */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                        {/* Target section title */}
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Target Months ({selectedBatchKeys.length} Selected)
                                        </span>
                                        {/* Quick select buttons */}
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            {/* Select all button */}
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                                onClick={handleSelectAllBatch}
                                            >
                                                Select All
                                            </button>
                                            {/* Clear all button */}
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                                onClick={handleDeselectAllBatch}
                                            >
                                                Clear
                                            </button>
                                        {/* Quick select buttons end */}
                                        </div>
                                    {/* Target header container end */}
                                    </div>

                                    {/* Target months chips strip */}
                                    <div className={styles.checkboxBar} style={{ padding: '0.4rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                        {/* Iterate horizon sequence */}
                                        {horizonSequence.map(item => {
                                            // Flag for baseline month
                                            const isBase = item.key === firstMonthKey;
                                            // Flag for copy source month
                                            const isSource = item.key === copySourceKey;
                                            // Flag for selected target month
                                            const isSelected = selectedBatchKeys.includes(item.key);

                                            // Render disabled chip for baseline starting month
                                            if (isBase) {
                                                return (
                                                    <span
                                                        key={item.key}
                                                        className={styles.checkboxChip}
                                                        style={{ opacity: 0.45, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)', fontSize: '0.75rem' }}
                                                        title="Baseline starting month cannot be overwritten"
                                                    >
                                                        {item.label} (Base)
                                                    </span>
                                                );
                                            }

                                            // Render disabled chip for active source month
                                            if (isSource) {
                                                return (
                                                    <span
                                                        key={item.key}
                                                        className={styles.checkboxChip}
                                                        style={{ opacity: 0.65, cursor: 'not-allowed', background: 'rgba(33, 150, 243, 0.1)', color: '#64B5F6', fontSize: '0.75rem' }}
                                                        title="Source month cannot copy into itself"
                                                    >
                                                        {item.label} (Source)
                                                    </span>
                                                );
                                            }

                                            // Return selectable target month chip
                                            return (
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
                                                {/* Target month chip label end */}
                                                </label>
                                            );
                                            // Map end
                                        })}
                                    {/* Target months chips strip end */}
                                    </div>
                                {/* Target months section end */}
                                </div>

                                {/* Action buttons row */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.4rem' }}>
                                    {/* Cancel button */}
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => {
                                            // Close copy dialog
                                            setIsCopyDialogOpen(false);
                                            // Reset view back to configure
                                            setCopyDialogView('configure');
                                        }}
                                        style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                                    >
                                        Cancel
                                    </button>
                                    {/* Continue to confirmation button */}
                                    <button
                                        type="button"
                                        className={styles.primaryButton}
                                        onClick={() => setCopyDialogView('confirm')}
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
                                        {/* Button text */}
                                        <span>Continue</span>
                                        {/* Forward chevron */}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Forward line */}
                                            <polyline points="9 18 15 12 9 6" />
                                        {/* Closing svg */}
                                        </svg>
                                    </button>
                                {/* Action buttons row end */}
                                </div>
                            </>
                        )}

                        {/* Confirm View Condition */}
                        {copyDialogView === 'confirm' && (
                            <>
                                {/* Header with warning icon and title */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Title group */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        {/* Warning icon badge */}
                                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255, 183, 77, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#FFB74D' }}>
                                            {/* Alert circle vector */}
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                {/* Outer circle */}
                                                <circle cx="12" cy="12" r="10" />
                                                {/* Top line */}
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                {/* Bottom dot */}
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            {/* Closing alert svg */}
                                            </svg>
                                        {/* Warning icon badge end */}
                                        </div>
                                        {/* Title text container */}
                                        <div>
                                            {/* Modal heading */}
                                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                Confirm Month Data Copy
                                            </h3>
                                            {/* Warning text */}
                                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                This will overwrite target simulation months.
                                            </p>
                                        {/* Title text container end */}
                                        </div>
                                    {/* Title group end */}
                                    </div>
                                    {/* Close button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Close copy dialog
                                            setIsCopyDialogOpen(false);
                                            // Reset view back to configure
                                            setCopyDialogView('configure');
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            padding: '0.25rem',
                                            fontSize: '1.1rem',
                                            lineHeight: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Close dialog"
                                    >
                                        ✕
                                    </button>
                                {/* Header with warning icon and title end */}
                                </div>

                                {/* Summary details box */}
                                <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                                    {/* Source month row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                        {/* Source label */}
                                        <span>Source Month:</span>
                                        {/* Source value */}
                                        <strong style={{ color: 'var(--text-primary)' }}>
                                            {horizonSequence.find(i => i.key === copySourceKey)?.label || copySourceKey}
                                        </strong>
                                    {/* Source month row end */}
                                    </div>
                                    {/* Target months count row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                        {/* Target count label */}
                                        <span>Target Months:</span>
                                        {/* Target count value */}
                                        <strong style={{ color: '#64B5F6' }}>
                                            {selectedBatchKeys.length} month{selectedBatchKeys.length === 1 ? '' : 's'}
                                        </strong>
                                    {/* Target months count row end */}
                                    </div>
                                    {/* Target month labels list */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.02)', padding: '0.4rem 0.5rem', borderRadius: '4px', maxHeight: '60px', overflowY: 'auto' }}>
                                        {selectedBatchKeys.map(k => horizonSequence.find(i => i.key === k)?.label || k).join(', ')}
                                    {/* Target month labels list end */}
                                    </div>
                                    {/* Data scope row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                        {/* Scope label */}
                                        <span>Data Scope:</span>
                                        {/* Scope value */}
                                        <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>
                                            {[copyScopeIncomeSavings ? 'Parameters' : '', copyScopeCategories ? 'Categories & Expenses' : ''].filter(Boolean).join(' + ')}
                                        </span>
                                    {/* Data scope row end */}
                                    </div>
                                {/* Summary details box end */}
                                </div>

                                {/* Confirmation action buttons */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.4rem' }}>
                                    {/* Back button */}
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => setCopyDialogView('configure')}
                                        style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                                    >
                                        Back
                                    </button>
                                    {/* Confirm copy execute button */}
                                    <button
                                        type="button"
                                        className={styles.primaryButton}
                                        onClick={handleExecuteCopyData}
                                        style={{ padding: '0.55rem 1.15rem', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    >
                                        {/* Checkmark icon */}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Check polyline */}
                                            <polyline points="20 6 9 17 4 12" />
                                        {/* Closing svg */}
                                        </svg>
                                        {/* Confirm label text */}
                                        <span>Confirm & Copy</span>
                                    </button>
                                {/* Confirmation action buttons end */}
                                </div>
                            </>
                        )}
                    {/* Modal card content container end */}
                    </div>
                {/* Modal overlay backdrop end */}
                </div>,
                // Direct portal render target to document body
                document.body            )}
        </div>
    );
}
