"use client";

import React from 'react';
import Summary from "@/components/Summary";
import CategoryList from "@/components/CategoryList";
import MonthSelector from "@/components/MonthSelector";
import Analytics from "@/components/Analytics";
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
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ margin: 0 }}>Budget Tracker</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{user.displayName}</span>
                    <button
                        onClick={logout}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Logout
                    </button>
                </div>
            </div>

            <MonthSelector />
            <Summary />
            <Analytics />
            <CategoryList />
        </div>
    );
}
