"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { BudgetContextType, Category, Expense, MonthData, PreviewCategory, PreviewExpense } from '../types';
// Import Firestore database connection from local config
import { db } from '../firebase';
// Import required document, collection, and query methods from Firebase Firestore SDK
import { doc, getDoc, collection, query, orderBy, limit, getDocs, setDoc } from 'firebase/firestore';
import { useFirestoreSync } from './useFirestoreSync';
import { useAuth } from './AuthContext';

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

// Helper to generate key
const getMonthKey = (month: number, year: number) => `${year}-${month}`;

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const currentKey = getMonthKey(currentMonth, currentYear);
    const { incomeState: income, categoriesState: categories, setIncomeState, setCategoriesState, loading, updateFirestore } = useFirestoreSync(user, currentKey);
    const [isInitialized, setIsInitialized] = useState(false);
    const [totalSavings, setTotalSavings] = useState(0);

    const [defaultMonthSettings, setDefaultMonthSettings] = useState<{ month: number, year: number } | null>(null);
    // Declare state for importing PDF mappings and ignored lists
    const [pdfConfig, setPdfConfig] = useState<{ mappings: Record<string, string>; ignored: string[] } | null>(null);

    // Initialize user landing month and total savings preference from remote or local storage
    useEffect(() => {
        // Define helper function to initialize month/year preference from local mock database
        const initializeMockMonth = async () => {
            // Attempt to query mock settings API
            try {
                // Fetch mock user object from API
                const res = await fetch('/api/mock-db?userId=test-user', { cache: 'no-store' });
                // Parse API response JSON
                const userData = await res.json();
                // Check if totalSavings is defined
                if (userData.totalSavings !== undefined) {
                    // Update total savings state
                    setTotalSavings(userData.totalSavings);
                // End of totalSavings check
                }
                // Check if pdfConfig is defined in mock database response
                if (userData.pdfConfig !== undefined) {
                    // Update pdfConfig state
                    setPdfConfig(userData.pdfConfig);
                // End of pdfConfig check
                }
                // Check if defaultMonth and defaultYear are set
                if (userData.defaultMonth !== undefined && userData.defaultMonth !== null && userData.defaultYear !== undefined && userData.defaultYear !== null) {
                    // Update current month state
                    setCurrentMonth(userData.defaultMonth);
                    // Update current year state
                    setCurrentYear(userData.defaultYear);
                    // Update default month settings state
                    setDefaultMonthSettings({ month: userData.defaultMonth, year: userData.defaultYear });
                    // Exit early as default preference found
                    return;
                // End of default preferences check
                }
                // Fallback: search for latest month in months dictionary
                if (userData.months && Object.keys(userData.months).length > 0) {
                    // Get keys of all months
                    const keys = Object.keys(userData.months);
                    // Sort month keys in descending order (newest first)
                    keys.sort((a, b) => {
                        // Compare key strings directly
                        return b.localeCompare(a);
                    // End of sort callback
                    });
                    // Get latest month data
                    const latestMonth = userData.months[keys[0]];
                    // Check if latest month exists
                    if (latestMonth && latestMonth.month !== undefined && latestMonth.year !== undefined) {
                        // Set current month to latest month
                        setCurrentMonth(latestMonth.month);
                        // Set current year to latest year
                        setCurrentYear(latestMonth.year);
                    // End of latestMonth check
                    }
                // End of months check
                }
            // Catch error on network/saving request failure
            } catch (error) {
                // Log mock initialization errors
                console.error("Error fetching mock initialization data:", error);
            // End of catch block
            } finally {
                // Toggle initialization loading status to true
                setIsInitialized(true);
            // End of finally block
            }
        // End of initializeMockMonth definition
        };
        // Define helper function to initialize month/year preference from Firestore
        const initializeMonth = async () => {
            // Return early if no user logged in or initialization complete
            if (!user || isInitialized) return;

            // Attempt to retrieve preferences from Firestore
            try {
                // Get user configuration document reference
                const userDocRef = doc(db, 'users', user.uid);
                // Fetch document snapshot from Firestore
                const userDocSnap = await getDoc(userDocRef);

                // If user document exists in Firestore
                if (userDocSnap.exists()) {
                    // Parse data from document snapshot
                    const userData = userDocSnap.data();
                    // If total savings is defined
                    if (userData.totalSavings !== undefined) {
                        // Set savings state
                        setTotalSavings(userData.totalSavings);
                    // End of totalSavings validation
                    }
                    // If pdfConfig is defined in Firestore record
                    if (userData.pdfConfig !== undefined) {
                        // Set pdfConfig state
                        setPdfConfig(userData.pdfConfig);
                    // End of pdfConfig validation
                    }
                    // If default landing month and year preferences are set
                    if (userData.defaultMonth !== undefined && userData.defaultYear !== undefined) {
                        // Set month state
                        setCurrentMonth(userData.defaultMonth);
                        // Set year state
                        setCurrentYear(userData.defaultYear);
                        // Set default month settings state
                        setDefaultMonthSettings({ month: userData.defaultMonth, year: userData.defaultYear });
                        // Complete initialization
                        setIsInitialized(true);
                        // Exit early
                        return;
                    // End of default settings validation
                    }
                // End of document existence check
                }

                // Query collections reference for months to fallback to latest active month
                const monthsRef = collection(db, 'users', user.uid, 'months');
                // Construct query to find latest month document
                const q = query(monthsRef, orderBy('year', 'desc'), orderBy('month', 'desc'), limit(1));
                // Fetch matching documents snapshot
                const querySnapshot = await getDocs(q);

                // Check if any month data is returned
                if (!querySnapshot.empty) {
                    // Get latest month document data
                    const latestDoc = querySnapshot.docs[0].data() as MonthData;
                    // If month and year are defined
                    if (latestDoc.month !== undefined && latestDoc.year !== undefined) {
                        // Set month state
                        setCurrentMonth(latestDoc.month);
                        // Set year state
                        setCurrentYear(latestDoc.year);
                    // End of latest month validation
                    }
                // End of snapshot empty validation
                }
            // Catch Firestore document read errors
            } catch (error) {
                // Log initialization errors
                console.error("Error fetching initialization data:", error);
            // End of catch block
            } finally {
                // Complete initialization regardless of success
                setIsInitialized(true);
            // End of finally block
            }
        // End of initializeMonth definition
        };

        // If user is logged in as test user
        if (user && user.uid === 'test-user') {
            // Trigger mock initialization
            initializeMockMonth();
            // Return out
            return;
        // End of test user check
        }

        // Trigger standard initialization
        initializeMonth();
    // Re-run initialization effect if user changes
    }, [user]);

    // Function to persist user's default month preference
    const saveDefaultMonth = async (month: number, year: number) => {
        // Return early if no active user session
        if (!user) return;
        // Check if user is the mock test user
        if (user.uid === 'test-user') {
            // Attempt to update mock database default month settings
            try {
                // Post new default settings to local API
                await fetch('/api/mock-db', {
                    // Use POST HTTP method
                    method: 'POST',
                    // Set request headers to JSON content type
                    headers: {
                        // Specify application/json content type
                        'Content-Type': 'application/json'
                    // End of headers object definition
                    },
                    // Stringify mock POST request parameters
                    body: JSON.stringify({
                        // User ID identifying mock session
                        userId: 'test-user',
                        // Specify update_settings action
                        action: 'update_settings',
                        // Settings details payload
                        settings: {
                            // Update default month index
                            defaultMonth: month,
                            // Update default year number
                            defaultYear: year
                        // End of settings object
                        }
                    // End of body stringification
                    })
                // End of fetch options definition
                });
                // Update default month settings state locally
                setDefaultMonthSettings({ month, year });
            // Catch error on network/saving request failure
            } catch (error) {
                // Log error details to console
                console.error("Error saving mock default month:", error);
            // End of catch block
            }
            // Exit early
            return;
        // End of test-user default month conditional check
        }
        // Attempt to write preference to Firestore
        try {
            // Write default month and year preference to user record
            await setDoc(doc(db, 'users', user.uid), {
                // Set default month
                defaultMonth: month,
                // Set default year
                defaultYear: year
            // Enable merge option to preserve other fields
            }, { merge: true });
            // Set state locally
            setDefaultMonthSettings({ month, year });
        // Catch database update errors
        } catch (error) {
            // Log saving preference errors
            console.error("Error saving default month:", error);
        // End of catch block
        }
    // End of saveDefaultMonth definition
    };

    // Function to update and persist total savings amount
    const updateTotalSavings = async (amount: number) => {
        // Set local total savings state immediately
        setTotalSavings(amount);
        // Return early if no active user session
        if (!user) return;
        // Check if user is the mock test user
        if (user.uid === 'test-user') {
            // Attempt to update mock database total savings
            try {
                // Post new savings amount to local API
                await fetch('/api/mock-db', {
                    // Use POST HTTP method
                    method: 'POST',
                    // Set request headers to JSON content type
                    headers: {
                        // Specify application/json content type
                        'Content-Type': 'application/json'
                    // End of headers object definition
                    },
                    // Stringify mock POST request parameters
                    body: JSON.stringify({
                        // User ID identifying mock session
                        userId: 'test-user',
                        // Specify update_settings action
                        action: 'update_settings',
                        // Settings details payload
                        settings: {
                            // Update total savings
                            totalSavings: amount
                        // End of settings object
                        }
                    // End of body stringification
                    })
                // End of fetch options definition
                });
            // Catch error on network/saving request failure
            } catch (error) {
                // Log error details to console
                console.error("Error saving mock total savings:", error);
            // End of catch block
            }
            // Exit early
            return;
        // End of test-user total savings conditional check
        }
        // Attempt Firestore write
        try {
            // Lazy load setDoc function from Firestore
            const { setDoc: lazySetDoc } = await import('firebase/firestore');
            // Write updated savings amount to user document
            await lazySetDoc(doc(db, 'users', user.uid), {
                // Set savings amount
                totalSavings: amount
            // Merge to preserve existing preferences
            }, { merge: true });
        // Catch saving errors
        } catch (error) {
            // Log update total savings errors
            console.error("Error saving total savings:", error);
        // End of catch block
        }
    // End of updateTotalSavings definition
    };

    // Function to update and persist PDF import configurations mapping
    const updatePDFConfig = async (config: { mappings: Record<string, string>; ignored: string[] }) => {
        // Set local state immediately
        setPdfConfig(config);
        // Return early if no active user session
        if (!user) return;
        // Check if user is the mock test user
        if (user.uid === 'test-user') {
            // Attempt to update mock database PDF settings
            try {
                // Post new settings to local API
                await fetch('/api/mock-db', {
                    // Use POST HTTP method
                    method: 'POST',
                    // Set request headers to JSON content type
                    headers: {
                        // Specify application/json content type
                        'Content-Type': 'application/json'
                    // End of headers object definition
                    },
                    // Stringify mock POST request parameters
                    body: JSON.stringify({
                        // User ID identifying mock session
                        userId: 'test-user',
                        // Specify update_settings action
                        action: 'update_settings',
                        // Settings details payload
                        settings: {
                            // Update PDF configuration settings
                            pdfConfig: config
                        // End of settings object
                        }
                    // End of body stringification
                    })
                // End of fetch options definition
                });
            // Catch error on network/saving request failure
            } catch (error) {
                // Log error details to console
                console.error("Error saving mock PDF config:", error);
            // End of catch block
            }
            // Exit early
            return;
        // End of test-user PDF config check
        }
        // Attempt Firestore write
        try {
            // Lazy load setDoc function from Firestore
            const { setDoc: lazySetDoc } = await import('firebase/firestore');
            // Write updated PDF configurations to user document
            await lazySetDoc(doc(db, 'users', user.uid), {
                // Set PDF import configurations
                pdfConfig: config
            // Merge to preserve existing preferences
            }, { merge: true });
        // Catch database update errors
        } catch (error) {
            // Log update PDF configurations errors
            console.error("Error saving PDF config:", error);
        // End of catch block
        }
    // End of updatePDFConfig definition
    };

    // Helper to update Firestore
    const updateFirestoreWrapper = async (newIncome: number, newCategories: Category[]) => {
        await updateFirestore(newIncome, newCategories, currentMonth, currentYear);
    };

    // Calculate totals
    const totalExpenses = useMemo(() => {
        return categories.reduce((total, cat) => {
            const catTotal = cat.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            return total + catTotal;
        }, 0);
    }, [categories]);

    const savings = useMemo(() => {
        return income - totalExpenses;
    }, [income, totalExpenses]);



    const setIncome = (amount: number) => {
        updateFirestoreWrapper(amount, categories);
    };

    // Function to add a new custom category
    const addCategory = (name: string, color: string): Category => {
        // Create new category object definition
        const newCategory: Category = {
            // Generate unique string ID
            id: Math.random().toString(36).substr(2, 9),
            // Set category name
            name,
            // Set category color
            color,
            // Initialize empty expenses array
            expenses: [],
            // Place at the top position
            order: 0,
        // Close category object
        };
        // Increment order for all existing categories
        const updatedExisting = categories.map(c => ({
            // Spread existing properties
            ...c,
            // Offset existing order by 1
            order: (c.order ?? 0) + 1
        // Close mapping object
        }));
        // Update database with new categories array prepended
        updateFirestoreWrapper(income, [newCategory, ...updatedExisting]);
        // Return created category instance
        return newCategory;
    // Close function
    };
    // Function to add multiple categories at once if they are missing
    const addMissingCategories = (missing: { name: string, color: string }[]) => {
        // Map missing category parameters into structured Category models
        const newCats: Category[] = missing.map((c, idx) => ({
            // Generate unique random string identifier
            id: Math.random().toString(36).substr(2, 9),
            // Assign name
            name: c.name,
            // Assign color
            color: c.color,
            // Initialize empty expenses collection
            expenses: [],
            // Set ordering position index at the top
            order: idx,
        // Close category mapping object
        }));
        // Increment order for all existing categories by the number of new categories
        const updatedExisting = categories.map(c => ({
            // Spread category properties
            ...c,
            // Offset order by the length of new categories added
            order: (c.order ?? 0) + missing.length
        // Close mapping object
        }));
        // Update database with concatenated categories collection prepended
        updateFirestoreWrapper(income, [...newCats, ...updatedExisting]);
    // Close function
    };

    const updateCategory = (id: string, name: string, color: string) => {
        const newCategories = categories.map(cat =>
            cat.id === id ? { ...cat, name, color } : cat
        );
        updateFirestoreWrapper(income, newCategories);
    };

    const deleteCategory = (id: string) => {
        const newCategories = categories.filter(cat => cat.id !== id);
        updateFirestoreWrapper(income, newCategories);
    };

    const addExpense = (categoryId: string, expense: Omit<Expense, 'id'>) => {
        const newExpense: Expense = {
            ...expense,
            id: Math.random().toString(36).substr(2, 9),
        };
        const newCategories = categories.map(cat => {
            if (cat.id === categoryId) {
                return { ...cat, expenses: [...cat.expenses, newExpense] };
            }
            return cat;
        });
        updateFirestoreWrapper(income, newCategories);
    };

    // Function to add multiple expenses at once (batch import)
    const addExpenses = (newExpensesList: { categoryId: string, expense: Omit<Expense, 'id'> }[]) => {
        // Map categories array to inject corresponding batched items
        const newCategories = categories.map((cat) => {
            // Create a mutable copy of existing expenses for this category
            const updatedExpenses = [...cat.expenses];
            // Filter incoming list matching current category ID index
            const catExpensesToAdd = newExpensesList.filter((item) => item.categoryId === cat.id);
            // Loop through each expense details object to insert or update
            for (const item of catExpensesToAdd) {
                // Add new expense details block unconditionally for batch import
                updatedExpenses.push({
                    // Spread payload details
                    ...item.expense,
                    // Generate random unique identifier string
                    id: Math.random().toString(36).substr(2, 9)
                // End of new expense object
                });
            }
            // Return updated category containing modified expenses
            return {
                // Spread category fields
                ...cat,
                // Assign updated expenses array
                expenses: updatedExpenses
            // End of returned category object
            };
        });
        // Update database with batch category changes
        updateFirestoreWrapper(income, newCategories);
    };

    const updateExpense = (categoryId: string, expense: Expense) => {
        const newCategories = categories.map(cat => {
            if (cat.id === categoryId) {
                return {
                    ...cat,
                    expenses: cat.expenses.map(exp => exp.id === expense.id ? expense : exp)
                };
            }
            return cat;
        });
        updateFirestoreWrapper(income, newCategories);
    };

    const deleteExpense = (categoryId: string, expenseId: string) => {
        const newCategories = categories.map(cat => {
            if (cat.id === categoryId) {
                return {
                    ...cat,
                    expenses: cat.expenses.filter(exp => exp.id !== expenseId)
                };
            }
            return cat;
        });
        updateFirestoreWrapper(income, newCategories);
    };

    const moveExpense = (oldCategoryId: string, newCategoryId: string, expense: Expense) => {
        const newCategories = categories.map(cat => {
            if (cat.id === oldCategoryId) {
                return {
                    ...cat,
                    expenses: cat.expenses.filter(exp => exp.id !== expense.id)
                };
            }
            if (cat.id === newCategoryId) {
                return {
                    ...cat,
                    expenses: [...cat.expenses, expense]
                };
            }
            return cat;
        });
        updateFirestoreWrapper(income, newCategories);
    };

    const changeMonth = (month: number, year: number) => {
        setCurrentMonth(month);
        setCurrentYear(year);
    };

    // Function to clone categories and recurring expenses from previous active month
    const copyPreviousMonthData = async () => {
        // Return early if no active user session
        if (!user) return;
        // Calculate previous month date object
        const prevDate = new Date(currentYear, currentMonth - 1, 1);
        // Generate previous month key string
        const prevKey = getMonthKey(prevDate.getMonth(), prevDate.getFullYear());
        // Check if user is the mock test user
        if (user.uid === 'test-user') {
            // Attempt to copy previous month details from mock database
            try {
                // Fetch previous month data from API
                const res = await fetch(`/api/mock-db?userId=test-user&monthKey=${prevKey}`, { cache: 'no-store' });
                // Parse API response JSON
                const prevData = await res.json();
                // Check if categories exist in previous month data
                if (prevData && prevData.categories && prevData.categories.length > 0) {
                    // Deep copy categories and regenerate unique IDs
                    const newCategories = prevData.categories.map((cat: any) => {
                        // Return mapped category copy
                        return {
                            // Set generated category ID
                            id: Math.random().toString(36).substr(2, 9),
                            // Copy category name
                            name: cat.name,
                            // Copy color code
                            color: cat.color,
                            // Copy position ordering index
                            order: cat.order,
                            // Map categories expenses list
                            expenses: cat.expenses.map((exp: any) => {
                                // Return mapped expense copy
                                return {
                                    // Set generated expense ID
                                    id: Math.random().toString(36).substr(2, 9),
                                    // Copy expense name
                                    name: exp.name,
                                    // Copy amount
                                    amount: exp.amount,
                                    // Copy payment day
                                    paymentDay: exp.paymentDay,
                                    // Copy recurring flag status
                                    isRecurring: exp.isRecurring
                                // End of expense mapping
                                };
                            // End of expenses mapping call
                            })
                        // End of category mapping
                        };
                    // End of categories mapping call
                    });
                    // Save copied data to current month
                    await updateFirestoreWrapper(prevData.income, newCategories);
                // End of categories presence check
                }
            // Catch error on network/saving request failure
            } catch (error) {
                // Log mock data copy errors
                console.error("Error copying mock previous month data:", error);
            // End of catch block
            }
            // Exit early
            return;
        // End of test-user check
        }
        // Get document reference for previous month
        const prevDocRef = doc(db, 'users', user.uid, 'months', prevKey);
        // Fetch document snapshot from database
        const prevSnap = await getDoc(prevDocRef);

        // Check if previous month document exists
        if (prevSnap.exists()) {
            // Retrieve document data as MonthData
            const prevData = prevSnap.data() as MonthData;

            // Map and deep clone categories and expenses with fresh random IDs
            const newCategories = prevData.categories.map(cat => ({
                // Copy all properties
                ...cat,
                // Regenerate category ID
                id: Math.random().toString(36).substr(2, 9),
                // Map over expenses array
                expenses: cat.expenses.map(exp => ({
                    // Copy all expense properties
                    ...exp,
                    // Regenerate expense ID
                    id: Math.random().toString(36).substr(2, 9)
                }))
            }));

            // Save cloned data to current month database entry
            updateFirestoreWrapper(prevData.income, newCategories);
        // End of prevSnap check
        }
    // End of copyPreviousMonthData definition
    };

    // Function to fetch recurring expenses from the previous active month for preview
    const getRecurringFromPreviousMonth = async (): Promise<PreviewCategory[] | null> => {
        if (!user) return null;
        
        const prevDate = new Date(currentYear, currentMonth - 1, 1);
        const prevKey = getMonthKey(prevDate.getMonth(), prevDate.getFullYear());
        
        let prevData: MonthData | null = null;
        
        if (user.uid === 'test-user') {
            try {
                const res = await fetch(`/api/mock-db?userId=test-user&monthKey=${prevKey}`, { cache: 'no-store' });
                prevData = await res.json();
            } catch (error) {
                console.error("Error fetching mock previous month data:", error);
                return null;
            }
        } else {
            const prevDocRef = doc(db, 'users', user.uid, 'months', prevKey);
            const prevSnap = await getDoc(prevDocRef);
            if (prevSnap.exists()) {
                prevData = prevSnap.data() as MonthData;
            }
        }

        if (prevData && prevData.categories && prevData.categories.length > 0) {
            const filteredCategories: PreviewCategory[] = [];
            prevData.categories.forEach((prevCat: any) => {
                const recurringExpenses = prevCat.expenses.filter((exp: any) => exp.isRecurring);
                if (recurringExpenses.length > 0) {
                    const previewExpenses: PreviewExpense[] = recurringExpenses.map((exp: any) => {
                        let existingId: string | undefined = undefined;
                        for (const cat of categories) {
                            const match = cat.expenses.find(e => e.name === exp.name);
                            if (match) {
                                existingId = match.id;
                                break;
                            }
                        }
                        return {
                            ...exp,
                            alreadyExists: !!existingId,
                            existingExpenseId: existingId,
                            willUpdate: true // Default to true so user can opt-out
                        };
                    });
                    
                    filteredCategories.push({
                        ...prevCat,
                        expenses: previewExpenses
                    });
                }
            });
            return filteredCategories.length > 0 ? filteredCategories : null;
        }
        return null;
    };

    // Function to merge the confirmed recurring expenses into the current month
    const importRecurringExpenses = async (categoriesToMerge: PreviewCategory[]) => {
        if (!user || categoriesToMerge.length === 0) return;
        
        let currentCategories = [...categories];

        categoriesToMerge.forEach((prevCat) => {
            prevCat.expenses.forEach(exp => {
                // Skip if the user deselected this transaction
                if (!exp.willUpdate) return;

                if (exp.alreadyExists && exp.existingExpenseId) {
                    currentCategories = currentCategories.map(cat => ({
                        ...cat,
                        expenses: cat.expenses.map(e => e.id === exp.existingExpenseId ? { ...e, amount: exp.amount, paymentDay: exp.paymentDay } : e)
                    }));
                } else {
                    const existingCategoryIndex = currentCategories.findIndex(c => c.name === prevCat.name);
                    if (existingCategoryIndex !== -1) {
                        currentCategories[existingCategoryIndex] = {
                            ...currentCategories[existingCategoryIndex],
                            expenses: [
                                ...currentCategories[existingCategoryIndex].expenses,
                                {
                                    id: Math.random().toString(36).substr(2, 9),
                                    name: exp.name,
                                    amount: exp.amount,
                                    paymentDay: exp.paymentDay,
                                    isRecurring: exp.isRecurring
                                }
                            ]
                        };
                    } else {
                        currentCategories.push({
                            id: Math.random().toString(36).substr(2, 9),
                            name: prevCat.name,
                            color: prevCat.color,
                            order: currentCategories.length,
                            expenses: [{
                                id: Math.random().toString(36).substr(2, 9),
                                name: exp.name,
                                amount: exp.amount,
                                paymentDay: exp.paymentDay,
                                isRecurring: exp.isRecurring
                            }]
                        });
                    }
                }
            });
        });

        await updateFirestoreWrapper(income, currentCategories);
    };

    const moveCategory = (id: string, direction: 'up' | 'down') => {
        const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
        const index = sortedCategories.findIndex(c => c.id === id);

        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === sortedCategories.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap orders
        const currentOrder = sortedCategories[index].order ?? index;
        const targetOrder = sortedCategories[targetIndex].order ?? targetIndex;

        sortedCategories[index].order = targetOrder;
        sortedCategories[targetIndex].order = currentOrder;

        updateFirestoreWrapper(income, sortedCategories);
    };

    const reorderCategories = (newCategories: Category[]) => {
        // Ensure order field is updated based on index
        const orderedCategories = newCategories.map((cat, index) => ({
            ...cat,
            order: index
        }));
        setCategoriesState(orderedCategories);
        updateFirestoreWrapper(income, orderedCategories);
    };

    const loadMockData = (mockIncome: number, mockCategories: Category[]) => {
        // Ensure order field is set
        const orderedCategories = mockCategories.map((cat, index) => ({
            ...cat,
            order: index
        }));
        setIncomeState(mockIncome);
        // Update local categories state
        setCategoriesState(orderedCategories);
        // Persist mock data to Firestore database
        updateFirestoreWrapper(mockIncome, orderedCategories);
    };

    // Function to clear all expenses and reset income for the current month
    const clearMonthData = () => {
        // Update local income state to zero
        setIncomeState(0);
        // Update local categories state to empty
        setCategoriesState([]);
        // Persist zero income and cleared categories to database storage
        updateFirestoreWrapper(0, []);
    };

    const budgetContextValue = {
        currentMonth,
        currentYear,
        income,
        categories,
        totalExpenses,
        savings,
        setIncome,
        addCategory,
        updateCategory,
        deleteCategory,
        addExpense,
        updateExpense,
        deleteExpense,
        moveExpense,
        changeMonth,
        copyPreviousMonthData,
        getRecurringFromPreviousMonth,
        importRecurringExpenses,
        moveCategory,
        reorderCategories,
        saveDefaultMonth,
        defaultMonthSettings,
        loadMockData,
        totalSavings,
        updateTotalSavings,
        setMonth: changeMonth,
        // Add batch category adder helper function
        addMissingCategories,
        // Add batch expenses adder helper function
        addExpenses,
        // Expose pdfConfig state
        pdfConfig,
        // Expose updatePDFConfig callback function
        updatePDFConfig,
        // Loading state flag
        loading,
        // Expose clearMonthData callback function
        clearMonthData
    };

    React.useEffect(() => {
        (window as any).budget = budgetContextValue;
    }, [budgetContextValue]);

    return (
        <BudgetContext.Provider value={budgetContextValue}>
            {children}
        </BudgetContext.Provider>
    );
};

export const useBudget = () => {
    const context = useContext(BudgetContext);
    if (context === undefined) {
        throw new Error('useBudget must be used within a BudgetProvider');
    }
    return context;
};
