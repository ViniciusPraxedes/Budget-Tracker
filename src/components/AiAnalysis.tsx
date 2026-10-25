"use client";

// Import React and standard state, effect, and memo hooks
import React, { useState, useEffect } from 'react';
// Import DOM portal generator
import { createPortal } from 'react-dom';
// Import useBudget context hook
import { useBudget } from '../context/BudgetContext';
// Import useLocalization context hook
import { useLocalization } from '../context/LocalizationContext';
// Import user auth context hook
import { useAuth } from '../context/AuthContext';
// Import toast notification dispatcher
import { useToast } from '../context/ToastContext';
// Import Firestore connection instance
import { db } from '../firebase';
// Import Firestore document accessor utilities
import { doc, getDoc } from 'firebase/firestore';
// Import component CSS module styles
import styles from './AiAnalysis.module.css';

// Declare component props interface supporting optional Horizon simulation data
export interface AiAnalysisProps {
    // Optional horizon simulation data payload
    horizonData?: {
        // Count of months in horizon sequence
        horizonSequenceCount: number;
        // Projected cumulative total savings
        projectedTotalSavings: number;
        // Long term savings target
        savingsGoal: number;
        // Label of target horizon month
        targetLabel: string;
    // Close horizonData type
    };
    // Optional custom button label text
    customTriggerLabel?: string;
// Close props interface
}

// Available insight types definitions
interface InsightOption {
    // Unique identifier key for the insight
    id: 'comprehensive' | 'cost_cutting' | 'savings_goal' | 'subscriptions' | 'horizon';
    // Human readable title label
    title: string;
    // Descriptive summary of the analysis focus
    desc: string;
    // SVG icon path render function
    icon: React.ReactNode;
// Close interface
}

// Declare enhanced AI spending analysis React component
export default function AiAnalysis({ horizonData, customTriggerLabel }: AiAnalysisProps = {}) {
    // Retrieve budget variables and mutators from budget context
    const { income, categories, totalExpenses, savings, totalSavings, savingsGoal, currentMonth, currentYear, monthlyBudget, setMonthlyBudget, setMonthlySavingsDeposit, updateCategory } = useBudget();
    // Retrieve currency formatter, currency code, and locale from localization hook
    const { formatCurrency, currency, locale } = useLocalization();
    // Retrieve current user session from auth context
    const { user } = useAuth();
    // Retrieve toast notification dispatcher
    const { addToast } = useToast();

    // Declare state for modal open status
    const [isOpen, setIsOpen] = useState(false);
    // Declare state for chosen insight type (null indicates showing the selector screen)
    const [selectedInsightType, setSelectedInsightType] = useState<string | null>(null);
    // Declare state for initial analysis network loading status
    const [loading, setLoading] = useState(false);
    // Declare state for active streaming status
    const [isStreaming, setIsStreaming] = useState(false);
    // Declare state for generated analysis markdown text
    const [analysis, setAnalysis] = useState('');
    // Declare state for error status message
    const [error, setError] = useState('');
    // Declare state for clipboard copied confirmation feedback
    const [copied, setCopied] = useState(false);
    // Declare state for set of applied action identifiers
    const [appliedActions, setAppliedActions] = useState<Set<string>>(new Set());
    // Declare state for conversational follow-up chat messages
    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
    // Declare state for current follow-up input text
    const [followUpInput, setFollowUpInput] = useState('');
    // Declare state for follow-up streaming status
    const [isStreamingFollowUp, setIsStreamingFollowUp] = useState(false);

    // Lock background scrolling on mobile and desktop when modal is active
    useEffect(() => {
        // Prevent execution outside browser DOM environment
        if (typeof document === 'undefined') return;
        // Check if modal dialog is currently open
        if (isOpen) {
            // Save original body overflow style value
            const prevOverflow = document.body.style.overflow;
            // Disable background scrolling
            document.body.style.overflow = 'hidden';
            // Return cleanup teardown function
            return () => {
                // Restore original body scrolling behavior
                document.body.style.overflow = prevOverflow;
            // Close cleanup handler
            };
        // Close if statement
        }
    // Track isOpen state dependency
    }, [isOpen]);

    // List of insight options presented to user in English
    const insightOptions: InsightOption[] = [
        // Comprehensive review
        {
            // ID
            id: 'comprehensive',
            // Title
            title: 'Comprehensive Health Check',
            // Description
            desc: 'Complete overview of income, spending, budget compliance & overall savings momentum.',
            // Icon
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            )
        // Close option
        },
        // Cost cutting focus
        {
            // ID
            id: 'cost_cutting',
            // Title
            title: 'Cost-Cutting & Over-Budget Audit',
            // Description
            desc: 'Deep dive into over-budget categories, highest cost drivers, and variable spending cuts.',
            // Icon
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                    <polyline points="17 18 23 18 23 12" />
                </svg>
            )
        // Close option
        },
        // Savings & Goal focus
        {
            // ID
            id: 'savings_goal',
            // Title
            title: 'Savings & Goal Trajectory',
            // Description
            desc: 'Analyzes your net savings rate, emergency buffer, and projected timeline to reach your goal.',
            // Icon
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
            )
        // Close option
        },
        // Subscriptions focus
        {
            // ID
            id: 'subscriptions',
            // Title
            title: 'Subscriptions & Fixed Bills',
            // Description
            desc: 'Audit recurring bills, highlight subscription fatigue, and calculate yearly cost recovery.',
            // Icon
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
            )
        // Close option
        },
        // Horizon Simulation focus (only if horizonData present)
        ...(horizonData ? [{
            // ID
            id: 'horizon' as const,
            // Title
            title: 'Horizon Simulation Forecast',
            // Description
            desc: `Evaluates multi-month cash flow trajectory and milestones toward ${horizonData.targetLabel}.`,
            // Icon
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
            )
        // Close option
        }] : [])
    // Close array
    ];

    // Construct unified financial profile object
    const buildFinancialProfile = async () => {
        // Calculate effective overall monthly budget target preserving zero
        const effectiveMonthlyBudget = monthlyBudget !== undefined ? monthlyBudget : categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);
        // Calculate combined total of expenses flagged as recurring across all categories
        const recurringTotal = categories.reduce((sum, cat) => sum + cat.expenses.filter(exp => exp.isRecurring).reduce((s, exp) => s + exp.amount, 0), 0);
        // Calculate user's savings rate as a percentage of income
        const savingsRate = income > 0 ? (savings / income) * 100 : 0;

        // Build readable category summary string
        const categoriesSummary = categories.map(cat => {
            // Calculate total expenses for the category
            const total = cat.expenses.reduce((sum, exp) => sum + exp.amount, 0);
            // Calculate percentage of category budget consumed, if a budget is set
            const budgetPct = cat.budget && cat.budget > 0 ? (total / cat.budget) * 100 : null;
            // Build a budget status label for this category
            const budgetStatus = budgetPct === null
                ? 'No budget set'
                : `Budget: ${formatCurrency(cat.budget!)} (${Math.round(budgetPct)}% used${budgetPct > 100 ? ' - OVER BUDGET' : ''})`;
            // Format expenses in the category as list
            const expensesList = cat.expenses.map(exp => `- ${exp.name}: ${formatCurrency(exp.amount)}${exp.isRecurring ? ' (Recurring)' : ''}`).join('\n');
            // Return formatted string for this category
            return `Category: ${cat.name} (ID: ${cat.id})\nTotal Spending: ${formatCurrency(total)}\n${budgetStatus}\nExpenses:\n${expensesList}`;
        // Join all category summaries with double newlines
        }).join('\n\n');

        // Initialize previous month metrics container
        let previousMonthMetrics: any = null;
        // Calculate previous month index
        const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
        // Calculate previous year index
        const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
        // Construct previous month key string
        const prevKey = `${prevY}-${prevM}`;

        // Attempt fetching prior month data for historical comparison
        try {
            // Check if authenticated cloud user
            if (user?.uid && user.uid !== 'test-user') {
                // Reference previous month document in Firestore
                const prevDocRef = doc(db, 'users', user.uid, 'months', prevKey);
                // Fetch document snapshot
                const prevSnap = await getDoc(prevDocRef);
                // Check if document snapshot exists
                if (prevSnap.exists()) {
                    // Extract data payload
                    const pData = prevSnap.data() as any;
                    // Calculate previous month total expenses
                    const pExpTotal = (pData.categories || []).reduce((sum: number, c: any) => sum + (c.expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0), 0);
                    // Find previous month top spending category
                    let pTopName = 'None';
                    // Find previous month top category amount
                    let pTopAmount = 0;
                    // Loop through previous categories
                    for (const c of (pData.categories || [])) {
                        // Calculate category total
                        const cTotal = (c.expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
                        // Check if greater than current top
                        if (cTotal > pTopAmount) {
                            // Update top amount
                            pTopAmount = cTotal;
                            // Update top category name
                            pTopName = c.name;
                        // Close if statement
                        }
                    // Close for loop
                    }
                    // Assign previous month metrics
                    previousMonthMetrics = {
                        // Previous month index
                        month: prevM,
                        // Previous year index
                        year: prevY,
                        // Previous income
                        income: pData.income || 0,
                        // Previous total expenses
                        totalExpenses: pExpTotal,
                        // Previous net savings
                        savings: (pData.income || 0) - pExpTotal,
                        // Top category name
                        topCategoryName: pTopName,
                        // Top category amount
                        topCategoryAmount: pTopAmount
                    // Close object
                    };
                // Close if prevSnap exists
                }
            // Else handle guest or local mock mode
            } else if (typeof window !== 'undefined') {
                // Query local mock database route
                const mockRes = await fetch(`/api/mock-db?action=getMonth&month=${prevM}&year=${prevY}`);
                // Check if mock request succeeded
                if (mockRes.ok) {
                    // Parse JSON payload
                    const mockData = await mockRes.json();
                    // Check if month payload returned
                    if (mockData.month) {
                        // Calculate total expenses
                        const mExpTotal = (mockData.month.categories || []).reduce((sum: number, c: any) => sum + (c.expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0), 0);
                        // Find top category
                        let mTopName = 'None';
                        // Find top amount
                        let mTopAmount = 0;
                        // Loop categories
                        for (const c of (mockData.month.categories || [])) {
                            // Calculate category sum
                            const cSum = (c.expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
                            // Compare with top
                            if (cSum > mTopAmount) {
                                // Update amount
                                mTopAmount = cSum;
                                // Update name
                                mTopName = c.name;
                            // Close if statement
                            }
                        // Close for loop
                        }
                        // Assign metrics
                        previousMonthMetrics = {
                            // Month
                            month: prevM,
                            // Year
                            year: prevY,
                            // Income
                            income: mockData.month.income || 0,
                            // Total expenses
                            totalExpenses: mExpTotal,
                            // Net savings
                            savings: (mockData.month.income || 0) - mExpTotal,
                            // Top category name
                            topCategoryName: mTopName,
                            // Top category amount
                            topCategoryAmount: mTopAmount
                        // Close object
                        };
                    // Close if mockData.month
                    }
                // Close if mockRes.ok
                }
            // Close if-else
            }
        // Catch prior month lookup errors gracefully
        } catch {
            // Leave previousMonthMetrics as null
            previousMonthMetrics = null;
        // Close catch block
        }

        // Return structured financial profile payload
        return {
            // Current month index
            currentMonth,
            // Current year index
            currentYear,
            // Monthly income
            income,
            // Total expenses
            totalExpenses,
            // Effective monthly budget
            effectiveMonthlyBudget,
            // Net savings
            savings,
            // Savings rate percentage
            savingsRate,
            // Cumulative total savings
            totalSavings,
            // Target savings goal
            savingsGoal,
            // Recurring bills total
            recurringTotal,
            // Categories formatted summary string
            categoriesSummary,
            // Raw categories collection for ID resolution
            categories,
            // Prior month comparison metrics
            previousMonth: previousMonthMetrics,
            // Simulated horizon data payload if present
            horizonData
        // Close return object
        };
    // Close buildFinancialProfile function
    };

    // Handle user selecting an insight focus type
    const handleSelectInsightType = (typeId: string) => {
        // Set selected insight type in state
        setSelectedInsightType(typeId);
        // Clear previous conversation follow-up history
        setChatMessages([]);
        // Trigger analysis execution with chosen insight focus
        executeAnalysis(typeId, false);
    // Close handleSelectInsightType
    };

    // Handle returning to the insight type selector view
    const handleResetInsightType = () => {
        // Reset selected insight type to null to show picker
        setSelectedInsightType(null);
        // Reset analysis text
        setAnalysis('');
        // Clear follow-up chat
        setChatMessages([]);
        // Reset error
        setError('');
    // Close handleResetInsightType
    };

    // Execute the analysis stream for a specific insight type
    const executeAnalysis = async (typeId: string, forceRefresh = false) => {
        // Construct cache key including selected insight type
        const typeCacheKey = `ai_cache_${user?.uid || 'guest'}_${currentYear}_${currentMonth}_${typeId}`;

        // Clear previous error messages
        setError('');

        // Check if cached report is available in session storage and refresh not forced
        if (!forceRefresh && typeof window !== 'undefined') {
            // Retrieve cached analysis string
            const cached = sessionStorage.getItem(typeCacheKey);
            // Check if cached text exists
            if (cached) {
                // Populate analysis state from cache
                setAnalysis(cached);
                // Ensure loading is false
                setLoading(false);
                // Exit early to preserve quota and speed up display
                return;
            // Close if cached
            }
        // Close if not forceRefresh
        }

        // Set loading status state to true
        setLoading(true);
        // Set streaming status to true
        setIsStreaming(true);
        // Reset analysis text for fresh streaming output
        setAnalysis('');

        // Attempt API streaming request
        try {
            // Build current financial profile with historical data
            const financialProfile = await buildFinancialProfile();

            // Dispatch POST request to internal Next.js API route
            const response = await fetch('/api/ai-analysis', {
                // Method POST
                method: 'POST',
                // Request headers
                headers: { 'Content-Type': 'application/json' },
                // JSON stringified payload
                body: JSON.stringify({
                    // Financial profile metrics
                    financialProfile,
                    // Selected insight focus
                    insightType: typeId,
                    // Active currency code (SEK)
                    currency: currency || 'SEK',
                    // Active locale (sv-SE)
                    locale: locale || 'sv-SE',
                    // Follow-up flag false for initial run
                    isFollowUp: false
                // Close payload
                })
            // Close fetch options
            });

            // Check if network request failed
            if (!response.ok) {
                // Parse error payload
                const errData = await response.json().catch(() => ({}));
                // Throw error with extracted message
                throw new Error(errData?.error || `Server returned status ${response.status}`);
            // Close if statement
            }

            // Ensure response body stream exists
            if (!response.body) {
                // Throw error for missing stream
                throw new Error('No readable data stream received from analysis service');
            // Close if statement
            }

            // Initialize stream reader
            const reader = response.body.getReader();
            // Initialize text decoder
            const decoder = new TextDecoder();
            // Text accumulator variable
            let fullText = '';
            // Dismiss initial loading spinner as soon as stream connects
            setLoading(false);

            // Read streaming chunks until completion
            while (true) {
                // Read next chunk
                const { done, value } = await reader.read();
                // Check if stream reached end
                if (done) break;
                // Decode chunk bytes
                const chunkText = decoder.decode(value, { stream: true });
                // Append chunk to accumulator
                fullText += chunkText;
                // Update analysis state in real time for progressive typing effect
                setAnalysis(fullText);
            // Close while loop
            }

            // Cache generated analysis in session storage
            if (typeof window !== 'undefined' && fullText) {
                // Store analysis string under month cache key
                sessionStorage.setItem(typeCacheKey, fullText);
            // Close session storage check
            }
        // Catch network or parse failures
        } catch (err: any) {
            // Log full error details to console
            console.error('AI Analysis Error:', err);
            // Set error state with failure message
            setError(err.message || 'Failed to generate financial analysis. Please try again.');
        // Finalize state clean up
        } finally {
            // Clear loading status state
            setLoading(false);
            // Clear streaming status state
            setIsStreaming(false);
        // Close finally block
        }
    // Close executeAnalysis function
    };

    // Handle copying full analysis text to clipboard
    const handleCopyAnalysis = async () => {
        // Exit if no analysis text exists
        if (!analysis) return;
        // Wrap clipboard access in try-catch
        try {
            // Strip action token bracket tags from copied text for clean sharing
            const cleanText = analysis.replace(/\[\[ACTION:[^\]]+\]\]/g, '').trim();
            // Write clean markdown to system clipboard
            await navigator.clipboard.writeText(cleanText);
            // Set copied confirmation flag
            setCopied(true);
            // Display toast confirmation
            addToast('Analysis copied to clipboard!', 'success');
            // Reset copied feedback after two seconds
            setTimeout(() => setCopied(false), 2000);
        // Catch clipboard permission errors
        } catch {
            // Notify user of clipboard write failure
            addToast('Failed to copy to clipboard.', 'error');
        // Close catch block
        }
    // Close handleCopyAnalysis function
    };

    // Handle applying one-click actionable recommendation
    const handleApplyAction = (actionType: string, param1: string, param2: string, label: string) => {
        // Construct unique action identifier key
        const actionKey = `${actionType}_${param1}_${param2}`;
        // Prevent re-applying already executed action
        if (appliedActions.has(actionKey)) return;

        // Route action by action type
        if (actionType === 'SET_CATEGORY_BUDGET') {
            // Parse target amount value
            const amount = parseFloat(param2);
            // Validate parsed amount
            if (isNaN(amount) || amount < 0) return;
            // Find target category by ID or fallback to matching name
            const targetCat = categories.find(c => c.id === param1) || categories.find(c => c.name.toLowerCase() === param1.toLowerCase());
            // Check if matching category exists
            if (targetCat) {
                // Update category budget limit
                updateCategory(targetCat.id, targetCat.name, targetCat.color, amount);
                // Dispatch success toast notification in English
                addToast(`Updated ${targetCat.name} budget to ${formatCurrency(amount)}!`, 'success');
            // Else fallback to first category
            } else if (categories[0]) {
                // Update first category budget
                updateCategory(categories[0].id, categories[0].name, categories[0].color, amount);
                // Dispatch success toast notification in English
                addToast(`Updated ${categories[0].name} budget to ${formatCurrency(amount)}!`, 'success');
            // Close if-else
            }
        // Handle monthly savings deposit adjustment
        } else if (actionType === 'SET_SAVINGS_DEPOSIT') {
            // Parse deposit amount
            const amount = parseFloat(param1);
            // Validate parsed amount
            if (isNaN(amount) || amount < 0) return;
            // Update monthly savings deposit setting
            setMonthlySavingsDeposit(amount);
            // Dispatch success toast notification in English
            addToast(`Updated monthly savings deposit to ${formatCurrency(amount)}!`, 'success');
        // Handle overall monthly budget adjustment
        } else if (actionType === 'SET_MONTHLY_BUDGET') {
            // Parse monthly budget amount
            const amount = parseFloat(param1);
            // Validate parsed amount
            if (isNaN(amount) || amount < 0) return;
            // Update monthly budget setting
            setMonthlyBudget(amount);
            // Dispatch success toast notification in English
            addToast(`Updated overall monthly budget to ${formatCurrency(amount)}!`, 'success');
        // Close action routing
        }

        // Mark action key as applied
        setAppliedActions(prev => new Set(prev).add(actionKey));
    // Close handleApplyAction function
    };

    // Handle sending a follow-up inquiry message in chat
    const handleSendFollowUp = async (e?: React.FormEvent) => {
        // Prevent default form submission
        if (e) e.preventDefault();
        // Trim input query text
        const question = followUpInput.trim();
        // Exit early if input is empty or follow-up is already generating
        if (!question || isStreamingFollowUp) return;

        // Clear input field immediately
        setFollowUpInput('');
        // Append user question to local chat messages list
        const updatedHistory = [...chatMessages, { role: 'user' as const, content: question }];
        // Update chat messages state
        setChatMessages(updatedHistory);
        // Set streaming follow-up status to true
        setIsStreamingFollowUp(true);

        // Attempt streaming response for follow-up
        try {
            // Build current financial profile
            const profile = await buildFinancialProfile();

            // Dispatch POST to AI analysis route with follow-up payload
            const response = await fetch('/api/ai-analysis', {
                // Method POST
                method: 'POST',
                // Content type JSON
                headers: { 'Content-Type': 'application/json' },
                // Stringified payload
                body: JSON.stringify({
                    // Attached financial profile
                    financialProfile: profile,
                    // Previous conversation history
                    chatHistory: updatedHistory,
                    // Active currency
                    currency: currency || 'SEK',
                    // Active locale
                    locale: locale || 'sv-SE',
                    // Current insight focus
                    insightType: selectedInsightType || 'comprehensive',
                    // Follow-up mode flag
                    isFollowUp: true,
                    // Specific user inquiry question
                    userQuestion: question
                // Close payload
                })
            // Close fetch options
            });

            // Check if response is valid
            if (!response.ok || !response.body) {
                // Throw response failure
                throw new Error('Failed to retrieve follow-up answer');
            // Close if statement
            }

            // Initialize stream reader
            const reader = response.body.getReader();
            // Initialize decoder
            const decoder = new TextDecoder();
            // Initialize answer accumulator
            let answerAccumulator = '';

            // Add placeholder assistant message in state
            setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            // Stream response chunks
            while (true) {
                // Read next chunk
                const { done, value } = await reader.read();
                // Check if stream finished
                if (done) break;
                // Decode chunk
                const chunk = decoder.decode(value, { stream: true });
                // Append chunk
                answerAccumulator += chunk;
                // Update assistant message text in state
                setChatMessages(prev => {
                    // Clone history array
                    const next = [...prev];
                    // Update latest message content
                    next[next.length - 1] = { role: 'assistant', content: answerAccumulator };
                    // Return updated list
                    return next;
                // Close state updater
                });
            // Close while loop
            }
        // Catch follow-up errors
        } catch (err: any) {
            // Append error message to chat in English
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Could not generate advice for that question. Please try again.' }]);
        // Finalize follow-up streaming
        } finally {
            // Clear follow-up streaming flag
            setIsStreamingFollowUp(false);
        // Close finally block
        }
    // Close handleSendFollowUp function
    };

    // Helper to parse inline bold markdown formatting
    const parseInlineMarkdown = (text: string) => {
        // Strip any stray hashtag symbols and action brackets from text
        const cleanText = text.replace(/#/g, '').replace(/\[\[ACTION:[^\]]+\]\]/g, '');
        // Split text by double asterisks pattern
        const parts = cleanText.split(/(\*\*.*?\*\*)/g);
        // Map over parts to return standard or bold text
        return parts.map((part, index) => {
            // Check if segment is wrapped in double asterisks
            if (part.startsWith('**') && part.endsWith('**')) {
                // Return bold styled strong element
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            // Close if statement
            }
            // Return standard text node
            return part;
        // Close map
        });
    // Close parseInlineMarkdown function
    };

    // Helper to extract actionable recommendations from text lines
    const extractAction = (line: string) => {
        // Regular expression matching action tokens
        const match = line.match(/\[\[ACTION:([A-Z_]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]\]/);
        // Return null if no action match found
        if (!match) return null;
        // Return extracted action components
        return {
            // Action operation type
            type: match[1],
            // Parameter 1
            param1: match[2],
            // Parameter 2
            param2: match[3],
            // Human readable action label
            label: match[4]
        // Close object
        };
    // Close extractAction function
    };

    // Parse markdown content into React nodes including interactive action buttons
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
            // Close if statement
            }
            // Check if line contains an actionable recommendation button token
            const action = extractAction(trimmed);
            // Render interactive action chip if action was detected
            if (action) {
                // Construct unique action key
                const actionKey = `${action.type}_${action.param1}_${action.param2}`;
                // Check if already applied
                const isApplied = appliedActions.has(actionKey);
                // Return interactive action chip element
                return (
                    // Action button container div
                    <div key={`act-${i}`} style={{ margin: '0.4rem 0 0.8rem 0' }}>
                        {/* Interactive recommendation action chip */}
                        <button
                            type="button"
                            className={`${styles.actionChip} ${isApplied ? styles.actionChipApplied : ''}`}
                            onClick={() => handleApplyAction(action.type, action.param1, action.param2, action.label)}
                        >
                            {/* Icon indicator */}
                            <span>{isApplied ? '✓' : '⚡'}</span>
                            {/* Action label */}
                            <span>{isApplied ? `${action.label} (Applied)` : action.label}</span>
                        {/* Close button */}
                        </button>
                    {/* Close container */}
                    </div>
                );
            // Close if action
            }
            // Check if line is any level header (####, ###, ##, #)
            if (trimmed.startsWith('#')) {
                // Strip all leading and trailing hashtag characters
                const headerText = trimmed.replace(/^#+\s*/, '').replace(/#+$/, '').trim();
                // Return h3 header element containing parsed inline text
                return <h3 key={i} className={styles.mdH3}>{parseInlineMarkdown(headerText)}</h3>;
            // Close if statement
            }
            // Check if line is bullet list item (- or *)
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                // Extract list item content string
                const content = trimmed.replace(/^[-*]\s+/, '');
                // Return li element containing parsed text
                return <li key={i} className={styles.mdLi}>{parseInlineMarkdown(content)}</li>;
            // Close if statement
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
            // Close if statement
            }
            // Check if line is empty spacing
            if (trimmed === '') {
                // Return spacing div block
                return <div key={i} className={styles.mdSpace} />;
            // Close if statement
            }
            // Return paragraph element containing parsed inline text
            return <p key={i} className={styles.mdP}>{parseInlineMarkdown(line)}</p>;
        // Close lines map
        });
    // Close parseMarkdown function
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
            {/* Card text description in English */}
            <p className={styles.cardDesc}>
                {/* Descriptive card copy */}
                {horizonData ? 'Analyze multi-month horizon scenario & trajectory in kr.' : 'Select an insight focus, get forecasts in kr, and interact with your AI assistant.'}
            </p>
            {/* Trigger action button wrapper */}
            <button
                className={styles.analyzeBtn}
                onClick={() => {
                    // Open modal
                    setIsOpen(true);
                }}
            >
                {/* Sparkle SVG icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {/* Sparkle star path */}
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                {/* Closing svg */}
                </svg>
                {/* Text title inside button */}
                <span>{customTriggerLabel || (horizonData ? 'Analyze Horizon with AI' : 'Start AI Analysis')}</span>
            </button>

            {/* Check if modal overlay needs rendering */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                // Dark glass screen overlay
                <div className={styles.modalOverlay} onClick={() => setIsOpen(false)}>
                    {/* Dialog content box */}
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        {/* Header bar within modal */}
                        <div className={styles.modalHeader}>
                            {/* Top row with Title on the left and Close Button pinned on the right */}
                            <div className={styles.headerTopRow}>
                                {/* Title heading style */}
                                <h2 className={styles.cardTitle}>
                                    {/* Header title text */}
                                    {selectedInsightType
                                        ? (insightOptions.find(o => o.id === selectedInsightType)?.title || 'AI Spending Analysis')
                                        : 'Select Insight Focus'}
                                {/* Close heading */}
                                </h2>

                                {/* Close button permanently pinned to the top right corner */}
                                <button className={styles.closeBtn} onClick={() => setIsOpen(false)} title="Close Dialog">
                                    {/* Close character entity */}
                                    &times;
                                {/* Close button */}
                                </button>
                            {/* Close headerTopRow */}
                            </div>

                            {/* Sub toolbar row displayed when an insight is active */}
                            {selectedInsightType && (
                                <div className={styles.headerSubBar}>
                                    {/* Change Focus back button */}
                                    <button
                                        type="button"
                                        className={styles.iconBtn}
                                        onClick={handleResetInsightType}
                                        title="Change Insight Focus"
                                    >
                                        {/* Back arrow SVG icon */}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Polyline chevron */}
                                            <polyline points="15 18 9 12 15 6" />
                                        {/* Close svg */}
                                        </svg>
                                        {/* Button text */}
                                        <span>Change Focus</span>
                                    {/* Close button */}
                                    </button>

                                    {/* Right aligned actions cluster */}
                                    <div className={styles.headerActionsRight}>
                                        {/* Copy to clipboard button */}
                                        {analysis && (
                                            <button
                                                type="button"
                                                className={styles.iconBtn}
                                                onClick={handleCopyAnalysis}
                                                title="Copy Analysis Markdown"
                                            >
                                                {/* Copy SVG icon */}
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    {/* Rect outline */}
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    {/* Back rect path */}
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                {/* Closing svg */}
                                                </svg>
                                                {/* Button text label */}
                                                <span>{copied ? 'Copied!' : 'Copy'}</span>
                                            {/* Close button */}
                                            </button>
                                        )}

                                        {/* Regenerate fresh report button */}
                                        <button
                                            type="button"
                                            className={styles.iconBtn}
                                            onClick={() => executeAnalysis(selectedInsightType, true)}
                                            title="Regenerate Fresh Analysis"
                                            disabled={loading || isStreaming}
                                        >
                                            {/* Refresh SVG icon */}
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                {/* Refresh circular polyline */}
                                                <polyline points="23 4 23 10 17 10" />
                                                {/* Refresh bottom polyline */}
                                                <polyline points="1 20 1 14 7 14" />
                                                {/* Path arcs */}
                                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                            {/* Closing svg */}
                                            </svg>
                                            {/* Button label */}
                                            <span>Regenerate</span>
                                        {/* Close button */}
                                        </button>
                                    {/* Close headerActionsRight */}
                                    </div>
                                {/* Close headerSubBar */}
                                </div>
                            )}
                        {/* Close modalHeader */}
                        </div>

                        {/* Analysis results or insight selector body wrapper */}
                        <div className={styles.analysisBody}>
                            {/* Render Pre-Analysis Insight Selector Screen when no type is selected */}
                            {!selectedInsightType && (
                                <div className={styles.selectorContainer}>
                                    {/* Selector title and subtitle in English */}
                                    <div>
                                        <h3 className={styles.selectorHeading}>What would you like the AI to focus on?</h3>
                                        <p className={styles.selectorSub}>
                                            Choose an analytical perspective to evaluate. All financial values are calculated in Swedish kronor ({currency === 'SEK' ? 'kr' : currency}).
                                        </p>
                                    </div>

                                    {/* Grid of insight option cards */}
                                    <div className={styles.insightGrid}>
                                        {insightOptions.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                className={styles.insightCard}
                                                onClick={() => handleSelectInsightType(option.id)}
                                            >
                                                {/* Card circular icon */}
                                                <div className={styles.insightCardIcon}>
                                                    {option.icon}
                                                </div>
                                                {/* Card title */}
                                                <h4 className={styles.insightCardTitle}>{option.title}</h4>
                                                {/* Card description */}
                                                <p className={styles.insightCardDesc}>{option.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Check if initial loading status active */}
                            {selectedInsightType && loading && (
                                // Loading spinner container
                                <div className={styles.loadingContainer}>
                                    {/* Spinner animation circle */}
                                    <div className={styles.spinner} />
                                    {/* Pulsating load text label in English */}
                                    <span className={styles.loadingText}>Analyzing budget and historical telemetry in {currency === 'SEK' ? 'kr' : currency}...</span>
                                </div>
                            )}

                            {/* Check if error occurred */}
                            {selectedInsightType && error && (
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

                            {/* Check if analysis text is ready and not in initial loading */}
                            {selectedInsightType && !loading && !error && analysis && (
                                // Renders parsed nodes list with streaming cursor
                                <div>
                                    {/* Render parsed markdown sections */}
                                    {parseMarkdown(analysis)}
                                    {/* Render streaming cursor pulse if stream is ongoing */}
                                    {isStreaming && <span className={styles.streamingCursor} />}
                                </div>
                            )}

                            {/* Interactive conversational follow-up section */}
                            {selectedInsightType && !loading && !error && analysis && (
                                <div className={styles.chatSection}>
                                    {/* Chat title heading in English */}
                                    <h4 className={styles.chatTitle}>
                                        {/* Chat bubble icon */}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Chat path */}
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        {/* Closing svg */}
                                        </svg>
                                        {/* Title text */}
                                        <span>Ask a Follow-Up Question</span>
                                    {/* Close title */}
                                    </h4>

                                    {/* Message thread bubbles container */}
                                    {chatMessages.length > 0 && (
                                        <div className={styles.chatThread}>
                                            {/* Map over conversation history */}
                                            {chatMessages.map((msg, idx) => (
                                                <div
                                                    key={idx}
                                                    className={msg.role === 'user' ? styles.chatMsgUser : styles.chatMsgAssistant}
                                                >
                                                    {/* Parse message content */}
                                                    {parseMarkdown(msg.content)}
                                                </div>
                                            ))}
                                            {/* Follow up streaming cursor */}
                                            {isStreamingFollowUp && <span className={styles.streamingCursor} />}
                                        </div>
                                    )}

                                    {/* Chat input form */}
                                    <form className={styles.chatInputRow} onSubmit={handleSendFollowUp}>
                                        {/* Question text input in English */}
                                        <input
                                            type="text"
                                            className={styles.chatInput}
                                            value={followUpInput}
                                            onChange={(e) => setFollowUpInput(e.target.value)}
                                            placeholder="Ask e.g. 'How can I trim 1 500 kr from dining?'..."
                                            disabled={isStreamingFollowUp}
                                        />
                                        {/* Send question button */}
                                        <button
                                            type="submit"
                                            className={styles.chatSendBtn}
                                            disabled={!followUpInput.trim() || isStreamingFollowUp}
                                        >
                                            {/* Send paper plane icon */}
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                {/* Arrow line */}
                                                <line x1="22" y1="2" x2="11" y2="13" />
                                                {/* Polygon triangle */}
                                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                            {/* Closing svg */}
                                            </svg>
                                            {/* Send button text */}
                                            <span>Send</span>
                                        {/* Close button */}
                                        </button>
                                    {/* Close form */}
                                    </form>
                                {/* Close chatSection */}
                                </div>
                            )}
                        {/* Close analysisBody */}
                        </div>
                    {/* Close modalContent */}
                    </div>
                {/* Close modalOverlay */}
                </div>,
                document.body
            )}
        {/* Close cardContainer */}
        </div>
    );
// Close AiAnalysis component
}
