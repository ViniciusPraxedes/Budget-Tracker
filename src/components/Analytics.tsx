// Import React core and hooks
import React, { useState } from 'react';
// Import Recharts components for data visualization charts
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
// Import useBudget context hook
import { useBudget } from '../context/BudgetContext';
// Import useLocalization context hook
import { useLocalization } from '../context/LocalizationContext';
// Import Box card container layout component
import Box from './Box';

// Define mathematical constant to convert degrees to radians
const RADIAN = Math.PI / 180;

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
        >
            {/* Print evaluated percentage values */}
            {`${(percent * 100).toFixed(1)}%`}
        </text>
    );
};

// Declare Analytics React component
const Analytics: React.FC = () => {
    // Destructure budget values from budget context
    const { income, totalExpenses, categories, currentMonth, currentYear } = useBudget();
    // Destructure currency formatter from localization context
    const { formatCurrency } = useLocalization();
    // Declare state for hovering pie chart slice index
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    // Declare state for collapsible section toggle (collapsed/hidden by default)
    const [isCollapsed, setIsCollapsed] = useState(true);

    // Filter categories with non-zero spending
    const data = categories.map(cat => ({
        // Category name
        name: cat.name,
        // Category total spending value
        value: cat.expenses.reduce((sum, exp) => sum + exp.amount, 0),
        // Category accent color
        color: cat.color,
        // Category budget target
        budget: cat.budget
    })).filter(item => item.value > 0);

    // Calculate total spending value
    const totalValue = data.reduce((sum, item) => sum + item.value, 0);

    // Return null if no spending data exists to display
    if (data.length === 0 && categories.length === 0) {
        // Return null
        return null;
    }

    // Format percentage helper function
    const formatPercentage = (val: number) => {
        // Return calculated percentage string
        return totalValue > 0 ? `${((val / totalValue) * 100).toFixed(1)}%` : '0%';
    };

    // Calculate savings rate percentage
    const savingsRate = income > 0 ? ((income - totalExpenses) / income) * 100 : 0;
    // Calculate total days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Calculate average daily spending
    const dailyAverage = totalExpenses / daysInMonth;
    // Calculate total category budget sum
    const totalBudget = categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);
    // Calculate budget utilization rate
    const budgetUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

    // Find top spending category
    const topCategory = [...data].sort((a, b) => b.value - a.value)[0];

    // Find largest single transaction expense
    const allExpenses = categories.flatMap(c => c.expenses);
    // Sort expenses descending by amount
    const largestExpense = [...allExpenses].sort((a, b) => b.amount - a.amount)[0];

    // Custom Tooltip component definition
    const CustomTooltip = ({ active, payload }: any) => {
        // Check active payload availability
        if (active && payload && payload.length) {
            // Extract item payload object
            const item = payload[0].payload;
            // Return tooltip markup container
            return (
                // Tooltip box container
                <div style={{
                    backgroundColor: 'var(--surface-dark)',
                    border: '1px solid var(--border-color)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                    {/* Tooltip category title */}
                    <div style={{ fontWeight: 'bold', color: item.color, marginBottom: '0.25rem' }}>{item.name}</div>
                    {/* Tooltip formatted spending value */}
                    <div style={{ color: 'white' }}>{formatCurrency(item.value)}</div>
                    {/* Tooltip percentage share of total spending */}
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{formatPercentage(item.value)}</div>
                </div>
            );
        }
        // Fallback null
        return null;
    };

    // Evaluate active hover slice value
    const centerValue = activeIndex !== null && data[activeIndex] ? data[activeIndex].value : totalValue;
    // Evaluate active hover slice label name
    const centerLabel = activeIndex !== null && data[activeIndex] ? data[activeIndex].name : 'Total';

    return (
        // Outer layout margin container
        <div style={{ marginBottom: '1rem' }}>
            {/* Main Box wrapper container for Monthly Analytics */}
            <Box
                // Header title element with interactive toggle handler
                title={
                    // Row container flex layout for collapsible header trigger
                    <div
                        // Click handler to toggle section visibility
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        // Styling layout properties
                        style={{
                            // Flexbox model layout
                            display: 'flex',
                            // Center items vertically
                            alignItems: 'center',
                            // Space items across edges
                            justifyContent: 'space-between',
                            // Hand pointer cursor indicator
                            cursor: 'pointer',
                            // Full container width
                            width: '100%'
                        }}
                    >
                        {/* Main section title label */}
                        <span>Monthly Analytics & Insights</span>
                        {/* Rotating arrow indicator element */}
                        <span style={{
                            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                            transition: 'transform 0.3s',
                            display: 'inline-block'
                        }}>
                            ▼
                        </span>
                    </div>
                }
            >
                {/* Render section content when not collapsed */}
                {!isCollapsed && (
                    // Column layout container
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                {/* Responsive KPI Metrics Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                }}>
                    {/* Savings Rate KPI Card */}
                    <div style={{ background: 'var(--background-dark)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {/* KPI Title */}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Savings Rate</div>
                        {/* KPI Value */}
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: savingsRate >= 20 ? '#00E676' : (savingsRate >= 0 ? 'var(--firebase-yellow)' : 'var(--firebase-red)') }}>
                            {savingsRate.toFixed(1)}%
                        </div>
                        {/* KPI Subtext */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            {savingsRate >= 20 ? 'Target achieved (≥20%)' : 'Below 20% savings target'}
                        </div>
                    </div>

                    {/* Daily Average Spend KPI Card */}
                    <div style={{ background: 'var(--background-dark)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {/* KPI Title */}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Daily Burn Rate</div>
                        {/* KPI Value */}
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'white' }}>
                            {formatCurrency(dailyAverage)}/day
                        </div>
                        {/* KPI Subtext */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Across {daysInMonth} days this month
                        </div>
                    </div>

                    {/* Budget Utilization KPI Card */}
                    <div style={{ background: 'var(--background-dark)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {/* KPI Title */}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Budget Utilization</div>
                        {/* KPI Value */}
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: budgetUtilization > 100 ? 'var(--firebase-red)' : (budgetUtilization >= 80 ? 'var(--firebase-orange)' : '#00E676') }}>
                            {totalBudget > 0 ? `${budgetUtilization.toFixed(1)}%` : 'N/A'}
                        </div>
                        {/* KPI Subtext */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            {totalBudget > 0 ? `${formatCurrency(totalExpenses)} of ${formatCurrency(totalBudget)}` : 'No category budgets set'}
                        </div>
                    </div>

                    {/* Top Expense KPI Card */}
                    <div style={{ background: 'var(--background-dark)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {/* KPI Title */}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Top Category & Max Expense</div>
                        {/* KPI Value */}
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {topCategory ? topCategory.name : 'None'}
                        </div>
                        {/* KPI Subtext */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Max item: {largestExpense ? `${largestExpense.name} (${formatCurrency(largestExpense.amount)})` : 'None'}
                        </div>
                    </div>
                </div>

                {/* Section layout for Budget vs Actual and Donut Chart */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Category Budget vs Spent Bar Chart Comparison */}
                    <div style={{ background: 'var(--background-dark)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {/* Card Sub-title */}
                        <h4 style={{ margin: '0 0 1rem 0', color: 'white' }}>Category Budget vs Actual</h4>
                        {/* Column stack of category budget comparison bars */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {categories.map(cat => {
                                // Compute category spent total
                                const catSpent = cat.expenses.reduce((sum, e) => sum + e.amount, 0);
                                // Compute category budget limit or fallback to spent
                                const catBudget = cat.budget || 0;
                                // Calculate percentage ratio spent
                                const spentRatio = catBudget > 0 ? Math.min((catSpent / catBudget) * 100, 100) : 100;
                                // Return category comparison bar markup
                                return (
                                    // Row wrapper for category budget item
                                    <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {/* Row header details */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                            {/* Category name with accent dot */}
                                            <span style={{ color: 'white', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color }} />
                                                {cat.name}
                                            </span>
                                            {/* Category spent vs budget figure */}
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                {formatCurrency(catSpent)} {catBudget > 0 ? `/ ${formatCurrency(catBudget)}` : ''}
                                            </span>
                                        </div>
                                        {/* Category bar track background */}
                                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                            {/* Category bar fill visual */}
                                            <div style={{
                                                height: '100%',
                                                width: `${spentRatio}%`,
                                                background: catBudget > 0
                                                    ? (catSpent > catBudget ? 'var(--firebase-red)' : (catSpent / catBudget >= 0.8 ? 'var(--firebase-orange)' : '#00E676'))
                                                    : cat.color,
                                                transition: 'width 0.4s ease'
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Donut Pie Chart Expenses Breakdown */}
                    <div style={{ background: 'var(--background-dark)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {/* Card Sub-title */}
                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'white' }}>Expenses Share</h4>
                        {/* Donut Chart container */}
                        <div style={{ height: '240px', position: 'relative' }}>
                            {/* Responsive container for PieChart */}
                            <ResponsiveContainer width="100%" height="100%">
                                {/* PieChart container component */}
                                <PieChart>
                                    {/* Pie slice configuration */}
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        dataKey="value"
                                        labelLine={false}
                                        label={renderCustomizedLabel}
                                        onMouseEnter={(_, index) => setActiveIndex(index)}
                                        onMouseLeave={() => setActiveIndex(null)}
                                    >
                                        {/* Render cells for each category color */}
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    {/* Tooltip render */}
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center hover stats display */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                pointerEvents: 'none',
                                transition: 'all 0.3s ease'
                            }}>
                                {/* Label subtitle */}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {centerLabel}
                                </div>
                                {/* Value formatted string */}
                                <div className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginTop: '0.1rem' }}>
                                    {formatCurrency(centerValue)}
                                </div>
                            </div>
                        </div>

                        {/* Interactive Categories Legend Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto auto',
                            gap: '0.5rem 1rem',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            maxHeight: '140px',
                            overflowY: 'auto',
                            marginTop: '0.5rem'
                        }}>
                            {data.map((item, index) => (
                                <React.Fragment key={`legend-${index}`}>
                                    {/* Color bullet indicator */}
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color }} />
                                    </div>
                                    {/* Category name */}
                                    <div style={{ color: 'white', fontWeight: 500 }}>{item.name}</div>
                                    {/* Category total spending value */}
                                    <div style={{ textAlign: 'right' }}>{formatCurrency(item.value)}</div>
                                    {/* Category percentage share */}
                                    <div style={{ textAlign: 'right', width: '45px' }}>{formatPercentage(item.value)}</div>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
                </div>
            )}
        </Box>
        </div>
    );
};

// Export Analytics component
export default Analytics;
