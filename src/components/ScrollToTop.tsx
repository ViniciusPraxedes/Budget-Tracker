"use client";

import React, { useState, useEffect } from 'react';

const ScrollToTop: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);

        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    if (!isVisible) {
        return null;
    }

    return (
        <button
            onClick={scrollToTop}
            style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                background: 'var(--firebase-yellow)',
                color: 'black',
                border: 'none',
                borderRadius: '50%',
                width: '3rem',
                height: '3rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                zIndex: 1000,
                transition: 'opacity 0.3s ease-in-out',
            }}
            title="Scroll to Top"
        >
            ↑
        </button>
    );
};

export default ScrollToTop;
