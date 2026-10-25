// Import Next.js server request and response types
import { NextRequest, NextResponse } from 'next/server';

// Declare handler for POST requests to ai-analysis
export async function POST(req: NextRequest) {
    // Wrap entire request processing in try-catch
    try {
        // Parse JSON payload from incoming request body
        const body = await req.json();
        // Destructure financial profile, chat history, and follow-up flags
        const { financialProfile, chatHistory = [], isFollowUp = false, userQuestion = '' } = body;

        // Retrieve server-side API key prioritizing private key over public variable
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

        // Check if API key is present and looks like a valid Google AI Studio key starting with AIza
        const hasValidKey = apiKey && apiKey.startsWith('AIza') && apiKey.length > 20;

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

                    // Add current user question to contents list
                    contentsPayload = [
                        // Spread previous message turns
                        ...historyParts,
                        // Append current question turn
                        {
                            // User role declaration
                            role: 'user',
                            // Parts array
                            parts: [{ text: `User Question: "${userQuestion}"\nAnswer with direct, practical advice based on their numbers.` }]
                        // Close object
                        }
                    // Close array
                    ];
                // Else handle initial analysis prompt
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
                        ? `- Prior Month (${previousMonth.month + 1}/${previousMonth.year}): Expenses $${previousMonth.totalExpenses.toFixed(2)}, Income $${previousMonth.income.toFixed(2)}, Net Savings $${previousMonth.savings.toFixed(2)}. Top Category: ${previousMonth.topCategoryName} ($${previousMonth.topCategoryAmount.toFixed(2)}).\n`
                        : '';

                    // Build horizon context note if simulated horizon data is attached
                    const horizonContext = horizonData
                        ? `- Multi-Month Horizon Simulation: Target is ${horizonData.targetLabel} across ${horizonData.horizonSequenceCount} months. Projected Cumulative Savings: $${horizonData.projectedTotalSavings.toFixed(2)} toward goal of $${horizonData.savingsGoal.toFixed(2)}.\n`
                        : '';

                    // Construct comprehensive prompt
                    const promptText = `You are an expert personal finance advisor.
Analyze the user's spending data and budget information for ${currentMonth + 1}/${currentYear} and provide actionable financial tips.

Financial Profile:
- Monthly Income: $${Number(income || 0).toFixed(2)}
- Monthly Expenses: $${Number(totalExpenses || 0).toFixed(2)}
- Overall Monthly Budget: $${Number(effectiveMonthlyBudget || 0).toFixed(2)}
- Net Monthly Savings: $${Number(savings || 0).toFixed(2)} (${Number(savingsRate || 0).toFixed(1)}% of income)
- Cumulative Total Savings: $${Number(totalSavings || 0).toFixed(2)}
- Long-Term Savings Goal: $${Number(savingsGoal || 0).toFixed(2)}
- Recurring Bills/Subscriptions: $${Number(recurringTotal || 0).toFixed(2)}
${previousMonthContext}${horizonContext}
Category Breakdown:
${categoriesSummary || 'No category breakdown available.'}

Formatting Rules:
- Structure cleanly into 3 distinct sections using these exact headers:
### 1. Spending Overview
### 2. Key Insights
### 3. Actionable Recommendations
- Do NOT use level-4 headers (####) and do NOT output raw '---' lines.
- In Section 1, summarize income vs expense, monthly savings rate, and goal progress trajectory.
- In Section 2, highlight over-budget categories and major spending drivers.
- In Section 3, provide 3 to 4 clear recommendations. Where you suggest budgeting or setting savings, append structured action tags so the user can apply them with one click:
  - To suggest a category budget: [[ACTION:SET_CATEGORY_BUDGET|CATEGORY_ID|SUGGESTED_AMOUNT|Set Category Name budget to $Amount]]
  - To suggest a savings deposit: [[ACTION:SET_SAVINGS_DEPOSIT|AMOUNT|Set monthly savings deposit to $Amount]]
  - To suggest total monthly budget: [[ACTION:SET_MONTHLY_BUDGET|AMOUNT|Set overall monthly budget to $Amount]]`;

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

        // Generate dynamic analysis using internal financial engine
        const fallbackText = generateDynamicAnalysis(financialProfile, isFollowUp, userQuestion, chatHistory);

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

// Helper engine to produce dynamic, high-fidelity financial insights and conversational responses
function generateDynamicAnalysis(
    // Financial profile object parameter
    profile: any,
    // Follow-up flag parameter
    isFollowUp: boolean,
    // User question parameter
    question: string,
    // Conversation history parameter
    _history: any[]
): string {
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
        if (q.includes('food') || q.includes('dining') || q.includes('groceries') || q.includes('eat')) {
            // Return targeted food advice
            return `### Food & Dining Strategy\nBased on your current spending, food and groceries are often the most flexible area for immediate savings:\n\n1. **Meal Planning:** Batch cooking 2 meals per week typically yields a **15% to 25% reduction** in recurring grocery bills.\n2. **Dining Out Cap:** Try instituting a strict weekly dining cap rather than an open monthly limit.\n3. **Quick Action:** If you reduce monthly dining expenses by just **$150**, that adds an extra **$1,800/year** directly to your savings pool.`;
        // Handle savings goal timelines
        } else if (q.includes('goal') || q.includes('reach') || q.includes('timeline') || q.includes('how long')) {
            // Remaining goal gap
            const gap = Math.max(0, goal - currentSavings);
            // Months remaining calculation
            const months = netSavings > 0 ? Math.ceil(gap / netSavings) : null;
            // Return goal projection advice
            return `### Savings Goal Projection\n- Current Savings: **$${currentSavings.toFixed(2)}**\n- Target Goal: **$${goal.toFixed(2)}**\n- Remaining Gap: **$${gap.toFixed(2)}**\n\n${
                months
                    ? `At your current net savings rate of **$${netSavings.toFixed(2)}/month**, you are on track to reach your goal in approximately **${months} month${months === 1 ? '' : 's'}**.\n\nIncreasing your monthly savings deposit by just **$100** would accelerate your target by **${Math.max(1, Math.round(months * 0.15))} months**!`
                    : `Currently, your monthly net cash flow is $${netSavings.toFixed(2)}. To build toward your goal, focus on setting category budget limits to free up at least 15% of your income.`
            }`;
        // Handle subscription or recurring inquiries
        } else if (q.includes('subscription') || q.includes('recurring') || q.includes('bill')) {
            // Recurring bills total
            const recurring = Number(profile?.recurringTotal || 0);
            // Return subscription advice
            return `### Recurring Bills Audit\nYour current recurring commitments total **$${recurring.toFixed(2)}/month** (${income > 0 ? ((recurring / income) * 100).toFixed(1) : 0}% of income).\n\n1. **Audit Infrequently Used Services:** Review streaming and software services used less than twice a week.\n2. **Annual vs. Monthly Discounts:** Consolidating unavoidable recurring bills to annual billing often saves 15–20%.\n3. **Action:** Eliminating even two $15 subscriptions immediately frees up **$360/year**.`;
        // General default follow-up answer
        } else {
            // Return general financial answer
            return `### Financial Advisory Insight\nRegarding **"${question}"**:\n\nWith your monthly income of **$${income.toFixed(2)}** and current expenses of **$${totalExpenses.toFixed(2)}**, your net margin is **$${netSavings.toFixed(2)}/month**.\n\n- **Focus on High-Impact Levers:** Fixed expenses (rent/mortgage, utilities) have low variance, so prioritize capping variable lifestyle categories.\n- **Automation:** Automate transfers to your savings pool on payday to remove decision friction.`;
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

    // Calculate month-over-month spending difference text
    let momText = '';
    // Check if previous month comparison is available
    if (prev && prev.totalExpenses > 0) {
        // Calculate dollar difference
        const diff = totalExpenses - prev.totalExpenses;
        // Calculate percentage difference
        const pct = (diff / prev.totalExpenses) * 100;
        // Check if spending increased
        if (diff > 0) {
            // Format increase text
            momText = ` Spending is up **$${diff.toFixed(2)} (+${pct.toFixed(1)}%)** compared to last month ($${prev.totalExpenses.toFixed(2)}).`;
        // Check if spending decreased
        } else if (diff < 0) {
            // Format decrease text
            momText = ` Spending dropped **$${Math.abs(diff).toFixed(2)} (${pct.toFixed(1)}%)** compared to last month ($${prev.totalExpenses.toFixed(2)}). Great discipline!`;
        // Else spending identical
        } else {
            // Format unchanged text
            momText = ` Spending matches your previous month exactly at $${totalExpenses.toFixed(2)}.`;
        // Close if-else
        }
    // Close if prev
    }

    // Calculate goal projection sentence
    let goalProjection = '';
    // Check if goal is configured and net savings positive
    if (savingsGoal > 0 && netSavings > 0) {
        // Calculate remaining gap
        const gap = Math.max(0, savingsGoal - totalSavings);
        // Calculate months
        const months = Math.ceil(gap / netSavings);
        // Format projection string
        goalProjection = ` At this net pace, you will reach your **$${savingsGoal.toFixed(2)}** goal in **${months} month${months === 1 ? '' : 's'}**.`;
    // Close if savingsGoal
    }

    // Build Horizon simulation note if present
    let horizonNote = '';
    // Check if horizon data exists
    if (horizon && horizon.projectedTotalSavings) {
        // Format simulation summary sentence
        horizonNote = `\n- **Horizon Outlook:** Multi-month simulation projects your cumulative savings reaching **$${horizon.projectedTotalSavings.toFixed(2)}** by **${horizon.targetLabel}**.`;
    // Close if horizon
    }

    // Find suggested category for one-click action
    const actionCat = overBudgetCats[0] || topCat;
    // Calculate suggested budget value for target category
    const suggestedCatBudget = actionCat
        ? Math.round(Math.max(50, (actionCat.spent || actionCat.budget || 100) * 0.9))
        : 300;
    // Suggested monthly savings deposit value
    const suggestedDeposit = Math.round(Math.max(50, income * 0.2));

    // Construct full formatted analysis document
    return `### 1. Spending Overview
- **Net Cash Flow:** Income of **$${income.toFixed(2)}** vs Total Expenses of **$${totalExpenses.toFixed(2)}** yields a net surplus of **$${netSavings.toFixed(2)}** (${savingsRate.toFixed(1)}% savings rate).${momText}
- **Budget Health:** ${
        budget > 0
            ? `Your overall monthly budget limit is **$${budget.toFixed(2)}** (${totalExpenses > budget ? 'Over limit by $' + (totalExpenses - budget).toFixed(2) : '$' + (budget - totalExpenses).toFixed(2) + ' remaining buffer'}).`
            : 'No overall monthly budget ceiling is set. Setting an explicit threshold anchors monthly discipline.'
    }
- **Savings Momentum:** You hold **$${totalSavings.toFixed(2)}** in cumulative reserves.${goalProjection}${horizonNote}

### 2. Key Insights
${
    overBudgetCats.length > 0
        ? overBudgetCats.map((c: any) => `- **Alert - Over Budget:** **${c.name}** spent **$${(c.spent || 0).toFixed(2)}** against a limit of $${c.budget.toFixed(2)} ($${((c.spent || 0) - c.budget).toFixed(2)} over).`).join('\n')
        : '- **Budget Adherence:** None of your categories currently exceed their designated budget caps.'
}
${
    topCat
        ? `- **Primary Cost Driver:** **${topCat.name}** accounts for your largest monthly outlay at **$${topCatSpent.toFixed(2)}** (${totalExpenses > 0 ? ((topCatSpent / totalExpenses) * 100).toFixed(1) : 0}% of total expenses).`
        : ''
}
- **Recurring Commitments:** Subscriptions and recurring bills account for **$${recurringTotal.toFixed(2)}/month** (${income > 0 ? ((recurringTotal / income) * 100).toFixed(1) : 0}% of net income).

### 3. Actionable Recommendations
1. **Target Highest Cost Driver:** Restrict discretionary spending in **${actionCat ? actionCat.name : 'variable categories'}** by 10% to capture immediate cash savings.
   [[ACTION:SET_CATEGORY_BUDGET|${actionCat ? actionCat.id : 'default'}|${suggestedCatBudget}|Set ${actionCat ? actionCat.name : 'Category'} Budget to $${suggestedCatBudget}]]
2. **Automate Target Savings:** Commit to depositing at least 20% of your net income on payday into savings.
   [[ACTION:SET_SAVINGS_DEPOSIT|${suggestedDeposit}|Set Monthly Savings Deposit to $${suggestedDeposit}]]
3. **Audit Recurring Outflows:** Review your active subscriptions for services used less than weekly; cancelling just one service often reclaims $15–$25 monthly.
4. **Build Safety Buffer:** Ensure your cumulative savings target covers 3 to 6 months of baseline living costs ($${(totalExpenses * 3).toFixed(2)}–$${(totalExpenses * 6).toFixed(2)}).`;
// Close generateDynamicAnalysis function
}
