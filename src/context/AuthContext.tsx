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

    // Hook executes on component mount to initialize the authentication state
    useEffect(() => {
        // Listen to firebase authentication state changes
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // Check if authenticated firebase user exists
            if (currentUser) {
                // Update state with authenticated user
                setUser(currentUser);
                // Turn off auth loader
                setLoading(false);
                // End currentUser check
            } else {
                // Check if code is running in a browser context
                const isClient = typeof window !== 'undefined';
                // Fetch saved mock user from browser storage
                const savedMockUser = isClient ? window.localStorage.getItem('mock_user') : null;
                // Check if storage has mock user data
                if (savedMockUser) {
                    // Update user state using parsed data
                    setUser(JSON.parse(savedMockUser) as User);
                    // Turn off active loading indicator
                    setLoading(false);
                    // End savedMockUser check
                } else {
                    // Check if hostname matches localhost or local IP addresses
                    const isLocal = isClient && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'));
                    // Check if local run mode is enabled
                    if (isLocal) {
                        // Initialize default test user properties
                        const mockUser = {
                            // Set fixed test uid
                            uid: 'test-user',
                            // Set test display name
                            displayName: 'Test User',
                            // Set test email address
                            email: 'test@example.com',
                        };
                        // Update React user state with mock object
                        setUser(mockUser as User);
                        // Turn off auth loader
                        setLoading(false);
                        // End isLocal check
                    } else {
                        // Clear user state
                        setUser(null);
                        // Turn off auth loader
                        setLoading(false);
                        // End non-local branch
                    }
                    // End else branch
                }
                // End unauthenticated branch
            }
            // End onAuthStateChanged handler
        });
        // Return unsubscriber function reference
        return () => unsubscribe();
    }, []);

    // Define function to login with Google using Firebase authentication popup
    const signInWithGoogle = async () => {
        // Attempt standard Firebase login flow
        try {
            // Open standard Google provider sign-in overlay popup
            await signInWithPopup(auth, googleProvider);
        // Handle active Google authentication exceptions
        } catch (error) {
            // Print exceptions out to console
            console.error("Error signing in with Google", error);
        }
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
        // Clear storage mock information
        if (typeof window !== 'undefined') {
            // Remove local storage user item
            window.localStorage.removeItem('mock_user');
        }
        // Execute standard authentication logout workflow
        try {
            // Invalidate credentials using Firebase signOut SDK
            await signOut(auth);
            // Clear user profile context
            setUser(null);
        // Handle logging out exceptions
        } catch (error) {
            // Log logout process errors
            console.error("Error signing out", error);
        }
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
