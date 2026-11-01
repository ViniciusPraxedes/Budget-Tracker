"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Interface defining an actionable callback button attached to a toast notification
export interface ToastAction {
    // Label string displayed on the action button
    label: string;
    // Callback invoked when the user taps the action button
    onClick: () => void;
}

// Interface defining internal toast model structure
interface Toast {
    // Unique identifier for the toast item
    id: string;
    // Main textual notification message
    message: string;
    // Visual theme variant for the toast
    type: 'success' | 'error' | 'info';
    // Optional interactive action button
    action?: ToastAction;
}

// Interface exposing public toast context dispatcher methods
interface ToastContextType {
    // Function to enqueue a new toast notification with optional action and custom duration
    addToast: (message: string, type?: 'success' | 'error' | 'info', action?: ToastAction, duration?: number) => void;
}

// React context storing toast dispatcher interface
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ToastProvider component wrapping layout to render notifications globally
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // State holding list of active visible toast notifications
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Function to enqueue a new toast notification
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info', action?: ToastAction, duration?: number) => {
        // Generate pseudo-random unique toast identifier
        const id = Math.random().toString(36).substr(2, 9);
        // Determine active timeout duration, extending to 6000ms if an interactive action is present
        const timeoutDuration = duration !== undefined ? duration : (action ? 6000 : 3000);
        // Append new toast notification to active toasts array
        setToasts(prev => [...prev, { id, message, type, action }]);
        // Set timer to automatically dismiss toast after timeout
        setTimeout(() => {
            // Filter out expired toast by id
            setToasts(prev => prev.filter(t => t.id !== id));
            // Close timeout callback
        }, timeoutDuration);
        // End addToast function
    };

    // Render provider and toast floating container
    return (
        // Context provider supplying addToast callback
        <ToastContext.Provider value={{ addToast }}>
            {/* Child component tree */}
            {children}
            {/* Fixed position floating container for toasts */}
            <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10002, display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', pointerEvents: 'none', width: 'max-content', maxWidth: '92vw' }}>
                {/* Map active toast notifications */}
                {toasts.map(toast => (
                    // Toast bubble element
                    <div key={toast.id} className="slide-up" style={{
                        // Background tint based on toast type
                        background: toast.type === 'error' ? 'var(--firebase-red)' : toast.type === 'success' ? '#00E676' : 'var(--surface-dark)',
                        // Text color based on toast type
                        color: toast.type === 'info' ? 'white' : 'black',
                        // Inner padding
                        padding: '0.75rem 1.25rem',
                        // Rounded pill corners
                        borderRadius: '30px',
                        // Elevation drop shadow
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        // Font weight
                        fontWeight: 'bold',
                        // Flexbox layout
                        display: 'flex',
                        // Vertical centering
                        alignItems: 'center',
                        // Gap between icon, text, and button
                        gap: '0.75rem',
                        // Enable pointer interactions on the toast itself
                        pointerEvents: 'auto',
                        // Box sizing
                        boxSizing: 'border-box',
                        // Max width
                        maxWidth: '100%'
                    }}>
                        {/* Success checkmark icon */}
                        {toast.type === 'success' && (
                            // Success SVG icon
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        )}
                        {/* Error cross icon */}
                        {toast.type === 'error' && (
                            // Error SVG icon
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        )}
                        {/* Info circle icon */}
                        {toast.type === 'info' && (
                            // Info SVG icon
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        )}
                        {/* Toast message string */}
                        <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', fontSize: '0.9rem' }}>
                            {toast.message}
                        </span>
                        {/* Interactive action button if configured */}
                        {toast.action && (
                            // Action button element
                            <button
                                type="button"
                                onClick={() => {
                                    // Remove toast immediately
                                    setToasts(prev => prev.filter(t => t.id !== toast.id));
                                    // Invoke action callback
                                    toast.action?.onClick();
                                }}
                                style={{
                                    // Semi-transparent button background
                                    background: 'rgba(255, 255, 255, 0.22)',
                                    // Border outline
                                    border: '1px solid rgba(255, 255, 255, 0.45)',
                                    // Inherited text color
                                    color: toast.type === 'info' ? '#64B5F6' : 'black',
                                    // Bold typography
                                    fontWeight: 700,
                                    // Font size
                                    fontSize: '0.82rem',
                                    // Compact padding
                                    padding: '0.28rem 0.75rem',
                                    // Pill border radius
                                    borderRadius: '16px',
                                    // Cursor pointer
                                    cursor: 'pointer',
                                    // Margin left separation
                                    marginLeft: '0.4rem',
                                    // Prevent text wrapping
                                    whiteSpace: 'nowrap',
                                    // Prevent button shrinking
                                    flexShrink: 0,
                                    // Smooth hover transition
                                    transition: 'background 0.15s ease'
                                }}
                            >
                                {/* Action button label */}
                                {toast.action.label}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
