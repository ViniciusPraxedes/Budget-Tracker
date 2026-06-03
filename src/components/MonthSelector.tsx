// Import React library for component building
import React from 'react';
// Import budget context consumer hook
import { useBudget } from '../context/BudgetContext';

// Declare functional component representing month navigator tool
const MonthSelector: React.FC = () => {
    // Extract current date states, monthly transitions, default settings, and clear operation from context
    const { currentMonth, currentYear, changeMonth, saveDefaultMonth, defaultMonthSettings, clearMonthData } = useBudget();
    // Manage state representing visibility status of clean data confirmation modal
    const [showConfirmClean, setShowConfirmClean] = React.useState(false);

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
                    // Inline styling overrides for transparent layout
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
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
                    // Inline styling overrides for transparent layout
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                    ›
                </button>
            </div>
            {/* Row container holding default startup preferences option and clean month operations */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
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
                    Set as startup month
                </label>
                {/* Button to clean data for active month */}
                <button
                    // Register click trigger to open confirmation modal
                    onClick={() => setShowConfirmClean(true)}
                    // Custom inline styling for button layout and red colors
                    style={{
                        // Transparent backdrop fill
                        background: 'transparent',
                        // Red transparent border edge
                        border: '1px solid rgba(244, 67, 54, 0.4)',
                        // Red text color code
                        color: '#ff5252',
                        // Inner spacing paddings
                        padding: '0.4rem 0.8rem',
                        // Rounded borders layout
                        borderRadius: '6px',
                        // Touch pointer interaction
                        cursor: 'pointer',
                        // Sized typography font
                        fontSize: '0.85rem',
                        // Transition animation settings
                        transition: 'all 0.2s'
                    }}
                >
                    {/* Clean Data button label text */}
                    Clean Data
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
        </>
    );
};

// Export MonthSelector component as the default module
export default MonthSelector;
