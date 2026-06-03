import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useLocalization } from '../context/LocalizationContext';
import Box from './Box';
import styles from './Summary.module.css';

const Summary: React.FC = () => {
    const { income, totalExpenses, savings, setIncome, categories, totalSavings, updateTotalSavings } = useBudget();
    const { formatCurrency } = useLocalization();
    const [isEditingIncome, setIsEditingIncome] = useState(false);
    const [tempIncome, setTempIncome] = useState(income.toString());
    
    const [isEditingTotalSavings, setIsEditingTotalSavings] = useState(false);
    const [tempTotalSavings, setTempTotalSavings] = useState(totalSavings.toString());

    const handleIncomeSave = () => {
        const val = parseFloat(tempIncome);
        if (!isNaN(val)) {
            setIncome(val);
        }
        setIsEditingIncome(false);
    };

    const handleTotalSavingsSave = () => {
        const val = parseFloat(tempTotalSavings);
        if (!isNaN(val)) {
            updateTotalSavings(val);
        }
        setIsEditingTotalSavings(false);
    };

    // Generate heatmap gradient based on categories
    let currentPercentage = 0;
    const gradientStops = categories.map(cat => {
        const catTotal = cat.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const catPercentage = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
        if (catPercentage === 0) return null;
        
        const start = currentPercentage;
        currentPercentage += catPercentage;
        const end = currentPercentage;
        return `${cat.color} ${start}%, ${cat.color} ${end}%`;
    }).filter(Boolean).join(', ');

    const heatMapBackground = gradientStops ? `linear-gradient(to right, ${gradientStops})` : 'var(--border-color)';

    return (
        <div className={styles.container}>
            <Box title="Monthly Income" className={styles.incomeBox}>
                {isEditingIncome ? (
                    <div className={styles.editContainer}>
                        <input
                            type="number"
                            value={tempIncome}
                            onChange={(e) => setTempIncome(e.target.value)}
                            className={styles.editInput}
                            autoFocus
                        />
                        <button
                            onClick={handleIncomeSave}
                            className={styles.saveBtn}
                        >
                            Save
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => setIsEditingIncome(true)}
                        className={styles.valueDisplay}
                    >
                        {formatCurrency(income)}
                        {/* Fix: use proper SVG icon to avoid typography alignment anomalies with emoji */}
                        <svg className={styles.editIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </div>
                )}
            </Box>

            <Box title="Monthly Expenses" className={styles.expenseBox}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className={styles.expenseDisplay}>
                        {formatCurrency(totalExpenses)}
                    </div>
                    <div style={{
                        width: '100%',
                        height: '6px',
                        background: heatMapBackground,
                        borderRadius: '3px',
                        marginTop: '0.5rem'
                    }} title="Expenses Heatmap" />
                </div>
            </Box>

            <Box title="Monthly Savings" className={styles.savingsBox}>
                <div className={styles.savingsDisplay} style={{ color: savings < 0 ? 'var(--firebase-red)' : '#00E676' }}>
                    {formatCurrency(savings)}
                </div>
            </Box>

            <Box title="Total Savings" className={styles.totalSavingsBox}>
                {isEditingTotalSavings ? (
                    <div className={styles.editContainer}>
                        <input
                            type="number"
                            value={tempTotalSavings}
                            onChange={(e) => setTempTotalSavings(e.target.value)}
                            className={styles.editInput}
                            autoFocus
                        />
                        <button
                            onClick={handleTotalSavingsSave}
                            className={styles.saveBtn}
                        >
                            Save
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => {
                            setTempTotalSavings(totalSavings.toString());
                            setIsEditingTotalSavings(true);
                        }}
                        className={styles.valueDisplay}
                        style={{ color: 'white' }}
                    >
                        {formatCurrency(totalSavings)}
                        <svg className={styles.editIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </div>
                )}
            </Box>
        </div>
    );
};

export default Summary;
