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

                    // Add current user question to contents list with currency rule reminder
                    contentsPayload = [
                        // Spread previous message turns
                        ...historyParts,
                        // Append current question turn
                        {
                            // User role declaration
                            role: 'user',
                            // Parts array
                            parts: [{ text: `User Question: "${userQuestion}"\nImportant: The user's active currency is Swedish kronor (${currencyUnit}). ALWAYS format monetary values in ${currencyUnit} (e.g. 1 500 ${currencyUnit}). Never use USD or "$". Provide concise, direct financial advice.` }]
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
                        focusGuidance = `FOCUS: Cost-cutting, discretionary expense reduction, and over-budget category diagnosis. Prioritize identifying non-essential outlays that can be cut immediately.`;
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

CRITICAL CURRENCY INSTRUCTION:
- The user's active currency is Swedish kronor (${currencyUnit}).
- ALWAYS format and display all currency numbers in ${currencyUnit} (e.g., "12 500 ${currencyUnit}" or "500 ${currencyUnit}").
- NEVER use USD, US dollars, or the "$" dollar sign under ANY circumstance.

Analytical Focus:
${focusGuidance}

Financial Profile:
- Monthly Income: ${formatAmount(income || 0)}
- Monthly Expenses: ${formatAmount(totalExpenses || 0)}
- Overall Monthly Budget: ${formatAmount(effectiveMonthlyBudget || 0)}
- Net Monthly Savings: ${formatAmount(savings || 0)} (${Number(savingsRate || 0).toFixed(1)}% of income)
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
- In Section 1, summarize income vs expense, monthly savings rate, and goal progress trajectory using ${currencyUnit}.
- In Section 2, highlight over-budget categories and major spending drivers.
- In Section 3, provide 3 to 4 clear recommendations. Where you suggest budgeting or setting savings, append structured action tags formatted in ${currencyUnit} so the user can apply them with one click:
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

        // Generate dynamic analysis using internal financial engine with Swedish kronor localization
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

// Helper engine to produce dynamic localized financial insights and conversational responses in Swedish kronor
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
            // Return targeted food advice
            return `### Mat & Restaurang Strategi\nBaserat på dina aktuella kostnader är mat och restaurangbesök ett av de enklaste områdena för snabba besparingar:\n\n1. **Veckoplanering:** Att laga matlådor 2 gånger i veckan minskar vanligtvis matkostnaderna med **15% till 25%**.\n2. **Utemat-budget:** Sätt ett strikt tak per vecka för restaurang och fika istället för en öppen månadspott.\n3. **Besparingspotential:** Om du minskar utemat med **${fmt(1500)}/månad**, ger det **${fmt(18000)} extra per år** rakt in i ditt sparande.`;
        // Handle savings goal timelines
        } else if (q.includes('goal') || q.includes('reach') || q.includes('timeline') || q.includes('how long') || q.includes('mål') || q.includes('spar')) {
            // Remaining goal gap
            const gap = Math.max(0, goal - currentSavings);
            // Months remaining calculation
            const months = netSavings > 0 ? Math.ceil(gap / netSavings) : null;
            // Return goal projection advice
            return `### Sparmålsprognos\n- Nuvarande sparande: **${fmt(currentSavings)}**\n- Sparmål: **${fmt(goal)}**\n- Kvar till målet: **${fmt(gap)}**\n\n${
                months
                    ? `Med ditt nuvarande sparande på **${fmt(netSavings)}/månad** beräknas du nå ditt mål om cirka **${months} månad${months === 1 ? '' : 'er'}**.\n\nOm du ökar ditt månadssparande med **${fmt(1000)}** kortar du tiden med ytterligare **${Math.max(1, Math.round(months * 0.15))} månader**!`
                    : `För närvarande är ditt månatliga kassaflöde ${fmt(netSavings)}. För att nå målet rekommenderas att sätta tydliga kategoribudgetar för att frigöra minst 15% av inkomsten.`
            }`;
        // Handle subscription or recurring inquiries
        } else if (q.includes('subscription') || q.includes('recurring') || q.includes('bill') || q.includes('abonnemang') || q.includes('räkning')) {
            // Recurring bills total
            const recurring = Number(profile?.recurringTotal || 0);
            // Return subscription advice
            return `### Granskning av Fasta Avgifter\nDina fasta och återkommande utgifter uppgår till **${fmt(recurring)}/månad** (${income > 0 ? ((recurring / income) * 100).toFixed(1) : 0}% av inkomsten).\n\n1. **Rensa oanvända tjänster:** Gå igenom streamingtjänster och appar som används mer sällan än en gång i veckan.\n2. **Årsbetalning:** Att byta månadsprenumerationer till årsabonnemang ger ofta 15–20% rabatt.\n3. **Åtgärd:** Att säga upp två abonnemang på 150 ${unit} sparar direkt **${fmt(3600)} per år**.`;
        // General default follow-up answer
        } else {
            // Return general financial answer
            return `### Finansiell Insikt\nAngående **"${question}"**:\n\nMed en månadsinkomst på **${fmt(income)}** och utgifter på **${fmt(totalExpenses)}** har du en marginal på **${fmt(netSavings)}/månad**.\n\n- **Fokusera på rörliga kostnader:** Fasta kostnader är svårare att justera snabbt, så sätt budgettak på de rörliga kategorierna.\n- **Automatisera sparandet:** För över ditt sparande direkt på lönedagen för att säkerställa att du når dina sparmål.`;
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
        // Calculate difference
        const diff = totalExpenses - prev.totalExpenses;
        // Calculate percentage difference
        const pct = (diff / prev.totalExpenses) * 100;
        // Check if spending increased
        if (diff > 0) {
            // Format increase text
            momText = ` Utgifterna har ökat med **${fmt(diff)} (+${pct.toFixed(1)}%)** jämfört med förra månaden (${fmt(prev.totalExpenses)}).`;
        // Check if spending decreased
        } else if (diff < 0) {
            // Format decrease text
            momText = ` Utgifterna minskade med **${fmt(Math.abs(diff))} (${pct.toFixed(1)}%)** jämfört med förra månaden (${fmt(prev.totalExpenses)}). Mycket bra!`;
        // Else spending identical
        } else {
            // Format unchanged text
            momText = ` Utgifterna är exakt desamma som förra månaden (${fmt(totalExpenses)}).`;
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
        goalProjection = ` I denna takt når du ditt mål på **${fmt(savingsGoal)}** om cirka **${months} månad${months === 1 ? '' : 'er'}**.`;
    // Close if savingsGoal
    }

    // Build Horizon simulation note if present
    let horizonNote = '';
    // Check if horizon data exists
    if (horizon && horizon.projectedTotalSavings) {
        // Format simulation summary sentence
        horizonNote = `\n- **Horisontprognos:** Simuleringen visar ett beräknat ackumulerat sparande på **${fmt(horizon.projectedTotalSavings)}** till **${horizon.targetLabel}**.`;
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

    // Specific section generation based on insightType
    if (insightType === 'cost_cutting') {
        return `### 1. Spending Overview
- **Kassautflöde:** Totala utgifter uppgår till **${fmt(totalExpenses)}** mot en inkomst på **${fmt(income)}** (${fmt(netSavings)} i överskott).${momText}
- **Budgetstatus:** ${budget > 0 ? `Total budget är satt till **${fmt(budget)}** (${totalExpenses > budget ? 'Över med ' + fmt(totalExpenses - budget) : fmt(budget - totalExpenses) + ' i marginal'}).` : 'Inget totalt budgettak är satt.'}

### 2. Key Insights
${overBudgetCats.length > 0
    ? overBudgetCats.map((c: any) => `- **Varning - Över Budget:** Kategori **${c.name}** har kostat **${fmt(c.spent || 0)}** mot taket på ${fmt(c.budget)} (${fmt((c.spent || 0) - c.budget)} över budget).`).join('\n')
    : '- **Budgetdisciplin:** Inga kategorier överskrider för närvarande sina budgetgränser.'}
${topCat ? `- **Största Kostnadspost:** **${topCat.name}** står för **${fmt(topCatSpent)}** (${totalExpenses > 0 ? ((topCatSpent / totalExpenses) * 100).toFixed(1) : 0}% av dina utgifter).` : ''}

### 3. Actionable Recommendations
1. **Sänk ${actionCat ? actionCat.name : 'rörliga kostnader'}:** Sätt en månatlig gräns på ${fmt(suggestedCatBudget)} för att spara direkt.
   [[ACTION:SET_CATEGORY_BUDGET|${actionCat ? actionCat.id : 'default'}|${suggestedCatBudget}|Sätt ${actionCat ? actionCat.name : 'Kategori'} budget till ${fmt(suggestedCatBudget)}]]
2. **Sätt Total Budget:** Begränsa månadens totala utgifter till ${fmt(suggestedBudget)}.
   [[ACTION:SET_MONTHLY_BUDGET|${suggestedBudget}|Sätt Total Månadsbudget till ${fmt(suggestedBudget)}]]
3. **Minska Impulsköp:** Inför en 48-timmars betänketid för alla inköp över ${fmt(500)}.`;
    }

    if (insightType === 'savings_goal') {
        return `### 1. Spending Overview
- **Sparkvot:** Du sparar för närvarande **${savingsRate.toFixed(1)}%** av din inkomst (${fmt(netSavings)}/månad). En hälsosam sparkvot ligger på minst 20%.
- **Reserver:** Du har totalt **${fmt(totalSavings)}** i sparande.${goalProjection}

### 2. Key Insights
- **Buffertstatus:** Tre månaders nödbuffert motsvarar **${fmt(totalExpenses * 3)}**. ${totalSavings >= totalExpenses * 3 ? 'Din buffert är fullt säkrad!' : `Du behöver ytterligare ${fmt(Math.max(0, (totalExpenses * 3) - totalSavings))} för full 3-månaders buffert.`}
${horizonNote}

### 3. Actionable Recommendations
1. **Automatisera Sparandet:** Sätt en automatisk överföring på minst 20% av din inkomst varje lönedag.
   [[ACTION:SET_SAVINGS_DEPOSIT|${suggestedDeposit}|Sätt Månadssparande till ${fmt(suggestedDeposit)}]]
2. **Accelerera Målet:** Genom att öka månadssparandet med ${fmt(1000)} når du ditt sparmål betydligt snabbare.
3. **Optimera Bufferten:** Håll 3 månaders utgifter på ett lättillgängligt räntekonto.`;
    }

    if (insightType === 'subscriptions') {
        return `### 1. Spending Overview
- **Fasta & Återkommande Avgifter:** Totalt **${fmt(recurringTotal)}/månad** (${income > 0 ? ((recurringTotal / income) * 100).toFixed(1) : 0}% av din inkomst).
- **Årskostnad för Abonnemang:** Detta motsvarar **${fmt(recurringTotal * 12)} per år**.

### 2. Key Insights
- **Abonnemangsfokus:** Återkommande utgifter dras automatiskt och glöms lätt bort.
- **Optimeringspotential:** Genom att säga upp tjänster som används sällan frigör du direkt månatligt kassaflöde till sparande.

### 3. Actionable Recommendations
1. **Granska Autogiron & Kortdragningar:** Avsluta eller pausa prenumerationer du inte nyttjat de senaste 30 dagarna.
2. **Flytta Sparade Pengar:** För över varje sparad hundralapp direkt till ditt månadssparande.
   [[ACTION:SET_SAVINGS_DEPOSIT|${suggestedDeposit}|Sätt Månadssparande till ${fmt(suggestedDeposit)}]]
3. **Förhandla Fasta Avtal:** Se över elavtal, hemförsäkring och bredband årligen.`;
    }

    // Default: Comprehensive health check
    return `### 1. Spending Overview
- **Kassaflöde:** Inkomst på **${fmt(income)}** mot Totala Utgifter på **${fmt(totalExpenses)}** ger ett nettoöverskott på **${fmt(netSavings)}** (${savingsRate.toFixed(1)}% sparkvot).${momText}
- **Budgethälsa:** ${
        budget > 0
            ? `Ditt månatliga budgettak är **${fmt(budget)}** (${totalExpenses > budget ? 'Över budget med ' + fmt(totalExpenses - budget) : fmt(budget - totalExpenses) + ' kvar i buffert'}).`
            : 'Inget övergripande budgettak är satt. Att sätta en gräns skapar trygghet i vardagen.'
    }
- **Sparande & Mål:** Du har **${fmt(totalSavings)}** i samlade reserver.${goalProjection}${horizonNote}

### 2. Key Insights
${
    overBudgetCats.length > 0
        ? overBudgetCats.map((c: any) => `- **Över Budget:** **${c.name}** har kostat **${fmt(c.spent || 0)}** mot budget på ${fmt(c.budget)} (${fmt((c.spent || 0) - c.budget)} över).`).join('\n')
        : '- **Budgetefterlevnad:** Inga kategorier överskrider för närvarande sina satta budgetramar.'
}
${
    topCat
        ? `- **Största Utgift:** **${topCat.name}** är månadens största kostnad på **${fmt(topCatSpent)}** (${totalExpenses > 0 ? ((topCatSpent / totalExpenses) * 100).toFixed(1) : 0}% av totala utgifter).`
        : ''
}
- **Fasta Räkningar:** Återkommande räkningar och abonnemang uppgår till **${fmt(recurringTotal)}/månad** (${income > 0 ? ((recurringTotal / income) * 100).toFixed(1) : 0}% av inkomsten).

### 3. Actionable Recommendations
1. **Hantera Största Utgiften:** Begränsa utgifter i **${actionCat ? actionCat.name : 'rörliga kategorier'}** till ${fmt(suggestedCatBudget)}.
   [[ACTION:SET_CATEGORY_BUDGET|${actionCat ? actionCat.id : 'default'}|${suggestedCatBudget}|Sätt ${actionCat ? actionCat.name : 'Kategori'} budget till ${fmt(suggestedCatBudget)}]]
2. **Automatisera Sparande:** Sikta på att spara minst 20% av inkomsten direkt på lönedagen.
   [[ACTION:SET_SAVINGS_DEPOSIT|${suggestedDeposit}|Sätt Månadssparande till ${fmt(suggestedDeposit)}]]
3. **Sätt Total Budget:** Etablera en fast budgetram på ${fmt(suggestedBudget)} för att trygga kassaflödet.
   [[ACTION:SET_MONTHLY_BUDGET|${suggestedBudget}|Sätt Total Månadsbudget till ${fmt(suggestedBudget)}]]
4. **Trygghetsbuffert:** Bygg en buffert som motsvarar 3 till 6 månaders basutgifter (${fmt(totalExpenses * 3)}–${fmt(totalExpenses * 6)}).`;
// Close generateDynamicAnalysis function
}
