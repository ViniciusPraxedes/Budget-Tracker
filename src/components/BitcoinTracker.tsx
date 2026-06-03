import React, { useState, useEffect } from 'react';
import Box from './Box';

const BitcoinTracker: React.FC = () => {
    const [btcAmount, setBtcAmount] = useState('');
    const [prices, setPrices] = useState<{ usd: number, sek: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(true);

    const formatCurrency = (val: number, currency: 'USD' | 'SEK') => {
        return new Intl.NumberFormat(currency === 'SEK' ? 'sv-SE' : 'en-US', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(val);
    };

    // Load saved amount on mount
    useEffect(() => {
        const savedAmount = localStorage.getItem('btcAmount');
        if (savedAmount) {
            setBtcAmount(savedAmount);
        }
    }, []);

    const fetchPrices = async () => {
        setLoading(true);
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,sek');
            const data = await response.json();
            if (data.bitcoin) {
                setPrices({
                    usd: data.bitcoin.usd,
                    sek: data.bitcoin.sek
                });
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Error fetching Bitcoin prices:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrices();
        // Refresh every 5 minutes
        const interval = setInterval(fetchPrices, 300000);
        return () => clearInterval(interval);
    }, []);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setBtcAmount(val);
        localStorage.setItem('btcAmount', val);
    };

    const amount = parseFloat(btcAmount);
    const hasAmount = !isNaN(amount) && amount > 0;

    return (
        <div style={{ marginBottom: '1rem' }}>
            <Box title={
                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        width: '100%'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>Bitcoin Tracker</span>
                        {loading && <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>(Updating...)</span>}
                    </div>
                    <span style={{
                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                        transition: 'transform 0.3s',
                        display: 'inline-block'
                    }}>
                        ▼
                    </span>
                </div>
            }>
                {!isCollapsed && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                Your Holding (BTC)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={btcAmount}
                                onChange={handleAmountChange}
                                placeholder="0.00000000"
                                style={{
                                    background: 'var(--background-dark)',
                                    border: '1px solid var(--border-color)',
                                    color: 'white',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    width: '100%',
                                    fontSize: '1.1rem'
                                }}
                            />
                        </div>

                        {prices && (
                            <>
                                <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                        Current Price
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
                                        <span style={{ fontSize: '1rem', color: '#00E676', fontWeight: 'bold' }}>
                                            {formatCurrency(prices.usd, 'USD')}
                                        </span>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            /
                                        </span>
                                        <span style={{ fontSize: '1rem', color: 'var(--firebase-yellow)', fontWeight: 'bold' }}>
                                            {formatCurrency(prices.sek, 'SEK')}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                    <div style={{
                                        padding: '1rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            Your Value (USD)
                                        </div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#00E676' }}>
                                            {formatCurrency(hasAmount ? amount * prices.usd : 0, 'USD')}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '1rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            Your Value (SEK)
                                        </div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--firebase-yellow)' }}>
                                            {formatCurrency(hasAmount ? amount * prices.sek : 0, 'SEK')}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {lastUpdated && (
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem', opacity: 0.6 }}>
                                Last updated: {lastUpdated.toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                )}
            </Box>
        </div>
    );
};

export default BitcoinTracker;
