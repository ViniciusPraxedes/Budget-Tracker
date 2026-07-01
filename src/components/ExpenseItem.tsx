import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Expense } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { useBudget } from '../context/BudgetContext';

interface ExpenseItemProps {
    categoryId: string;
    expense: Expense;
    onUpdate: (expense: Expense) => void;
    onDelete: (id: string) => void;
    onMove?: (expense: Expense, oldCategoryId: string, newCategoryId: string) => void;
}

const ExpenseItem: React.FC<ExpenseItemProps> = ({ categoryId, expense, onUpdate, onDelete, onMove }) => {
    const { categories } = useBudget();
    // Manage the active editing state flag of the item
    const [isEditing, setIsEditing] = useState(false);
    // Match the transaction count pattern at the end of the name string
    const match = expense.name.match(/\s\((\d+)\stransactions?\)$/);
    // Extract the name without the transaction count suffix
    const cleanName = match ? expense.name.replace(match[0], '') : expense.name;
    // Parse the transaction count integer value
    const transactionCount = match ? parseInt(match[1], 10) : null;
    // Initialize the edited name state with the clean name
    const [editedName, setEditedName] = useState(cleanName);
    const [editedAmount, setEditedAmount] = useState(expense.amount.toString());
    const [editedDay, setEditedDay] = useState(expense.paymentDay.toString());
    const [editedRecurring, setEditedRecurring] = useState(!!expense.isRecurring);
    const [editedCategoryId, setEditedCategoryId] = useState(categoryId);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Define the save handler function for the expense item
    const handleSave = () => {
        // Check if the transaction count is not null to format the final name string
        const finalName = transactionCount !== null 
            // Append the transaction count suffix to the edited name
            ? `${editedName} (${transactionCount} transaction${transactionCount === 1 ? '' : 's'})` 
            // Otherwise use the edited name as is
            : editedName;

        // Check if category was changed and move handler is provided
        if (editedCategoryId && editedCategoryId !== categoryId && onMove) {
            // Trigger the move handler with the updated expense and category IDs
            onMove(
                // Provide the updated expense object
                {
                    // Spread the existing expense properties
                    ...expense,
                    // Assign the final constructed name string
                    name: finalName,
                    // Parse the edited amount string to a float or fallback to zero
                    amount: parseFloat(editedAmount) || 0,
                    // Parse the edited payment day string to an integer or fallback to one
                    paymentDay: parseInt(editedDay) || 1,
                    // Assign the edited recurring boolean flag
                    isRecurring: editedRecurring,
                // Close the expense object
                },
                // Provide the original category ID
                categoryId,
                // Provide the new edited category ID
                editedCategoryId
            // Close the move handler arguments
            );
        // Handle the case where the category was not changed
        } else {
            // Trigger the update handler with the updated expense
            onUpdate(
                // Provide the updated expense object
                {
                    // Spread the existing expense properties
                    ...expense,
                    // Assign the final constructed name string
                    name: finalName,
                    // Parse the edited amount string to a float or fallback to zero
                    amount: parseFloat(editedAmount) || 0,
                    // Parse the edited payment day string to an integer or fallback to one
                    paymentDay: parseInt(editedDay) || 1,
                    // Assign the edited recurring boolean flag
                    isRecurring: editedRecurring,
                // Close the expense object
                }
            // Close the update handler arguments
            );
        // Close the else block
        }
        // Deactivate the editing state flag
        setIsEditing(false);
    // Close the save handler function
    };

    const { formatCurrency } = useLocalization();

    if (isEditing) {
        return (
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                alignItems: 'center',
                border: '1px solid var(--firebase-yellow)'
            }}>
                <input
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    placeholder="Name"
                    style={{
                        flex: '2 1 150px',
                        background: 'var(--background-dark)',
                        border: '1px solid var(--border-color)',
                        color: 'white',
                        padding: '0.5rem',
                        borderRadius: '4px'
                    }}
                />
                <input
                    type="number"
                    value={editedAmount}
                    onChange={e => setEditedAmount(e.target.value)}
                    placeholder="Amount"
                    style={{
                        flex: '1 1 80px',
                        background: 'var(--background-dark)',
                        border: '1px solid var(--border-color)',
                        color: 'white',
                        padding: '0.5rem',
                        borderRadius: '4px'
                    }}
                />
                <input
                    type="number"
                    min="1" max="31"
                    value={editedDay}
                    onChange={e => setEditedDay(e.target.value)}
                    placeholder="Day"
                    style={{
                        flex: '0 1 60px',
                        background: 'var(--background-dark)',
                        border: '1px solid var(--border-color)',
                        color: 'white',
                        padding: '0.5rem',
                        borderRadius: '4px'
                    }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', flex: '1 1 auto' }}>
                    <input 
                        type="checkbox" 
                        checked={editedRecurring} 
                        onChange={e => setEditedRecurring(e.target.checked)} 
                    />
                    Recurring
                </label>
                <select
                    value={editedCategoryId}
                    onChange={e => setEditedCategoryId(e.target.value)}
                    style={{
                        flex: '1 1 120px',
                        background: 'var(--background-dark)',
                        border: '1px solid var(--border-color)',
                        color: 'white',
                        padding: '0.5rem',
                        borderRadius: '4px'
                    }}
                >
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: '0.5rem', flex: '0 0 auto' }}>
                    <button onClick={handleSave} style={{ background: 'var(--firebase-yellow)', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 'bold', color: 'black' }}>✓</button>
                    <button onClick={() => setIsEditing(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'white' }}>✕</button>
                </div>
            </div>
        );
    }

    // Renders the transaction item container with negative margins and alignment style rules
    return (
        <div
            // Apply flex, margin overrides, border, and transition styling rules
            style={{
                // Flexbox display layout model
                display: 'flex',
                // Space items out to opposite horizontal edges
                justifyContent: 'space-between',
                // Align items vertically centered
                alignItems: 'center',
                // Responsive padding on top/bottom and left side to keep text visible, while right side remains zero to push icons right
                padding: '0.75rem 0 0.75rem 0.75rem',
                // Shift left edge closer to the card border
                marginLeft: '-0.75rem',
                // Shift right edge closer to the card border
                marginRight: '-0.75rem',
                // Bottom divider separation line
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                // Transition background highlight effects
                transition: 'background 0.2s',
            }}
            // Highlight background on hover enter event
            onMouseEnter={(e) => {
                // Set semi-transparent white background color highlight
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            }}
            // Clear background highlight on hover leave event
            onMouseLeave={(e) => {
                // Reset background color to transparent surface
                e.currentTarget.style.background = 'transparent';
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Outer span container for clipping long expense name text */}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {/* Render the cleaned expense name without the count suffix */}
                        {cleanName}
                    {/* Close name wrapper span */}
                    </span>
                    {expense.isRecurring && (
                        <span title="Recurring Expense" style={{ fontSize: '0.8rem', opacity: 0.8, flexShrink: 0 }}>🔁</span>
                    )}
                </span>
                {/* Render the details span container for day and count */}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {/* Render the payment day label */}
                    Day {expense.paymentDay}
                    {/* Check if transaction count metadata is present and the expense is not recurring */}
                    {transactionCount !== null && !expense.isRecurring && (
                        // Render separator and transaction count detail string
                        ` • ${transactionCount} ${transactionCount === 1 ? 'transaction' : 'transactions'}`
                    // End of transaction count condition
                    )}
                {/* Close details span container */}
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(expense.amount)}</span>
                {/* Action buttons wrapper container */}
                <div
                    // Align button elements using row layout
                    style={{
                        // Set flexbox display model formatting
                        display: 'flex',
                        // Assign spacing gap between buttons
                        gap: '0.5rem',
                    }}
                >
                    {/* Edit expense trigger button */}
                    <button
                        // Activate editing state true on click tap
                        onClick={() => {
                            // Set isEditing flag status active
                            setIsEditing(true);
                        }}
                        // Define button style overrides
                        style={{
                            // Transparent surface background
                            background: 'transparent',
                            // Remove default boundaries
                            border: 'none',
                            // Enforce touch target accessibility minimum width
                            minWidth: '44px',
                            // Enforce touch target accessibility minimum height
                            minHeight: '44px',
                            // Set flexbox display to center icon content
                            display: 'flex',
                            // Center horizontal content layout
                            justifyContent: 'center',
                            // Center vertical content layout
                            alignItems: 'center',
                            // Define hand pointer style cursor indicator
                            cursor: 'pointer',
                            // Secondary gray text styling rule
                            color: 'var(--text-secondary)',
                            // Set large readable font size
                            fontSize: '1rem',
                        }}
                        // Screenreader tooltip title text
                        title="Edit"
                    >
                        {/* Pencil glyph edit icon character */}
                        ✎
                    {/* Close edit button component */}
                    </button>
                    {/* Delete warning confirmation trigger button */}
                    <button
                        // Activate delete confirm overlay display on click tap
                        onClick={() => {
                            // Set delete confirm visibility flag active
                            setShowDeleteConfirm(true);
                        }}
                        // Define button style overrides
                        style={{
                            // Transparent surface background
                            background: 'transparent',
                            // Remove default boundaries
                            border: 'none',
                            // Enforce touch target accessibility minimum width
                            minWidth: '44px',
                            // Enforce touch target accessibility minimum height
                            minHeight: '44px',
                            // Set flexbox display to center icon content
                            display: 'flex',
                            // Center horizontal content layout
                            justifyContent: 'center',
                            // Center vertical content layout
                            alignItems: 'center',
                            // Define hand pointer style cursor indicator
                            cursor: 'pointer',
                            // Warning red color styling rule
                            color: 'var(--firebase-red)',
                            // Set large readable font size
                            fontSize: '1rem',
                        }}
                        // Screenreader tooltip title text
                        title="Delete"
                    >
                        {/* Trash bin glyph delete icon character */}
                        🗑
                    {/* Close delete button component */}
                    </button>
                {/* Close actions button wrapper group */}
                </div>
            </div>

            {/* Conditional portal rendering for delete expense warning confirm overlay */}
            {showDeleteConfirm && typeof document !== 'undefined' && createPortal(
                // Overlay background container for backdrop screen blur
                <div className="confirm-overlay">
                    {/* Inner modal box container component */}
                    <div
                        // Apply confirmation modal styling class name
                        className="confirm-modal"
                        // Add padding spacing directly
                        style={{ padding: '1.5rem' }}
                    >
                        {/* Modal heading dialog warning title */}
                        <h3
                            // Remove default title margins and enforce white color contrast
                            style={{ marginTop: 0, color: 'white' }}
                        >
                            {/* Title text warning string */}
                            Delete Expense?
                        {/* Close title element */}
                        </h3>
                        {/* Paragraph description body text detail */}
                        <p
                            // Set secondary gray text color and custom margin spacing bottom
                            style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}
                        >
                            {/* Confirmation warning text prefix details */}
                            Are you sure you want to delete{" "}
                            {/* Render bold name text parameter highlight */}
                            <strong>{cleanName}</strong>
                            {/* Confirmation warning text suffix details */}
                            ?
                        {/* Close paragraph description text element */}
                        </p>
                        {/* Button control actions wrapper footer row */}
                        <div
                            // Set layout flex and gap alignment styles
                            style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}
                        >
                            {/* Confirm abort cancel operation action button */}
                            <button
                                // Reset visibility status true or false flag on tap click
                                onClick={() => {
                                    // Deactivate deletion confirmation overlay visibility flag status
                                    setShowDeleteConfirm(false);
                                }}
                                // Button style configurations
                                style={{
                                    // Set transparent surface background
                                    background: 'transparent',
                                    // Set standard border color boundary line
                                    border: '1px solid var(--border-color)',
                                    // Set white color contrast
                                    color: 'white',
                                    // Add responsive padding spacing
                                    padding: '0.5rem 1rem',
                                    // Add rounded border corners
                                    borderRadius: '4px',
                                    // Define hand cursor interactive selector
                                    cursor: 'pointer',
                                }}
                            >
                                {/* Cancel button label text */}
                                Cancel
                            {/* Close cancel button component */}
                            </button>
                            {/* Confirm finalize delete expense button action button */}
                            <button
                                // Finalize expense deletion on click tap
                                onClick={() => {
                                    // Execute deletion callback trigger
                                    onDelete(expense.id);
                                    // Deactivate deletion confirmation overlay visibility flag status
                                    setShowDeleteConfirm(false);
                                }}
                                // Warning button style configurations
                                style={{
                                    // Set alert red brand color background
                                    background: 'var(--firebase-red)',
                                    // Remove default outlines
                                    border: 'none',
                                    // Set white color contrast
                                    color: 'white',
                                    // Add responsive padding spacing
                                    padding: '0.5rem 1rem',
                                    // Add rounded border corners
                                    borderRadius: '4px',
                                    // Define hand cursor interactive selector
                                    cursor: 'pointer',
                                    // Enforce bold font weight highlight styling
                                    fontWeight: 'bold',
                                }}
                            >
                                {/* Finalize delete warning confirm label text */}
                                Delete
                            {/* Close delete button component */}
                            </button>
                        {/* Close button control actions footer row wrapper element */}
                        </div>
                    {/* Close modal box container component */}
                    </div>
                {/* Close overlay backdrop background container */}
                </div>,
                // Direct portal render target to document body
                document.body
            // Close portal method parameters
            )}
        </div>
    );
};

export default ExpenseItem;
