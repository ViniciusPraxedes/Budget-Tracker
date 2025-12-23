"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { BudgetContextType, Category, Expense, MonthData } from '../types';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

// Helper to generate key
const getMonthKey = (month: number, year: number) => `${year}-${month}`;

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const [income, setIncomeState] = useState(0);
    const [categories, setCategoriesState] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    const [defaultMonthSettings, setDefaultMonthSettings] = useState<{ month: number, year: number } | null>(null);

    // Initialize to latest month with data on load
    useEffect(() => {
        const initializeMonth = async () => {
            if (!user || isInitialized) return;

            try {
                // 1. Check for user default preference
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userData.defaultMonth !== undefined && userData.defaultYear !== undefined) {
                        setCurrentMonth(userData.defaultMonth);
                        setCurrentYear(userData.defaultYear);
                        setDefaultMonthSettings({ month: userData.defaultMonth, year: userData.defaultYear });
                        setIsInitialized(true);
                        return; // Preference found, stop here
                    }
                }

                // 2. Fallback to latest month with data
                const monthsRef = collection(db, 'users', user.uid, 'months');
                const q = query(monthsRef, orderBy('year', 'desc'), orderBy('month', 'desc'), limit(1));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const latestDoc = querySnapshot.docs[0].data() as MonthData;
                    if (latestDoc.month !== undefined && latestDoc.year !== undefined) {
                        setCurrentMonth(latestDoc.month);
                        setCurrentYear(latestDoc.year);
                    }
                }
            } catch (error) {
                console.error("Error fetching initialization data:", error);
            } finally {
                setIsInitialized(true);
            }
        };

        initializeMonth();
    }, [user]);

    const saveDefaultMonth = async (month: number, year: number) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'users', user.uid), {
                defaultMonth: month,
                defaultYear: year
            }, { merge: true });
            setDefaultMonthSettings({ month, year });
        } catch (error) {
            console.error("Error saving default month:", error);
        }
    };

    const currentKey = getMonthKey(currentMonth, currentYear);

    // Subscribe to Firestore updates
    useEffect(() => {
        if (!user) {
            setIncomeState(0);
            setCategoriesState([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const docRef = doc(db, 'users', user.uid, 'months', currentKey);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as MonthData;
                setIncomeState(data.income || 0);
                const fetchedCategories = data.categories || [];
                // Sort by order
                fetchedCategories.sort((a, b) => (a.order || 0) - (b.order || 0));
                setCategoriesState(fetchedCategories);
            } else {
                // Initialize if doesn't exist
                setIncomeState(0);
                setCategoriesState([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentKey, user]);

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

    // Helper to update Firestore
    const updateFirestore = async (newIncome: number, newCategories: Category[]) => {
        if (!user) return;
        const docRef = doc(db, 'users', user.uid, 'months', currentKey);
        await setDoc(docRef, {
            month: currentMonth,
            year: currentYear,
            income: newIncome,
            categories: newCategories
        });
    };

    const setIncome = (amount: number) => {
        updateFirestore(amount, categories);
    };

    const addCategory = (name: string, color: string) => {
        const newCategory: Category = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            color,
            expenses: [],
            order: categories.length, // Append to end
        };
        updateFirestore(income, [...categories, newCategory]);
    };

    const updateCategory = (id: string, name: string, color: string) => {
        const newCategories = categories.map(cat =>
            cat.id === id ? { ...cat, name, color } : cat
        );
        updateFirestore(income, newCategories);
    };

    const deleteCategory = (id: string) => {
        const newCategories = categories.filter(cat => cat.id !== id);
        updateFirestore(income, newCategories);
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
        updateFirestore(income, newCategories);
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
        updateFirestore(income, newCategories);
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
        updateFirestore(income, newCategories);
    };

    const changeMonth = (month: number, year: number) => {
        setCurrentMonth(month);
        setCurrentYear(year);
    };

    const copyPreviousMonthData = async () => {
        if (!user) return;
        // Calculate previous month date
        const prevDate = new Date(currentYear, currentMonth - 1, 1);
        const prevKey = getMonthKey(prevDate.getMonth(), prevDate.getFullYear());

        const prevDocRef = doc(db, 'users', user.uid, 'months', prevKey);
        const prevSnap = await getDoc(prevDocRef);

        if (prevSnap.exists()) {
            const prevData = prevSnap.data() as MonthData;

            // Deep copy and regenerate IDs
            const newCategories = prevData.categories.map(cat => ({
                ...cat,
                id: Math.random().toString(36).substr(2, 9),
                expenses: cat.expenses.map(exp => ({
                    ...exp,
                    id: Math.random().toString(36).substr(2, 9)
                }))
            }));

            // Write to current month
            updateFirestore(prevData.income, newCategories);
        }
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

        updateFirestore(income, sortedCategories);
    };

    const reorderCategories = (newCategories: Category[]) => {
        // Ensure order field is updated based on index
        const orderedCategories = newCategories.map((cat, index) => ({
            ...cat,
            order: index
        }));
        setCategoriesState(orderedCategories);
        updateFirestore(income, orderedCategories);
    };

    return (
        <BudgetContext.Provider value={{
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
            changeMonth,
            copyPreviousMonthData,
            moveCategory,
            reorderCategories,
            saveDefaultMonth,
            defaultMonthSettings,
        }}>
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
