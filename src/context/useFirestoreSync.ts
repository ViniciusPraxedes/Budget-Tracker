import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MonthData, Category } from '../types';
import { User } from 'firebase/auth';
import { useToast } from './ToastContext';

export const useFirestoreSync = (user: User | null, currentKey: string) => {
    // Declare state for monthly income
    const [incomeState, setIncomeState] = useState<number>(0);
    // Declare state for expense categories
    const [categoriesState, setCategoriesState] = useState<Category[]>([]);
    // Declare state for monthly savings deposit
    const [monthlySavingsDepositState, setMonthlySavingsDepositState] = useState<number>(0);
    // Declare state for total monthly spending budget
    const [monthlyBudgetState, setMonthlyBudgetState] = useState<number>(0);
    // Declare state for loading indicator
    const [loading, setLoading] = useState(true);
    // Retrieve toast notification handler
    const { addToast } = useToast();

    // Subscribe to Firestore updates
    // Sync active month data whenever user or current key changes
    useEffect(() => {
        // If no user is logged in
        if (!user) {
            // Set income state to zero
            setIncomeState(0);
            // Set categories array to empty
            setCategoriesState([]);
            // Set monthly savings deposit to zero
            setMonthlySavingsDepositState(0);
            // Set monthly budget state to zero
            setMonthlyBudgetState(0);
            // Disable loading spinner
            setLoading(false);
            // Return early
            return;
        // End of user presence check
        }
        // Check if user is the mock test user
        if (user.uid === 'test-user') {
            // Set loading state to true
            setLoading(true);
            // Fetch month details from mock database API
            fetch(`/api/mock-db?userId=test-user&monthKey=${currentKey}`, { cache: 'no-store' })
                // Parse API response to JSON
                .then(res => {
                    // Return JSON payload from response
                    return res.json();
                // Handle parsed response data
                })
                .then(data => {
                    // Update income state with retrieved mock income
                    setIncomeState(data.income || 0);
                    // Update monthly savings deposit state
                    setMonthlySavingsDepositState(data.monthlySavingsDeposit || 0);
                    // Update monthly budget state
                    setMonthlyBudgetState(data.monthlyBudget || 0);
                    // Retrieve categories array or use empty array default
                    const fetchedCategories = data.categories || [];
                    // Sort categories by their order property
                    fetchedCategories.sort((a: any, b: any) => {
                        // Compute sorting difference
                        return (a.order || 0) - (b.order || 0);
                    // End of sort callback
                    });
                    // Set components categories state with loaded items
                    setCategoriesState(fetchedCategories);
                    // Set loading status to false
                    setLoading(false);
                // Catch any fetching/parsing errors
                })
                .catch(error => {
                    // Log error details to console
                    console.error("Mock DB fetch error:", error);
                    // Display error toast notification
                    addToast("Failed to sync with local database.", "error");
                    // Turn off loading indicator
                    setLoading(false);
                // End of catch block
                });
            // Return an empty unsubscribe handler for local sync
            return () => {};
        // End of test-user conditional check
        }

        // Set loading state to true
        setLoading(true);
        // Create Firestore document reference for active month
        const docRef = doc(db, 'users', user.uid, 'months', currentKey);
        
        // Flag to track document presence
        let documentExists = false;

        // Subscribe to snapshot changes
        const unsubscribe = onSnapshot(docRef, 
            // Handle snapshot update callback
            (docSnap) => {
                // Determine document existence status
                documentExists = docSnap.exists();
                // If snapshot document exists
                if (documentExists) {
                    // Cast snapshot data to MonthData interface
                    const data = docSnap.data() as MonthData;
                    // Update local income state
                    setIncomeState(data.income || 0);
                    // Update local monthly savings deposit state
                    setMonthlySavingsDepositState(data.monthlySavingsDeposit || 0);
                    // Update local monthly budget state
                    setMonthlyBudgetState(data.monthlyBudget || 0);
                    // Retrieve categories list
                    const fetchedCategories = data.categories || [];
                    // Sort categories by order index
                    fetchedCategories.sort((a, b) => (a.order || 0) - (b.order || 0));
                    // Set categories state
                    setCategoriesState(fetchedCategories);
                    // Disable loading spinner
                    setLoading(false);
                // Handle non-existent document snapshot
                } else {
                    // Try to auto-initialize recurring expenses from previous month
                    const [y, m] = currentKey.split('-');
                    // Parse year number
                    const yearNum = parseInt(y, 10);
                    // Parse month number
                    const monthNum = parseInt(m, 10);
                    
                    // Create previous date object
                    const prevDate = new Date(yearNum, monthNum - 1, 1);
                    // Generate key string for previous month
                    const prevKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;
                    
                    // Dynamically import getDoc method from firestore module
                    import('firebase/firestore').then(({ getDoc }) => {
                        // Query document for previous month
                        getDoc(doc(db, 'users', user.uid, 'months', prevKey)).then(prevSnap => {
                            // Check if previous month document snapshot exists
                            if (prevSnap.exists()) {
                                // Extract data for previous month
                                const prevData = prevSnap.data() as MonthData;
                                
                                // Map previous categories and clone recurring expenses
                                const newCategories = prevData.categories.map(cat => ({
                                    ...cat,
                                    id: Math.random().toString(36).substr(2, 9),
                                    expenses: cat.expenses
                                        .filter(exp => exp.isRecurring)
                                        .map(exp => ({
                                            ...exp,
                                            id: Math.random().toString(36).substr(2, 9)
                                        }))
                                }));
    
                                // Only initialize if we have something to copy
                                if (newCategories.length > 0) {
                                    // Exit if document was created concurrently
                                    if (documentExists) return;
                                    // Save initialized month document in Firestore
                                    setDoc(docRef, {
                                        month: monthNum,
                                        year: yearNum,
                                        income: prevData.income || 0,
                                        monthlySavingsDeposit: prevData.monthlySavingsDeposit || 0,
                                        monthlyBudget: prevData.monthlyBudget || 0,
                                        categories: newCategories
                                    });
                                // Handle case where no recurring categories exist
                                } else {
                                    // Exit if document exists
                                    if (documentExists) return;
                                    // Reset income state to zero
                                    setIncomeState(0);
                                    // Reset categories state to empty
                                    setCategoriesState([]);
                                    // Reset monthly savings deposit to zero
                                    setMonthlySavingsDepositState(0);
                                    // Reset monthly budget state to zero
                                    setMonthlyBudgetState(0);
                                }
                            // Handle case where previous month document does not exist
                            } else {
                                // Exit if document exists
                                if (documentExists) return;
                                // Reset income state to zero
                                setIncomeState(0);
                                // Reset categories state to empty
                                setCategoriesState([]);
                                // Reset monthly savings deposit to zero
                                setMonthlySavingsDepositState(0);
                                // Reset monthly budget state to zero
                                setMonthlyBudgetState(0);
                            }
                            // Disable loading spinner
                            setLoading(false);
                        // Handle catch for previous snapshot fetch
                        }).catch(() => {
                            // Exit if document exists
                            if (documentExists) return;
                            // Reset income state to zero
                            setIncomeState(0);
                            // Reset categories state to empty
                            setCategoriesState([]);
                            // Reset monthly savings deposit to zero
                            setMonthlySavingsDepositState(0);
                            // Reset monthly budget state to zero
                            setMonthlyBudgetState(0);
                            // Disable loading spinner
                            setLoading(false);
                        });
                    });
                }
            },
            // Handle subscription error callback
            (error) => {
                // Log sync error to console
                console.error("Firestore sync error:", error);
                // Display error toast notification
                addToast("Failed to sync with database. Please check your connection.", "error");
                // Disable loading spinner
                setLoading(false);
            }
        );

        // Return cleanup function to unsubscribe snapshot listener
        return () => unsubscribe();
    }, [currentKey, user, addToast]);

    // Function to push budget updates to the remote or local database
    const updateFirestore = async (newIncome: number, newCategories: Category[], month: number, year: number, newSavingsDeposit?: number, newMonthlyBudget?: number) => {
        // Determine savings deposit value using state fallback
        const savingsDepositValue = newSavingsDeposit !== undefined ? newSavingsDeposit : monthlySavingsDepositState;
        // Determine monthly budget value using state fallback
        const monthlyBudgetValue = newMonthlyBudget !== undefined ? newMonthlyBudget : monthlyBudgetState;
        // Log update parameters to console for debugging
        console.log("DEBUG: updateFirestore called!", { newIncome, cats: newCategories.length, month, year, currentKey, savingsDepositValue, monthlyBudgetValue });
        // Return early if no user session exists
        if (!user) {
            // Log abort message to console
            console.log("DEBUG: updateFirestore aborted, no user!");
            // Return out of function
            return;
        // End of user check
        }
        // Check if user is the mock test user
        if (user.uid === 'test-user') {
            // Attempt to update mock database API
            try {
                // Update local income state immediately to ensure reactive UI updates
                setIncomeState(newIncome);
                // Update local categories state immediately to ensure reactive UI updates
                setCategoriesState(newCategories);
                // Update local monthly savings deposit state immediately
                setMonthlySavingsDepositState(savingsDepositValue);
                // Update local monthly budget state immediately
                setMonthlyBudgetState(monthlyBudgetValue);
                // Call local API to update month data
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
                        // Specify update_month action
                        action: 'update_month',
                        // Key for targeted month
                        monthKey: currentKey,
                        // Month details payload
                        monthData: {
                            // Month index number
                            month,
                            // Calendar year number
                            year,
                            // New monthly income amount
                            income: newIncome,
                            // New monthly savings deposit amount
                            monthlySavingsDeposit: savingsDepositValue,
                            // New monthly budget amount
                            monthlyBudget: monthlyBudgetValue,
                            // Categories list
                            categories: newCategories
                        // End of monthData object
                        }
                    // End of body stringification
                    })
                // End of fetch options definition
                });
            // Catch error on network/saving request failure
            } catch (error) {
                // Log local save errors
                console.error("Mock DB update error:", error);
                // Trigger error toast notification
                addToast("Failed to save changes locally.", "error");
            // End of catch block
            }
            // Exit early
            return;
        // End of test-user update conditional check
        }
        // Try saving updated document to Firestore database
        try {
            // Get reference to Firestore month document
            const docRef = doc(db, 'users', user.uid, 'months', currentKey);
            // Save document with updated properties
            await setDoc(docRef, {
                month,
                year,
                income: newIncome,
                monthlySavingsDeposit: savingsDepositValue,
                monthlyBudget: monthlyBudgetValue,
                categories: newCategories
            });
        // Catch error on saving document to Firestore
        } catch (error) {
            // Log Firestore update error to console
            console.error("DEBUG: Firestore update error:", error);
            // Display error toast notification
            addToast("Failed to save changes.", "error");
        }
    };

    // Return hook state values and functions
    return {
        // Return current income state
        incomeState,
        // Return current categories list state
        categoriesState,
        // Return current monthly savings deposit state
        monthlySavingsDepositState,
        // Return current monthly budget state
        monthlyBudgetState,
        // Return income state modifier
        setIncomeState,
        // Return categories state modifier
        setCategoriesState,
        // Return monthly savings deposit modifier
        setMonthlySavingsDepositState,
        // Return monthly budget modifier
        setMonthlyBudgetState,
        // Return loading state status
        loading,
        // Return database update function
        updateFirestore
    };
};
