"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { BudgetContextType, Category, Expense, MonthData } from '../types';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
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
                setCategoriesState(data.categories || []);
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
