import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Expense } from './types';
import { loadExpenses, saveExpenses } from './storage';

interface ExpensesContextValue {
  expenses: Expense[];
  loading: boolean;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  total: number;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(
  undefined
);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpenses().then((data) => {
      setExpenses(data);
      setLoading(false);
    });
  }, []);

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expense,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
    const next = [newExpense, ...expenses];
    setExpenses(next);
    await saveExpenses(next);
  };

  const deleteExpense = async (id: string) => {
    const next = expenses.filter((e) => e.id !== id);
    setExpenses(next);
    await saveExpenses(next);
  };

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  return (
    <ExpensesContext.Provider
      value={{ expenses, loading, addExpense, deleteExpense, total }}
    >
      {children}
    </ExpensesContext.Provider>
  );
}

export function useExpenses() {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error('useExpenses must be used within ExpensesProvider');
  return ctx;
}
