import { Category, Expense } from '../types';

// Define helper to generate random IDs
const generateId = () => {
    // Generate a 9-character random alphanumeric string
    return Math.random().toString(36).substr(2, 9);
// End of generateId function
};

// Export default income amount for mock initial state
export const defaultIncome = 45000;

// Export default categories configuration for mock initial state
export const defaultCategories: Category[] = [
    // Housing category configuration
    {
        // Generate random ID
        id: generateId(),
        // Set category name
        name: 'Housing',
        // Set color code
        color: '#FF5722',
        // Set ordering index
        order: 0,
        // Set monthly category budget target limit
        budget: 15000,
        // Define initial expenses
        expenses: [
            // Rent expense
            { id: generateId(), name: 'Rent', amount: 12000, paymentDay: 1, isRecurring: true },
            // Utilities expense
            { id: generateId(), name: 'Utilities', amount: 1500, paymentDay: 5, isRecurring: true },
            // Internet expense
            { id: generateId(), name: 'Internet', amount: 600, paymentDay: 28, isRecurring: true }
        // End of expenses array
        ]
    // End of Housing category
    },
    // Food category configuration
    {
        // Generate random ID
        id: generateId(),
        // Set category name
        name: 'Food',
        // Set color code
        color: '#4CAF50',
        // Set ordering index
        order: 1,
        // Set monthly category budget target limit
        budget: 5000,
        // Define initial expenses
        expenses: [
            // Groceries expense
            { id: generateId(), name: 'Groceries', amount: 3800, paymentDay: 10, isRecurring: false },
            // Dining Out expense
            { id: generateId(), name: 'Dining Out', amount: 1400, paymentDay: 15, isRecurring: false },
            // Coffee expense
            { id: generateId(), name: 'Coffee', amount: 400, paymentDay: 20, isRecurring: false }
        // End of expenses array
        ]
    // End of Food category
    },
    // Transportation category configuration
    {
        // Generate random ID
        id: generateId(),
        // Set category name
        name: 'Transportation',
        // Set color code
        color: '#2196F3',
        // Set ordering index
        order: 2,
        // Set monthly category budget target limit
        budget: 2500,
        // Define initial expenses
        expenses: [
            // Gas expense
            { id: generateId(), name: 'Gas', amount: 1000, paymentDay: 12, isRecurring: false },
            // Car Insurance expense
            { id: generateId(), name: 'Car Insurance', amount: 600, paymentDay: 25, isRecurring: true },
            // Public Transit expense
            { id: generateId(), name: 'Public Transit', amount: 300, paymentDay: 2, isRecurring: false }
        // End of expenses array
        ]
    // End of Transportation category
    },
    // Entertainment category configuration
    {
        // Generate random ID
        id: generateId(),
        // Set category name
        name: 'Entertainment',
        // Set color code
        color: '#9C27B0',
        // Set ordering index
        order: 3,
        // Set monthly category budget target limit
        budget: 1000,
        // Define initial expenses
        expenses: [
            // Netflix expense
            { id: generateId(), name: 'Netflix', amount: 159, paymentDay: 18, isRecurring: true },
            // Spotify expense
            { id: generateId(), name: 'Spotify', amount: 119, paymentDay: 22, isRecurring: true },
            // Movies & Gaming expense
            { id: generateId(), name: 'Movies & Gaming', amount: 300, paymentDay: 14, isRecurring: false }
        // End of expenses array
        ]
    // End of Entertainment category
    },
    // Healthcare category configuration
    {
        // Generate random ID
        id: generateId(),
        // Set category name
        name: 'Healthcare & Wellness',
        // Set color code
        color: '#00BCD4',
        // Set ordering index
        order: 4,
        // Set monthly category budget target limit
        budget: 2000,
        // Define initial expenses
        expenses: [
            // Gym Membership expense
            { id: generateId(), name: 'Gym Membership', amount: 350, paymentDay: 3, isRecurring: true },
            // Pharmacy expense
            { id: generateId(), name: 'Pharmacy & Vitamins', amount: 500, paymentDay: 16, isRecurring: false }
        // End of expenses array
        ]
    // End of Healthcare category
    }
// End of defaultCategories array
];
