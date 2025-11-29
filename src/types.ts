export interface Expense {
    id: string;
    name: string;
    amount: number;
    paymentDay: number;
}

export interface Category {
    id: string;
    name: string;
    color: string;
    expenses: Expense[];
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
    addCategory: (name: string, color: string) => void;
    updateCategory: (id: string, name: string, color: string) => void;
    deleteCategory: (id: string) => void;
    addExpense: (categoryId: string, expense: Omit<Expense, 'id'>) => void;
    updateExpense: (categoryId: string, expense: Expense) => void;
    deleteExpense: (categoryId: string, expenseId: string) => void;
    changeMonth: (month: number, year: number) => void;
    copyPreviousMonthData: () => void;
}
