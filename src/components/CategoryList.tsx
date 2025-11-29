import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import CategoryBox from './CategoryBox';
import { PREDEFINED_COLORS } from '../constants';

const CategoryList: React.FC = () => {
    const { categories, addCategory, copyPreviousMonthData } = useBudget();
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(PREDEFINED_COLORS[0]);

    const handleAdd = () => {
        if (newName) {
            addCategory(newName, newColor);
            setNewName('');
            setNewColor(PREDEFINED_COLORS[0]);
            setIsAdding(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Categories</h2>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    style={{
                        background: 'var(--firebase-yellow)',
                        color: 'black',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    {isAdding ? 'Cancel' : '+ New Category'}
                </button>
            </div>

            {isAdding && (
                <div style={{
                    marginBottom: '2rem',
                    padding: '1.5rem',
                    background: 'var(--surface-dark)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input
                            placeholder="Category Name"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            style={{ flex: 1, background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.75rem', borderRadius: '4px' }}
                        />
                        <button
                            onClick={handleAdd}
                            style={{
                                background: 'var(--firebase-orange)',
                                color: 'black',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Create
                        </button>
                    </div>

                    <div>
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Choose Color:</div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {PREDEFINED_COLORS.map(color => (
                                <div
                                    key={color}
                                    onClick={() => setNewColor(color)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: color,
                                        cursor: 'pointer',
                                        border: newColor === color ? '2px solid white' : '2px solid transparent',
                                        boxShadow: newColor === color ? '0 0 0 2px var(--background-dark)' : 'none',
                                        transition: 'transform 0.1s'
                                    }}
                                    title={color}
                                />
                            ))}
                            <div style={{ position: 'relative', width: '32px', height: '32px' }}>
                                <input
                                    type="color"
                                    value={newColor}
                                    onChange={e => setNewColor(e.target.value)}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        opacity: 0,
                                        cursor: 'pointer'
                                    }}
                                    title="Custom Color"
                                />
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                                    border: !PREDEFINED_COLORS.includes(newColor) ? '2px solid white' : '2px solid transparent',
                                    boxShadow: !PREDEFINED_COLORS.includes(newColor) ? '0 0 0 2px var(--background-dark)' : 'none',
                                }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {categories.map(category => (
                    <CategoryBox key={category.id} category={category} />
                ))}
            </div>

            {categories.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.7 }}>
                    <p>No categories for this month.</p>
                    <button
                        onClick={copyPreviousMonthData}
                        style={{
                            background: 'transparent',
                            border: '1px dashed var(--firebase-yellow)',
                            color: 'var(--firebase-yellow)',
                            padding: '1rem 2rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            marginTop: '1rem'
                        }}
                    >
                        Copy Budget from Previous Month
                    </button>
                </div>
            )}
        </div>
    );
};

export default CategoryList;
