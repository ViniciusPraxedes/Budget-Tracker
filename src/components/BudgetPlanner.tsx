// Import React core library and state/effect hooks
import React, { useState, useEffect } from 'react';
// Import budget context consumer hook
import { useBudget } from '../context/BudgetContext';
// Import localization context consumer hook
import { useLocalization } from '../context/LocalizationContext';
// Import Box layout panel component for consistent card styling
import Box from './Box';
// Import CSS module styles for budget planner layout
import styles from './BudgetPlanner.module.css';
// Import shared payday cycle resolver so cycle math stays consistent across components
import { resolvePaydayCycle } from '../utils/paydayCycle';
// Import Horizon Planner multi-month simulation and batch editing component
import HorizonPlanner from './HorizonPlanner';

// Declare functional component representing Budget Planner & Savings Center
const BudgetPlanner: React.FC = () => {
    // Destructure metrics and state from budget context provider
    const { income, totalExpenses, monthlySavingsDeposit, setMonthlySavingsDeposit, totalSavings, categories, monthlyBudget, setMonthlyBudget, paydayStartDay, paydayEndDay, currentMonth, currentYear, savingsGoal, setSavingsGoal } = useBudget();
    // Destructure formatCurrency function from localization context provider
    const { formatCurrency } = useLocalization();

    // Declare state for collapsible section visibility (hidden by default)
    const [isExpanded, setIsExpanded] = useState(false);
    // Declare state for active tab selection inside budget planner
    const [activeTab, setActiveTab] = useState<'planner' | 'horizon'>('planner');

    // Total effective budget threshold calculation preserving zero
    const effectiveTotalBudget = monthlyBudget !== undefined ? monthlyBudget : categories.reduce((s, c) => s + (c.budget || 0), 0);
    // Declare state for inline monthly budget editing mode
    const [isEditingMonthlyBudget, setIsEditingMonthlyBudget] = useState(false);
    // Declare state for temporary monthly budget input string
    const [tempMonthlyBudget, setTempMonthlyBudget] = useState(monthlyBudget !== undefined ? monthlyBudget.toString() : (effectiveTotalBudget > 0 ? effectiveTotalBudget.toString() : ''));

    // Keep tempMonthlyBudget in sync with loaded budget values when not editing
    useEffect(() => {
        // Only synchronize when editing mode is closed
        if (!isEditingMonthlyBudget) {
            // Set temporary string matching configured budget or empty fallback
            setTempMonthlyBudget(monthlyBudget !== undefined ? monthlyBudget.toString() : (effectiveTotalBudget > 0 ? effectiveTotalBudget.toString() : ''));
        // End of editing mode check
        }
    // Track dependencies for synchronizing input value
    }, [monthlyBudget, effectiveTotalBudget, isEditingMonthlyBudget]);

    // Commit the pending monthly budget edit, supporting zero or clearing to undefined
    const commitMonthlyBudget = () => {
        // Check if input is empty to reset to undefined
        if (tempMonthlyBudget.trim() === '') {
            // Clear monthly budget override
            setMonthlyBudget(undefined);
        // Parse numeric value if provided
        } else {
            // Parse float value from input string
            const val = parseFloat(tempMonthlyBudget);
            // Verify parsed value is valid number
            if (!isNaN(val)) {
                // Set monthly budget to parsed number
                setMonthlyBudget(val);
            // End of valid number check
            }
        // End of empty check
        }
        // Close inline editing mode
        setIsEditingMonthlyBudget(false);
    // End of commitMonthlyBudget definition
    };

    // Abandon the pending monthly budget edit and restore the persisted value
    const cancelMonthlyBudgetEdit = () => {
        // Restore previous budget value or empty fallback
        setTempMonthlyBudget(monthlyBudget !== undefined ? monthlyBudget.toString() : (effectiveTotalBudget > 0 ? effectiveTotalBudget.toString() : ''));
        // Close inline editing mode
        setIsEditingMonthlyBudget(false);
    // End of cancelMonthlyBudgetEdit definition
    };

    // Savings Goal state initializations
    // Declare state string for savings target goal amount, pre-filled from persisted context value
    const [goalAmount, setGoalAmount] = useState(savingsGoal > 0 ? savingsGoal.toString() : '50000');

    // Keep goalAmount in sync if the persisted savings goal loads or changes externally
    useEffect(() => {
        if (savingsGoal > 0) {
            setGoalAmount(savingsGoal.toString());
        }
    }, [savingsGoal]);

    // Persist goal amount changes to context/Firestore, debounced so typing doesn't spam writes
    useEffect(() => {
        const val = parseFloat(goalAmount);
        if (isNaN(val) || val <= 0 || val === savingsGoal) return;
        const timeout = setTimeout(() => {
            setSavingsGoal(val);
        }, 600);
        return () => clearTimeout(timeout);
    }, [goalAmount, savingsGoal, setSavingsGoal]);

    // State for local monthly savings contribution input string
    const [monthlyContributionInput, setMonthlyContributionInput] = useState(monthlySavingsDeposit > 0 ? monthlySavingsDeposit.toString() : '');

    // Sync input string with monthlySavingsDeposit context updates
    useEffect(() => {
        // Update input string state when context value changes externally
        setMonthlyContributionInput(monthlySavingsDeposit > 0 ? monthlySavingsDeposit.toString() : '');
    }, [monthlySavingsDeposit]);

    // Handle change for monthly contribution input field
    const handleContributionChange = (valStr: string) => {
        // Update local state value for contribution input
        setMonthlyContributionInput(valStr);
        // Parse float number from input string
        const val = parseFloat(valStr);
        // Check if parsed value is valid non-negative number
        if (!isNaN(val) && val >= 0) {
            // Commit updated deposit to budget context
            setMonthlySavingsDeposit(val);
        }
    };

    // Parsed numeric value of the goal input, NaN when the field is empty or non-numeric
    const parsedGoal = parseFloat(goalAmount);
    // Whether the entered goal is a usable positive target
    const isGoalValid = !isNaN(parsedGoal) && parsedGoal > 0;
    // Percentage of the goal reached, only meaningful once a valid goal is entered
    const goalProgressPct = isGoalValid ? Math.min(100, (totalSavings / parsedGoal) * 100) : 0;
    // Whether current savings meet or exceed the entered goal
    const isGoalReached = isGoalValid && totalSavings >= parsedGoal;
    // Parsed numeric value of monthly contribution input
    const parsedContribution = parseFloat(monthlyContributionInput);
    // Effective numeric monthly contribution amount
    const effectiveContribution = !isNaN(parsedContribution) && parsedContribution > 0 ? parsedContribution : 0;
    // Remaining balance needed to hit the target goal
    const remainingGoal = isGoalValid ? Math.max(0, parsedGoal - totalSavings) : 0;
    // Estimated months remaining to achieve goal
    const monthsToGoal = isGoalValid && effectiveContribution > 0 && !isGoalReached ? Math.ceil(remainingGoal / effectiveContribution) : null;
    // Target completion date string calculated from current date plus months remaining
    const targetCompletionDate = (() => {
        // Check if months to goal calculation is valid and greater than zero
        if (monthsToGoal === null || monthsToGoal <= 0) return '';
        // Create date object for current date
        const now = new Date();
        // Resolve target completion month and year
        const targetDate = new Date(now.getFullYear(), now.getMonth() + monthsToGoal, 1);
        // Return formatted month and year string
        return targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    })();

    // Resolve payday cycle boundaries and elapsed progress for the month currently being viewed
    const paydayCycle = resolvePaydayCycle(paydayStartDay, paydayEndDay, currentMonth, currentYear);
    // Days of the viewed month's cycle elapsed so far, clamped to the cycle bounds
    const paydayDaysElapsed = paydayCycle.daysElapsed;
    // Total duration of the viewed month's configured payday cycle
    const paydayCycleLength = paydayCycle.lengthInDays;
    // Percentage of the viewed month's payday cycle elapsed
    const monthElapsedPct = paydayCycle.elapsedPct;
    // Percentage of budget spent so far
    const budgetSpentPct = effectiveTotalBudget > 0 ? Math.round((totalExpenses / effectiveTotalBudget) * 100) : 0;

    // Calculate total planned budgeted expenses or actual expenses if higher
    const plannedExpenses = monthlyBudget !== undefined
        // If custom budget is configured use max of budget and total expenses
        ? Math.max(monthlyBudget, totalExpenses)
        // Otherwise fall back to sum of category budgets
        : categories.reduce((sum, cat) => sum + (cat.budget !== undefined ? Math.max(cat.budget, cat.expenses.reduce((s, e) => s + e.amount, 0)) : cat.expenses.reduce((s, e) => s + e.amount, 0)), 0);

    // Calculate remaining net free cash flow incorporating budget limits
    const netFreeCash = income - plannedExpenses - monthlySavingsDeposit;

    // Render component view template using standard Box layout card
    return (
        // Standard Box component wrapper matching Analytics and BitcoinTracker cards
        <Box
            // Set outer bottom margin spacing matching surrounding card components
            style={{ marginBottom: '1rem' }}
            // Pass title header component layout matching surrounding dashboard components
            title={
                // Header row wrapper div with click trigger to toggle expanded state
                <div
                    // Toggle section visibility state on click
                    onClick={() => setIsExpanded(!isExpanded)}
                    // Flexbox layout styles
                    style={{
                        // Flex display model
                        display: 'flex',
                        // Space items to opposite edges
                        justifyContent: 'space-between',
                        // Center vertically
                        alignItems: 'center',
                        // Hand pointer cursor indicator
                        cursor: 'pointer',
                        // Full container width
                        width: '100%',
                        // Margin bottom zero when collapsed to match other cards
                        marginBottom: isExpanded ? '0.5rem' : '0'
                    }}
                >
                    {/* Main section title label */}
                    <span>Budget Planner</span>
                    {/* Rotating chevron arrow indicator */}
                    <span style={{
                        // Rotate arrow upside down when expanded
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        // Transition animation for arrow rotation
                        transition: 'transform 0.3s',
                        // Inline block display
                        display: 'inline-block'
                    }}>
                        {/* Chevron down symbol */}
                        ▼
                    </span>
                </div>
            }
        >
            {/* Render collapsible content when expanded flag is true */}
            {isExpanded && (
                // Wrapper div for expanded content body
                <div style={{ marginTop: '0.5rem' }}>
                    {/* Tab navigation bar container */}
                    <div className={styles.tabsContainer}>
                        {/* Tab button for Current Month Budget & Goals */}
                        <button
                            type="button"
                            className={`${styles.tabButton} ${activeTab === 'planner' ? styles.tabButtonActive : ''}`}
                            onClick={() => setActiveTab('planner')}
                        >
                            {/* Target SVG icon */}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {/* Outer target ring */}
                                <circle cx="12" cy="12" r="10" />
                                {/* Middle target ring */}
                                <circle cx="12" cy="12" r="6" />
                                {/* Center target ring */}
                                <circle cx="12" cy="12" r="2" />
                            {/* Closing svg */}
                            </svg>
                            {/* Tab label text */}
                            <span>Current Month Budget & Goals</span>
                        </button>
                        {/* Tab button for Multi-Month Horizon Planner */}
                        <button
                            type="button"
                            className={`${styles.tabButton} ${activeTab === 'horizon' ? styles.tabButtonActive : ''}`}
                            onClick={() => setActiveTab('horizon')}
                        >
                            {/* Horizon calendar SVG icon */}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {/* Calendar/horizon outline */}
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                {/* Top bar line */}
                                <line x1="16" y1="2" x2="16" y2="6" />
                                {/* Top bar line left */}
                                <line x1="8" y1="2" x2="8" y2="6" />
                                {/* Calendar middle divide */}
                                <line x1="3" y1="10" x2="21" y2="10" />
                            {/* Closing svg */}
                            </svg>
                            {/* Tab label text */}
                            <span>Month Simulation</span>
                        </button>
                    </div>
                    {/* Render Horizon Planner widget when horizon tab is active */}
                    {activeTab === 'horizon' ? (
                        <HorizonPlanner />
                    ) : (
                        <>
                            {/* Top metrics summary grid */}
                            <div className={styles.metricsGrid}>
                        {/* Metric card 1: Total Monthly Budget */}
                        <div className={styles.metricCard}>
                            {/* Metric label string */}
                            <span className={styles.metricLabel}>
                                Monthly Budget
                            </span>
                            {/* Check if monthly budget editing mode is active */}
                            {isEditingMonthlyBudget ? (
                                // Edit input container row
                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                                    {/* Number input control for total monthly budget, committing on Enter and aborting on Escape */}
                                    <input
                                        type="number"
                                        value={tempMonthlyBudget}
                                        onChange={(e) => setTempMonthlyBudget(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                commitMonthlyBudget();
                                            } else if (e.key === 'Escape') {
                                                cancelMonthlyBudgetEdit();
                                            }
                                        }}
                                        className={styles.input}
                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                                        autoFocus
                                    />
                                    {/* Save button trigger */}
                                    <button
                                        onClick={commitMonthlyBudget}
                                        title="Save budget (Enter)"
                                        style={{ background: 'var(--firebase-yellow)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontWeight: 'bold', color: 'black', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {/* Checkmark SVG */}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Check polyline */}
                                            <polyline points="20 6 9 17 4 12" />
                                        {/* Closing svg */}
                                        </svg>
                                    {/* Close button */}
                                    </button>
                                    {/* Cancel button discarding the pending edit */}
                                    <button
                                        onClick={cancelMonthlyBudgetEdit}
                                        title="Cancel (Esc)"
                                        style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {/* Cross SVG */}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Cross line 1 */}
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            {/* Cross line 2 */}
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        {/* Closing svg */}
                                        </svg>
                                    {/* Close button */}
                                    </button>
                                </div>
                            ) : (
                                // Value display trigger to activate inline editing mode
                                <div
                                    onClick={() => {
                                        // Initialize edit field with current budget value
                                        setTempMonthlyBudget(monthlyBudget !== undefined ? monthlyBudget.toString() : (effectiveTotalBudget > 0 ? effectiveTotalBudget.toString() : ''));
                                        // Open editing mode
                                        setIsEditingMonthlyBudget(true);
                                    }}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                    title="Click to edit monthly budget"
                                >
                                    {/* Formatted effective total monthly budget value */}
                                    <span className={styles.metricValue} style={{ color: 'var(--firebase-yellow)' }}>
                                        {formatCurrency(effectiveTotalBudget)}
                                    </span>
                                    {/* Edit pencil icon glyph */}
                                    <svg style={{ width: '14px', height: '14px', color: 'var(--text-secondary)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {/* SVG path shape */}
                                        <path d="M12 20h9"></path>
                                        {/* SVG path shape */}
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                </div>
                            )}
                            {/* Metric subtext info string */}
                            <span className={styles.metricSubtext}>
                                {/* Display label indicating whether custom budget is set */}
                                {monthlyBudget !== undefined ? 'Custom budget set' : 'Category budgets sum'}
                            </span>
                        </div>

                        {/* Metric card 2: Net Free Cash */}
                        <div className={styles.metricCard}>
                            {/* Metric label string */}
                            <span className={styles.metricLabel}>
                                Net Free Cash
                            </span>
                            {/* Formatted net free cash figure */}
                            <span className={styles.metricValue} style={{ color: netFreeCash < 0 ? 'var(--firebase-red)' : '#00E676' }}>
                                {formatCurrency(netFreeCash)}
                            </span>
                            {/* Metric subtext string */}
                            <span className={styles.metricSubtext}>
                                Unallocated income available
                            </span>
                        </div>

                        {/* Metric card 3: Monthly Savings Rate */}
                        <div className={styles.metricCard}>
                            {/* Metric label string */}
                            <span className={styles.metricLabel}>
                                Monthly Savings Rate
                            </span>
                            {/* Savings rate percentage value */}
                            <span className={styles.metricValue} style={{ color: '#AB47BC' }}>
                                {Math.round((monthlySavingsDeposit / (income || 1)) * 100)}%
                            </span>
                            {/* Metric subtext string */}
                            <span className={styles.metricSubtext}>
                                {formatCurrency(monthlySavingsDeposit)} saved / month
                            </span>
                        </div>
                    </div>

                    {/* Section heading for the savings goal */}
                    <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                        Savings Goal
                    </div>

                    {/* Goal panel box panel container */}
                    <div className={styles.panelBox}>
                        {/* Input controls form grid container */}
                        <div className={styles.goalFormGrid}>
                            {/* Form control group for target savings goal */}
                            <div className={styles.formGroup}>
                                {/* Target goal text label */}
                                <label className={styles.label}>
                                    Target Savings Goal
                                </label>
                                {/* Target goal numeric input control */}
                                <input
                                    type="number"
                                    value={goalAmount}
                                    onChange={(e) => setGoalAmount(e.target.value)}
                                    className={styles.input}
                                    placeholder="e.g. 50000"
                                />
                            </div>

                            {/* Form control group for monthly savings contribution */}
                            <div className={styles.formGroup}>
                                {/* Monthly savings contribution text label */}
                                <label className={styles.label}>
                                    Monthly Contribution
                                </label>
                                {/* Monthly savings contribution numeric input control */}
                                <input
                                    type="number"
                                    value={monthlyContributionInput}
                                    onChange={(e) => handleContributionChange(e.target.value)}
                                    className={styles.input}
                                    placeholder="e.g. 500"
                                />
                            </div>
                        </div>

                        {/* Check if target goal value is valid */}
                        {isGoalValid ? (
                            <>
                                {/* Progress bar track background line */}
                                <div className={styles.progressBarTrack}>
                                    {/* Progress bar active fill bar */}
                                    <div
                                        className={`${styles.progressBarFill} ${isGoalReached ? styles.progressBarFillReached : ''}`}
                                        style={{
                                            width: `${goalProgressPct}%`
                                        }}
                                    />
                                </div>
                                {/* Current savings vs target goal line summary */}
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                    {/* Formatted current total savings and parsed goal figure */}
                                    <span>{formatCurrency(totalSavings)} / {formatCurrency(parsedGoal)}</span>
                                    {/* Formatted percentage label string */}
                                    <span style={{ color: isGoalReached ? '#00E676' : 'var(--text-secondary)', fontWeight: 600 }}>
                                        {isGoalReached ? 'Reached!' : `${Math.round(goalProgressPct)}%`}
                                    </span>
                                </div>
                                {/* Conditional banner rendering based on goal state */}
                                {isGoalReached ? (
                                    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {/* Trophy celebration SVG icon */}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Cup body left handle */}
                                            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            {/* Cup body right handle */}
                                            <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4" />
                                            {/* Cup base line */}
                                            <path d="M4 22h16" />
                                            {/* Cup stem */}
                                            <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
                                            {/* Cup stem right */}
                                            <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
                                            {/* Cup bowl */}
                                            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                        {/* Closing svg */}
                                        </svg>
                                        {/* Goal reached message */}
                                        <span>Congratulations! You have reached your savings goal.</span>
                                    </div>
                                ) : monthsToGoal !== null ? (
                                    <div className={styles.estimationCard}>
                                        {/* Estimation label side container */}
                                        <div className={styles.estimationLabel}>
                                            {/* Timer SVG icon indicator */}
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64B5F6' }}>
                                                {/* Clock circle path */}
                                                <circle cx="12" cy="12" r="10"></circle>
                                                {/* Clock hands polyline */}
                                                <polyline points="12 6 12 12 16 14"></polyline>
                                            </svg>
                                            {/* Estimated duration text label */}
                                            <span>Estimated time to reach goal</span>
                                        </div>
                                        {/* Estimation value badge */}
                                        <div className={styles.estimationBadge}>
                                            {/* Months remaining numeric text */}
                                            <span>{monthsToGoal} {monthsToGoal === 1 ? 'month' : 'months'}</span>
                                            {/* Target completion month date text */}
                                            <span className={styles.estimationDate}>({targetCompletionDate})</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {/* Prompt to set monthly contribution */}
                                        Set a monthly savings contribution above to estimate how long it will take to reach your goal.
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {/* Prompt message shown when target goal is empty */}
                                Enter a target above to track progress. Your saved goal of{' '}
                                {/* Formatted savings goal context value */}
                                <strong>{formatCurrency(savingsGoal)}</strong> stays active until you set a new one.
                            </div>
                        )}
                    </div>
                        </>
                    )}
                </div>
            )}
        </Box>
    );
};

// Export BudgetPlanner component
export default BudgetPlanner;
