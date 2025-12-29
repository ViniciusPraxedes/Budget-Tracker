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

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontSize: '0.8rem', fontWeight: 'bold', textShadow: '0px 0px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <Box title="Expenses Breakdown" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ height: '300px' }}>
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
                                label={renderCustomizedLabel}
                                labelLine={false}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto auto',
                    gap: '0.75rem 1.5rem',
                    padding: '0 1rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    paddingRight: '0.5rem' // Space for scrollbar
                }}>
                    {data.map((item, index) => (
                        <React.Fragment key={`legend-${index}`}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color }} />
                            </div>
                            <div style={{ color: 'white', fontWeight: 500 }}>{item.name}</div>
                            <div style={{ textAlign: 'right' }}>{formatCurrency(item.value)}</div>
                            <div style={{ textAlign: 'right', width: '45px' }}>{formatPercentage(item.value)}</div>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </Box>
    );
};

export default Analytics;
