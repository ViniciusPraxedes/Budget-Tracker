// Import React core hooks
import React, { useState } from 'react';
// Import useBudget context hook
import { useBudget } from '../context/BudgetContext';
// Import useLocalization context hook
import { useLocalization } from '../context/LocalizationContext';
// Import Box container card component
import Box from './Box';
// Import CSS module styles
import styles from './Summary.module.css';

// Declare Summary React functional component
const Summary: React.FC = () => {
    // Destructure budget metrics and setters from context hook
    const { income, totalExpenses, savings, setIncome, categories, totalSavings, updateTotalSavings, monthlySavingsDeposit, setMonthlySavingsDeposit, monthlyBudget, setMonthlyBudget, savingsGoal } = useBudget();
    // Destructure currency formatter from localization hook
    const { formatCurrency } = useLocalization();
    // Declare state for inline income editing mode
    const [isEditingIncome, setIsEditingIncome] = useState(false);
    // Declare state for temporary income input string
    const [tempIncome, setTempIncome] = useState(income.toString());
    
    // Declare state for inline total savings editing mode
    const [isEditingTotalSavings, setIsEditingTotalSavings] = useState(false);
    // Declare state for temporary total savings input string
    const [tempTotalSavings, setTempTotalSavings] = useState(totalSavings.toString());

    // Declare state for inline monthly savings deposit editing mode
    const [isEditingDeposit, setIsEditingDeposit] = useState(false);
    // Declare state for temporary monthly savings deposit input string
    const [tempDeposit, setTempDeposit] = useState(monthlySavingsDeposit.toString());

    // Keep temp state in sync with loaded budget context values when not editing
    React.useEffect(() => {
        if (!isEditingIncome) setTempIncome(income.toString());
    }, [income, isEditingIncome]);

    React.useEffect(() => {
        if (!isEditingTotalSavings) setTempTotalSavings(totalSavings.toString());
    }, [totalSavings, isEditingTotalSavings]);

    React.useEffect(() => {
        if (!isEditingDeposit) setTempDeposit(monthlySavingsDeposit.toString());
    }, [monthlySavingsDeposit, isEditingDeposit]);

    // Calculate effective monthly budget target amount
    const effectiveMonthlyBudget = monthlyBudget > 0 ? monthlyBudget : categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);

    // Calculate total planned budgeted expenses or actual expenses if higher
    const plannedExpenses = monthlyBudget > 0 
        ? Math.max(monthlyBudget, totalExpenses) 
        : categories.reduce((sum, cat) => sum + (cat.budget !== undefined ? Math.max(cat.budget, cat.expenses.reduce((s, e) => s + e.amount, 0)) : cat.expenses.reduce((s, e) => s + e.amount, 0)), 0);
    // Calculate free operational cash remaining after budgeted expenses and savings deposit
    const freeCash = income - plannedExpenses - monthlySavingsDeposit;

    // Handle saving updated monthly income value
    const handleIncomeSave = () => {
        // Parse float value from input text
        const val = parseFloat(tempIncome);
        // Check if parsed number is valid
        if (!isNaN(val)) {
            // Invoke setIncome handler
            setIncome(val);
        }
        // Disable income editing mode
        setIsEditingIncome(false);
    };

    // Handle saving updated total savings bank balance
    const handleTotalSavingsSave = () => {
        // Parse float value from input text
        const val = parseFloat(tempTotalSavings);
        // Check if parsed number is valid
        if (!isNaN(val)) {
            // Invoke updateTotalSavings handler
            updateTotalSavings(val);
        }
        // Disable total savings editing mode
        setIsEditingTotalSavings(false);
    };

    // Handle saving updated monthly savings deposit allocation
    const handleDepositSave = () => {
        // Parse float value from input text
        const val = parseFloat(tempDeposit);
        // Check if parsed number is valid
        if (!isNaN(val)) {
            // Invoke setMonthlySavingsDeposit handler
            setMonthlySavingsDeposit(val);
        }
        // Disable deposit editing mode
        setIsEditingDeposit(false);
    };

    // Calculate percentage of budget consumed by actual expenses
    const budgetUsedPercentage = effectiveMonthlyBudget > 0 ? (totalExpenses / effectiveMonthlyBudget) * 100 : 0;
    // Clamp displayed bar width to 100% so overspend doesn't overflow the track
    const budgetBarWidth = Math.min(budgetUsedPercentage, 100);
    // Choose progress bar color based on how close to or over budget
    const budgetBarColor = budgetUsedPercentage >= 100
        ? 'var(--firebase-red)'
        : budgetUsedPercentage >= 80
            ? 'var(--firebase-yellow)'
            : '#00E676';

    // Calculate percentage of savings goal reached by current total savings
    const savingsGoalPercentage = savingsGoal > 0 ? (totalSavings / savingsGoal) * 100 : 0;
    // Clamp displayed bar width to 100% once the goal is reached or exceeded
    const savingsGoalBarWidth = Math.min(savingsGoalPercentage, 100);
    // Highlight bar in green once the goal has been reached, otherwise the card's accent blue
    const savingsGoalBarColor = savingsGoalPercentage >= 100 ? '#00E676' : '#2196F3';

    // Return component visual tree
    return (
        // Grid container wrapper
        <div className={styles.container}>
            {/* Monthly Income summary card */}
            <Box title="Monthly Income" className={styles.incomeBox}>
                {/* Check if income editing mode is active */}
                {isEditingIncome ? (
                    // Input and save button container
                    <div className={styles.editContainer}>
                        {/* Number input field for editing income */}
                        <input
                            type="number"
                            value={tempIncome}
                            onChange={(e) => setTempIncome(e.target.value)}
                            className={styles.editInput}
                            autoFocus
                        />
                        {/* Save button trigger */}
                        <button
                            onClick={handleIncomeSave}
                            className={styles.saveBtn}
                        >
                            Save
                        </button>
                    </div>
                ) : (
                    // Display box trigger to enable editing
                    <div
                        onClick={() => {
                            setTempIncome(income.toString());
                            setIsEditingIncome(true);
                        }}
                        className={styles.valueDisplay}
                    >
                        {/* Render formatted income currency */}
                        {formatCurrency(income)}
                        {/* Edit pencil SVG icon */}
                        <svg className={styles.editIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {/* SVG path shape */}
                            <path d="M12 20h9"></path>
                            {/* SVG path shape */}
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </div>
                )}
            </Box>

            {/* Monthly Expenses summary card */}
            <Box title="Monthly Expenses" className={styles.expenseBox}>
                {/* Column layout container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {/* Expense total formatted string */}
                    <div className={styles.expenseDisplay}>
                        {formatCurrency(totalExpenses)}
                    </div>
                    {/* Render static total monthly budget string */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.15rem'
                        }}
                    >
                        {/* Render formatted total monthly budget or fallback sum of category budgets */}
                        <span>
                            Budgeted: {formatCurrency(effectiveMonthlyBudget)}
                        </span>
                        {/* Render percentage of budget consumed so far */}
                        <span style={{ color: budgetBarColor, fontWeight: 600 }}>
                            {Math.round(budgetUsedPercentage)}%
                        </span>
                    </div>
                    {/* Budget usage progress bar track */}
                    <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'var(--border-color)',
                        borderRadius: '3px',
                        marginTop: '0.25rem',
                        overflow: 'hidden'
                    }} title={`${Math.round(budgetUsedPercentage)}% of budget used`}>
                        {/* Budget usage progress bar fill */}
                        <div style={{
                            width: `${budgetBarWidth}%`,
                            height: '100%',
                            background: budgetBarColor,
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            </Box>

            {/* Monthly Savings Deposit Card */}
            <Box title="Monthly Savings Deposit" className={styles.depositBox}>
                {/* Check if deposit editing mode is active */}
                {isEditingDeposit ? (
                    // Edit container wrapper
                    <div className={styles.editContainer}>
                        {/* Input field for savings deposit */}
                        <input
                            type="number"
                            value={tempDeposit}
                            onChange={(e) => setTempDeposit(e.target.value)}
                            className={styles.editInput}
                            autoFocus
                        />
                        {/* Save button trigger */}
                        <button
                            onClick={handleDepositSave}
                            className={styles.saveBtn}
                        >
                            Save
                        </button>
                    </div>
                ) : (
                    // Value display trigger
                    <div
                        onClick={() => {
                            setTempDeposit(monthlySavingsDeposit.toString());
                            setIsEditingDeposit(true);
                        }}
                        className={styles.valueDisplay}
                        style={{ color: '#00E676' }}
                    >
                        {/* Formatted monthly savings deposit */}
                        {formatCurrency(monthlySavingsDeposit)}
                        {/* Edit pencil SVG icon */}
                        <svg className={styles.editIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {/* SVG path shape */}
                            <path d="M12 20h9"></path>
                            {/* SVG path shape */}
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </div>
                )}
            </Box>

            {/* Net Free Cash Remaining summary card */}
            <Box title="Net Free Cash" className={styles.freeCashBox}>
                {/* Free cash display element with color indicator */}
                <div className={styles.savingsDisplay} style={{ color: freeCash < 0 ? 'var(--firebase-red)' : '#AB47BC' }}>
                    {formatCurrency(freeCash)}
                </div>
            </Box>

            {/* Total Bank Savings summary card */}
            <Box title="Total Savings" className={styles.totalSavingsBox}>
                {/* Vertical column wrapper for total savings and monthly contribution subtext */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {/* Check if total savings editing mode is active */}
                    {isEditingTotalSavings ? (
                        // Edit container wrapper
                        <div className={styles.editContainer}>
                            {/* Input field for editing total savings */}
                            <input
                                type="number"
                                value={tempTotalSavings}
                                onChange={(e) => setTempTotalSavings(e.target.value)}
                                className={styles.editInput}
                                autoFocus
                            />
                            {/* Save button trigger */}
                            <button
                                onClick={handleTotalSavingsSave}
                                className={styles.saveBtn}
                            >
                                Save
                            </button>
                        </div>
                    ) : (
                        // Value display element
                        <div
                            onClick={() => {
                                setTempTotalSavings(totalSavings.toString());
                                setIsEditingTotalSavings(true);
                            }}
                            className={styles.valueDisplay}
                            style={{ color: 'white' }}
                        >
                            {/* Formatted total savings currency */}
                            {formatCurrency(totalSavings)}
                            {/* Edit pencil SVG icon */}
                            <svg className={styles.editIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {/* SVG path shape */}
                                <path d="M12 20h9"></path>
                                {/* SVG path shape */}
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                        </div>
                    )}
                    {/* Subtext display showing monthly deposit contribution */}
                    <div style={{ fontSize: '0.875rem', color: '#00E676', fontWeight: 500 }}>
                        {/* Formatted monthly deposit contribution string */}
                        +{formatCurrency(monthlySavingsDeposit)} this month
                    </div>
                    {/* Savings goal progress label row */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.15rem'
                        }}
                    >
                        {/* Render formatted savings goal target */}
                        <span>
                            Goal: {formatCurrency(savingsGoal)}
                        </span>
                        {/* Render percentage of savings goal reached so far */}
                        <span style={{ color: savingsGoalBarColor, fontWeight: 600 }}>
                            {Math.round(savingsGoalPercentage)}%
                        </span>
                    </div>
                    {/* Savings goal progress bar track */}
                    <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'var(--border-color)',
                        borderRadius: '3px',
                        marginTop: '0.25rem',
                        overflow: 'hidden'
                    }} title={`${Math.round(savingsGoalPercentage)}% of savings goal reached`}>
                        {/* Savings goal progress bar fill */}
                        <div style={{
                            width: `${savingsGoalBarWidth}%`,
                            height: '100%',
                            background: savingsGoalBarColor,
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            </Box>
        </div>
    );
};

// Export Summary component
export default Summary;
