import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Category, Expense } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { useBudget } from '../context/BudgetContext';
import Box from './Box';
import ExpenseItem from './ExpenseItem';
import { PREDEFINED_COLORS } from '../constants';

import { getUsedColors, getAvailableColors, getUnusedColor } from '../utils/colors';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CategoryBoxProps {
    category: Category;
    isExpanded: boolean;
    onToggle: () => void;
}

const CategoryBox: React.FC<CategoryBoxProps> = ({ category, isExpanded, onToggle }) => {
    const { categories, updateCategory, deleteCategory, addExpense, updateExpense, deleteExpense, moveCategory, totalExpenses, moveExpense } = useBudget();
    const [isEditing, setIsEditing] = useState(false);
    // Declare state for category name editing
    const [editedName, setEditedName] = useState(category.name);
    // Declare state for category accent color editing
    const [editedColor, setEditedColor] = useState(category.color);
    // Declare state for category monthly budget limit editing
    const [editedBudget, setEditedBudget] = useState(category.budget !== undefined ? category.budget.toString() : '');
    // Declare state for delete confirmation dialog toggle
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: category.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.9 : 1,
        zIndex: isDragging ? 99 : 1,
        boxShadow: isDragging ? '0 16px 32px rgba(0,0,0,0.6)' : 'none',
        scale: isDragging ? 1.02 : 1,
        rotate: isDragging ? '1deg' : '0deg',
        position: 'relative',
        borderRadius: '12px'
    };

    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [newExpenseName, setNewExpenseName] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseDay, setNewExpenseDay] = useState('');
    const [newExpenseRecurring, setNewExpenseRecurring] = useState(false);

    const subtotal = category.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const percentage = totalExpenses > 0 ? (subtotal / totalExpenses) * 100 : 0;

    // Save updated category details handler
    const handleCategorySave = () => {
        // Parse float value from editedBudget or leave undefined if empty
        const parsedBudget = editedBudget !== '' ? parseFloat(editedBudget) : undefined;
        // Invoke updateCategory context method with budget parameter
        updateCategory(category.id, editedName, editedColor, parsedBudget);
        // Disable inline category editing mode
        setIsEditing(false);
    };

    const handleAddExpense = () => {
        if (newExpenseName && newExpenseAmount) {
            addExpense(category.id, {
                name: newExpenseName,
                amount: parseFloat(newExpenseAmount) || 0,
                paymentDay: parseInt(newExpenseDay) || 1,
                isRecurring: newExpenseRecurring,
            });
            setNewExpenseName('');
            setNewExpenseAmount('');
            setNewExpenseDay('');
            setNewExpenseRecurring(false);
            setIsAddingExpense(false);
        }
    };

    const { formatCurrency } = useLocalization();

    return (
        <div ref={setNodeRef} style={style}>
            <Box style={{ borderTop: `4px solid ${category.color}`, position: 'relative' }}>
                {/* Header row flex container wrapper with negative horizontal margins for edge alignment */}
                <div
                    // Apply display flex, margins, spacing, and alignment style rules
                    style={{
                        // Flexbox layout display model
                        display: 'flex',
                        // Space items out to opposite edges
                        justifyContent: 'space-between',
                        // Center elements vertically
                        alignItems: 'center',
                        // Add margin bottom separator
                        marginBottom: '1rem',
                        // Shift left edge closer to the card border
                        marginLeft: '-0.75rem',
                        // Shift right edge closer to the card border
                        marginRight: '-0.75rem',
                    }}
                >
                    {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    placeholder="Category Name"
                                    value={editedName}
                                    onChange={e => setEditedName(e.target.value)}
                                    style={{ background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem', borderRadius: '4px', flex: 1 }}
                                />
                                <input
                                    type="number"
                                    placeholder="Budget Limit"
                                    value={editedBudget}
                                    onChange={e => setEditedBudget(e.target.value)}
                                    style={{ background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '110px' }}
                                />
                                <button onClick={handleCategorySave} style={{ background: 'var(--firebase-yellow)', border: 'none', borderRadius: '4px', padding: '0.5rem 0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>✓</button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Color:</span>
                                <button
                                    onClick={() => {
                                        const otherCategories = categories.filter(c => c.id !== category.id);
                                        const usedColors = getUsedColors(otherCategories);
                                        setEditedColor(getUnusedColor(usedColors));
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-secondary)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem'
                                    }}
                                >
                                    ✨ Auto
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {getAvailableColors(getUsedColors(categories.filter(c => c.id !== category.id))).map(color => (
                                    <div
                                        key={color}
                                        onClick={() => setEditedColor(color)}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: color,
                                            cursor: 'pointer',
                                            border: editedColor === color ? '2px solid white' : '2px solid transparent',
                                            boxShadow: editedColor === color ? '0 0 0 2px var(--background-dark)' : 'none',
                                        }}
                                    />
                                ))}
                                <div style={{ position: 'relative', width: '24px', height: '24px' }}>
                                    <input
                                        type="color"
                                        value={editedColor}
                                        onChange={e => setEditedColor(e.target.value)}
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
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                                        border: !PREDEFINED_COLORS.includes(editedColor) ? '2px solid white' : '2px solid transparent',
                                        boxShadow: !PREDEFINED_COLORS.includes(editedColor) ? '0 0 0 2px var(--background-dark)' : 'none',
                                    }} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                             {/* Category title details and drag handle container wrapper */}
                             <div
                                 // Apply flex display layout settings
                                 style={{
                                     // Flexbox display layout model
                                     display: 'flex',
                                     // Center elements vertically
                                     alignItems: 'center',
                                     // Add spacing gap between elements
                                     gap: '0.5rem',
                                     // Allow flex container to grow dynamically
                                     flex: 1,
                                     // Reset min width threshold bounds
                                     minWidth: 0,
                                     // Add spacing margin right to separate actions
                                     marginRight: '0.5rem',
                                 }}
                             >
                                 {/* Grab handle item container for re-ordering drag animations */}
                                 <div
                                     // Spread dnd-kit sortable attributes hook parameters
                                     {...attributes}
                                     // Spread dnd-kit sortable listeners hook parameters
                                     {...listeners}
                                     // Apply style attributes
                                     style={{
                                         // Set grab style cursor indicator on hover
                                         cursor: 'grab',
                                         // Secondary text color rule
                                         color: 'var(--text-secondary)',
                                         // Flex layout display mode
                                         display: 'flex',
                                         // Align elements vertically center
                                         alignItems: 'center',
                                         // Compact inner padding layout to shift icon left
                                         padding: '0.5rem 0.25rem',
                                         // Font size settings
                                         fontSize: '1.2rem',
                                         // Prevent text block highlights during dragging
                                         userSelect: 'none',
                                         // Turn off browser default gesture touches
                                         touchAction: 'none',
                                         // Prevent elements from shrinking
                                         flexShrink: 0,
                                     }}
                                 >
                                     {/* Unicode draggable grab handle triple line character icon */}
                                     ≡
                                 {/* Close grab handle container */}
                                 </div>
                                 {/* Category name header title text component */}
                                 <h3
                                     // Apply custom category color and style settings
                                     style={{
                                         // Remove default header margins
                                         margin: 0,
                                         // Mapped color code property
                                         color: category.color,
                                         // Title font sizing style rule
                                         fontSize: '1.2rem',
                                         // Enable word breaks for long texts
                                         wordBreak: 'break-word',
                                         // Avoid text clipping margins
                                         overflow: 'hidden',
                                     }}
                                 >
                                     {/* Print category label string value */}
                                     {category.name}
                                 {/* Close header component */}
                                 </h3>
                             {/* Close category title details wrapper */}
                             </div>
                            {/* Actions wrapper group container */}
                            <div
                                // Apply interactive row layout align rules
                                style={{
                                    // Set flexbox display model formatting
                                    display: 'flex',
                                    // Assign gap spacing between buttons
                                    gap: '0.5rem',
                                    // Align standard items vertically center
                                    alignItems: 'center',
                                }}
                            >
                                {/* Category accordion section expansion toggle button */}
                                <button
                                    // Register click toggle handler for accordion expansion
                                    onClick={onToggle}
                                    // Styling configuration settings
                                    style={{
                                        // Transparent surface background
                                        background: 'transparent',
                                        // Remove element border lines
                                        border: 'none',
                                        // Hand pointer style cursor indicator
                                        cursor: 'pointer',
                                        // Secondary gray color style rule
                                        color: 'var(--text-secondary)',
                                        // Large readable font sizing
                                        fontSize: '1.2rem',
                                        // Enforce touch target accessibility minimum width
                                        minWidth: '44px',
                                        // Enforce touch target accessibility minimum height
                                        minHeight: '44px',
                                        // Set flexbox display to align inside arrow icon
                                        display: 'flex',
                                        // Center horizontal axis contents
                                        justifyContent: 'center',
                                        // Center vertical axis contents
                                        alignItems: 'center',
                                    }}
                                >
                                    {/* Select arrow pointer display indicator based on expanded state */}
                                    {isExpanded ? '▲' : '▼'}
                                </button>
                                {/* Category edit toggle button */}
                                <button
                                    // Trigger editing panel activation on click tap
                                    onClick={() => {
                                        // Activate edit flag status
                                        setIsEditing(true);
                                    }}
                                    // Styling configuration settings
                                    style={{
                                        // Transparent surface background
                                        background: 'transparent',
                                        // Remove element border lines
                                        border: 'none',
                                        // Hand pointer style cursor indicator
                                        cursor: 'pointer',
                                        // Secondary gray color style rule
                                        color: 'var(--text-secondary)',
                                        // Set larger font size for edit glyph visibility
                                        fontSize: '1.4rem',
                                        // Enforce touch target accessibility minimum width
                                        minWidth: '44px',
                                        // Enforce touch target accessibility minimum height
                                        minHeight: '44px',
                                        // Set flexbox display to align edit icon
                                        display: 'flex',
                                        // Center horizontal axis contents
                                        justifyContent: 'center',
                                        // Center vertical axis contents
                                        alignItems: 'center',
                                    }}
                                >
                                    {/* Pencil glyph edit icon character */}
                                    ✎
                                </button>
                                {/* Category deletion warning confirmation trigger button */}
                                <button
                                    // Trigger deletion confirm overlay visibility true on click tap
                                    onClick={() => {
                                        // Set delete confirm visibility flag active
                                        setShowDeleteConfirm(true);
                                    }}
                                    // Styling configuration settings
                                    style={{
                                        // Transparent surface background
                                        background: 'transparent',
                                        // Remove element border lines
                                        border: 'none',
                                        // Hand pointer style cursor indicator
                                        cursor: 'pointer',
                                        // Warning red color style rule
                                        color: 'var(--firebase-red)',
                                        // Set larger font size for delete glyph visibility
                                        fontSize: '1.4rem',
                                        // Enforce touch target accessibility minimum width
                                        minWidth: '44px',
                                        // Enforce touch target accessibility minimum height
                                        minHeight: '44px',
                                        // Set flexbox display to align cross icon
                                        display: 'flex',
                                        // Center horizontal axis contents
                                        justifyContent: 'center',
                                        // Center vertical axis contents
                                        alignItems: 'center',
                                    }}
                                >
                                    {/* Cross sign exit icon character */}
                                    ✕
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateRows: isExpanded ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s ease',
                }}>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ paddingTop: '0.5rem' }}>
                            {/* Subtotal and category budget progress section */}
                            <div style={{ marginBottom: '1rem' }}>
                                {/* Category spending summary title and figures */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    {/* Label display */}
                                    <span>{category.budget !== undefined ? 'Spent vs Budget' : 'Subtotal'}</span>
                                    {/* Formatted amount display */}
                                    <span style={{ color: 'white', fontWeight: 'bold' }}>
                                        {category.budget !== undefined ? `${formatCurrency(subtotal)} / ${formatCurrency(category.budget)}` : formatCurrency(subtotal)}
                                    </span>
                                </div>
                                {/* Progress bar track container */}
                                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                    {/* Progress bar fill indicator with color coding */}
                                    <div style={{
                                        height: '100%',
                                        width: category.budget !== undefined ? `${Math.min((subtotal / category.budget) * 100, 100)}%` : `${percentage}%`,
                                        background: category.budget !== undefined
                                            ? (subtotal > category.budget ? 'var(--firebase-red)' : (subtotal / category.budget >= 0.8 ? 'var(--firebase-orange)' : '#00E676'))
                                            : category.color,
                                        transition: 'width 0.5s ease-out'
                                    }} />
                                </div>
                                {/* Check if category budget is defined to show budget status text */}
                                {category.budget !== undefined && (
                                    // Row layout for budget status subtext
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                                        {/* Status message indicating remaining budget or over-budget deficit */}
                                        <span style={{ color: subtotal > category.budget ? 'var(--firebase-red)' : (subtotal / category.budget >= 0.8 ? 'var(--firebase-orange)' : 'var(--text-secondary)') }}>
                                            {subtotal > category.budget
                                                ? `Exceeded by ${formatCurrency(subtotal - category.budget)}`
                                                : `${formatCurrency(category.budget - subtotal)} remaining`}
                                        </span>
                                        {/* Budget percentage usage text */}
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            {Math.round((subtotal / category.budget) * 100)}% used
                                        </span>
                                    </div>
                                )}
                            </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {category.expenses.map(expense => (
                                <ExpenseItem
                                    key={expense.id}
                                    categoryId={category.id}
                                    expense={expense}
                                    onUpdate={(updated) => updateExpense(category.id, updated)}
                                    onDelete={(id) => deleteExpense(category.id, id)}
                                    onMove={(exp, oldId, newId) => {
                                        moveExpense(oldId, newId, exp);
                                    }}
                                />
                            ))}
                        </div>

                        {isAddingExpense ? (
                            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>New Expense</h4>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <input
                                        placeholder="Name"
                                        value={newExpenseName}
                                        onChange={e => setNewExpenseName(e.target.value)}
                                        style={{ background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        <input
                                            placeholder="Amount"
                                            type="number"
                                            value={newExpenseAmount}
                                            onChange={e => setNewExpenseAmount(e.target.value)}
                                            style={{ background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
                                        />
                                        <input
                                            placeholder="Day"
                                            type="number"
                                            min="1" max="31"
                                            value={newExpenseDay}
                                            onChange={e => setNewExpenseDay(e.target.value)}
                                            style={{ background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
                                        />
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={newExpenseRecurring} 
                                            onChange={e => setNewExpenseRecurring(e.target.checked)} 
                                        />
                                        Recurring Expense (copies to new months)
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <button onClick={handleAddExpense} style={{ flex: 1, background: 'var(--firebase-yellow)', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: 'black' }}>Add</button>
                                        <button onClick={() => setIsAddingExpense(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', color: 'white' }}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAddingExpense(true)}
                                style={{
                                    width: '100%',
                                    marginTop: '1rem',
                                    padding: '0.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px dashed var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                    e.currentTarget.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }}
                            >
                                + Add Expense
                            </button>
                        )}
                        </div>
                    </div>
                </div>
            </Box>

            {/* Conditional portal rendering for delete category warning confirm overlay */}
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
                            Delete Category?
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
                            <strong>{category.name}</strong>
                            {/* Confirmation warning text suffix details */}
                            ? This will permanently delete all expenses in this category.
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
                            {/* Confirm finalize delete category button action button */}
                            <button
                                // Finalize category deletion on click tap
                                onClick={() => {
                                    // Execute deletion callback trigger
                                    deleteCategory(category.id);
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

export default CategoryBox;
