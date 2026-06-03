import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MonthData, Category } from '../types';
import { User } from 'firebase/auth';
import { useToast } from './ToastContext';

export const useFirestoreSync = (user: User | null, currentKey: string) => {
    const [incomeState, setIncomeState] = useState<number>(0);
    const [categoriesState, setCategoriesState] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
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
        const docRef = doc(db, 'users', user.uid, 'months', currentKey);
        
        let documentExists = false;

        const unsubscribe = onSnapshot(docRef, 
            (docSnap) => {
                documentExists = docSnap.exists();
                if (documentExists) {
                    const data = docSnap.data() as MonthData;
                    setIncomeState(data.income || 0);
                    const fetchedCategories = data.categories || [];
                    fetchedCategories.sort((a, b) => (a.order || 0) - (b.order || 0));
                    setCategoriesState(fetchedCategories);
                    setLoading(false);
                } else {
                    // Try to auto-initialize recurring expenses from previous month
                    const [y, m] = currentKey.split('-');
                    const yearNum = parseInt(y, 10);
                    const monthNum = parseInt(m, 10);
                    
                    const prevDate = new Date(yearNum, monthNum - 1, 1);
                    const prevKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;
                    
                    import('firebase/firestore').then(({ getDoc }) => {
                        getDoc(doc(db, 'users', user.uid, 'months', prevKey)).then(prevSnap => {
                            if (prevSnap.exists()) {
                                const prevData = prevSnap.data() as MonthData;
                                
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
                                    if (documentExists) return;
                                    setDoc(docRef, {
                                        month: monthNum,
                                        year: yearNum,
                                        income: prevData.income || 0,
                                        categories: newCategories
                                    });
                                } else {
                                    if (documentExists) return;
                                    setIncomeState(0);
                                    setCategoriesState([]);
                                }
                            } else {
                                if (documentExists) return;
                                setIncomeState(0);
                                setCategoriesState([]);
                            }
                            setLoading(false);
                        }).catch(() => {
                            if (documentExists) return;
                            setIncomeState(0);
                            setCategoriesState([]);
                            setLoading(false);
                        });
                    });
                }
            },
            (error) => {
                console.error("Firestore sync error:", error);
                addToast("Failed to sync with database. Please check your connection.", "error");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentKey, user, addToast]);

    // Function to push budget updates to the remote or local database
    const updateFirestore = async (newIncome: number, newCategories: Category[], month: number, year: number) => {
        // Log update parameters to console for debugging
        console.log("DEBUG: updateFirestore called!", { newIncome, cats: newCategories.length, month, year, currentKey, uid: user?.uid });
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
        try {
            console.log("DEBUG: Getting docRef...");
            const docRef = doc(db, 'users', user.uid, 'months', currentKey);
            console.log("DEBUG: Calling setDoc...");
            await setDoc(docRef, {
                month,
                year,
                income: newIncome,
                categories: newCategories
            });
            console.log("DEBUG: setDoc SUCCESS!");
        } catch (error) {
            console.error("DEBUG: Firestore update error:", error);
            addToast("Failed to save changes.", "error");
        }
    };

    return {
        incomeState,
        categoriesState,
        setIncomeState,
        setCategoriesState,
        loading,
        updateFirestore
    };
};
