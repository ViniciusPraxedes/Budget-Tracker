"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LocalizationContextType {
    locale: string;
    currency: string;
    setLocale: (locale: string) => void;
    setCurrency: (currency: string) => void;
    formatCurrency: (amount: number) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [locale, setLocale] = useState('sv-SE');
    const [currency, setCurrency] = useState('SEK');

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat(locale, { 
            style: 'currency', 
            currency,
            maximumFractionDigits: 0 
        }).format(amount);
    };

    return (
        <LocalizationContext.Provider value={{ locale, currency, setLocale, setCurrency, formatCurrency }}>
            {children}
        </LocalizationContext.Provider>
    );
};

export const useLocalization = () => {
    const context = useContext(LocalizationContext);
    if (context === undefined) {
        throw new Error('useLocalization must be used within a LocalizationProvider');
    }
    return context;
};
