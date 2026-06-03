import React, { useState, useEffect } from 'react';
import Box from './Box';
import { useBudget } from '../context/BudgetContext';

const SavingsCalculator: React.FC = () => {
    const { totalSavings } = useBudget();
    const [currentSavings, setCurrentSavings] = useState(totalSavings.toString());
    const [monthlyContribution, setMonthlyContribution] = useState('');
    const [goal, setGoal] = useState('');
    const [result, setResult] = useState<{ months: number; date: string } | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        setCurrentSavings(totalSavings.toString());
    }, [totalSavings]);

    const calculateSavings = () => {
        const current = parseFloat(currentSavings);
        const monthly = parseFloat(monthlyContribution);
        const target = parseFloat(goal);

        if (isNaN(current) || isNaN(monthly) || isNaN(target) || monthly <= 0) {
            return;
        }

        if (current >= target) {
            setResult({ months: 0, date: 'Already achieved!' });
            return;
        }

        const remaining = target - current;
        const months = Math.ceil(remaining / monthly);

        const now = new Date();
        const targetDate = new Date(now.getFullYear(), now.getMonth() + months, 1);

        // Format date: "Month Year" (e.g., "August 2026")
        const dateString = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        setResult({ months, date: dateString });
    };

    const inputStyle = {
        background: 'var(--background-dark)',
        border: '1px solid var(--border-color)',
        color: 'white',
        padding: '0.75rem',
        borderRadius: '8px',
        width: '100%',
        fontSize: '1rem',
        marginBottom: '1rem'
    };

    const labelStyle = {
        display: 'block',
        color: 'var(--text-secondary)',
        marginBottom: '0.5rem',
        fontSize: '0.9rem'
    };

    return (
        <div style={{ marginBottom: '3rem' }}>
            <Box title={
                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        width: '100%'
                    }}
                >
                    <span>Savings Calculator</span>
                    <span style={{
                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                        transition: 'transform 0.3s',
                        display: 'inline-block'
                    }}>
                        ▼
                    </span>
                </div>
            }>
                {!isCollapsed && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Current Savings</label>
                                <input
                                    type="number"
                                    value={currentSavings}
                                    onChange={(e) => setCurrentSavings(e.target.value)}
                                    placeholder="0"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Monthly Contribution</label>
                                <input
                                    type="number"
                                    value={monthlyContribution}
                                    onChange={(e) => setMonthlyContribution(e.target.value)}
                                    placeholder="0"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Goal Amount</label>
                                <input
                                    type="number"
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="0"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <button
                            onClick={calculateSavings}
                            style={{
                                background: 'var(--firebase-yellow)',
                                color: 'black',
                                border: 'none',
                                padding: '0.75rem 2rem',
                                borderRadius: '24px',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                width: '100%',
                                marginTop: '0.5rem'
                            }}
                        >
                            Calculate
                        </button>

                        {result && (
                            <div style={{
                                marginTop: '1.5rem',
                                padding: '1rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '8px',
                                textAlign: 'center',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Time to reach goal</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--firebase-yellow)' }}>
                                    {result.months} Months
                                </div>
                                <div style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
                                    Target: <span style={{ fontWeight: 'bold' }}>{result.date}</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Box>
        </div>
    );
};

export default SavingsCalculator;
