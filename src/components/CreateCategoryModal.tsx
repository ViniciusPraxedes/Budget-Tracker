import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { PREDEFINED_COLORS } from '../constants';
import { getUsedColors, getAvailableColors, getUnusedColor } from '../utils/colors';

interface CreateCategoryModalProps {
    onClose: () => void;
    onCreated?: (categoryId: string) => void;
}

const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({ onClose, onCreated }) => {
    const { categories, addCategory } = useBudget();
    // State for new category name input
    const [newName, setNewName] = useState('');
    // State for optional new category monthly budget limit
    const [newBudget, setNewBudget] = useState('');
    
    // Get colors currently used across existing categories
    const usedColors = getUsedColors(categories);
    // Filter available unused color palette options
    const availableColors = getAvailableColors(usedColors);
    // Select initial unused accent color
    const [newColor, setNewColor] = useState(getUnusedColor(usedColors));

    // Handle creation submit action
    const handleAdd = () => {
        // Check if category name string is provided
        if (newName) {
            // Parse float value from budget input or leave undefined
            const parsedBudget = newBudget !== '' ? parseFloat(newBudget) : undefined;
            // Create category with name, color, and optional budget limit
            const newCat = addCategory(newName, newColor, parsedBudget);
            // Trigger callback if listener is registered
            if (onCreated) {
                // Pass created category ID to callback
                onCreated(newCat.id);
            }
            // Close modal dialog
            onClose();
        }
    };

    // Auto pick next available color helper
    const handleAutoPick = () => {
        // Set new unused color state
        setNewColor(getUnusedColor(usedColors));
    };

    return (
        // Overlay backdrop container
        <div 
            onClick={(e) => {
                // Stop propagation
                e.stopPropagation();
                // Close modal
                onClose();
            }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.6)',
                zIndex: 10000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}
        >
            {/* Modal card layout wrapper */}
            <div 
                onClick={(e) => e.stopPropagation()}
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
                    maxWidth: '320px',
                    boxSizing: 'border-box'
                }}
            >
                {/* Close modal button */}
                <button 
                    onClick={onClose} 
                    style={{ 
                        position: 'absolute', 
                        top: '10px', 
                        right: '10px', 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--text-secondary)', 
                        cursor: 'pointer',
                        fontSize: '1.2rem'
                    }}
                >
                    &times;
                </button>
                
                {/* Inputs container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    {/* Category name input */}
                    <input
                        placeholder="Category Name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        style={{ width: '100%', background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.75rem', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                    {/* Optional monthly budget input */}
                    <input
                        type="number"
                        placeholder="Monthly Budget Limit (optional)"
                        value={newBudget}
                        onChange={e => setNewBudget(e.target.value)}
                        style={{ width: '100%', background: 'var(--background-dark)', border: '1px solid var(--border-color)', color: 'white', padding: '0.75rem', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                    {/* Create category action button */}
                    <button
                        onClick={handleAdd}
                        style={{
                            background: 'var(--firebase-orange)',
                            color: 'black',
                            border: 'none',
                            padding: '0.75rem 1rem',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Create Category
                    </button>
                </div>

                <div>
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Choose Color:</span>
                        <button
                            onClick={handleAutoPick}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            ✨ Auto Pick
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {availableColors.map(color => (
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
        </div>
    );
};

export default CreateCategoryModal;
