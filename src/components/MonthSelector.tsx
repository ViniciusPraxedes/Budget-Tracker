// Import React library for component building
import React from 'react';
import { createPortal } from 'react-dom';
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
    const { currentMonth, currentYear, changeMonth, saveDefaultMonth, defaultMonthSettings, clearMonthData, getRecurringFromPreviousMonth, importRecurringExpenses, paydayStartDay, paydayEndDay, setPaydayStartDay, setPaydayCycleDays } = useBudget();
    // Manage state representing visibility status of clean data confirmation modal
    const [showConfirmClean, setShowConfirmClean] = React.useState(false);
    // State to hold the preview data of recurring expenses
    const [recurringPreview, setRecurringPreview] = React.useState<PreviewCategory[] | null>(null);
    // State to handle loading status during import fetch
    const [isImporting, setIsImporting] = React.useState(false);
    // State to toggle in-app notice modal when no recurring expenses exist
    const [showNoRecurringNotice, setShowNoRecurringNotice] = React.useState(false);
    // State to toggle Budget Cycle configuration modal visibility
    const [showPaydayModal, setShowPaydayModal] = React.useState(false);
    // Helper to format YYYY-MM-DD date strings
    const formatYMD = (year: number, month: number, day: number) => {
        const m = (month + 1).toString().padStart(2, '0');
        const d = Math.min(Math.max(day, 1), 31).toString().padStart(2, '0');
        return `${year}-${m}-${d}`;
    };
    // Helper to format ISO YYYY-MM-DD string into European DD/MM/YYYY
    const toEuroDate = (ymdStr: string) => {
        if (!ymdStr) return '';
        const parts = ymdStr.split('-');
        if (parts.length !== 3) return ymdStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };
    // State for temporary start and end dates inside datepicker modal
    const [tempStartDate, setTempStartDate] = React.useState('');
    const [tempEndDate, setTempEndDate] = React.useState('');
    // Refs for hidden datepicker elements
    const startDatePickerRef = React.useRef<HTMLInputElement>(null);
    const endDatePickerRef = React.useRef<HTMLInputElement>(null);

    // Fetch recurring expenses preview and show modal
    const handleImportRecurring = async () => {
        // Set loading state true
        setIsImporting(true);
        // Query recurring expenses from previous active month
        const data = await getRecurringFromPreviousMonth();
        // Check if data exists and contains categories
        if (data && data.length > 0) {
            // Update preview state data
            setRecurringPreview(data);
        } else {
            // Show in-app notice modal
            setShowNoRecurringNotice(true);
        }
        // Reset loading state false
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
    // Calculate active end day of Budget Cycle
    const activeEndDay = paydayEndDay ?? (paydayStartDay === 1 ? new Date(currentYear, currentMonth + 1, 0).getDate() : paydayStartDay - 1);
    // Resolve start date of Budget Cycle
    const prevMonthDate = new Date(currentYear, paydayStartDay === 1 ? currentMonth : currentMonth - 1, paydayStartDay);
    // Resolve end date of Budget Cycle
    const endCycleDate = new Date(currentYear, currentMonth, activeEndDay);
    // Format start month short name
    const startMonthName = prevMonthDate.toLocaleString('default', { month: 'short' });
    // Format end month short name
    const endMonthName = endCycleDate.toLocaleString('default', { month: 'short' });
    // Salary period string representation
    const paydayPeriodStr = `${paydayStartDay} ${startMonthName} – ${activeEndDay} ${endMonthName}`;

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
                {/* Heading label printing formatted month name and Budget Cycle */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, minWidth: '200px', textAlign: 'center', textTransform: 'capitalize' }}>
                        {/* Render active month and year text */}
                        {monthName} {currentYear}
                    </h2>
                    {/* Budget Cycle subtitle row with edit pencil icon button trigger */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {paydayPeriodStr}
                        </span>
                        {/* Edit pencil button to open Budget Cycle modal */}
                        <button
                            onClick={() => {
                                const pStart = paydayStartDay || 25;
                                const pEnd = paydayEndDay || 24;
                                const startM = pStart === 1 ? currentMonth : (currentMonth === 0 ? 11 : currentMonth - 1);
                                const startY = pStart === 1 ? currentYear : (currentMonth === 0 ? currentYear - 1 : currentYear);
                                setTempStartDate(formatYMD(startY, startM, pStart));
                                setTempEndDate(formatYMD(currentYear, currentMonth, pEnd));
                                setShowPaydayModal(true);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'inline-flex',
                                alignItems: 'center'
                            }}
                            title="Configure Budget Cycle"
                        >
                            {/* Pencil edit icon SVG */}
                            <svg style={{ width: '12px', height: '12px' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
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

            {/* Render in-app notice modal when no recurring transactions are found */}
            {showNoRecurringNotice && (
                // Modal backdrop overlay container
                <div
                    // Click backdrop to dismiss notice
                    onClick={() => setShowNoRecurringNotice(false)}
                    // Styling for full screen modal backdrop overlay
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 1200,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    {/* Inner modal card layout */}
                    <div
                        // Prevent click propagation
                        onClick={(e) => e.stopPropagation()}
                        // Modal styling
                        style={{
                            padding: '1.5rem',
                            backgroundColor: '#1E1E1E',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            position: 'relative',
                            width: '90%',
                            maxWidth: '360px',
                            boxSizing: 'border-box'
                        }}
                    >
                        {/* Title header */}
                        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                            No Recurring Expenses Found
                        </h3>
                        {/* Notice message body */}
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                            No recurring transactions were found in the previous month. Mark expenses as recurring in previous months to copy them over.
                        </p>
                        {/* Dismiss button container */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            {/* Action dismiss button */}
                            <button
                                onClick={() => setShowNoRecurringNotice(false)}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'var(--firebase-yellow)',
                                    color: 'black',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Render Budget Cycle Configuration Modal Dialog */}
            {showPaydayModal && typeof document !== 'undefined' && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '1rem'
                    }}
                    onClick={() => setShowPaydayModal(false)}
                >
                    <div
                        style={{
                            background: 'var(--background-card, #1e1e1e)',
                            border: '1px solid var(--border-color, #333)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            maxWidth: '400px',
                            width: '100%',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Configure Budget Cycle</h3>
                            <button
                                onClick={() => setShowPaydayModal(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                            Select the calendar start and end date range for your monthly salary budget cycle.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                            {/* Cycle Start Date Field */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                    Cycle Start Date
                                </label>
                                <div
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        background: 'var(--background-dark, #121212)',
                                        border: '1px solid var(--border-color, #333)',
                                        borderRadius: '6px',
                                        padding: '0.6rem 0.8rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {/* European Formatted Date Display Input */}
                                    <input
                                        type="text"
                                        readOnly
                                        value={toEuroDate(tempStartDate)}
                                        placeholder="DD/MM/YYYY"
                                        style={{
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '0.95rem',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontWeight: 500
                                        }}
                                    />
                                    {/* Calendar Icon SVG */}
                                    <svg style={{ width: '18px', height: '18px', color: 'var(--text-secondary)', flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    {/* Hidden DatePicker Overlay */}
                                    <input
                                        type="date"
                                        ref={startDatePickerRef}
                                        value={tempStartDate}
                                        onChange={(e) => setTempStartDate(e.target.value)}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            opacity: 0,
                                            cursor: 'pointer'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Cycle End Date Field */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                    Cycle End Date
                                </label>
                                <div
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        background: 'var(--background-dark, #121212)',
                                        border: '1px solid var(--border-color, #333)',
                                        borderRadius: '6px',
                                        padding: '0.6rem 0.8rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {/* European Formatted Date Display Input */}
                                    <input
                                        type="text"
                                        readOnly
                                        value={toEuroDate(tempEndDate)}
                                        placeholder="DD/MM/YYYY"
                                        style={{
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '0.95rem',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontWeight: 500
                                        }}
                                    />
                                    {/* Calendar Icon SVG */}
                                    <svg style={{ width: '18px', height: '18px', color: 'var(--text-secondary)', flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    {/* Hidden DatePicker Overlay */}
                                    <input
                                        type="date"
                                        ref={endDatePickerRef}
                                        value={tempEndDate}
                                        onChange={(e) => setTempEndDate(e.target.value)}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            opacity: 0,
                                            cursor: 'pointer'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowPaydayModal(false)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'transparent',
                                    border: '1px solid var(--border-color, #444)',
                                    color: 'white',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (tempStartDate && tempEndDate) {
                                        const startDt = new Date(tempStartDate + 'T00:00:00');
                                        const endDt = new Date(tempEndDate + 'T00:00:00');
                                        if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
                                            setPaydayCycleDays(startDt.getDate(), endDt.getDate());
                                        }
                                    }
                                    setShowPaydayModal(false);
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'var(--firebase-yellow, #FFCA28)',
                                    border: 'none',
                                    color: 'black',
                                    fontWeight: 'bold',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Save Cycle
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

// Export MonthSelector component as the default module
export default MonthSelector;
