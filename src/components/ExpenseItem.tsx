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
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(expense.name);
    const [editedAmount, setEditedAmount] = useState(expense.amount.toString());
    const [editedDay, setEditedDay] = useState(expense.paymentDay.toString());
    const [editedRecurring, setEditedRecurring] = useState(!!expense.isRecurring);
    const [editedCategoryId, setEditedCategoryId] = useState(categoryId);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleSave = () => {
        if (editedCategoryId && editedCategoryId !== categoryId && onMove) {
            onMove(
                {
                    ...expense,
                    name: editedName,
                    amount: parseFloat(editedAmount) || 0,
                    paymentDay: parseInt(editedDay) || 1,
                    isRecurring: editedRecurring,
                },
                categoryId,
                editedCategoryId
            );
        } else {
            onUpdate({
                ...expense,
                name: editedName,
                amount: parseFloat(editedAmount) || 0,
                paymentDay: parseInt(editedDay) || 1,
                isRecurring: editedRecurring,
            });
        }
        setIsEditing(false);
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

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            transition: 'background 0.2s'
        }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {expense.name}
                    </span>
                    {expense.isRecurring && (
                        <span title="Recurring Expense" style={{ fontSize: '0.8rem', opacity: 0.8, flexShrink: 0 }}>🔁</span>
                    )}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Day {expense.paymentDay}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(expense.amount)}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setIsEditing(true)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem' }}
                        title="Edit"
                    >
                        ✎
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--firebase-red)', fontSize: '1rem' }}
                        title="Delete"
                    >
                        🗑
                    </button>
                </div>
            </div>

            {showDeleteConfirm && typeof document !== 'undefined' && createPortal(
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
                        background: '#121212',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        maxWidth: '400px',
                        width: '100%',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}>
                        <h3 style={{ marginTop: 0, color: 'white' }}>Delete Expense?</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Are you sure you want to delete <strong>{expense.name}</strong>?
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
                                    onDelete(expense.id);
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
                </div>,
                document.body
            )}
        </div>
    );
};

export default ExpenseItem;
