import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_FINANCIAL_PROFILE,
  Expense,
  FinancialGoal,
  FinancialProfile,
} from './types';
import {
  loadExpenses,
  loadFinancialProfile,
  loadGoals,
  saveExpenses,
  saveFinancialProfile,
  saveGoals,
} from './storage';

interface ExpensesContextValue {
  expenses: Expense[];
  loading: boolean;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  total: number;
  profile: FinancialProfile;
  updateProfile: (profile: FinancialProfile) => Promise<void>;
  goals: FinancialGoal[];
  addGoal: (goal: Omit<FinancialGoal, 'id'>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(
  undefined
);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profile, setProfile] = useState<FinancialProfile>(
    DEFAULT_FINANCIAL_PROFILE
  );
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadExpenses(), loadFinancialProfile(), loadGoals()]).then(
      ([expenseData, profileData, goalData]) => {
        setExpenses(expenseData);
        setProfile(profileData);
        setGoals(goalData);
        setLoading(false);
      }
    );
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

  const updateProfile = async (nextProfile: FinancialProfile) => {
    setProfile(nextProfile);
    await saveFinancialProfile(nextProfile);
  };

  const addGoal = async (goal: Omit<FinancialGoal, 'id'>) => {
    const newGoal: FinancialGoal = {
      ...goal,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
    const next = [newGoal, ...goals];
    setGoals(next);
    await saveGoals(next);
  };

  const deleteGoal = async (id: string) => {
    const next = goals.filter((goal) => goal.id !== id);
    setGoals(next);
    await saveGoals(next);
  };

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  return (
    <ExpensesContext.Provider
      value={{
        expenses,
        loading,
        addExpense,
        deleteExpense,
        total,
        profile,
        updateProfile,
        goals,
        addGoal,
        deleteGoal,
      }}
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
