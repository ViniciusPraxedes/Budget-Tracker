"use client";

// Import React and hooks from react core
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
// Import useBudget context hook
import { useBudget } from '../context/BudgetContext';
// Import useLocalization context hook
import { useLocalization } from '../context/LocalizationContext';
// Import CSS module styles
import styles from './AiAnalysis.module.css';

// Declare AI spending analysis React component
export default function AiAnalysis() {
    // Retrieve budget variables from state hook
    const { income, categories, totalExpenses, savings, totalSavings, currentMonth, currentYear } = useBudget();
    // Retrieve currency formatter from localization hook
    const { formatCurrency } = useLocalization();
    // Declare state for modal open status
    const [isOpen, setIsOpen] = useState(false);
    // Declare state for network loading status
    const [loading, setLoading] = useState(false);
    // Declare state for analysis result text
    const [analysis, setAnalysis] = useState('');
    // Declare state for error status message
    const [error, setError] = useState('');

    // Handle triggering analysis from button click
    const handleAnalyze = async () => {
        // Set loading status state to true
        setLoading(true);
        // Clear previous error messages
        setError('');
        // Open modal dialog container window
        setIsOpen(true);
        // Build readable category summary string
        const categoriesSummary = categories.map(cat => {
            // Calculate total expenses for the category
            const total = cat.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            // Format expenses in the category as list
            const expensesList = cat.expenses.map(exp => `- ${exp.name}: ${formatCurrency(exp.amount)}${exp.isRecurring ? ' (Recurring)' : ''}`).join('\n');
            // Return formatted string for this category
            return `Category: ${cat.name}\nTotal Spending: ${formatCurrency(total)}\nExpenses:\n${expensesList}`;
        // Join all category summaries with double newlines
        }).join('\n\n');

        // Formulate the prompt text message for Gemini API
        const promptText = `You are an expert personal finance advisor.
Analyze the user's spending data and budget information for the month of ${currentMonth + 1}/${currentYear} and provide actionable financial tips.

Financial Profile:
- Monthly Income: ${formatCurrency(income)}
- Monthly Expenses: ${formatCurrency(totalExpenses)}
- Net Monthly Savings: ${formatCurrency(savings)}
- Cumulative Total Savings: ${formatCurrency(totalSavings)}

Category Breakdown:
${categoriesSummary}

Formatting Rules:
- Structure your answer cleanly into 3 distinct sections using these exact headers:
### 1. Spending Overview
### 2. Key Insights
### 3. Actionable Recommendations
- Do NOT use level-4 headers (####), do NOT output raw hashtag (#) symbols, and do NOT output raw '---' horizontal lines.
- Format action steps as clean numbered items (1., 2., 3.) or bullet points.
- Be encouraging, highly specific to their actual numbers, professional, and concise.`;

        // Define API key from environment variables
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        
        if (!apiKey) {
            setError('API key is missing. Please check your environment variables.');
            setLoading(false);
            return;
        }
        
        // Construct API endpoint URL string
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

        // Attempt API connection and parsing
        try {
            // Post payload to Gemini endpoint
            const response = await fetch(url, {
                // Set request method to post
                method: 'POST',
                // Define JSON payload headers
                headers: {
                    // Set content type to JSON
                    'Content-Type': 'application/json',
                },
                // Stringify contents block
                body: JSON.stringify({
                    // Contents structure for Gemini API
                    contents: [{
                        // Set parts array list
                        parts: [{
                            // Attach formatted prompt text
                            text: promptText
                        }]
                    }]
                })
            });

            // Check if network request failed
            if (!response.ok) {
                // Read and parse error details from response payload
                const errorData = await response.json().catch(() => ({}));
                // Extract error message string or fallback to status code
                const errorMessage = errorData?.error?.message || `API returned status ${response.status}`;
                // Throw error with extracted message detail
                throw new Error(errorMessage);
            }

            // Parse response body as JSON data
            const data = await response.json();
            
            // Check if candidates are returned
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
                // Extract parsed markdown text value
                const text = data.candidates[0].content.parts[0].text;
                // Set state with analysis text
                setAnalysis(text);
            } else {
                // Throw custom parsing error
                throw new Error('Invalid response structure received from Gemini API');
            }
        // Catch network or parse failures
        } catch (err: any) {
            // Log full error details to console
            console.error('Gemini API Error:', err);
            // Set error state with failure message
            setError(err.message || 'Failed to generate financial analysis. Please try again.');
        } finally {
            // Clear loading status state
            setLoading(false);
        }
    };

    // Helper to parse inline bold markdown formatting
    const parseInlineMarkdown = (text: string) => {
        // Strip any stray hashtag symbols from text
        const cleanText = text.replace(/#/g, '');
        // Split text by double asterisks pattern
        const parts = cleanText.split(/(\*\*.*?\*\*)/g);
        // Map over parts to return standard or bold text
        return parts.map((part, index) => {
            // Check if segment is wrapped in double asterisks
            if (part.startsWith('**') && part.endsWith('**')) {
                // Return bold styled strong element
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            // Return standard text node
            return part;
        });
    };

    // Parse markdown content into React nodes
    const parseMarkdown = (text: string) => {
        // Split input text by newline character
        const lines = text.split('\n');
        // Map each line to a React element
        return lines.map((line, i) => {
            // Trim leading and trailing whitespace
            const trimmed = line.trim();
            // Check for horizontal divider lines like --- or *** or ___
            if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
                // Return styled horizontal divider element
                return <hr key={i} className={styles.mdHr} />;
            }
            // Check if line is any level header (####, ###, ##, #)
            if (trimmed.startsWith('#')) {
                // Strip all leading and trailing hashtag characters
                const headerText = trimmed.replace(/^#+\s*/, '').replace(/#+$/, '').trim();
                // Return h3 header element containing parsed inline text
                return <h3 key={i} className={styles.mdH3}>{parseInlineMarkdown(headerText)}</h3>;
            }
            // Check if line is bullet list item (- or *)
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                // Extract list item content string
                const content = trimmed.replace(/^[-*]\s+/, '');
                // Return li element containing parsed text
                return <li key={i} className={styles.mdLi}>{parseInlineMarkdown(content)}</li>;
            }
            // Check if line is a numbered list item like "1. ", "2. ", "3. "
            if (/^\d+\.\s+/.test(trimmed)) {
                // Extract number match prefix
                const num = trimmed.match(/^\d+/)?.[0] || '•';
                // Extract content after number prefix
                const content = trimmed.replace(/^\d+\.\s+/, '');
                // Return structured step item container with step number badge
                return (
                    <div key={i} className={styles.mdNumberedItem}>
                        {/* Step number circular badge */}
                        <span className={styles.mdBadge}>{num}</span>
                        {/* Step content text */}
                        <div className={styles.mdNumberedContent}>{parseInlineMarkdown(content)}</div>
                    </div>
                );
            }
            // Check if line is empty spacing
            if (trimmed === '') {
                // Return spacing div block
                return <div key={i} className={styles.mdSpace} />;
            }
            // Return paragraph element containing parsed inline text
            return <p key={i} className={styles.mdP}>{parseInlineMarkdown(line)}</p>;
        });
    };

    // Return component visual tree
    return (
        // Outer card container element
        <div className={styles.cardContainer}>
            {/* Header wrapper block */}
            <div className={styles.cardHeader}>
                {/* Sparkle icon vector */}
                <svg className={styles.sparkleIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    {/* Path shape elements */}
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
                {/* Title heading label */}
                <h3 className={styles.cardTitle}>AI Financial Assistant</h3>
            </div>
            {/* Card text description */}
            <p className={styles.cardDesc}>Get AI-powered spending insights & customized financial tips for this month.</p>
            {/* Trigger action button wrapper */}
            <button className={styles.analyzeBtn} onClick={handleAnalyze}>
                {/* Sparkle label icon */}
                <span>✨</span>
                {/* Text title inside button */}
                <span>Analyze Spending</span>
            </button>

            {/* Check if modal overlay needs rendering */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                // Dark glass screen overlay
                <div className={styles.modalOverlay} onClick={() => setIsOpen(false)}>
                    {/* Dialog content box */}
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        {/* Header bar within modal */}
                        <div className={styles.modalHeader}>
                            {/* Title heading style */}
                            <h2 className={styles.cardTitle}>AI Spending Analysis</h2>
                            {/* Close button modal trigger */}
                            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                                {/* Close character entity */}
                                &times;
                            </button>
                        </div>
                        {/* Analysis results body wrapper */}
                        <div className={styles.analysisBody}>
                            {/* Check if loading status active */}
                            {loading && (
                                // Loading spinner container
                                <div className={styles.loadingContainer}>
                                    {/* Spinner animation circle */}
                                    <div className={styles.spinner} />
                                    {/* Pulsating load text label */}
                                    <span className={styles.loadingText}>Analyzing budget data...</span>
                                </div>
                            )}

                            {/* Check if error occurred */}
                            {error && (
                                // Error notification box
                                <div className={styles.errorBox}>
                                    {/* Error icon element */}
                                    <svg className={styles.errorIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        {/* Warning path design */}
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                    </svg>
                                    {/* Error message text details */}
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Check if analysis text is ready and not loading */}
                            {!loading && !error && analysis && (
                                // Renders parsed nodes list
                                <div>{parseMarkdown(analysis)}</div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
