import React, { useState } from 'react';
import { Expense } from '../types';

interface ExpenseItemProps {
    expense: Expense;
    onUpdate: (expense: Expense) => void;
    onDelete: (id: string) => void;
}

const ExpenseItem: React.FC<ExpenseItemProps> = ({ expense, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(expense.name);
    const [editedAmount, setEditedAmount] = useState(expense.amount.toString());
    const [editedDay, setEditedDay] = useState(expense.paymentDay.toString());

    const handleSave = () => {
        onUpdate({
            ...expense,
            name: editedName,
            amount: parseFloat(editedAmount) || 0,
            paymentDay: parseInt(editedDay) || 1,
        });
        setIsEditing(false);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(val);
    };

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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{expense.name}</span>
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
                        onClick={() => onDelete(expense.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--firebase-red)', fontSize: '1rem' }}
                        title="Delete"
                    >
                        🗑
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExpenseItem;
