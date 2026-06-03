import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useBudget } from '../context/BudgetContext';
import { useLocalization } from '../context/LocalizationContext';
import Box from './Box';

// Define mathematical constant to convert degrees to radians
const RADIAN = Math.PI / 180;

// Define properties interface for PieLabel parameters
interface PieLabelProps {
    // The center X coordinate of the pie
    cx: number;
    // The center Y coordinate of the pie
    cy: number;
    // The middle angle degree of the slice
    midAngle: number;
    // The inner radius of the donut
    innerRadius: number;
    // The outer radius of the donut
    outerRadius: number;
    // The decimal percentage of the slice
    percent: number;
    // The index position of the slice
    index: number;
// Close the interface declaration
}

// Function to render custom inner labels for pie segments
const renderCustomizedLabel = ({
    // Map X center coordinate parameter
    cx,
    // Map Y center coordinate parameter
    cy,
    // Map angle calculation parameter
    midAngle,
    // Map inner radius bounds parameter
    innerRadius,
    // Map outer radius bounds parameter
    outerRadius,
    // Map slice percentage parameter
    percent,
// Provide type declaration using any to satisfy Recharts library types
}: any) => {
    // Calculate standard mid-radius placement position
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    // Project horizontal center position using cosine conversion
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    // Project vertical center position using sine conversion
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Hide percentage label for extremely thin slices to avoid text layout collisions
    if (percent < 0.01) {
        // Render no label output
        return null;
    // Close conditional block
    }

    // Return inline SVG text layout segment
    return (
        // Define graphic text tag element
        <text
            // Assign mapped horizontal projection
            x={x}
            // Assign mapped vertical projection
            y={y}
            // Apply white fill color for visual contrast
            fill="white"
            // Align text element anchors horizontally
            textAnchor="middle"
            // Align text baseline anchors vertically
            dominantBaseline="central"
            // Apply small font size rules
            fontSize="0.75rem"
            // Apply bold styling weight rules
            fontWeight="bold"
        // Close opening tag attributes
        >
            {/* Print evaluated percentage values */}
            {`${(percent * 100).toFixed(1)}%`}
        {/* Close graphic text element */}
        </text>
    // Close return statement
    );
// Close function declaration
};

const Analytics: React.FC = () => {
    const { categories } = useBudget();
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const data = categories.map(cat => ({
        name: cat.name,
        value: cat.expenses.reduce((sum, exp) => sum + exp.amount, 0),
        color: cat.color
    })).filter(item => item.value > 0);

    const totalValue = data.reduce((sum, item) => sum + item.value, 0);

    const { formatCurrency } = useLocalization();

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

    const centerValue = activeIndex !== null && data[activeIndex] ? data[activeIndex].value : totalValue;
    const centerLabel = activeIndex !== null && data[activeIndex] ? data[activeIndex].name : 'Total';

    return (
        <Box title="Expenses Breakdown" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ height: '300px', position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            {/* Render Pie component with customized labels inside slices */}
                            <Pie
                                // Set data array source
                                data={data}
                                // Align center horizontally
                                cx="50%"
                                // Align center vertically
                                cy="50%"
                                // Set inner radius of donut ring
                                innerRadius={70}
                                // Set outer radius of donut ring
                                outerRadius={110}
                                // Set padding angle between slices
                                paddingAngle={5}
                                // Set key mapping to evaluate values
                                dataKey="value"
                                // Disable connecting label lines
                                labelLine={false}
                                // Assign custom slice label renderer function
                                label={renderCustomizedLabel}
                                // Handle hover enter event
                                onMouseEnter={(_, index) => setActiveIndex(index)}
                                // Handle hover leave event
                                onMouseLeave={() => setActiveIndex(null)}
                            // Close opening component properties
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        transition: 'all 0.3s ease'
                    }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {centerLabel}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white', marginTop: '0.2rem' }}>
                            {formatCurrency(centerValue)}
                        </div>
                    </div>
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
