import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useBudget } from '../context/BudgetContext';
import Box from './Box';

const Analytics: React.FC = () => {
    const { categories } = useBudget();

    const data = categories.map(cat => ({
        name: cat.name,
        value: cat.expenses.reduce((sum, exp) => sum + exp.amount, 0),
        color: cat.color
    })).filter(item => item.value > 0);

    const totalValue = data.reduce((sum, item) => sum + item.value, 0);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(val);
    };

    const formatPercentage = (val: number) => {
        return `${((val / totalValue) * 100).toFixed(1)}%`;
    };

    if (data.length === 0) {
        return null;
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            return (
                <div style={{
                    backgroundColor: 'var(--surface-dark)',
                    border: '1px solid var(--border-color)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ fontWeight: 'bold', color: item.color, marginBottom: '0.25rem' }}>{item.name}</div>
                    <div style={{ color: 'white' }}>{formatCurrency(item.value)}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{formatPercentage(item.value)}</div>
                </div>
            );
        }
        return null;
    };

    const CustomLegend = ({ payload }: any) => {
        return (
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                gap: '1rem 1.5rem',
                padding: '0 1rem',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
            }}>
                {payload.map((entry: any, index: number) => {
                    const item = data.find(d => d.name === entry.value);
                    if (!item) return null;
                    return (
                        <React.Fragment key={`legend-${index}`}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color }} />
                            </div>
                            <div style={{ color: 'white', fontWeight: 500 }}>{item.name}</div>
                            <div style={{ textAlign: 'right' }}>{formatCurrency(item.value)}</div>
                            <div style={{ textAlign: 'right', width: '40px' }}>{formatPercentage(item.value)}</div>
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <Box title="Expenses Breakdown" style={{ marginBottom: '2rem' }}>
            <div style={{ height: '300px', marginBottom: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend content={<CustomLegend />} verticalAlign="bottom" height={undefined} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Box>
    );
};

export default Analytics;
