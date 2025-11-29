import React from 'react';
import { useBudget } from '../context/BudgetContext';

const MonthSelector: React.FC = () => {
    const { currentMonth, currentYear, changeMonth } = useBudget();

    const handlePrev = () => {
        if (currentMonth === 0) {
            changeMonth(11, currentYear - 1);
        } else {
            changeMonth(currentMonth - 1, currentYear);
        }
    };

    const handleNext = () => {
        if (currentMonth === 11) {
            changeMonth(0, currentYear + 1);
        } else {
            changeMonth(currentMonth + 1, currentYear);
        }
    };

    const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button
                onClick={handlePrev}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
            >
                ‹
            </button>
            <h2 style={{ margin: 0, minWidth: '200px', textAlign: 'center', textTransform: 'capitalize' }}>
                {monthName} {currentYear}
            </h2>
            <button
                onClick={handleNext}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
            >
                ›
            </button>
        </div>
    );
};

export default MonthSelector;
