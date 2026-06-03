"use client";

// Import React and hooks from core libraries
import React, { useState } from 'react';
// Import Summary component for budget summary display
import Summary from "@/components/Summary";
// Import CategoryList component for displaying categorised expenses
import CategoryList from "@/components/CategoryList";
// Import MonthSelector component to change current budget month
import MonthSelector from "@/components/MonthSelector";
// Import Analytics component for charts and metrics visualization
import Analytics from "@/components/Analytics";
// Import SavingsCalculator component to calculate savings target goals
import SavingsCalculator from "@/components/SavingsCalculator";
// Import BitcoinTracker component to display BTC price metrics
import BitcoinTracker from "@/components/BitcoinTracker";
// Import ScrollToTop button for quick viewport navigation
import ScrollToTop from "@/components/ScrollToTop";
// Import AuthContext hook to read authenticated session profile details
import { useAuth } from "@/context/AuthContext";
// Import PDF import modal component
import PDFImportModal from "@/components/PDFImportModal";
// Import CSS module styles for page layout structure
import styles from "./page.module.css";

// Declare standard React page component representing homepage routing
export default function Home() {
    // Get user details, sign-in methods, and logout callback from context
    const { user, signInWithGoogle, loginAsTestUser, logout } = useAuth();
    // Declare state variable to toggle PDF statement import modal dialog visibility
    const [isImportOpen, setIsImportOpen] = useState(false);

    // Check if session authentication state is currently unresolved
    if (!user) {
        // Return fallback auth template wrapper view container
        return (
            // Flex outer box container styling
            <div className={styles.loginContainer}>
                {/* Main branding page title text label */}
                <h1 className={styles.loginTitle}>Budget Tracker</h1>
                {/* Sign-in button with Google auth trigger */}
                <button
                    // Register onClick event to trigger Google sign-in
                    onClick={signInWithGoogle}
                    // Apply login action button styles
                    className={styles.loginBtn}
                >
                    {/* Render google SVG vector icon image logo */}
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className={styles.googleIcon} />
                    {/* Button title string */}
                    Sign in with Google
                </button>
                {/* Check if current Node environment context matches development */}
                {process.env.NODE_ENV === 'development' && (
                    // Render secondary local database dev testing signin button option
                    <button
                        // Register click event hook to login with mock details
                        onClick={loginAsTestUser}
                        // Apply layout classes
                        className={styles.loginBtn}
                        // Custom styled margins and colors overrides
                        style={{ marginTop: '1rem', backgroundColor: '#333', color: '#fff' }}
                    >
                        {/* Mock DB login button text title */}
                        Login as Test User (Mock DB)
                    </button>
                )}
            </div>
        );
    }

    // Return primary dashboard workspace layout template
    return (
        // Outmost page viewport container wrapper
        <div className={`mobile-padding ${styles.container}`}>
            {/* Header section panel */}
            <div className={styles.header}>
                {/* Dashboard page heading text title */}
                <h1 className={`mobile-title ${styles.title}`}>Budget Tracker</h1>
                {/* User tools wrapper */}
                <div className={`mobile-header-user ${styles.userInfo}`}>
                    {/* User profile picture wrapper container */}
                    <div className={styles.userProfile}>
                        {/* Verify photo URL exist inside profile record */}
                        {user.photoURL && (
                            // Render profile picture image element
                            <img
                                // Profile photo URL string source
                                src={user.photoURL}
                                // Screenreader accessible text caption
                                alt="Profile"
                                // Styled thumbnail circular profile thumbnail CSS class
                                className={styles.userImage}
                            />
                        )}
                        {/* Display profile display name string */}
                        <span className={styles.userName}>{user.displayName}</span>
                    </div>
                    {/* Import Statement PDF trigger button */}
                    <button
                        // Open statement importing modal on tap click action
                        onClick={() => setIsImportOpen(true)}
                        // CSS styling button styles
                        className={`mobile-logout-btn ${styles.logoutBtn}`}
                        // Add margin spacer
                        style={{ marginRight: '0.25rem' }}
                    >
                        {/* Document SVG Icon shape */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {/* File background outline path */}
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          {/* Document fold coordinates lines */}
                          <polyline points="14 2 14 8 20 8"></polyline>
                          {/* Arrow pointing down */}
                          <line x1="12" y1="18" x2="12" y2="12"></line>
                          {/* Cap point down */}
                          <polyline points="9 15 12 12 15 15"></polyline>
                        </svg>
                        {/* Screen text block hidden on narrow mobile devices */}
                        <span className="mobile-hide-text">Import PDF</span>
                    </button>
                    {/* Logout trigger button */}
                    <button
                        // Trigger logout action callback
                        onClick={logout}
                        // Styled action buttons classes
                        className={`mobile-logout-btn ${styles.logoutBtn}`}
                    >
                        {/* Logout standard power indicator shape vector SVG */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {/* SVG bracket border path */}
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            {/* Exit direction arrowhead points lines */}
                            <polyline points="16 17 21 12 16 7"></polyline>
                            {/* Exit horizontal pointer line */}
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        {/* Text labels hidden on compact viewports */}
                        <span className="mobile-hide-text">Log out</span>
                    </button>
                </div>
            </div>

            {/* Render month/year date navigator */}
            <MonthSelector />
            {/* Render dashboard totals metrics summary */}
            <Summary />
            {/* Render category analytics charts */}
            <Analytics />
            {/* Render budget goal calculator tools */}
            <SavingsCalculator />
            {/* Render BTC price tracker ticker */}
            <BitcoinTracker />

            {/* Render categorised expenses listing */}
            <CategoryList />
            {/* Render scroll navigator back up page */}
            <ScrollToTop />

            {/* Display statement import modal dialog when state flag is active */}
            {isImportOpen && (
                // Import modal container component rendering
                <PDFImportModal
                    // Close handler updating state flag false
                    onClose={() => setIsImportOpen(false)}
                />
            )}
        </div>
    );
}
