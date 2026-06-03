import React, { useState } from 'react';
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
    const { categories, updateCategory, deleteCategory, addExpense, updateExpense, deleteExpense, moveCategory, totalExpenses } = useBudget();
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(category.name);
    const [editedColor, setEditedColor] = useState(category.color);
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

    const handleCategorySave = () => {
        updateCategory(category.id, editedName, editedColor);
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    value={editedName}
                                    onChange={e => setEditedName(e.target.value)}
                                    style={{ background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem', borderRadius: '4px', flex: 1 }}
                                />
                                <button onClick={handleCategorySave} style={{ background: 'var(--firebase-yellow)', border: 'none', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer' }}>✓</button>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0, marginRight: '1rem' }}>
                                <div
                                    {...attributes}
                                    {...listeners}
                                    style={{
                                        cursor: 'grab',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.75rem',
                                        fontSize: '1.2rem',
                                        userSelect: 'none',
                                        touchAction: 'none',
                                        flexShrink: 0
                                    }}
                                >
                                    ≡
                                </div>
                                <h3 style={{ margin: 0, color: category.color, fontSize: '1.2rem', wordBreak: 'break-word', overflow: 'hidden' }}>{category.name}</h3>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>

                                <button
                                    onClick={onToggle}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.2rem', padding: '0 0.5rem' }}
                                >
                                    {isExpanded ? '▲' : '▼'}
                                </button>
                                <button onClick={() => setIsEditing(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>✎</button>
                                <button onClick={() => setShowDeleteConfirm(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--firebase-red)' }}>✕</button>
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
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <span>Subtotal</span>
                                    <span style={{ color: 'white', fontWeight: 'bold' }}>{formatCurrency(subtotal)}</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${percentage}%`, background: category.color, transition: 'width 0.5s ease-out' }} />
                                </div>
                            </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {category.expenses.map(expense => (
                                <ExpenseItem
                                    key={expense.id}
                                    expense={expense}
                                    onUpdate={(updated) => updateExpense(category.id, updated)}
                                    onDelete={(id) => deleteExpense(category.id, id)}
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

            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'var(--background-card)',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        maxWidth: '400px',
                        width: '100%',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}>
                        <h3 style={{ marginTop: 0, color: 'white' }}>Delete Category?</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Are you sure you want to delete <strong>{category.name}</strong>? This will permanently delete all expenses in this category.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    color: 'white',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    deleteCategory(category.id);
                                    setShowDeleteConfirm(false);
                                }}
                                style={{
                                    background: 'var(--firebase-red)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryBox;
