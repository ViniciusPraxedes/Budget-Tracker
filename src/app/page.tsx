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
    // Declare state variable to toggle user profile dropdown modal visibility
    const [isProfileOpen, setIsProfileOpen] = useState(false);

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
                {/* User tools dropdown wrapper */}
                <div className={styles.userDropdownContainer}>
                    {/* Trigger button for dropdown */}
                    <button
                        // Toggle profile modal visibility
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        // Trigger styles
                        className={styles.userDropdownTrigger}
                    >
                        {/* User avatar circle */}
                        <div className={styles.userAvatar}>
                            {/* Conditionally render image or text */}
                            {user.photoURL ? (
                                // Render profile image
                                <img
                                    // Image source URL
                                    src={user.photoURL}
                                    // Accessible label
                                    alt="Profile"
                                />
                            ) : (
                                // Render fallback text
                                user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'
                            )}
                        </div>
                        {/* Dropdown chevron SVG */}
                        <svg className={styles.chevronIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {/* Arrowhead lines */}
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>

                    {/* Conditionally render dropdown */}
                    {isProfileOpen && (
                        // Dropdown menu modal box
                        <div className={styles.userDropdownMenu}>
                            {/* User details section */}
                            <div className={styles.userDetails}>
                                {/* Display name label */}
                                <span className={styles.userNameDropdown}>
                                    {user.displayName}
                                </span>
                                {/* Email address label */}
                                <span className={styles.userEmailDropdown}>
                                    {user.email}
                                </span>
                            </div>
                            {/* Sign out action button */}
                            <button
                                // Trigger logout and close
                                onClick={() => {
                                    // Execute logout action
                                    logout();
                                    // Close the dropdown state
                                    setIsProfileOpen(false);
                                }}
                                // Styled dropdown button class
                                className={styles.logoutBtnDropdown}
                            >
                                {/* Logout SVG icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {/* Outer door bracket path */}
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    {/* Inner exit arrowhead polyline */}
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    {/* Inner exit horizontal line segment */}
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                                {/* Button text */}
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Render month/year date navigator with import click handler */}
            <MonthSelector
                // Pass click handler callback
                onImportClick={() => setIsImportOpen(true)}
            // End of MonthSelector component rendering
            />
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
