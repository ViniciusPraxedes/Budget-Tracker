"use client";

import React from 'react';
import Summary from "@/components/Summary";
import CategoryList from "@/components/CategoryList";
import MonthSelector from "@/components/MonthSelector";
import Analytics from "@/components/Analytics";
import SavingsCalculator from "@/components/SavingsCalculator";
import BitcoinTracker from "@/components/BitcoinTracker";
import ScrollToTop from "@/components/ScrollToTop";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
    const { user, signInWithGoogle, logout } = useAuth();

    if (!user) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                gap: '2rem'
            }}>
                <h1 style={{ fontSize: '2.5rem', color: 'var(--firebase-yellow)' }}>Budget Tracker</h1>
                <button
                    onClick={signInWithGoogle}
                    style={{
                        background: 'white',
                        color: '#333',
                        border: 'none',
                        padding: '1rem 2rem',
                        borderRadius: '24px',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '24px', height: '24px' }} />
                    Sign in with Google
                </button>
            </div>
        );
    }

    return (
        <div className="mobile-padding" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="mobile-title" style={{ margin: 0 }}>Budget Tracker</h1>
                <div className="mobile-header-user" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {user.photoURL && (
                            <img
                                src={user.photoURL}
                                alt="Profile"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '2px solid var(--border-color)'
                                }}
                            />
                        )}
                        <span style={{ color: 'var(--text-secondary)' }}>{user.displayName}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="mobile-logout-btn"
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span className="mobile-hide-text">Log out</span>
                    </button>
                </div>
            </div>

            <MonthSelector />
            <Summary />
            <Analytics />
            <SavingsCalculator />
            <BitcoinTracker />

            <CategoryList />
            <ScrollToTop />
        </div>
    );
}
