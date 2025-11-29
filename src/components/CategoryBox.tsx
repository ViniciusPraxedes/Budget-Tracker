import React, { useState } from 'react';
import { Category, Expense } from '../types';
import { useBudget } from '../context/BudgetContext';
import Box from './Box';
import ExpenseItem from './ExpenseItem';
import { PREDEFINED_COLORS } from '../constants';

interface CategoryBoxProps {
    category: Category;
}

const CategoryBox: React.FC<CategoryBoxProps> = ({ category }) => {
    const { updateCategory, deleteCategory, addExpense, updateExpense, deleteExpense } = useBudget();
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(category.name);
    const [editedColor, setEditedColor] = useState(category.color);

    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [newExpenseName, setNewExpenseName] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseDay, setNewExpenseDay] = useState('');

    const subtotal = category.expenses.reduce((sum, exp) => sum + exp.amount, 0);

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
            });
            setNewExpenseName('');
            setNewExpenseAmount('');
            setNewExpenseDay('');
            setIsAddingExpense(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(val);
    };

    return (
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

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {PREDEFINED_COLORS.map(color => (
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
                        <h3 style={{ margin: 0, color: category.color, fontSize: '1.2rem' }}>{category.name}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setIsEditing(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>✎</button>
                            <button onClick={() => deleteCategory(category.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--firebase-red)' }}>✕</button>
                        </div>
                    </>
                )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    <span>Subtotal</span>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>{formatCurrency(subtotal)}</span>
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
        </Box>
    );
};

export default CategoryBox;
