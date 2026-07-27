export interface Expense {
    id: string;
    name: string;
    amount: number;
    paymentDay: number;
    isRecurring?: boolean;
}

// Category model interface definition
export interface Category {
    // Unique category identifier
    id: string;
    // Name of category
    name: string;
    // Category visual accent color code
    color: string;
    // List of expenses under category
    expenses: Expense[];
    // Display ordering index
    order?: number;
    // Optional monthly budget limit
    budget?: number;
}

export interface PreviewExpense extends Expense {
    alreadyExists: boolean;
    existingExpenseId?: string;
    willUpdate: boolean;
}

export interface PreviewCategory extends Omit<Category, 'expenses'> {
    expenses: PreviewExpense[];
}

export interface MonthData {
    month: number; // 0-11
    year: number;
    income: number;
    categories: Category[];
    monthlySavingsDeposit?: number;
    monthlyBudget?: number;
}

export interface BudgetContextType {
    currentMonth: number;
    currentYear: number;
    income: number;
    categories: Category[];
    totalExpenses: number;
    savings: number;
    monthlySavingsDeposit: number;
    monthlyBudget: number;
    setMonthlyBudget: (amount: number) => void;
    setMonthlySavingsDeposit: (amount: number) => void;
    setIncome: (amount: number) => void;
    addCategory: (name: string, color: string, budget?: number) => Category;
    updateCategory: (id: string, name: string, color: string, budget?: number) => void;
    deleteCategory: (id: string) => void;
    addExpense: (categoryId: string, expense: Omit<Expense, 'id'>) => void;
    updateExpense: (categoryId: string, expense: Expense) => void;
    deleteExpense: (categoryId: string, expenseId: string) => void;
    moveExpense: (oldCategoryId: string, newCategoryId: string, expense: Expense) => void;
    changeMonth: (month: number, year: number) => void;
    copyPreviousMonthData: () => void;
    getRecurringFromPreviousMonth: () => Promise<PreviewCategory[] | null>;
    importRecurringExpenses: (categoriesToMerge: PreviewCategory[]) => Promise<void>;
    moveCategory: (id: string, direction: 'up' | 'down') => void;
    reorderCategories: (newCategories: Category[]) => void;
    reorderExpenses: (categoryId: string, newExpenses: Expense[]) => void;
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
