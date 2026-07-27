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
    const { income, totalExpenses, savings, setIncome, categories, totalSavings, updateTotalSavings, monthlySavingsDeposit, setMonthlySavingsDeposit } = useBudget();
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

    // Calculate free operational cash remaining after expenses and savings deposit
    const freeCash = income - totalExpenses - monthlySavingsDeposit;

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

    // Initialize accumulator for category heatmap percentages
    let currentPercentage = 0;
    // Map categories to linear gradient stops
    const gradientStops = categories.map(cat => {
        // Compute total spending for category
        const catTotal = cat.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        // Calculate category spending percentage relative to total expenses
        const catPercentage = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
        // Return null if percentage is zero
        if (catPercentage === 0) return null;
        
        // Save current start percentage
        const start = currentPercentage;
        // Accumulate percentage to end boundary
        currentPercentage += catPercentage;
        // Save end percentage boundary
        const end = currentPercentage;
        // Return gradient stop string segment
        return `${cat.color} ${start}%, ${cat.color} ${end}%`;
    // Filter out null stops and join segments
    }).filter(Boolean).join(', ');

    // Construct background CSS linear gradient string
    const heatMapBackground = gradientStops ? `linear-gradient(to right, ${gradientStops})` : 'var(--border-color)';

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
                        onClick={() => setIsEditingIncome(true)}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Expense total formatted string */}
                    <div className={styles.expenseDisplay}>
                        {formatCurrency(totalExpenses)}
                    </div>
                    {/* Heatmap progress visual bar */}
                    <div style={{
                        width: '100%',
                        height: '6px',
                        background: heatMapBackground,
                        borderRadius: '3px',
                        marginTop: '0.5rem'
                    }} title="Expenses Heatmap" />
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
                        style={{ color: '#00BCD4' }}
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
            </Box>
        </div>
    );
};

// Export Summary component
export default Summary;
