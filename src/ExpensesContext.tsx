import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import {
  DEFAULT_FINANCIAL_PROFILE,
  Expense,
  FinancialGoal,
  FinancialProfile,
  GoalScenario,
  ProgressSnapshot,
} from './types';
import {
  loadExpenses,
  loadFinancialProfile,
  loadGoals,
  loadProgressSnapshot,
  loadGoalScenarios,
  saveExpenses,
  saveFinancialProfile,
  saveGoals,
  saveProgressSnapshot,
  saveGoalScenarios,
} from './storage';
import { isSupabaseConfigured, supabase } from './supabase';
import { SyncState, syncUserData } from './sync';

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
  updateGoal: (
    id: string,
    changes: Partial<Omit<FinancialGoal, 'id'>>
  ) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  scenarios: GoalScenario[];
  saveScenario: (scenario: Omit<GoalScenario, 'id' | 'createdAt'>) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
  authUser: User | null;
  authLoading: boolean;
  authEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  lastReview: ProgressSnapshot | null;
  recordReview: (snapshot: ProgressSnapshot) => Promise<void>;
  syncing: boolean;
  syncError: string | null;
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
  const [lastReview, setLastReview] = useState<ProgressSnapshot | null>(null);
  const [scenarios, setScenarios] = useState<GoalScenario[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadExpenses(),
      loadFinancialProfile(),
      loadGoals(),
      loadProgressSnapshot(),
      loadGoalScenarios(),
    ]).then(
      ([expenseData, profileData, goalData, reviewData, scenarioData]) => {
        setExpenses(expenseData);
        setProfile(profileData);
        setGoals(goalData);
        setLastReview(reviewData);
        setScenarios(scenarioData);
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!authUser || loading) return;
    void syncState({
      expenses,
      profile,
      goals,
      scenarios,
      review: lastReview,
      });
      }, [authUser, loading]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const syncState = async (state: SyncState) => {
    if (!authUser) return;
    setSyncing(true);
    try {
      const merged = await syncUserData(authUser.id, state);
      setExpenses(merged.expenses);
      setProfile(merged.profile);
      setGoals(merged.goals);
      setScenarios(merged.scenarios);
      setLastReview(merged.review);
      await Promise.all([
        saveExpenses(merged.expenses),
        saveFinancialProfile(merged.profile),
        saveGoals(merged.goals),
        saveGoalScenarios(merged.scenarios),
        merged.review ? saveProgressSnapshot(merged.review) : Promise.resolve(),
      ]);
      setSyncError(null);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Cloud sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expense,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      updatedAt: new Date().toISOString(),
    };
    const next = [newExpense, ...expenses];
    setExpenses(next);
    await saveExpenses(next);
    await syncState({ expenses: next, profile, goals, scenarios, review: lastReview });
  };

  const deleteExpense = async (id: string) => {
    const next = expenses.map((expense) =>
      expense.id === id
        ? { ...expense, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : expense
    );
    setExpenses(next);
    await saveExpenses(next);
    await syncState({ expenses: next, profile, goals, scenarios, review: lastReview });
  };

  const updateProfile = async (nextProfile: FinancialProfile) => {
    const updated = { ...nextProfile, updatedAt: new Date().toISOString() };
    setProfile(updated);
    await saveFinancialProfile(updated);
    await syncState({ expenses, profile: updated, goals, scenarios, review: lastReview });
  };

  const addGoal = async (goal: Omit<FinancialGoal, 'id'>) => {
    const newGoal: FinancialGoal = {
      ...goal,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      updatedAt: new Date().toISOString(),
    };
    const next = [newGoal, ...goals];
    setGoals(next);
    await saveGoals(next);
    await syncState({ expenses, profile, goals: next, scenarios, review: lastReview });
  };

  const updateGoal = async (
    id: string,
    changes: Partial<Omit<FinancialGoal, 'id'>>
  ) => {
    const next = goals.map((goal) =>
      goal.id === id
        ? { ...goal, ...changes, updatedAt: new Date().toISOString() }
        : goal
    );
    setGoals(next);
    await saveGoals(next);
    await syncState({ expenses, profile, goals: next, scenarios, review: lastReview });
  };

  const deleteGoal = async (id: string) => {
    const next = goals.map((goal) =>
      goal.id === id
        ? { ...goal, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : goal
    );
    setGoals(next);
    await saveGoals(next);
    await syncState({ expenses, profile, goals: next, scenarios, review: lastReview });
  };

  const recordReview = async (snapshot: ProgressSnapshot) => {
    const updated = {
      ...snapshot,
      id: snapshot.id ?? 'current',
      updatedAt: new Date().toISOString(),
    };
    setLastReview(updated);
    await saveProgressSnapshot(updated);
    await syncState({ expenses, profile, goals, scenarios, review: updated });
  };

  const saveScenario = async (
    scenario: Omit<GoalScenario, 'id' | 'createdAt'>
  ) => {
    const saved: GoalScenario = {
      ...scenario,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [saved, ...scenarios];
    setScenarios(next);
    await saveGoalScenarios(next);
    await syncState({ expenses, profile, goals, scenarios: next, review: lastReview });
  };

  const deleteScenario = async (id: string) => {
    const next = scenarios.map((scenario) =>
      scenario.id === id
        ? { ...scenario, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : scenario
    );
    setScenarios(next);
    await saveGoalScenarios(next);
    await syncState({ expenses, profile, goals, scenarios: next, review: lastReview });
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  return (
    <ExpensesContext.Provider
      value={{
        expenses: expenses.filter((expense) => !expense.deletedAt),
        loading,
        addExpense,
        deleteExpense,
        total,
        profile,
        updateProfile,
        goals: goals.filter((goal) => !goal.deletedAt),
        addGoal,
        updateGoal,
        deleteGoal,
        lastReview,
        recordReview,
        scenarios: scenarios.filter((scenario) => !scenario.deletedAt),
        saveScenario,
        deleteScenario,
        authUser,
        authLoading,
        authEnabled: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        syncing,
        syncError,
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
