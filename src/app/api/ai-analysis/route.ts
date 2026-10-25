// Import Next.js server request and response types
import { NextRequest, NextResponse } from 'next/server';

// Declare handler for POST requests to ai-analysis
export async function POST(req: NextRequest) {
    // Wrap entire request processing in try-catch
    try {
        // Parse JSON payload from incoming request body
        const body = await req.json();
        // Destructure financial profile, chat history, follow-up flags, currency, locale, and insightType
        const {
            // Financial metrics profile
            financialProfile,
            // Conversation history array
            chatHistory = [],
            // Follow up query boolean flag
            isFollowUp = false,
            // User query question string
            userQuestion = '',
            // Active currency symbol/code (default SEK)
            currency = 'SEK',
            // Active user locale (default sv-SE)
            locale = 'sv-SE',
            // Selected insight focus type
            insightType = 'comprehensive'
        // Close destructuring
        } = body;

        // Retrieve server-side API key prioritizing private key over public variable
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

        // Check if API key is present and looks like a valid Google AI Studio key starting with AIza
        const hasValidKey = apiKey && apiKey.startsWith('AIza') && apiKey.length > 20;

        // Determine currency symbol label
        const currencyUnit = currency === 'SEK' ? 'kr' : currency;

        // Helper currency formatter for text injection
        const formatAmount = (val: number) => {
            // Try standard international number formatting
            try {
                // Return formatted localized currency
                return new Intl.NumberFormat(locale || 'sv-SE', {
                    // Currency style
                    style: 'currency',
                    // Currency code
                    currency: currency || 'SEK',
                    // No decimals for cleaner display
                    maximumFractionDigits: 0
                // Format value
                }).format(val);
            // Fallback to simple suffix if Intl errors
            } catch {
                // Return rounded value with currency unit
                return `${Math.round(val)} ${currencyUnit}`;
            // Close catch
            }
        // Close formatAmount helper
        };

        // Attempt live Gemini streaming if key appears valid
        if (hasValidKey) {
            // Attempt Gemini API request with fallback handling
            try {
                // Construct Gemini API stream endpoint URL
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

                // Build contents payload depending on whether this is a follow-up or initial analysis
                let contentsPayload: any[] = [];

                // Check if this is a follow-up user query
                if (isFollowUp && userQuestion) {
                    // Map existing conversation history into Gemini parts structure
                    const historyParts = chatHistory.map((msg: any) => ({
                        // Map role to user or model
                        role: msg.role === 'user' ? 'user' : 'model',
                        // Provide text part
                        parts: [{ text: msg.text || msg.content }]
                    // Close mapping
                    }));

                    // Add current user question to contents list with currency and language instructions
                    contentsPayload = [
                        // Spread previous message turns
                        ...historyParts,
                        // Append current question turn
                        {
                            // User role declaration
                            role: 'user',
                            // Parts array
                            parts: [{ text: `User Question: "${userQuestion}"\nLanguage: Respond in fluent English.\nCurrency: The user's active currency is Swedish kronor (${currencyUnit}). ALWAYS format all monetary amounts in ${currencyUnit} (e.g. 1 500 ${currencyUnit}). NEVER use USD or "$".\nCRITICAL CONTEXT: The user's monthly budget is how much they expect/plan to spend for the entire month, whereas expenses are actual month-to-date spending logged so far. Do not mistake current expenses as the total for the whole month. Provide concise, direct financial advice.` }]
                        // Close object
                        }
                    // Close array
                    ];
                // Else handle initial analysis prompt based on selected insight type
                } else {
                    // Extract fields from profile
                    const {
                        currentMonth,
                        currentYear,
                        income,
                        totalExpenses,
                        effectiveMonthlyBudget,
                        savings,
                        savingsRate,
                        totalSavings,
                        savingsGoal,
                        recurringTotal,
                        categoriesSummary,
                        previousMonth,
                        horizonData
                    } = financialProfile || {};

                    // Build historical context note if previous month is provided
                    const previousMonthContext = previousMonth
                        ? `- Prior Month (${previousMonth.month + 1}/${previousMonth.year}): Expenses ${formatAmount(previousMonth.totalExpenses)}, Income ${formatAmount(previousMonth.income)}, Net Savings ${formatAmount(previousMonth.savings)}. Top Category: ${previousMonth.topCategoryName} (${formatAmount(previousMonth.topCategoryAmount)}).\n`
                        : '';

                    // Build horizon context note if simulated horizon data is attached
                    const horizonContext = horizonData
                        ? `- Multi-Month Horizon Simulation: Target is ${horizonData.targetLabel} across ${horizonData.horizonSequenceCount} months. Projected Cumulative Savings: ${formatAmount(horizonData.projectedTotalSavings)} toward goal of ${formatAmount(horizonData.savingsGoal)}.\n`
                        : '';

                    // Focus prompt guidance based on chosen insight type
                    let focusGuidance = '';
                    // Check if insight type is cost cutting
                    if (insightType === 'cost_cutting') {
                        // Focus on budget cuts
                        focusGuidance = `FOCUS: Cost-cutting, discretionary expense reduction, and over-budget category diagnosis. Prioritize identifying non-essential outlays that can be trimmed immediately.`;
                    // Check if insight type is savings goal
                    } else if (insightType === 'savings_goal') {
                        // Focus on savings goal timeline
                        focusGuidance = `FOCUS: Long-term savings trajectory, net savings velocity, and timeline to achieve their savings goal of ${formatAmount(savingsGoal)}. Emphasize emergency reserve adequacy.`;
                    // Check if insight type is subscriptions
                    } else if (insightType === 'subscriptions') {
                        // Focus on recurring expenses
                        focusGuidance = `FOCUS: Recurring bills, subscriptions, and fixed overhead audit. Highlight subscription fatigue, unused services, and yearly savings from cancellations.`;
                    // Check if insight type is horizon
                    } else if (insightType === 'horizon') {
                        // Focus on multi month simulation
                        focusGuidance = `FOCUS: Multi-month simulation feasibility, projected cash-flow runway, and milestones to reach target by ${horizonData?.targetLabel || 'target'}.`;
                    // Else comprehensive
                    } else {
                        // General holistic review
                        focusGuidance = `FOCUS: Comprehensive financial health check evaluating income vs. expenses, category budget adherence, and savings momentum.`;
                    // Close if-else
                    }

                    // Construct comprehensive prompt
                    const promptText = `You are an expert personal finance advisor.
Analyze the user's spending data and budget information for ${currentMonth + 1}/${currentYear} and provide actionable financial tips.

CRITICAL INSTRUCTIONS:
- LANGUAGE: Output your entire response in English.
- CURRENCY: The user's active currency is Swedish kronor (${currencyUnit}).
- ALWAYS format and display all currency numbers in ${currencyUnit} (e.g., "12 500 ${currencyUnit}" or "500 ${currencyUnit}").
- NEVER use USD, US dollars, or the "$" dollar sign under ANY circumstance.

CRITICAL TEMPORAL & BUDGET CONTEXT (NEVER CONFUSE SPENT WITH BUDGET):
- BUDGET = EXPECTED/PLANNED SPENDING FOR THE WHOLE MONTH: The "Full-Month Expected Budget" (both overall and per category) represents what the user expects and plans to spend across the entire month. It is their planned spending target, NOT money already spent.
- EXPENSES = ACTUAL SPENT MONTH-TO-DATE: The "Month-to-Date Actual Expenses" are ONLY what the user has spent up to today. The month is currently in progress. NEVER assume or state that the user has only spent this amount for the whole month!
- REMAINING ALLOWANCE: If Month-to-Date expenses are lower than the expected budget, the user has remaining budget left to spend for the rest of the month. Evaluate their burn rate and remaining allowance rather than assuming spending has stopped.
- PROJECTED SAVINGS: End-of-month projected savings should be evaluated based on (Income - Full-Month Expected Budget), whereas current net cash flow to date is (Income - Month-to-Date Actual Expenses).

Analytical Focus:
${focusGuidance}

Financial Profile:
- Monthly Income: ${formatAmount(income || 0)}
- Full-Month Expected Budget (Planned spending for the entire month): ${formatAmount(effectiveMonthlyBudget || 0)}
- Month-to-Date Actual Expenses (Logged so far up to current date): ${formatAmount(totalExpenses || 0)}
- Remaining Monthly Budget Allowance: ${formatAmount((effectiveMonthlyBudget || 0) - (totalExpenses || 0))} (${effectiveMonthlyBudget > 0 ? (((effectiveMonthlyBudget - totalExpenses) / effectiveMonthlyBudget) * 100).toFixed(1) : 0}% left to spend)
- Current Net Cash Flow to Date (Income minus spent so far): ${formatAmount(savings || 0)}
- Projected Net Savings at Month-End (Income minus full-month planned budget): ${formatAmount((income || 0) - (effectiveMonthlyBudget || 0))}
- Cumulative Total Savings: ${formatAmount(totalSavings || 0)}
- Long-Term Savings Goal: ${formatAmount(savingsGoal || 0)}
- Recurring Bills/Subscriptions: ${formatAmount(recurringTotal || 0)}
${previousMonthContext}${horizonContext}
Category Breakdown:
${categoriesSummary || 'No category breakdown available.'}

Formatting Rules:
- Structure cleanly into 3 distinct sections using these exact headers:
### 1. Spending Overview
### 2. Key Insights
### 3. Actionable Recommendations
- Do NOT use level-4 headers (####) and do NOT output raw '---' lines.
- In Section 1, summarize income, full-month expected budget, actual expenses logged to date, remaining budget buffer for the rest of the month, and projected savings trajectory using ${currencyUnit}.
- In Section 2, evaluate spending pace against expected monthly budgets, highlighting over-budget categories and categories burning through their budget too quickly.
- In Section 3, provide 3 to 4 clear recommendations in English. Where you suggest budgeting or setting savings, append structured action tags formatted in ${currencyUnit} so the user can apply them with one click:
  - To suggest a category budget: [[ACTION:SET_CATEGORY_BUDGET|CATEGORY_ID|SUGGESTED_AMOUNT|Set Category Name budget to SuggestedAmount ${currencyUnit}]]
  - To suggest a savings deposit: [[ACTION:SET_SAVINGS_DEPOSIT|AMOUNT|Set monthly savings deposit to SuggestedAmount ${currencyUnit}]]
  - To suggest total monthly budget: [[ACTION:SET_MONTHLY_BUDGET|AMOUNT|Set overall monthly budget to SuggestedAmount ${currencyUnit}]]`;

                    // Assign single prompt payload
                    contentsPayload = [{
                        // User role
                        role: 'user',
                        // Single text part
                        parts: [{ text: promptText }]
                    // Close object
                    }];
                // Close if-else block
                }

                // Dispatch streaming POST to Gemini
                const geminiRes = await fetch(geminiUrl, {
                    // Set method
                    method: 'POST',
                    // Set headers
                    headers: { 'Content-Type': 'application/json' },
                    // Body payload
                    body: JSON.stringify({ contents: contentsPayload })
                // Close fetch options
                });

                // Verify upstream response status
                if (geminiRes.ok && geminiRes.body) {
                    // Create SSE response reader
                    const reader = geminiRes.body.getReader();
                    // Instantiate text decoder
                    const decoder = new TextDecoder();

                    // Create custom output readable stream
                    const stream = new ReadableStream({
                        // Start stream pump loop
                        async start(controller) {
                            // Loop reading chunks
                            while (true) {
                                // Read chunk from upstream
                                const { done, value } = await reader.read();
                                // Check if stream has finished
                                if (done) break;
                                // Decode raw chunk text
                                const chunkText = decoder.decode(value, { stream: true });
                                // Split chunk text by SSE lines
                                const lines = chunkText.split('\n');
                                // Iterate through each SSE line
                                for (const line of lines) {
                                    // Check if line contains data payload
                                    if (line.startsWith('data: ')) {
                                        // Extract JSON string after prefix
                                        const jsonStr = line.slice(6).trim();
                                        // Skip empty lines
                                        if (!jsonStr) continue;
                                        // Wrap JSON parse
                                        try {
                                            // Parse SSE data object
                                            const parsed = JSON.parse(jsonStr);
                                            // Extract text part from candidate
                                            const partText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                                            // Enqueue text chunk if present
                                            if (partText) {
                                                // Convert text to uint8array and enqueue
                                                controller.enqueue(new TextEncoder().encode(partText));
                                            // Close if statement
                                            }
                                        // Catch JSON parse errors
                                        } catch {
                                            // Continue to next line
                                        // Close catch block
                                        }
                                    // Close if statement
                                    }
                                // Close for loop
                                }
                            // Close while loop
                            }
                            // Close output controller
                            controller.close();
                        // Close start method
                        }
                    // Close ReadableStream constructor
                    });

                    // Return streaming text response
                    return new Response(stream, {
                        // Stream headers configuration
                        headers: {
                            // Content type plain text stream
                            'Content-Type': 'text/plain; charset=utf-8',
                            // Cache control no cache
                            'Cache-Control': 'no-cache, no-transform'
                        // Close headers
                        }
                    // Close Response
                    });
                // Close if upstream ok
                }
            // Catch upstream network errors
            } catch (geminiError) {
                // Log upstream failure to console
                console.warn('Gemini upstream failed, falling back to dynamic rule engine:', geminiError);
            // Close catch block
            }
        // Close if hasValidKey
        }

        // Generate dynamic analysis in English with Swedish kronor currency formatting
        const fallbackText = generateDynamicAnalysis(financialProfile, isFollowUp, userQuestion, chatHistory, currency, locale, insightType);

        // Stream fallback text to maintain identical real-time UI typing experience
        const encoder = new TextEncoder();
        // Create custom readable stream for fallback text
        const fallbackStream = new ReadableStream({
            // Initialize start generator
            async start(controller) {
                // Break output into realistic words and punctuation chunks
                const chunks = fallbackText.match(/(\S+\s*|\s+)/g) || [fallbackText];
                // Loop through text chunks
                for (const chunk of chunks) {
                    // Enqueue chunk bytes
                    controller.enqueue(encoder.encode(chunk));
                    // Introduce brief delay to simulate natural generative streaming
                    await new Promise(resolve => setTimeout(resolve, 15));
                // Close for loop
                }
                // Close stream controller
                controller.close();
            // Close start
            }
        // Close ReadableStream
        });

        // Return streamed plain text response
        return new Response(fallbackStream, {
            // Set response headers
            headers: {
                // Content type text stream
                'Content-Type': 'text/plain; charset=utf-8',
                // No caching
                'Cache-Control': 'no-cache, no-transform'
            // Close headers
            }
        // Close Response
        });
    // Catch high level request errors
    } catch (err: any) {
        // Return 500 error response
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    // Close catch block
    }
// Close POST handler
}

// Helper engine to produce dynamic localized financial insights in English with Swedish kronor currency formatting
function generateDynamicAnalysis(
    // Financial profile object parameter
    profile: any,
    // Follow-up flag parameter
    isFollowUp: boolean,
    // User question parameter
    question: string,
    // Conversation history parameter
    _history: any[],
    // Currency code
    currency: string,
    // Locale code
    locale: string,
    // Selected insight focus
    insightType: string
): string {
    // Determine currency unit string
    const unit = currency === 'SEK' ? 'kr' : currency;

    // Localized currency formatter
    const fmt = (val: number) => {
        // Try Intl formatting
        try {
            // Return formatted currency string
            return new Intl.NumberFormat(locale || 'sv-SE', {
                // Style currency
                style: 'currency',
                // Currency code
                currency: currency || 'SEK',
                // No fraction digits
                maximumFractionDigits: 0
            // Format number
            }).format(val);
        // Fallback to simple number plus unit
        } catch {
            // Return rounded value
            return `${Math.round(val)} ${unit}`;
        // Close catch
        }
    // Close fmt
    };

    // Check if this is a follow-up conversation question
    if (isFollowUp && question) {
        // Normalize question to lower case for keyword routing
        const q = question.toLowerCase();
        // Income variable
        const income = Number(profile?.income || 0);
        // Expenses variable
        const totalExpenses = Number(profile?.totalExpenses || 0);
        // Monthly net savings
        const netSavings = income - totalExpenses;
        // Total savings goal
        const goal = Number(profile?.savingsGoal || 0);
        // Cumulative total savings
        const currentSavings = Number(profile?.totalSavings || 0);

        // Handle dining and groceries cut inquiries
        if (q.includes('food') || q.includes('dining') || q.includes('groceries') || q.includes('eat') || q.includes('mat')) {
            // Return targeted food advice in English
            return `### Food & Dining Strategy\nBased on your current numbers, food and groceries are often the most flexible area for immediate savings:\n\n1. **Meal Planning:** Batch cooking 2 meals per week typically yields a **15% to 25% reduction** in recurring grocery bills.\n2. **Dining Out Cap:** Institute a strict weekly dining cap rather than an open monthly limit.\n3. **Quick Action:** If you reduce monthly dining expenses by **${fmt(1500)}**, that adds an extra **${fmt(18000)}/year** directly to your savings pool.`;
        // Handle savings goal timelines
        } else if (q.includes('goal') || q.includes('reach') || q.includes('timeline') || q.includes('how long') || q.includes('mål') || q.includes('spar')) {
            // Remaining goal gap
            const gap = Math.max(0, goal - currentSavings);
            // Months remaining calculation
            const months = netSavings > 0 ? Math.ceil(gap / netSavings) : null;
            // Return goal projection advice in English
            return `### Savings Goal Projection\n- Current Savings: **${fmt(currentSavings)}**\n- Target Goal: **${fmt(goal)}**\n- Remaining Gap: **${fmt(gap)}**\n\n${
                months
                    ? `At your current net savings rate of **${fmt(netSavings)}/month**, you are on track to reach your goal in approximately **${months} month${months === 1 ? '' : 's'}**.\n\nIncreasing your monthly savings deposit by just **${fmt(1000)}** would accelerate your target by **${Math.max(1, Math.round(months * 0.15))} months**!`
                    : `Currently, your monthly net cash flow is ${fmt(netSavings)}. To build toward your goal, focus on setting category budget limits to free up at least 15% of your income.`
            }`;
        // Handle subscription or recurring inquiries
        } else if (q.includes('subscription') || q.includes('recurring') || q.includes('bill') || q.includes('abonnemang') || q.includes('räkning')) {
            // Recurring bills total
            const recurring = Number(profile?.recurringTotal || 0);
            // Return subscription advice in English
            return `### Recurring Bills Audit\nYour current recurring commitments total **${fmt(recurring)}/month** (${income > 0 ? ((recurring / income) * 100).toFixed(1) : 0}% of net income).\n\n1. **Audit Infrequently Used Services:** Review streaming and software services used less than twice a week.\n2. **Annual vs. Monthly Discounts:** Consolidating unavoidable recurring bills to annual billing often saves 15–20%.\n3. **Action:** Eliminating even two subscriptions of 150 ${unit} immediately frees up **${fmt(3600)}/year**.`;
        // General default follow-up answer in English
        } else {
            // Return general financial answer
            return `### Financial Advisory Insight\nRegarding **"${question}"**:\n\nWith your monthly income of **${fmt(income)}** and current expenses of **${fmt(totalExpenses)}**, your net margin is **${fmt(netSavings)}/month**.\n\n- **Focus on Variable Costs:** Fixed costs are harder to trim immediately, so prioritize capping discretionary categories.\n- **Automate Savings:** Transfer savings directly on payday to remove decision friction and protect your margin.`;
        // Close if-else chain
        }
    // Close follow-up branch
    }

    // Extract core profile metrics for full initial analysis
    const income = Number(profile?.income || 0);
    // Extract total expenses
    const totalExpenses = Number(profile?.totalExpenses || 0);
    // Extract effective budget
    const budget = Number(profile?.effectiveMonthlyBudget || 0);
    // Calculate net savings
    const netSavings = income - totalExpenses;
    // Calculate savings rate
    const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;
    // Extract cumulative savings
    const totalSavings = Number(profile?.totalSavings || 0);
    // Extract savings goal
    const savingsGoal = Number(profile?.savingsGoal || 0);
    // Extract recurring total
    const recurringTotal = Number(profile?.recurringTotal || 0);
    // Extract raw categories list if provided
    const categories = Array.isArray(profile?.categories) ? profile.categories : [];
    // Extract previous month data
    const prev = profile?.previousMonth;
    // Extract horizon data
    const horizon = profile?.horizonData;

    // Identify over-budget categories
    const overBudgetCats = categories.filter((c: any) => {
        // Calculate cat spending
        const spent = (c.expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
        // Return true if budget exists and spent exceeds budget
        return c.budget && c.budget > 0 && spent > c.budget;
    // Close filter
    });

    // Identify highest spending category
    let topCat: any = null;
    // Top category spending amount
    let topCatSpent = 0;
    // Iterate categories to find highest spender
    for (const cat of categories) {
        // Calculate category spending
        const spent = (cat.expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
        // Compare with current top
        if (spent > topCatSpent) {
            // Update top category spent
            topCatSpent = spent;
            // Update top category reference
            topCat = { ...cat, spent };
        // Close if statement
        }
    // Close for loop
    }

    // Calculate month-over-month spending difference text in English
    let momText = '';
    // Check if previous month comparison is available
    if (prev && prev.totalExpenses > 0) {
        // Calculate difference
        const diff = totalExpenses - prev.totalExpenses;
        // Calculate percentage difference
        const pct = (diff / prev.totalExpenses) * 100;
        // Check if spending increased
        if (diff > 0) {
            // Format increase text in English
            momText = ` Spending is up **${fmt(diff)} (+${pct.toFixed(1)}%)** compared to last month (${fmt(prev.totalExpenses)}).`;
        // Check if spending decreased
        } else if (diff < 0) {
            // Format decrease text in English
            momText = ` Spending dropped **${fmt(Math.abs(diff))} (${pct.toFixed(1)}%)** compared to last month (${fmt(prev.totalExpenses)}). Great discipline!`;
        // Else spending identical
        } else {
            // Format unchanged text in English
            momText = ` Spending matches your previous month exactly at ${fmt(totalExpenses)}.`;
        // Close if-else
        }
    // Close if prev
    }

    // Calculate goal projection sentence in English
    let goalProjection = '';
    // Check if goal is configured and net savings positive
    if (savingsGoal > 0 && netSavings > 0) {
        // Calculate remaining gap
        const gap = Math.max(0, savingsGoal - totalSavings);
        // Calculate months
        const months = Math.ceil(gap / netSavings);
        // Format projection string in English
        goalProjection = ` At this net pace, you will reach your **${fmt(savingsGoal)}** goal in approximately **${months} month${months === 1 ? '' : 's'}**.`;
    // Close if savingsGoal
    }

    // Build Horizon simulation note if present
    let horizonNote = '';
    // Check if horizon data exists
    if (horizon && horizon.projectedTotalSavings) {
        // Format simulation summary sentence in English
        horizonNote = `\n- **Horizon Outlook:** Multi-month simulation projects your cumulative savings reaching **${fmt(horizon.projectedTotalSavings)}** by **${horizon.targetLabel}**.`;
    // Close if horizon
    }

    // Find suggested category for one-click action
    const actionCat = overBudgetCats[0] || topCat;
    // Calculate suggested budget value for target category
    const suggestedCatBudget = actionCat
        ? Math.round(Math.max(500, (actionCat.spent || actionCat.budget || 2000) * 0.9))
        : 3000;
    // Suggested monthly savings deposit value
    const suggestedDeposit = Math.round(Math.max(500, income * 0.2));
    // Suggested overall budget
    const suggestedBudget = Math.round(Math.max(1000, totalExpenses * 0.95));

    // Specific section generation based on insightType in English
    if (insightType === 'cost_cutting') {
        return `### 1. Spending Overview
- **Month-to-Date Cash Flow:** Actual spending so far is **${fmt(totalExpenses)}** against an income of **${fmt(income)}** (current net surplus: ${fmt(netSavings)}).${momText}
- **Full-Month Expected Budget:** ${budget > 0 ? `Expected monthly spending cap is **${fmt(budget)}** (${totalExpenses > budget ? 'Currently over budget by ' + fmt(totalExpenses - budget) : fmt(budget - totalExpenses) + ' remaining buffer for the rest of the month'}).` : 'No overall monthly budget ceiling is currently set.'}
- **Projected Month-End Savings:** Estimated net savings of **${fmt(income - budget)}** if full expected budget is spent.

### 2. Key Insights
${overBudgetCats.length > 0
    ? overBudgetCats.map((c: any) => `- **Alert - Over Budget:** **${c.name}** has already spent **${fmt(c.spent || 0)}** against an expected full-month limit of ${fmt(c.budget)} (${fmt((c.spent || 0) - c.budget)} over limit).`).join('\n')
    : '- **Budget Adherence:** None of your categories currently exceed their designated monthly budget caps.'}
${topCat ? `- **Primary Cost Driver:** **${topCat.name}** accounts for **${fmt(topCatSpent)}** (${totalExpenses > 0 ? ((topCatSpent / totalExpenses) * 100).toFixed(1) : 0}% of spending to date).` : ''}

### 3. Actionable Recommendations
1. **Trim ${actionCat ? actionCat.name : 'Variable Costs'}:** Establish a monthly budget ceiling of ${fmt(suggestedCatBudget)} to capture immediate cash savings.
   [[ACTION:SET_CATEGORY_BUDGET|${actionCat ? actionCat.id : 'default'}|${suggestedCatBudget}|Set ${actionCat ? actionCat.name : 'Category'} Budget to ${fmt(suggestedCatBudget)}]]
2. **Cap Monthly Spending:** Restrict overall monthly outlays to ${fmt(suggestedBudget)}.
   [[ACTION:SET_MONTHLY_BUDGET|${suggestedBudget}|Set Overall Monthly Budget to ${fmt(suggestedBudget)}]]
3. **Cool-Off Rule:** Implement a mandatory 48-hour pause before making discretionary purchases over ${fmt(500)}.`;
    }

    if (insightType === 'savings_goal') {
        return `### 1. Spending Overview
- **Current Savings Rate:** You have saved **${savingsRate.toFixed(1)}%** of your net income so far this month (${fmt(netSavings)} to date).
- **Projected Full-Month Savings:** Based on your expected monthly budget of ${fmt(budget)}, projected end-of-month savings is **${fmt(income - budget)}** (${income > 0 ? (((income - budget) / income) * 100).toFixed(1) : 0}%).
- **Cumulative Reserves:** You hold **${fmt(totalSavings)}** in total saved funds.${goalProjection}

### 2. Key Insights
- **Emergency Runway:** Three months of baseline living costs based on your expected monthly budget (${fmt((budget > 0 ? budget : totalExpenses) * 3)}). ${totalSavings >= (budget > 0 ? budget : totalExpenses) * 3 ? 'Your safety runway is fully funded!' : `You need an additional ${fmt(Math.max(0, ((budget > 0 ? budget : totalExpenses) * 3) - totalSavings))} to establish a 3-month buffer.`}
${horizonNote}

### 3. Actionable Recommendations
1. **Automate Target Deposit:** Commit to depositing at least 20% of your net income into savings every payday.
   [[ACTION:SET_SAVINGS_DEPOSIT|${suggestedDeposit}|Set Monthly Savings Deposit to ${fmt(suggestedDeposit)}]]
2. **Accelerate Timeline:** Increasing your monthly savings deposit by ${fmt(1000)} shaves multiple months off your target timeline.
3. **Separate Reserves:** Keep your 3-month safety runway in an accessible high-yield account separate from checking.`;
    }

    if (insightType === 'subscriptions') {
        return `### 1. Spending Overview
- **Recurring Commitments:** Totaling **${fmt(recurringTotal)}/month** (${income > 0 ? ((recurringTotal / income) * 100).toFixed(1) : 0}% of net income).
- **Annualized Burden:** Recurring services cost **${fmt(recurringTotal * 12)} per year**.

### 2. Key Insights
- **Subscription Creep:** Recurring bills withdraw automatically and frequently evade monthly spending scrutiny.
- **Immediate Recovery:** Cancelling unused services immediately frees up recurring cash flow directly into savings.

### 3. Actionable Recommendations
1. **Audit Infrequently Used Services:** Review streaming, software, and gym memberships used less than twice a week.
2. **Reclaim Recovered Funds:** Re-route cancelled subscription amounts directly into your monthly savings deposit.
   [[ACTION:SET_SAVINGS_DEPOSIT|${suggestedDeposit}|Set Monthly Savings Deposit to ${fmt(suggestedDeposit)}]]
3. **Consolidate to Annual Billing:** Switch unavoidable annual services to yearly billing to capture typical 15–20% discounts.`;
    }

    // Default: Comprehensive health check in English
    return `### 1. Spending Overview
- **Month-to-Date Cash Flow:** Actual spending logged so far is **${fmt(totalExpenses)}** against an income of **${fmt(income)}** (current net surplus to date: **${fmt(netSavings)}**).${momText}
- **Full-Month Expected Budget:** ${
        budget > 0
            ? `You expect/plan to spend **${fmt(budget)}** across the full month (${totalExpenses > budget ? 'Currently over budget by ' + fmt(totalExpenses - budget) : fmt(budget - totalExpenses) + ' remaining buffer to spend for the rest of the month'}).`
            : 'No overall monthly budget ceiling is set. Setting an explicit threshold anchors monthly discipline.'
    }
- **Projected End-of-Month Savings:** If you spend your full expected budget, your projected net savings will be **${fmt(income - budget)}** (${income > 0 ? (((income - budget) / income) * 100).toFixed(1) : 0}% projected savings rate).
- **Savings Momentum:** You hold **${fmt(totalSavings)}** in cumulative reserves.${goalProjection}${horizonNote}

### 2. Key Insights
${
    overBudgetCats.length > 0
        ? overBudgetCats.map((c: any) => `- **Alert - Over Budget:** **${c.name}** has already spent **${fmt(c.spent || 0)}** against an expected monthly limit of ${fmt(c.budget)} (${fmt((c.spent || 0) - c.budget)} over limit).`).join('\n')
        : '- **Budget Adherence:** None of your categories currently exceed their designated full-month budget caps.'
}
${
    topCat
        ? `- **Primary Cost Driver:** **${topCat.name}** accounts for your largest outlay to date at **${fmt(topCatSpent)}** (${totalExpenses > 0 ? ((topCatSpent / totalExpenses) * 100).toFixed(1) : 0}% of expenses logged so far).`
        : ''
}
- **Recurring Bills:** Subscriptions and recurring bills account for **${fmt(recurringTotal)}/month** (${income > 0 ? ((recurringTotal / income) * 100).toFixed(1) : 0}% of net income).

### 3. Actionable Recommendations
1. **Target Highest Cost Driver:** Restrict discretionary spending in **${actionCat ? actionCat.name : 'variable categories'}** to ${fmt(suggestedCatBudget)}.
   [[ACTION:SET_CATEGORY_BUDGET|${actionCat ? actionCat.id : 'default'}|${suggestedCatBudget}|Set ${actionCat ? actionCat.name : 'Category'} Budget to ${fmt(suggestedCatBudget)}]]
2. **Automate Target Savings:** Commit to depositing at least 20% of your net income on payday into savings.
   [[ACTION:SET_SAVINGS_DEPOSIT|${suggestedDeposit}|Set Monthly Savings Deposit to ${fmt(suggestedDeposit)}]]
3. **Set Monthly Ceiling:** Establish an overall monthly spending limit of ${fmt(suggestedBudget)} to secure cash flow.
   [[ACTION:SET_MONTHLY_BUDGET|${suggestedBudget}|Set Overall Monthly Budget to ${fmt(suggestedBudget)}]]
4. **Build Safety Buffer:** Ensure your cumulative savings target covers 3 to 6 months of baseline living costs (${fmt((budget > 0 ? budget : totalExpenses) * 3)}–${fmt((budget > 0 ? budget : totalExpenses) * 6)}).`;
// Close generateDynamicAnalysis function
}
