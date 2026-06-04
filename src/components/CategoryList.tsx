import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import CategoryBox from './CategoryBox';
import { PREDEFINED_COLORS } from '../constants';
import { getUsedColors, getAvailableColors, getUnusedColor } from '../utils/colors';
import { defaultCategories, defaultIncome } from '../utils/mockData';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';

const CategoryList: React.FC = () => {
    // Destructure required state and functions from the budget context provider
    const { categories, addCategory, copyPreviousMonthData, loadMockData, reorderCategories } = useBudget();
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');

    const [newColor, setNewColor] = useState(PREDEFINED_COLORS[0]);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

    const usedColors = getUsedColors(categories);
    const availableColors = getAvailableColors(usedColors);

    const handleAdd = () => {
        if (newName) {
            addCategory(newName, newColor);
            setNewName('');
            setNewColor(getUnusedColor(usedColors)); // Reset to a new unused color
            setIsAdding(false);
        }
    };

    const handleAutoPick = () => {
        setNewColor(getUnusedColor(usedColors));
    };

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev =>
            prev.includes(id) ? prev.filter(catId => catId !== id) : [...prev, id]
        );
    };

    const allExpanded = categories.length > 0 && expandedCategories.length === categories.length;

    const toggleExpandAll = () => {
        if (allExpanded) {
            setExpandedCategories([]);
        } else {
            setExpandedCategories(categories.map(c => c.id));
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(TouchSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = categories.findIndex((cat) => cat.id === active.id);
            const newIndex = categories.findIndex((cat) => cat.id === over.id);

            reorderCategories(arrayMove(categories, oldIndex, newIndex));
        }
    };

    return (
        // Add bottom padding to allow scrolling past mobile floating action buttons
        <div style={{ paddingBottom: '7.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Categories</h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={toggleExpandAll}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        {allExpanded ? 'Collapse All' : 'Expand All'}
                    </button>
                    {/* Renders category button using mobile floating styles */}
                    <button
                        // Apply mobile FAB styling and conditional class modifier
                        className={`mobile-fab ${isAdding ? 'is-adding' : ''}`}
                        // Register tap click toggle trigger
                        onClick={() => setIsAdding(!isAdding)}
                        // Apply button styling settings
                        style={{
                            // Define standard yellow surface background color
                            background: 'var(--firebase-yellow)',
                            // Define dark text color contrast
                            color: 'black',
                            // Remove element border lines
                            border: 'none',
                            // Add responsive padding spacing
                            padding: '0.5rem 1rem',
                            // Add border radius curvature bounds
                            borderRadius: '4px',
                            // Highlight text weight bold font
                            fontWeight: 'bold',
                            // Define pointer style cursor indicator
                            cursor: 'pointer',
                            // Define interactive scaling speed duration transition
                            transition: 'all 0.2s',
                        }}
                        // Trigger scaling up animation on hover enter
                        onMouseEnter={(e) => {
                            // Assign transform scaling target property
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        // Trigger scaling down animation on hover exit
                        onMouseLeave={(e) => {
                            // Reset transform scaling target property
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        {/* Conditional category form state visual label content */}
                        {isAdding ? 'Cancel' : '+ New Category'}
                    </button>
                </div>
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
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={categories.map(c => c.id)}
                    strategy={rectSortingStrategy}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {categories.map(category => (
                            <CategoryBox
                                key={category.id}
                                category={category}
                                isExpanded={expandedCategories.includes(category.id)}
                                onToggle={() => toggleCategory(category.id)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {categories.length === 0 && (
                <div className="fade-in-delay-1" style={{ 
                    textAlign: 'center', 
                    marginTop: '4rem',
                    padding: '3rem 2rem',
                    background: 'var(--surface-dark)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(255, 196, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        border: '1px solid rgba(255, 196, 0, 0.2)',
                        boxShadow: '0 0 20px rgba(255, 196, 0, 0.1)'
                    }}>
                        <span style={{ fontSize: '2.5rem' }}>📂</span>
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'white' }}>No Categories Yet</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '300px', margin: '0 auto 2rem' }}>
                        Start tracking your expenses by creating a new category or copying your budget from last month.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
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
                                fontWeight: '500',
                                transition: 'all 0.2s',
                                width: '100%',
                                maxWidth: '300px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 196, 0, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            Copy Budget from Previous Month
                        </button>
                        
                        <button
                            onClick={() => loadMockData(defaultIncome, defaultCategories)}
                            style={{
                                background: 'var(--surface-dark)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                padding: '0.75rem 2rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s',
                                width: '100%',
                                maxWidth: '300px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--surface-dark)';
                            }}
                        >
                            Load Mock Data for Testing
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryList;
