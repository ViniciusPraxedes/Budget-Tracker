"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

// Check if error is due to missing or stale deployment chunk
const isChunkLoadError = (error: Error | null): boolean => {
    // Guard against null error
    if (!error) return false;
    // Extract lowercased message
    const msg = (error.message || '').toLowerCase();
    // Extract lowercased name
    const name = (error.name || '').toLowerCase();
    // Return true if error matches chunk load patterns
    return (
        // Check ChunkLoadError name
        name.includes('chunkloaderror') ||
        // Check failed to load chunk message
        msg.includes('failed to load chunk') ||
        // Check loading chunk failed message
        msg.includes('loading chunk') ||
        // Check dynamically imported module failure
        msg.includes('dynamically imported module')
    );
};

// ErrorBoundary class component to catch rendering errors and handle deployment chunk mismatches
class ErrorBoundary extends Component<Props, State> {
    // Component initial state
    public state: State = {
        // Error flag
        hasError: false,
        // Error reference
        error: null
    };

    // Static lifecycle method to derive error state
    public static getDerivedStateFromError(error: Error): State {
        // Return updated state
        return { hasError: true, error };
    }

    // Lifecycle hook triggered after error is thrown by descendant component
    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log caught error and component stack
        console.error("Uncaught error:", error, errorInfo);
        // Check if error is caused by stale deployment chunk mismatch
        if (isChunkLoadError(error)) {
            // Guard in browser environment
            if (typeof window !== 'undefined') {
                // Key for reload throttling guard
                const reloadKey = 'chunk_error_reloaded';
                // Check if already reloaded in current session
                const alreadyReloaded = sessionStorage.getItem(reloadKey);
                // Trigger reload if not yet attempted
                if (!alreadyReloaded) {
                    // Set flag in session storage
                    sessionStorage.setItem(reloadKey, 'true');
                    // Force hard page reload to fetch latest deployment manifest
                    window.location.reload();
                    // End reload check
                }
                // End browser check
            }
            // End chunk error check
        }
    // End componentDidCatch
    }

    // Render boundary UI fallback or wrapped children
    public render() {
        // Check error state
        if (this.state.hasError) {
            // Check if current error is stale chunk error
            const isChunk = isChunkLoadError(this.state.error);
            // Render error container
            return (
                // Outer flex layout container
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '2rem', textAlign: 'center' }}>
                    {/* Error title header */}
                    <h1 style={{ color: 'var(--firebase-red)' }}>
                        {/* Title text depending on chunk error type */}
                        {isChunk ? 'New Version Available' : 'Something went wrong.'}
                    </h1>
                    {/* Error explanation paragraph */}
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0.5rem auto' }}>
                        {/* Explanation description depending on chunk error type */}
                        {isChunk ? 'A new version of the app was recently deployed. Please reload to fetch the latest updates.' : this.state.error?.message}
                    </p>
                    {/* Action button trigger */}
                    <button
                        // Execute reload or retry based on error type
                        onClick={() => {
                            // If chunk error force hard reload
                            if (isChunk && typeof window !== 'undefined') {
                                // Reload page
                                window.location.reload();
                            // Otherwise reset state
                            } else {
                                // Reset error state
                                this.setState({ hasError: false, error: null });
                            // End else
                            }
                        }}
                        // Action button styles
                        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', background: 'var(--firebase-yellow)', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {/* Button label text */}
                        {isChunk ? 'Update & Reload' : 'Try again'}
                    </button>
                </div>
            );
        // End error check
        }

        // Return wrapped children
        return this.props.children;
    // End render
    }
}

export default ErrorBoundary;
