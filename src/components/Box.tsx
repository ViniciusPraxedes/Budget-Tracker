import React from 'react';

interface BoxProps {
    children: React.ReactNode;
    title?: string;
    className?: string;
    style?: React.CSSProperties;
}

const Box: React.FC<BoxProps> = ({ children, title, className = '', style = {} }) => {
    return (
        <div
            className={`box ${className}`}
            style={{
                backgroundColor: 'var(--surface-dark)',
                borderRadius: '12px',
                padding: '1.5rem',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                ...style
            }}
        >
            {title && (
                <h3 style={{
                    marginTop: 0,
                    marginBottom: '1rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
};

export default Box;
