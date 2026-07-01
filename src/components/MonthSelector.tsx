// Import React library for component building
import React from 'react';
// Import budget context consumer hook
import { useBudget } from '../context/BudgetContext';
import { Category, PreviewCategory } from '../types';

// Define props interface for the MonthSelector component
interface MonthSelectorProps {
    // Callback to trigger statement importing modal visibility
    onImportClick: () => void;
    // Close interface definition
}

// Declare functional component representing month navigator tool with props
const MonthSelector: React.FC<MonthSelectorProps> = ({ onImportClick }) => {
    // Extract current date states, monthly transitions, default settings, and clear operation from context
    const { currentMonth, currentYear, changeMonth, saveDefaultMonth, defaultMonthSettings, clearMonthData, getRecurringFromPreviousMonth, importRecurringExpenses } = useBudget();
    // Manage state representing visibility status of clean data confirmation modal
    const [showConfirmClean, setShowConfirmClean] = React.useState(false);
    // State to hold the preview data of recurring expenses
    const [recurringPreview, setRecurringPreview] = React.useState<PreviewCategory[] | null>(null);
    // State to handle loading status during import fetch
    const [isImporting, setIsImporting] = React.useState(false);

    // Fetch recurring expenses preview and show modal
    const handleImportRecurring = async () => {
        setIsImporting(true);
        const data = await getRecurringFromPreviousMonth();
        if (data) {
            setRecurringPreview(data);
        } else {
            alert("No recurring transactions found in the previous month.");
        }
        setIsImporting(false);
    };

    const toggleWillUpdate = (categoryId: string, expenseId: string) => {
        if (!recurringPreview) return;
        setRecurringPreview(recurringPreview.map(cat => {
            if (cat.id === categoryId) {
                return {
                    ...cat,
                    expenses: cat.expenses.map(exp => exp.id === expenseId ? { ...exp, willUpdate: !exp.willUpdate } : exp)
                };
            }
            return cat;
        }));
    };

    const setAllWillUpdate = (value: boolean) => {
        if (!recurringPreview) return;
        setRecurringPreview(recurringPreview.map(cat => ({
            ...cat,
            expenses: cat.expenses.map(exp => ({ ...exp, willUpdate: value }))
        })));
    };

    // Calculate totals for the preview dialog
    const previewTotalAmount = recurringPreview ? recurringPreview.reduce((sum, cat) => sum + cat.expenses.filter(e => e.willUpdate).reduce((expSum, exp) => expSum + exp.amount, 0), 0) : 0;
    const previewTotalCount = recurringPreview ? recurringPreview.reduce((count, cat) => count + cat.expenses.filter(e => e.willUpdate).length, 0) : 0;
    const allSelected = recurringPreview ? recurringPreview.every(cat => cat.expenses.every(exp => exp.willUpdate)) : false;

    // Transition date selection to the previous month
    const handlePrev = () => {
        // If current month is January
        if (currentMonth === 0) {
            // Set date to December of previous year
            changeMonth(11, currentYear - 1);
            // Otherwise decrement month index
        } else {
            // Set date to previous month of current year
            changeMonth(currentMonth - 1, currentYear);
        }
    };

    // Transition date selection to the next month
    const handleNext = () => {
        // If current month is December
        if (currentMonth === 11) {
            // Set date to January of next year
            changeMonth(0, currentYear + 1);
            // Otherwise increment month index
        } else {
            // Set date to next month of current year
            changeMonth(currentMonth + 1, currentYear);
        }
    };

    // Resolve month name string representation from active year and month indices
    const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });

    // Render month selection and settings toolbar layout
    return (
        // Fragment root container element
        <>
            {/* Outer wrapper panel for month name navigation buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                {/* Previous month transition button */}
                <button
                    // Register prev month click trigger
                    onClick={handlePrev}
                    // Apply inline style configurations
                    style={{
                        // Remove default button background
                        background: 'transparent',
                        // Remove default button border outline
                        border: 'none',
                        // Set text color to secondary variable
                        color: 'var(--text-secondary)',
                        // Set font size to 2.25rem for larger arrows
                        fontSize: '2.25rem',
                        // Use pointer cursor type on hover
                        cursor: 'pointer',
                        // Ensure layout aligns with title text
                        lineHeight: 1
                    }}
                >
                    ‹
                </button>
                {/* Heading label printing formatted month name */}
                <h2 style={{ margin: 0, minWidth: '200px', textAlign: 'center', textTransform: 'capitalize' }}>
                    {/* Render active month and year text */}
                    {monthName} {currentYear}
                </h2>
                {/* Next month transition button */}
                <button
                    // Register next month click trigger
                    onClick={handleNext}
                    // Apply inline style configurations
                    style={{
                        // Remove default button background
                        background: 'transparent',
                        // Remove default button border outline
                        border: 'none',
                        // Set text color to secondary variable
                        color: 'var(--text-secondary)',
                        // Set font size to 2.25rem for larger arrows
                        fontSize: '2.25rem',
                        // Use pointer cursor type on hover
                        cursor: 'pointer',
                        // Ensure layout aligns with title text
                        lineHeight: 1
                    }}
                >
                    ›
                </button>
            </div>
            {/* Row container holding default startup preferences option and clean month operations */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                {/* Label wrapper for default startup selection checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}>
                    {/* Startup setting checkbox toggle */}
                    <input
                        // Checkbox input type
                        type="checkbox"
                        // Bind checked state comparing settings configurations matches
                        checked={defaultMonthSettings?.month === currentMonth && defaultMonthSettings?.year === currentYear}
                        // Change event callback trigger
                        onChange={(e) => {
                            // If checkbox has been toggled to checked
                            if (e.target.checked) {
                                // Save default startup month setting values
                                saveDefaultMonth(currentMonth, currentYear);
                            }
                        }}
                        // Accent color layout styles
                        style={{ accentColor: 'var(--firebase-yellow)' }}
                    />
                    {/* Label helper text */}
                    Current Month
                </label>
                {/* Button to import recurring transactions from the previous month */}
                <button
                    onClick={handleImportRecurring}
                    disabled={isImporting}
                    title="Import Recurring"
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(33, 150, 243, 0.4)',
                        color: '#2196F3',
                        padding: '0.6rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 1 21 5 17 9"></polyline>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                        <polyline points="7 23 3 19 7 15"></polyline>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                    </svg>
                </button>
                {/* Button to import transaction statement PDF */}
                <button
                    onClick={onImportClick}
                    title="Import Transactions"
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 196, 0, 0.4)',
                        color: '#FFC400',
                        padding: '0.6rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="12" y1="18" x2="12" y2="12"></line>
                        <polyline points="9 15 12 12 15 15"></polyline>
                    </svg>
                </button>
                {/* Button to clean data for active month */}
                <button
                    onClick={() => setShowConfirmClean(true)}
                    title="Clean Data"
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(244, 67, 54, 0.4)',
                        color: '#ff5252',
                        padding: '0.6rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            {/* Render monthly clean data confirmation modal overlay when state is active */}
            {showConfirmClean && (
                <div
                    // Dimmed backdrop click resets state and dismisses modal
                    onClick={() => setShowConfirmClean(false)}
                    // Full screen fixed overlays styling layout settings
                    style={{
                        // Fixed viewport coverage position
                        position: 'fixed',
                        // Top align coordinate
                        top: 0,
                        // Left align coordinate
                        left: 0,
                        // Full width coverage percentage
                        width: '100%',
                        // Full height coverage percentage
                        height: '100%',
                        // Black high opacity background
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        // Glass backdrop filter blur
                        backdropFilter: 'blur(10px)',
                        // Layer index sorting above standard pages
                        zIndex: 1200,
                        // Center layouts flex
                        display: 'flex',
                        // Center horizontally
                        justifyContent: 'center',
                        // Center vertically
                        alignItems: 'center'
                    }}
                >
                    {/* Inner confirmation modal container card panel */}
                    <div
                        // Intercept bubbles clicks
                        onClick={(e) => e.stopPropagation()}
                        // Premium dark card panel layout style properties
                        style={{
                            // Inner spacing paddings
                            padding: '1.5rem',
                            // Custom dark card background
                            backgroundColor: '#151515',
                            // Rounded corner edges
                            borderRadius: '16px',
                            // Fine border outline highlight
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            // High spread box shadow details
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                            // Vertical flex column display
                            display: 'flex',
                            // Flex direction to column
                            flexDirection: 'column',
                            // Spacing gap between children elements
                            gap: '1.25rem',
                            // Coordinate position reference
                            position: 'relative',
                            // Responsive width percentage
                            width: '90%',
                            // Limit max scale width bounds
                            maxWidth: '420px',
                            // Fit border box model sizing
                            boxSizing: 'border-box'
                        }}
                    >
                        {/* Title header warning label */}
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                            {/* Title text */}
                            Confirm Cleaning
                        </h3>
                        {/* Descriptive caution info paragraph text */}
                        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                            {/* Caution warning details text content */}
                            Are you sure you want to clean all data for {monthName} {currentYear}? This will delete all expenses and reset the income. This action cannot be undone.
                        </p>
                        {/* Footer actions toolbar row container */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                            {/* Cancel button to dismiss caution modal */}
                            <button
                                // Reset trigger status false to dismiss modal
                                onClick={() => setShowConfirmClean(false)}
                                // Transparent layouts borders styling
                                style={{
                                    // Spacing paddings
                                    padding: '0.5rem 1rem',
                                    // Rounded borders layout
                                    borderRadius: '6px',
                                    // Subtle border line
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    // Empty background fill
                                    background: 'transparent',
                                    // Light gray text colors
                                    color: '#ccc',
                                    // Pointer cursor
                                    cursor: 'pointer',
                                    // Semi bold font weights
                                    fontWeight: 600,
                                    // Small scale text
                                    fontSize: '0.85rem'
                                }}
                            >
                                {/* Cancel label */}
                                Cancel
                            </button>
                            {/* Action confirm button executing monthly cleanup */}
                            <button
                                // Click triggers monthly cleanup routine and closes modal
                                onClick={() => {
                                    // Invoke context clear callback function
                                    clearMonthData();
                                    // Dismiss active modal status trigger state
                                    setShowConfirmClean(false);
                                }}
                                // Solid red branding background styling
                                style={{
                                    // Inner spacing paddings
                                    padding: '0.5rem 1rem',
                                    // Rounded borders layout
                                    borderRadius: '6px',
                                    // Remove borders
                                    border: 'none',
                                    // Red brand button color
                                    background: 'var(--firebase-red)',
                                    // White contrast text
                                    color: 'white',
                                    // Pointer cursor
                                    cursor: 'pointer',
                                    // Semi bold font weights
                                    fontWeight: 600,
                                    // Small scale text
                                    fontSize: '0.85rem'
                                }}
                            >
                                {/* Clean confirm button label */}
                                Clean
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Render confirmation modal for importing recurring expenses */}
            {recurringPreview && (
                <div
                    onClick={() => setRecurringPreview(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 1200,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            padding: '1.5rem',
                            backgroundColor: '#151515',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem',
                            position: 'relative',
                            width: '90%',
                            maxWidth: '420px',
                            maxHeight: '80vh',
                            boxSizing: 'border-box'
                        }}
                    >
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                            Import Recurring
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                            You are about to import <strong>{previewTotalCount}</strong> transactions totaling <strong>{previewTotalAmount} kr</strong>.
                        </p>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '-0.5rem' }}>
                            <button
                                onClick={() => setAllWillUpdate(!allSelected)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', background: 'transparent', border: `1px solid ${allSelected ? 'rgba(255,255,255,0.2)' : 'rgba(76, 175, 80, 0.5)'}`, color: allSelected ? '#ccc' : '#4CAF50', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        {/* Scrollable list of transactions */}
                        <div style={{ overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {recurringPreview.map((cat) => (
                                <div key={cat.id}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: cat.color || '#fff' }}>{cat.name}</h4>
                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#ccc' }}>
                                        {cat.expenses.map((exp) => (
                                            <li key={exp.id} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                                <span style={{ textDecoration: !exp.willUpdate ? 'line-through' : 'none', opacity: !exp.willUpdate ? 0.5 : 1 }}>
                                                    {exp.name} - {exp.amount} kr
                                                </span>
                                                <label style={{ fontSize: '0.75rem', color: exp.alreadyExists ? '#ffb300' : '#4CAF50', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={exp.willUpdate}
                                                        onChange={() => toggleWillUpdate(cat.id, exp.id)}
                                                        style={{ accentColor: exp.alreadyExists ? '#ffb300' : '#4CAF50' }}
                                                    />
                                                    {exp.alreadyExists ? 'Update existing' : 'Import'}
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button
                                onClick={() => setRecurringPreview(null)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    background: 'transparent',
                                    color: '#ccc',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await importRecurringExpenses(recurringPreview);
                                    setRecurringPreview(null);
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#2196F3',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem'
                                }}
                            >
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// Export MonthSelector component as the default module
export default MonthSelector;
