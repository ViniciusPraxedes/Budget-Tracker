// Import Category and Expense interfaces from types definitions
import { Category, Expense } from '../types';

// Define helper to generate random IDs
const generateId = () => {
    // Generate a 9-character random alphanumeric string
    return Math.random().toString(36).substr(2, 9);
// End of generateId function
};

// Export default income amount for mock initial state from August production data
export const defaultIncome = 25886;

// Export default categories configuration for mock initial state matching August production database
export const defaultCategories: Category[] = [
    // Home category configuration
    {
        // Category ID
        id: 'l1k935laa',
        // Set category name
        name: 'Home',
        // Set color code
        color: '#651FFF',
        // Set ordering index
        order: 0,
        // Define initial expenses from August production data
        expenses: [
            // Jysk expense
            { id: '6vxl4riub', name: 'Jysk AB Swish Jysk A (1 transactions)', amount: 619, paymentDay: 27, isRecurring: false },
            // Dressman expense
            { id: 'ijv8yo6dw', name: 'Dressman', amount: 364, paymentDay: 26, isRecurring: false }
        // End of expenses array
        ]
    // End of Home category
    },
    // Fixed category configuration
    {
        // Category ID
        id: 'zfwz99w2c',
        // Set category name
        name: 'Fixed',
        // Set color code
        color: '#2979FF',
        // Set ordering index
        order: 1,
        // Define initial expenses from August production data
        expenses: [
            // HBO Max expense
            { id: 'exfwk9t7l', name: 'HBO Max (1 transaction)', amount: 89, paymentDay: 8, isRecurring: true },
            // Amazon Prime expense
            { id: 'gpjl6tand', name: 'Amazon Prime (1 transaction)', amount: 69, paymentDay: 1, isRecurring: true },
            // Disney Plus expense
            { id: '540wieu9w', name: 'PAYPAL *DISN', amount: 129.17, paymentDay: 13, isRecurring: true },
            // Netflix expense
            { id: 'dtqmbpvyw', name: 'Netflix', amount: 117, paymentDay: 16, isRecurring: true },
            // YouTube Premium expense
            { id: 'g55f1r0ie', name: 'You Tube Premium  (1 transaction)', amount: 199, paymentDay: 6, isRecurring: true },
            // Gamepass expense
            { id: '475le272g', name: 'Gamepass', amount: 115, paymentDay: 15, isRecurring: true },
            // Klarna expense
            { id: 'rvom5iruw', name: 'Klarna', amount: 832, paymentDay: 17, isRecurring: true },
            // Vimla expense
            { id: '7rsiderre', name: 'Vimla (1 transaction)', amount: 120, paymentDay: 29, isRecurring: true },
            // Unionen expense
            { id: '8yls5rg1g', name: 'UNIONEN (1 transaction)', amount: 235, paymentDay: 2, isRecurring: true },
            // Capio Primar expense
            { id: '7p5zn7t6r', name: 'CAPIO PRIM#R (1 transaction)', amount: 50, paymentDay: 30, isRecurring: true },
            // Folktandvarden expense
            { id: 'htq155v39', name: 'FRISKTANDV (1 transaction)', amount: 65, paymentDay: 29, isRecurring: true },
            // CSN expense
            { id: 'bx47xkajn', name: 'CSN (1 transaction)', amount: 842, paymentDay: 26, isRecurring: true },
            // Unionen A-kassa expense
            { id: 'qcm3vzxwa', name: 'Avier Unione (1 transaction)', amount: 160, paymentDay: 26, isRecurring: true },
            // Nordic Wellness expense
            { id: 't1ysyzuvm', name: 'nordicwell (1 transaction)', amount: 479, paymentDay: 25, isRecurring: true },
            // Vasttrafik expense
            { id: 'n76rllx63', name: 'Västtrafik T Swish Västtr (1 transaction)', amount: 445, paymentDay: 24, isRecurring: true }
        // End of expenses array
        ]
    // End of Fixed category
    },
    // Fun category configuration
    {
        // Category ID
        id: '5x99qkhr3',
        // Set category name
        name: 'Fun',
        // Set color code
        color: '#FF5252',
        // Set ordering index
        order: 2,
        // Define initial expenses from August production data
        expenses: [
            // Ivans Pilsner expense
            { id: 'jkc5xq63j', name: 'Ivans Pilsne (1 transactions)', amount: 95, paymentDay: 27, isRecurring: false },
            // Gotapetter expense
            { id: 'xf03gvw4v', name: 'M/S GOTAPETT (4 transactions)', amount: 267, paymentDay: 27, isRecurring: false },
            // Stora Teatern expense
            { id: '8xt84mz23', name: 'Stora Teater Swish Stora (1 transactions)', amount: 395, paymentDay: 27, isRecurring: false },
            // Amazon SE expense
            { id: 'am4ddnchv', name: 'AMAZON SE* B (1 transactions)', amount: 39, paymentDay: 24, isRecurring: false },
            // Filmstaden expense
            { id: 'okdznm7e9', name: 'FILMSTADEN B (1 transactions)', amount: 116, paymentDay: 24, isRecurring: false },
            // Microsoft Xbox expense
            { id: 'a2jg3f3am', name: 'Microsoft*Xb (1 transactions)', amount: 349.65, paymentDay: 24, isRecurring: false }
        // End of expenses array
        ]
    // End of Fun category
    },
    // Food category configuration
    {
        // Category ID
        id: 'm843pk89m',
        // Set category name
        name: 'Food',
        // Set color code
        color: '#DD2C00',
        // Set ordering index
        order: 3,
        // Set category budget limit
        budget: 5000,
        // Define initial expenses from August production data
        expenses: [
            // Hemkop Molndal expense
            { id: 'fx5b4xusa', name: 'HEMKOP MOLND (3 transactions)', amount: 1045.12, paymentDay: 27, isRecurring: false },
            // Nordstanskebab expense
            { id: 'c8u4avzrm', name: 'NORDSTANSKEB (1 transactions)', amount: 135, paymentDay: 27, isRecurring: false },
            // Karuizawa Sushi expense
            { id: '4ruwqubpl', name: 'KARUIZAWA SU (1 transactions)', amount: 180, paymentDay: 27, isRecurring: false },
            // ICA Kvantum expense
            { id: '9fm4x3gs1', name: 'ICA KVANTUM (1 transactions)', amount: 23, paymentDay: 27, isRecurring: false },
            // Gelateria expense
            { id: 'fg7z0kunf', name: 'GELATERIA PO (1 transactions)', amount: 59, paymentDay: 24, isRecurring: false }
        // End of expenses array
        ]
    // End of Food category
    },
    // Health and beauty category configuration
    {
        // Category ID
        id: 'ptilkn7g6',
        // Set category name
        name: 'Health and beauty',
        // Set color code
        color: '#FF4081',
        // Set ordering index
        order: 4,
        // Set category budget limit
        budget: 500,
        // Define initial expenses from August production data
        expenses: [
            // Kronans Apotek expense
            { id: 'oys4zkfqz', name: 'Kronans Apot (1 transactions)', amount: 390, paymentDay: 27, isRecurring: false },
            // Normal Molndal expense
            { id: 'egtfk3tmc', name: 'NORMAL M@LND (1 transactions)', amount: 124, paymentDay: 27, isRecurring: false }
        // End of expenses array
        ]
    // End of Health and beauty category
    }
];
