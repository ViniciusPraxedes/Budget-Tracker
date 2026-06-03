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
import styles from "./page.module.css";

export default function Home() {
    const { user, signInWithGoogle, loginAsTestUser, logout } = useAuth();

    if (!user) {
        return (
            <div className={styles.loginContainer}>
                <h1 className={styles.loginTitle}>Budget Tracker</h1>
                <button
                    onClick={signInWithGoogle}
                    className={styles.loginBtn}
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className={styles.googleIcon} />
                    Sign in with Google
                </button>
                {process.env.NODE_ENV === 'development' && (
                    <button
                        onClick={loginAsTestUser}
                        className={styles.loginBtn}
                        style={{ marginTop: '1rem', backgroundColor: '#333', color: '#fff' }}
                    >
                        Login as Test User (Mock DB)
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`mobile-padding ${styles.container}`}>
            <div className={styles.header}>
                <h1 className={`mobile-title ${styles.title}`}>Budget Tracker</h1>
                <div className={`mobile-header-user ${styles.userInfo}`}>
                    <div className={styles.userProfile}>
                        {user.photoURL && (
                            <img
                                src={user.photoURL}
                                alt="Profile"
                                className={styles.userImage}
                            />
                        )}
                        <span className={styles.userName}>{user.displayName}</span>
                    </div>
                    <button
                        onClick={logout}
                        className={`mobile-logout-btn ${styles.logoutBtn}`}
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
