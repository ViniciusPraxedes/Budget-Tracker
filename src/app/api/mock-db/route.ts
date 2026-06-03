// Import NextRequest and NextResponse from next/server to handle incoming requests and responses
import { NextRequest, NextResponse } from 'next/server';
// Import the fs module to read and write database files on local disk
import fs from 'fs';
// Import the path module to resolve file path locations in the project directory
// Import the path module to resolve file path locations in the project directory
import path from 'path';
// Import default mock data from utils
import { defaultCategories, defaultIncome } from '../../../utils/mockData';

// Force Next.js API route to be dynamic, preventing aggressive caching of mock data
export const dynamic = 'force-dynamic';

// Define the Shape of individual expense item
interface Expense {
    // Unique identifier for the expense item
    id: string;
    // Name of the expense
    name: string;
    // Amount of the expense
    amount: number;
    // Day of payment
    paymentDay: number;
    // Flag if expense recurring
    isRecurring?: boolean;
// End of expense interface
}

// Define the Category structure
interface Category {
    // Unique identifier for category
    id: string;
    // Name of category
    name: string;
    // Color code
    color: string;
    // Expenses list
    expenses: Expense[];
    // Position ordering index
    order?: number;
// End of category interface
}

// Define monthly budget data structure
interface MonthData {
    // Month index from 0 to 11
    month: number;
    // Calendar year number
    year: number;
    // Total income for the month
    income: number;
    // List of categories
    categories: Category[];
// End of MonthData interface
}

// Define mock user schema containing preferences and monthly budgets
interface MockUser {
    // User total savings amount
    totalSavings: number;
    // Default start month
    defaultMonth: number | null;
    // Default start year
    defaultYear: number | null;
    // Dictionary mapping month keys to month data
    months: Record<string, MonthData>;
// End of MockUser interface
}

// Define database schema containing user records
interface MockDatabase {
    // Dictionary mapping user IDs to user objects
    users: Record<string, MockUser>;
// End of MockDatabase interface
}

// Helper to generate a unique random string ID for mock items
const generateId = () => {
    // Returns a random 9-character alphanumeric string
    return Math.random().toString(36).substr(2, 9);
// End of generateId function
};

// Helper function to resolve the absolute path of mock-db.json in the project root
const getDbPath = () => {
    // Joins current working directory with mock-db.json
    return path.join(process.cwd(), 'mock-db.json');
// End of getDbPath function
};

// Helper function to read the mock database file from disk and return its parsed contents
const readDb = (): MockDatabase => {
    // Resolve database file path
    const filePath = getDbPath();
    // Check if the mock database file does not exist
    if (!fs.existsSync(filePath)) {
        // Construct the default initial database state with default mock data
        const initialDb: MockDatabase = {
            // Setup the users dictionary mapping
            users: {
                // Initialize settings and default data for the test-user
                'test-user': {
                    // Set initial savings to 15000
                    totalSavings: 15000,
                    // Set default month to current month
                    defaultMonth: new Date().getMonth(),
                    // Set default year to current year
                    defaultYear: new Date().getFullYear(),
                    // Initialize months mapping dictionary
                    months: {
                        // Pre-populate with the current month key and default categories list
                        [`${new Date().getFullYear()}-${new Date().getMonth()}`]: {
                            // Month index 0-11
                            month: new Date().getMonth(),
                            // Year number
                            year: new Date().getFullYear(),
                            // Initial income amount from mockData
                            income: defaultIncome,
                            // Initial category configuration from mockData
                            categories: defaultCategories
                        // End of month key object
                        }
                    // Close months dictionary
                    }
                // End of test-user object
                }
            // Close users dictionary
            }
        // End of initialDb definition
        };
        // Write the initial database state to local disk in JSON format
        fs.writeFileSync(filePath, JSON.stringify(initialDb, null, 2), 'utf-8');
        // Return initial database object
        return initialDb;
    // End of if condition
    }
    // Read existing database file contents
    const content = fs.readFileSync(filePath, 'utf-8');
    // Parse the content and return database object
    return JSON.parse(content) as MockDatabase;
// End of readDb function
};

// Helper function to serialize database state to disk
const writeDb = (db: MockDatabase) => {
    // Resolve absolute path to database file
    const filePath = getDbPath();
    // Write database object formatted with indentation
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
// End of writeDb function
};

// GET handler to fetch user settings or specific month's data
export async function GET(request: NextRequest) {
    // Parse query parameters from request URL
    const { searchParams } = new URL(request.url);
    // Get userId query parameter value
    const userId = searchParams.get('userId');
    // Get monthKey query parameter value
    const monthKey = searchParams.get('monthKey');
    // Validate if userId parameter is missing
    if (!userId) {
        // Return 400 status code with JSON error message
        return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    // End of validation check
    }
    // Read current database state from disk
    const db = readDb();
    // Retrieve user record from database
    const user = db.users[userId];
    // Check if user record was not found
    if (!user) {
        // Return empty settings and months dictionary
        return NextResponse.json({
            // Set total savings to zero
            totalSavings: 0,
            // Null landing month
            defaultMonth: null,
            // Null landing year
            defaultYear: null,
            // Empty months mapping
            months: {}
        // Close response body
        });
    // End of user existence check
    }
    // Check if a specific month was requested
    if (monthKey) {
        // Retrieve the data for the specified month
        const monthData = user.months[monthKey];
        // If the month data exists in the database
        if (monthData) {
            // Return month details directly
            return NextResponse.json(monthData);
        // If the month data does not exist
        } else {
            // Parse year and month values from key string
            const [y, m] = monthKey.split('-');
            // Parse year string to integer
            const yearNum = parseInt(y, 10);
            // Parse month string to integer
            const monthNum = parseInt(m, 10);
            // Get previous month date
            const prevDate = new Date(yearNum, monthNum - 1, 1);
            // Construct the previous month key YYYY-M
            const prevKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;
            // Search database for previous month data
            const prevData = user.months[prevKey];
            // Check if previous month data exists
            if (prevData) {
                // Copy categories and filter recurring expenses
                const newCategories = prevData.categories.map(cat => {
                    // Return mapped category object
                    return {
                        // Set generated category ID
                        id: generateId(),
                        // Copy category name
                        name: cat.name,
                        // Copy color value
                        color: cat.color,
                        // Copy ordering index
                        order: cat.order,
                        // Map filtered recurring expenses
                        expenses: cat.expenses
                            // Filter for recurring items
                            .filter(exp => {
                                // Returns true if recurring flag set
                                return !!exp.isRecurring;
                            // End of filter call
                            })
                            // Map recurring expense items
                            .map(exp => {
                                // Return expense copy with new ID
                                return {
                                    // Set generated expense ID
                                    id: generateId(),
                                    // Copy expense name
                                    name: exp.name,
                                    // Copy amount
                                    amount: exp.amount,
                                    // Copy payment day
                                    paymentDay: exp.paymentDay,
                                    // Copy recurring flag
                                    isRecurring: exp.isRecurring
                                // End of expense mapping object
                                };
                            // End of map call
                            })
                    // End of category mapping object
                    };
                // End of categories mapping
                });
                // Initialize the new month data structure
                const newMonth: MonthData = {
                    // Set month index
                    month: monthNum,
                    // Set year number
                    year: yearNum,
                    // Set income to match previous month
                    income: prevData.income || 0,
                    // Set cloned categories list
                    categories: newCategories
                // End of newMonth definition
                };
                // Store new month data in user months dictionary
                user.months[monthKey] = newMonth;
                // Write updated database back to disk
                writeDb(db);
                // Return newly initialized month data
                return NextResponse.json(newMonth);
            // End of prevData existence check
            }
            // Return default empty month data structure
            return NextResponse.json({
                // Set requested month
                month: monthNum,
                // Set requested year
                year: yearNum,
                // Zero default income
                income: 0,
                // Empty categories list
                categories: []
            // Close response body
            });
        // End of monthData check
        }
    // End of monthKey check
    }
    // Return complete user object containing settings and budgets
    return NextResponse.json(user);
// End of GET handler
}

// POST handler to update user settings or monthly budget data
export async function POST(request: NextRequest) {
    // Parse JSON payload from request body
    const body = await request.json();
    // Retrieve userId from body
    const userId = body.userId;
    // Retrieve action from body
    const action = body.action;
    // Validate if userId parameter is missing
    if (!userId) {
        // Return 400 status code with JSON error message
        return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    // End of validation check
    }
    // Read current database state from disk
    const db = readDb();
    // Check if user record does not exist in database
    if (!db.users[userId]) {
        // Create initial empty profile for user ID
        db.users[userId] = {
            // Zero savings
            totalSavings: 0,
            // Null month
            defaultMonth: null,
            // Null year
            defaultYear: null,
            // Empty months
            months: {}
        // Close object definition
        };
    // End of user creation check
    }
    // Retrieve user reference
    const user = db.users[userId];
    // Check if update settings action requested
    if (action === 'update_settings') {
        // Retrieve settings payload from request body
        const settings = body.settings;
        // If settings object is provided
        if (settings) {
            // If totalSavings is defined
            if (typeof settings.totalSavings === 'number') {
                // Update total savings
                user.totalSavings = settings.totalSavings;
            // End of totalSavings check
            }
            // If defaultMonth is defined
            if (typeof settings.defaultMonth === 'number' || settings.defaultMonth === null) {
                // Update default month index
                user.defaultMonth = settings.defaultMonth;
            // End of defaultMonth check
            }
            // If defaultYear is defined
            if (typeof settings.defaultYear === 'number' || settings.defaultYear === null) {
                // Update default year number
                user.defaultYear = settings.defaultYear;
            // End of defaultYear check
            }
        // End of settings object check
        }
    // Check if update month data action requested
    } else if (action === 'update_month') {
        // Retrieve monthKey from body
        const monthKey = body.monthKey;
        // Retrieve monthData from body
        const monthData = body.monthData;
        // Check if both month key and data are provided
        if (monthKey && monthData) {
            // Update month details in user months mapping
            user.months[monthKey] = monthData;
        // End of values validation check
        }
    // Handle invalid action parameter
    } else {
        // Return 400 status with invalid action message
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    // End of action checks
    }
    // Serialize database updates to disk
    writeDb(db);
    // Return updated user profile
    return NextResponse.json(user);
// End of POST handler
}
