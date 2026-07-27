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

// Declare functional component representing Budget Planner & Savings Center
const BudgetPlanner: React.FC = () => {
    // Destructure metrics and state from budget context provider
    const { income, totalExpenses, monthlySavingsDeposit, totalSavings, categories, monthlyBudget, setMonthlyBudget, paydayStartDay } = useBudget();
    // Destructure formatCurrency function from localization context provider
    const { formatCurrency } = useLocalization();

    // Declare state for collapsible section visibility (hidden by default)
    const [isExpanded, setIsExpanded] = useState(false);
    // Declare state for active tab selection ('savings' | 'rules' | 'health')
    const [activeTab, setActiveTab] = useState<'savings' | 'rules' | 'health'>('savings');

    // Total effective budget threshold calculation
    const effectiveTotalBudget = monthlyBudget > 0 ? monthlyBudget : categories.reduce((s, c) => s + (c.budget || 0), 0);
    // Declare state for inline monthly budget editing mode
    const [isEditingMonthlyBudget, setIsEditingMonthlyBudget] = useState(false);
    // Declare state for temporary monthly budget input string
    const [tempMonthlyBudget, setTempMonthlyBudget] = useState(effectiveTotalBudget > 0 ? effectiveTotalBudget.toString() : '');

    // Keep tempMonthlyBudget in sync with loaded budget values when not editing
    useEffect(() => {
        if (!isEditingMonthlyBudget) {
            setTempMonthlyBudget(effectiveTotalBudget > 0 ? effectiveTotalBudget.toString() : '');
        }
    }, [effectiveTotalBudget, isEditingMonthlyBudget]);

    // Savings Goal state initializations
    // Declare state string for savings target goal amount
    const [goalAmount, setGoalAmount] = useState('50000');
    // Declare state string for monthly contribution amount
    const [monthlyContrib, setMonthlyContrib] = useState(monthlySavingsDeposit > 0 ? monthlySavingsDeposit.toString() : '2000');
    // Declare state for goal calculation result object
    const [savingsResult, setSavingsResult] = useState<{ months: number; targetDate: string; totalInterestSaved: number } | null>(null);

    // Keep monthly contribution state updated if context deposit changes
    useEffect(() => {
        // Check if monthly savings deposit exists in context
        if (monthlySavingsDeposit > 0) {
            // Update monthly contribution string state
            setMonthlyContrib(monthlySavingsDeposit.toString());
        }
    }, [monthlySavingsDeposit]);

    // Recalculate savings projection whenever goal amount or monthly contribution changes
    useEffect(() => {
        // Parse float value from goal amount string
        const target = parseFloat(goalAmount);
        // Parse float value from monthly contribution string
        const monthly = parseFloat(monthlyContrib);
        // Current existing bank savings balance
        const current = totalSavings;

        // Validate numbers are positive and valid floats
        if (isNaN(target) || isNaN(monthly) || monthly <= 0 || target <= current) {
            // Reset calculation result state to null if invalid or goal reached
            setSavingsResult(null);
            // Return early
            return;
        }

        // Calculate net remaining balance needed to reach target goal
        const needed = target - current;
        // Compute total months required to reach target
        const months = Math.ceil(needed / monthly);
        
        // Calculate estimated completion date
        const date = new Date();
        // Add calculated months to current date
        date.setMonth(date.getMonth() + months);
        // Format date string to Month Year (e.g. October 2026)
        const dateStr = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

        // Update calculation result state
        setSavingsResult({
            // Set required months count
            months,
            // Set formatted target completion date
            targetDate: dateStr,
            // Simple projected cushion bonus metric
            totalInterestSaved: Math.round(monthly * months * 0.02)
        });
    }, [goalAmount, monthlyContrib, totalSavings]);

    // Financial 50/30/20 Rule Calculations
    // Calculate total budgeted or actual income threshold
    const netIncome = income > 0 ? income : 1;
    // Recommended 50% Needs allocation amount
    const recNeeds = netIncome * 0.5;
    // Recommended 30% Wants allocation amount
    const recWants = netIncome * 0.3;
    // Recommended 20% Savings allocation amount
    const recSavings = netIncome * 0.2;

    // Estimate actual expenses distribution across Needs, Wants, and Savings
    // Calculate total expenses for categories labeled as Needs / Essential
    const actualNeeds = categories.reduce((sum, cat) => {
        // Match category names for essential utilities, rent, housing, food, transport
        const isNeed = /rent|housing|bill|utility|grocery|food|transport|car|health/i.test(cat.name);
        // Accumulate subtotal if category matches essential criteria
        return isNeed ? sum + cat.expenses.reduce((s, e) => s + e.amount, 0) : sum;
    }, 0);

    // Calculate actual Wants expenses as total expenses minus Needs
    const actualWants = Math.max(0, totalExpenses - actualNeeds);
    // Actual savings allocated this month
    const actualSavings = monthlySavingsDeposit;

    // Percentages of income spent on Needs, Wants, Savings
    // Percentage spent on Needs
    const pctNeeds = Math.min(100, (actualNeeds / netIncome) * 100);
    // Percentage spent on Wants
    const pctWants = Math.min(100, (actualWants / netIncome) * 100);
    // Percentage saved
    const pctSavings = Math.min(100, (actualSavings / netIncome) * 100);

    // Calculate budget burn rate relative to configured payday cycle
    const startDay = paydayStartDay || 25;
    const now = new Date();
    const todayNum = now.getDate();
    // Determine days elapsed in payday cycle starting on startDay
    const paydayDaysElapsed = startDay === 1
        ? todayNum
        : (todayNum >= startDay
            ? (todayNum - startDay + 1)
            : (new Date(now.getFullYear(), now.getMonth(), 0).getDate() - startDay + 1 + todayNum));
    // Total duration of payday cycle (30 days average)
    const paydayCycleLength = 30;
    // Percentage of payday cycle elapsed
    const monthElapsedPct = Math.min(100, Math.round((paydayDaysElapsed / paydayCycleLength) * 100));
    // Percentage of budget spent so far
    const budgetSpentPct = effectiveTotalBudget > 0 ? Math.round((totalExpenses / effectiveTotalBudget) * 100) : 0;

    // Calculate total planned budgeted expenses or actual expenses if higher
    const plannedExpenses = monthlyBudget > 0 
        ? Math.max(monthlyBudget, totalExpenses) 
        : categories.reduce((sum, cat) => sum + (cat.budget !== undefined ? Math.max(cat.budget, cat.expenses.reduce((s, e) => s + e.amount, 0)) : cat.expenses.reduce((s, e) => s + e.amount, 0)), 0);

    // Calculate remaining net free cash flow incorporating budget limits
    const netFreeCash = income - plannedExpenses - monthlySavingsDeposit;

    // Render component view template using standard Box layout card
    return (
        // Standard Box component wrapper matching Analytics and BitcoinTracker cards
        <Box
            // Remove margin bottom on header title when collapsed
            style={{ marginBottom: '1.5rem' }}
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
                    {/* Top metrics summary grid */}
                    <div className={styles.metricsGrid}>
                        {/* Metric card 1: Net Free Cash */}
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

                        {/* Metric card 2: Month Pace & Burn Rate */}
                        <div className={styles.metricCard}>
                            {/* Metric label string */}
                            <span className={styles.metricLabel}>
                                Payday Pace (Day {paydayDaysElapsed}/{paydayCycleLength})
                            </span>
                            {/* Burn rate compare value string */}
                            <span className={styles.metricValue} style={{ color: budgetSpentPct > monthElapsedPct ? 'var(--firebase-orange)' : '#00E676' }}>
                                {budgetSpentPct}% spent
                            </span>
                            {/* Metric subtext comparison string */}
                            <span className={styles.metricSubtext}>
                                {monthElapsedPct}% of month elapsed
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

                        {/* Metric card 4: Total Monthly Budget */}
                        <div className={styles.metricCard}>
                            {/* Metric label string */}
                            <span className={styles.metricLabel}>
                                Total Monthly Budget
                            </span>
                            {/* Check if monthly budget editing mode is active */}
                            {isEditingMonthlyBudget ? (
                                // Edit input container row
                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                                    {/* Number input control for total monthly budget */}
                                    <input
                                        type="number"
                                        value={tempMonthlyBudget}
                                        onChange={(e) => setTempMonthlyBudget(e.target.value)}
                                        className={styles.input}
                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                                        autoFocus
                                    />
                                    {/* Save button trigger */}
                                    <button
                                        onClick={() => {
                                            const val = parseFloat(tempMonthlyBudget);
                                            if (!isNaN(val)) setMonthlyBudget(val);
                                            setIsEditingMonthlyBudget(false);
                                        }}
                                        style={{ background: 'var(--firebase-yellow)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontWeight: 'bold', color: 'black' }}
                                    >
                                        ✓
                                    </button>
                                </div>
                            ) : (
                                // Value display trigger to activate inline editing mode
                                <div
                                    onClick={() => {
                                        setTempMonthlyBudget(effectiveTotalBudget > 0 ? effectiveTotalBudget.toString() : '');
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
                                {monthlyBudget > 0 ? 'Custom budget set' : 'Category budgets sum'}
                            </span>
                        </div>
                    </div>

                    {/* Navigation tabs row container */}
                    <div className={styles.tabContainer}>
                        {/* Tab button 1: Savings Goal Planner */}
                        <button
                            // Switch tab state to 'savings' on click
                            onClick={() => setActiveTab('savings')}
                            // Apply active tab styling conditionally
                            className={`${styles.tabButton} ${activeTab === 'savings' ? styles.activeTab : ''}`}
                        >
                            Savings Goal Calculator
                        </button>
                        {/* Tab button 2: 50-30-20 Rule Breakdown */}
                        <button
                            // Switch tab state to 'rules' on click
                            onClick={() => setActiveTab('rules')}
                            // Apply active tab styling conditionally
                            className={`${styles.tabButton} ${activeTab === 'rules' ? styles.activeTab : ''}`}
                        >
                            50-30-20 Rule
                        </button>
                        {/* Tab button 3: Budget Health Analysis */}
                        <button
                            // Switch tab state to 'health' on click
                            onClick={() => setActiveTab('health')}
                            // Apply active tab styling conditionally
                            className={`${styles.tabButton} ${activeTab === 'health' ? styles.activeTab : ''}`}
                        >
                            Budget Health
                        </button>
                    </div>

                    {/* Render active tab content view */}
                    {activeTab === 'savings' && (
                        // Calculator grid container wrapper
                        <div className={styles.calcGrid}>
                            {/* Left panel: Savings goal inputs */}
                            <div className={styles.panelBox}>
                                {/* Form row for target goal amount */}
                                <div className={styles.formGroup}>
                                    {/* Input label */}
                                    <label className={styles.label}>
                                        Target Savings Goal
                                    </label>
                                    {/* Goal number input control */}
                                    <input
                                        type="number"
                                        value={goalAmount}
                                        onChange={(e) => setGoalAmount(e.target.value)}
                                        className={styles.input}
                                        placeholder="e.g. 50000"
                                    />
                                </div>

                                {/* Form row for monthly contribution */}
                                <div className={styles.formGroup}>
                                    {/* Input label */}
                                    <label className={styles.label}>
                                        Monthly Deposit Contribution
                                    </label>
                                    {/* Contribution number input control */}
                                    <input
                                        type="number"
                                        value={monthlyContrib}
                                        onChange={(e) => setMonthlyContrib(e.target.value)}
                                        className={styles.input}
                                        placeholder="e.g. 2000"
                                    />
                                    {/* Quick add preset button pills row */}
                                    <div className={styles.presetRow}>
                                        {/* Preset button +500 kr */}
                                        <button
                                            onClick={() => setMonthlyContrib((prev) => (parseFloat(prev || '0') + 500).toString())}
                                            className={styles.presetBtn}
                                        >
                                            +500 kr
                                        </button>
                                        {/* Preset button +1000 kr */}
                                        <button
                                            onClick={() => setMonthlyContrib((prev) => (parseFloat(prev || '0') + 1000).toString())}
                                            className={styles.presetBtn}
                                        >
                                            +1000 kr
                                        </button>
                                        {/* Preset button 20% of income */}
                                        {income > 0 && (
                                            <button
                                                onClick={() => setMonthlyContrib(Math.round(income * 0.2).toString())}
                                                className={styles.presetBtn}
                                            >
                                                20% Income ({Math.round(income * 0.2)} kr)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right panel: Savings projection results */}
                            <div className={styles.panelBox}>
                                {/* Header sublabel */}
                                <span className={styles.metricLabel}>
                                    Target Projection ETA
                                </span>
                                {/* Check if calculation result exists */}
                                {savingsResult ? (
                                    // Flex layout container for projection metrics
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {/* Big ETA date highlight typography */}
                                        <div className={styles.metricValue} style={{ color: '#00E676' }}>
                                            {savingsResult.targetDate}
                                        </div>
                                        {/* Subtext info for months remaining */}
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            Achieved in <strong>{savingsResult.months} months</strong> with current monthly contribution of {formatCurrency(parseFloat(monthlyContrib))}.
                                        </div>
                                        {/* Progress bar visual for existing total savings vs goal */}
                                        <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '8px', overflow: 'hidden', marginTop: '0.25rem' }}>
                                            {/* Fill bar segment */}
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${Math.min(100, (totalSavings / (parseFloat(goalAmount) || 1)) * 100)}%`,
                                                    background: '#00E676',
                                                    transition: 'width 0.3s ease'
                                                }}
                                            />
                                        </div>
                                        {/* Subtext info showing total accumulated balance */}
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Current: {formatCurrency(totalSavings)}</span>
                                            <span>Target: {formatCurrency(parseFloat(goalAmount) || 0)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    // Fallback display message when goal is reached or invalid
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '1rem 0' }}>
                                        {totalSavings >= parseFloat(goalAmount || '0')
                                            ? 'You have already reached or exceeded this savings goal!'
                                            : 'Enter a valid target goal and monthly deposit to calculate your estimated timeline.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Render 50-30-20 Rule Tab */}
                    {activeTab === 'rules' && (
                        // Panel box wrapper
                        <div className={styles.panelBox}>
                            {/* Section explanation text */}
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                The 50-30-20 rule recommends spending <strong>50% on Needs</strong>, <strong>30% on Wants</strong>, and saving <strong>20% of Net Income</strong>.
                            </div>

                            {/* Needs row bar */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {/* Label and values display */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span>Needs (Target: 50% = {formatCurrency(recNeeds)})</span>
                                    <span>{formatCurrency(actualNeeds)} ({Math.round(pctNeeds)}%)</span>
                                </div>
                                {/* Track bar */}
                                <div className={styles.ruleTrack}>
                                    {/* Segment fill */}
                                    <div
                                        className={styles.ruleSegment}
                                        style={{
                                            width: `${pctNeeds}%`,
                                            background: pctNeeds > 50 ? 'var(--firebase-orange)' : '#29B6F6'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Wants row bar */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.75rem' }}>
                                {/* Label and values display */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span>Wants (Target: 30% = {formatCurrency(recWants)})</span>
                                    <span>{formatCurrency(actualWants)} ({Math.round(pctWants)}%)</span>
                                </div>
                                {/* Track bar */}
                                <div className={styles.ruleTrack}>
                                    {/* Segment fill */}
                                    <div
                                        className={styles.ruleSegment}
                                        style={{
                                            width: `${pctWants}%`,
                                            background: pctWants > 30 ? 'var(--firebase-red)' : '#AB47BC'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Savings row bar */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.75rem' }}>
                                {/* Label and values display */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span>Savings (Target: 20% = {formatCurrency(recSavings)})</span>
                                    <span>{formatCurrency(actualSavings)} ({Math.round(pctSavings)}%)</span>
                                </div>
                                {/* Track bar */}
                                <div className={styles.ruleTrack}>
                                    {/* Segment fill */}
                                    <div
                                        className={styles.ruleSegment}
                                        style={{
                                            width: `${pctSavings}%`,
                                            background: pctSavings >= 20 ? '#00E676' : 'var(--firebase-yellow)'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Render Budget Health Analysis Tab */}
                    {activeTab === 'health' && (
                        // Panel box wrapper
                        <div className={styles.panelBox}>
                            {/* Health status summary title */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                <span>Health Status:</span>
                                <span style={{ color: budgetSpentPct <= monthElapsedPct ? '#00E676' : 'var(--firebase-orange)' }}>
                                    {budgetSpentPct <= monthElapsedPct ? 'Healthy Spending Velocity' : 'Spending Faster Than Time Elapsed'}
                                </span>
                            </div>

                            {/* Monthly Budget Setting Form Group */}
                            <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                                <label className={styles.label}>Total Monthly Budget Limit</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="number"
                                        value={tempMonthlyBudget}
                                        onChange={(e) => setTempMonthlyBudget(e.target.value)}
                                        className={styles.input}
                                        placeholder="Set total monthly budget"
                                    />
                                    <button
                                        onClick={() => {
                                            const val = parseFloat(tempMonthlyBudget);
                                            if (!isNaN(val)) setMonthlyBudget(val);
                                        }}
                                        style={{ background: 'var(--firebase-yellow)', border: 'none', borderRadius: '6px', padding: '0.6rem 1rem', cursor: 'pointer', fontWeight: 'bold', color: 'black', flexShrink: 0 }}
                                    >
                                        Save Budget
                                    </button>
                                </div>
                            </div>

                            {/* Health details list */}
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <div>• <strong>Burn Rate:</strong> You have spent {budgetSpentPct}% of your budget with {monthElapsedPct}% of the month completed.</div>
                                <div>• <strong>Free Cash Balance:</strong> You have {formatCurrency(netFreeCash)} remaining unallocated after expenses and savings.</div>
                                <div>• <strong>Category Coverage:</strong> {categories.filter(c => (c.expenses.reduce((s,e)=>s+e.amount,0)) > (c.budget || 0)).length} category(ies) currently exceeding their budget limit.</div>
                            </div>
                        </div>
                    )}

                    {/* Smart recommendation callout tip box */}
                    {netFreeCash > 0 && (
                        // Tip box wrapper
                        <div className={styles.tipBox}>
                            {/* Tip description text */}
                            <div>
                                You have <strong>{formatCurrency(netFreeCash)}</strong> in unallocated free cash flow. Allocating 50% ({formatCurrency(Math.round(netFreeCash * 0.5))}) to your savings deposit will accelerate your target goal by several months!
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Box>
    );
};

// Export BudgetPlanner component
export default BudgetPlanner;
