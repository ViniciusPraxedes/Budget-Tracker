import React from 'react';

interface BoxProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

const Box: React.FC<BoxProps> = ({ children, title, className = '', style = {} }) => {
    return (
        <div
            className={`box glass-panel fade-in ${className}`}
            style={{
                borderRadius: '12px',
                padding: '1.5rem',
                ...style
            }}
        >
            {title && (
                <div style={{
                    marginBottom: '1rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 'bold'
                }}>
                    {title}
                </div>
            )}
            {children}
        </div>
    );
};

export default Box;
