import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import Box from './Box';

const Summary: React.FC = () => {
    const { income, totalExpenses, savings, setIncome } = useBudget();
    const [isEditingIncome, setIsEditingIncome] = useState(false);
    const [tempIncome, setTempIncome] = useState(income.toString());

    const handleIncomeSave = () => {
        const val = parseFloat(tempIncome);
        if (!isNaN(val)) {
            setIncome(val);
        }
        setIsEditingIncome(false);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(val);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <Box title="Monthly Income" style={{ borderLeft: '4px solid var(--firebase-yellow)' }}>
                {isEditingIncome ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            value={tempIncome}
                            onChange={(e) => setTempIncome(e.target.value)}
                            style={{
                                background: 'var(--background-dark)',
                                border: '1px solid var(--border-color)',
                                color: 'white',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                width: '100%'
                            }}
                            autoFocus
                        />
                        <button
                            onClick={handleIncomeSave}
                            style={{
                                background: 'var(--firebase-yellow)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0.5rem 1rem',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                color: 'black'
                            }}
                        >
                            Save
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => setIsEditingIncome(true)}
                        style={{ fontSize: '2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {formatCurrency(income)}
                        <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>✎</span>
                    </div>
                )}
            </Box>

            <Box title="Monthly Expenses" style={{ borderLeft: '4px solid var(--firebase-red)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {formatCurrency(totalExpenses)}
                </div>
            </Box>

            <Box title="Monthly Savings" style={{ borderLeft: '4px solid #00E676' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: savings < 0 ? 'var(--firebase-red)' : '#00E676' }}>
                    {formatCurrency(savings)}
                </div>
            </Box>
        </div>
    );
};

export default Summary;
