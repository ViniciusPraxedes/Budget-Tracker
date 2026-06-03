"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    loginAsTestUser: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Execute hook on component mount to initialize user authentication state
    useEffect(() => {
        // Retrieve any stored mock user from localStorage
        const savedMockUser = typeof window !== 'undefined' ? window.localStorage.getItem('mock_user') : null;
        // Check if a saved mock user is present in localStorage
        if (savedMockUser) {
            // Set the user state with the parsed mock user object
            setUser(JSON.parse(savedMockUser) as User);
            // Set loading state to false
            setLoading(false);
            // Return an empty cleanup function for mock auth
            return () => {};
        // End of savedMockUser conditional check
        }
        // Subscribe to standard Firebase auth state changes
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // Update the React user state with current Firebase user
            setUser(currentUser);
            // Set loading state to false once state is retrieved
            setLoading(false);
        // End of unsubscribe callback parameter
        });
        // Return standard Firebase unsubscriber function
        return () => unsubscribe();
    // Empty dependency array ensures hook runs once on mount
    }, []);

    // Define function to login with Google using Firebase authentication popup
    const signInWithGoogle = async () => {
        // Attempt popup sign in process
        try {
            // Call Google authentication popup SDK
            await signInWithPopup(auth, googleProvider);
        // Catch authentication flow errors
        } catch (error) {
            // Log authentication errors
            console.error("Error signing in with Google", error);
        // End of catch block
        }
    // End of signInWithGoogle function definition
    };

    // Define function to sign in locally as the mock test user
    const loginAsTestUser = async () => {
        // Define mock user object template
        const mockUser = {
            // Mock user ID
            uid: 'test-user',
            // Mock display name
            displayName: 'Test User',
            // Mock email address
            email: 'test@example.com'
        // End of mockUser definition
        };
        // Store mock user state inside browser localStorage
        if (typeof window !== 'undefined') {
            // Set the stringified mock user in localStorage
            window.localStorage.setItem('mock_user', JSON.stringify(mockUser));
        // End of window presence check
        }
        // Set react user state with mock user object
        setUser(mockUser as User);
    // End of loginAsTestUser function definition
    };

    // Define function to sign out and clear active session
    const logout = async () => {
        // Remove mock user token from local storage
        if (typeof window !== 'undefined') {
            // Clear mock user key
            window.localStorage.removeItem('mock_user');
        // End of window storage clean check
        }
        // Attempt Firebase sign out sequence
        try {
            // Call Firebase signOut SDK
            await signOut(auth);
            // Set user state back to null
            setUser(null);
        // Catch logout SDK errors
        } catch (error) {
            // Log logout process errors
            console.error("Error signing out", error);
        // End of catch block
        }
    // End of logout function definition
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, loginAsTestUser, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
