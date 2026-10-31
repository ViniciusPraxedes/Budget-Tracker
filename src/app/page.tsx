"use client";

// Import React and hooks from core libraries
import React, { useState, useEffect } from 'react';
// Import Summary component for budget summary display
import Summary from "@/components/Summary";
// Import CategoryList component for displaying categorised expenses
import CategoryList from "@/components/CategoryList";
// Import MonthSelector component to change current budget month
import MonthSelector from "@/components/MonthSelector";
// Import Analytics component for charts and metrics visualization
import Analytics from "@/components/Analytics";
// Import BudgetPlanner component for budget planning & savings goal calculations
import BudgetPlanner from "@/components/BudgetPlanner";
// Import BitcoinTracker component to display BTC price metrics
import BitcoinTracker from "@/components/BitcoinTracker";
// Import ScrollToTop button for quick viewport navigation
import ScrollToTop from "@/components/ScrollToTop";
// Import AuthContext hook to read authenticated session profile details
import { useAuth } from "@/context/AuthContext";
// Import PDF import modal component
import PDFImportModal from "@/components/PDFImportModal";
// Import Firestore query and document methods
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
// Import Firebase popup authentication and sign out methods
import { signInWithPopup, signOut } from 'firebase/auth';
// Import Firebase instances and authentication provider
import { auth, googleProvider, db } from "@/firebase";
// Import toast notification hook
import { useToast } from "@/context/ToastContext";
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
    // State to track if production database sync is in progress
    const [isSyncing, setIsSyncing] = useState(false);
    // State to track if application is running in a local development environment
    const [isLocalEnv, setIsLocalEnv] = useState(false);
    // Access toast notification trigger function
    const { addToast } = useToast();

    // Effect hook to check if current environment is localhost or development
    useEffect(() => {
        // Check if code is running in browser context
        const isClient = typeof window !== 'undefined';
        // Evaluate if running in development mode or local hostnames
        const isLocal = process.env.NODE_ENV === 'development' || (
            // Verify browser window presence
            isClient && (
                // Match localhost hostname
                window.location.hostname === 'localhost' ||
                // Match standard loopback IP address
                window.location.hostname === '127.0.0.1' ||
                // Match private Class C subnet
                window.location.hostname.startsWith('192.168.') ||
                // Match private Class A subnet
                window.location.hostname.startsWith('10.') ||
                // Match private Class B subnet
                window.location.hostname.startsWith('172.') ||
                // Match mDNS local domain suffix
                window.location.hostname.endsWith('.local')
            // Close hostname matching checks
            )
        // Close local evaluation expression
        );
        // Update local environment state
        setIsLocalEnv(isLocal);
    // Run effect once on initial mount
    }, []);

    // Function to fetch production Firestore data and override test database
    const handleSyncProdToTest = async () => {
        // Prevent concurrent sync execution
        if (isSyncing) return;
        // Turn on syncing loading state
        setIsSyncing(true);
        // Execute sync logic within try-catch block
        try {
            // Track if user was previously in mock test-user mode
            const wasTestUser = user?.uid === 'test-user';
            // Variable to store authenticated production user ID
            let prodUid = auth.currentUser?.uid;
            // Check if user is unauthenticated with Firebase Auth
            if (!prodUid) {
                // Prompt user to sign in with Google to get read access
                const creds = await signInWithPopup(auth, googleProvider);
                // Extract authenticated user ID from credentials
                prodUid = creds.user.uid;
            // Close unauthenticated check
            }
            // Construct Firestore document reference for user settings
            const userDocRef = doc(db, 'users', prodUid);
            // Fetch production user document snapshot
            const userDocSnap = await getDoc(userDocRef);
            // Construct Firestore collection reference for user monthly records
            const monthsColRef = collection(db, 'users', prodUid, 'months');
            // Fetch production monthly records snapshot
            const monthsSnap = await getDocs(monthsColRef);
            // Initialize dictionary for monthly budget records
            const monthsData: Record<string, any> = {};
            // Iterate over all monthly budget documents
            monthsSnap.docs.forEach((monthDoc) => {
                // Store month record using its document identifier
                monthsData[monthDoc.id] = monthDoc.data();
            // Close month documents iteration
            });
            // Retrieve production user settings data or fallback to empty object
            const prodUserData = userDocSnap.exists() ? userDocSnap.data() : {};
            // Assemble override user dataset for test database
            const overridePayload = {
                // Total savings amount
                totalSavings: prodUserData.totalSavings ?? 0,
                // Savings goal amount
                savingsGoal: prodUserData.savingsGoal ?? 50000,
                // Payday cycle start day
                paydayStartDay: prodUserData.paydayStartDay ?? 25,
                // Payday cycle end day
                paydayEndDay: prodUserData.paydayEndDay ?? 24,
                // Default landing month
                defaultMonth: prodUserData.defaultMonth ?? null,
                // Default landing year
                defaultYear: prodUserData.defaultYear ?? null,
                // PDF import mappings configuration
                pdfConfig: prodUserData.pdfConfig ?? { mappings: {}, ignored: [] },
                // Simulation planner months
                simulationMonths: prodUserData.simulationMonths ?? {},
                // Simulation planner range
                simulationRange: prodUserData.simulationRange ?? null,
                // All monthly budget records
                months: monthsData
            // Close override payload definition
            };
            // Send payload to mock database endpoint
            const res = await fetch('/api/mock-db', {
                // Set HTTP method to POST
                method: 'POST',
                // Define request headers
                headers: {
                    // Application JSON content type
                    'Content-Type': 'application/json'
                // Close headers
                },
                // Serialize request payload
                body: JSON.stringify({
                    // Target test user
                    userId: 'test-user',
                    // Action to override user record
                    action: 'override_user',
                    // Payload data
                    userData: overridePayload
                // Close stringify
                })
            // Close fetch options
            });
            // Check if API call succeeded
            if (!res.ok) {
                // Throw error if response was not ok
                throw new Error('Failed to update mock database');
            // Close response check
            }
            // Display success toast notification
            addToast("Test database successfully replaced with production data!", "success");
            // Check if user session was in test-user mode
            if (wasTestUser) {
                // Sign out of Firebase auth to return to local mock mode
                await signOut(auth);
                // Ensure local storage preserves mock user identity
                window.localStorage.setItem('mock_user', JSON.stringify({ uid: 'test-user', displayName: 'Test User', email: 'test@example.com' }));
                // Set delay before reloading page
                setTimeout(() => {
                    // Reload page to reflect updated test database
                    window.location.reload();
                // Delay in milliseconds
                }, 1000);
            // Close wasTestUser check
            }
        // Catch any sync errors
        } catch (error) {
            // Log sync error to console
            console.error("Failed to sync production data:", error);
            // Display error toast notification
            addToast("Failed to copy production data to test database.", "error");
        // Ensure syncing indicator is turned off
        } finally {
            // Reset syncing status
            setIsSyncing(false);
        // Close finally block
        }
    // Close handleSyncProdToTest
    };

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
                {/* Header right side controls container */}
                <div className={styles.headerControls}>
                    {/* Render sync button only when running in a local environment */}
                    {isLocalEnv && (
                        /* Sync production database to test database button */
                        <button
                            // Click handler invoking sync function
                            onClick={handleSyncProdToTest}
                            // Disable button during active sync operation
                            disabled={isSyncing}
                            // Header sync button styling class
                            className={styles.syncBtn}
                            // Tooltip describing button action
                            title="Fetch data from production database and override test database"
                        >
                            {/* Database icon SVG */}
                            <svg
                                // Icon CSS class with conditional spin animation
                                className={isSyncing ? styles.spinIcon : ''}
                                // XML namespace
                                xmlns="http://www.w3.org/2000/svg"
                                // Width attribute
                                width="16"
                                // Height attribute
                                height="16"
                                // Viewbox definition
                                viewBox="0 0 24 24"
                                // Fill none
                                fill="none"
                                // Stroke current color
                                stroke="currentColor"
                                // Stroke width
                                strokeWidth="2"
                                // Stroke linecap
                                strokeLinecap="round"
                                // Stroke linejoin
                                strokeLinejoin="round"
                            >
                                {/* Top ellipse cylinder shape */}
                                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                                {/* Middle layer curve */}
                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                                {/* Bottom layer curve */}
                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                            </svg>
                            {/* Dynamic button text */}
                            {isSyncing ? "Syncing..." : "Sync Prod to Test DB"}
                        </button>
                    /* End of local environment condition check */
                    )}
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
                            {/* Render dropdown sync option only in local environment */}
                            {isLocalEnv && (
                                /* Override test database from production dropdown action */
                                <button
                                    // Click handler triggering production sync
                                    onClick={() => {
                                        // Close profile dropdown menu
                                        setIsProfileOpen(false);
                                        // Trigger sync logic
                                        handleSyncProdToTest();
                                    }}
                                    // Disable button if already syncing
                                    disabled={isSyncing}
                                    // Styling class for dropdown sync action
                                    className={styles.syncBtnDropdown}
                                >
                                    {/* Sync icon SVG */}
                                    <svg
                                        // Icon CSS class with conditional spin animation
                                        className={isSyncing ? styles.spinIcon : ''}
                                        // XML namespace
                                        xmlns="http://www.w3.org/2000/svg"
                                        // Width attribute
                                        width="16"
                                        // Height attribute
                                        height="16"
                                        // Viewbox definition
                                        viewBox="0 0 24 24"
                                        // Fill none
                                        fill="none"
                                        // Stroke current color
                                        stroke="currentColor"
                                        // Stroke width
                                        strokeWidth="2"
                                        // Stroke linecap
                                        strokeLinecap="round"
                                        // Stroke linejoin
                                        strokeLinejoin="round"
                                    >
                                        {/* Circular arrows sync icon path */}
                                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
                                    </svg>
                                    {/* Button label text */}
                                    Sync Prod to Test DB
                                </button>
                            /* End of local environment dropdown check */
                            )}
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
                    {/* Close user tools dropdown wrapper */}
                </div>
                {/* Close header right controls wrapper */}
            </div>
            {/* Close header section panel */}
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
            {/* Render budget goal calculator and planner tools */}
            <BudgetPlanner />
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
