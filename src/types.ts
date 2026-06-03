export interface Expense {
    id: string;
    name: string;
    amount: number;
    paymentDay: number;
    isRecurring?: boolean;
}

export interface Category {
    id: string;
    name: string;
    color: string;
    expenses: Expense[];
    order?: number;
}

export interface MonthData {
    month: number; // 0-11
    year: number;
    income: number;
    categories: Category[];
}

export interface BudgetContextType {
    currentMonth: number;
    currentYear: number;
    income: number;
    categories: Category[];
    totalExpenses: number;
    savings: number;
    setIncome: (amount: number) => void;
    addCategory: (name: string, color: string) => Category;
    updateCategory: (id: string, name: string, color: string) => void;
    deleteCategory: (id: string) => void;
    addExpense: (categoryId: string, expense: Omit<Expense, 'id'>) => void;
    updateExpense: (categoryId: string, expense: Expense) => void;
    deleteExpense: (categoryId: string, expenseId: string) => void;
    changeMonth: (month: number, year: number) => void;
    copyPreviousMonthData: () => void;
    moveCategory: (id: string, direction: 'up' | 'down') => void;
    reorderCategories: (newCategories: Category[]) => void;
    saveDefaultMonth: (month: number, year: number) => void;
    defaultMonthSettings: { month: number, year: number } | null;
    loadMockData: (income: number, categories: Category[]) => void;
    totalSavings: number;
    updateTotalSavings: (amount: number) => void;
    // Function to add multiple categories at once if they are missing
    addMissingCategories: (missing: { name: string, color: string }[]) => void;
    // Function to add multiple expenses at once (batch import)
    addExpenses: (expenses: { categoryId: string, expense: Omit<Expense, 'id'> }[]) => void;
    // Saved configuration for PDF importing name mappings and ignores
    pdfConfig: { mappings: Record<string, string>; ignored: string[] } | null;
    // Function to save updated PDF configuration preferences
    updatePDFConfig: (config: { mappings: Record<string, string>; ignored: string[] }) => Promise<void>;
    // Function to clear all expenses and reset income for the current month
    clearMonthData: () => void;
}
