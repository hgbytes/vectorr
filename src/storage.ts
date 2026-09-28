import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_FINANCIAL_PROFILE,
  Expense,
  GoalCategory,
  GoalDeadlineType,
  FinancialGoal,
  FinancialProfile,
  GoalScenario,
  ProgressSnapshot,
} from './types';

const STORAGE_KEY = 'expenses';
const PROFILE_STORAGE_KEY = 'financial-profile';
const GOALS_STORAGE_KEY = 'financial-goals';
const REVIEW_STORAGE_KEY = 'financial-review';
const SCENARIOS_STORAGE_KEY = 'financial-scenarios';

export async function loadExpenses(): Promise<Expense[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Expense[]).map((expense) => ({
      ...expense,
      updatedAt: expense.updatedAt ?? expense.date,
    }));
  } catch {
    return [];
  }
}

export async function saveExpenses(expenses: Expense[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export async function loadFinancialProfile(): Promise<FinancialProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return DEFAULT_FINANCIAL_PROFILE;
  try {
    return { ...DEFAULT_FINANCIAL_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FINANCIAL_PROFILE;
  }
}

export async function saveFinancialProfile(
  profile: FinancialProfile
): Promise<void> {
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export async function loadGoals(): Promise<FinancialGoal[]> {
  const raw = await AsyncStorage.getItem(GOALS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((goal) => ({
      ...goal,
      category: (goal.category ?? 'Custom') as GoalCategory,
      minimumMonthlyContribution: Number(goal.minimumMonthlyContribution ?? 0),
      deadlineType: (goal.deadlineType ?? 'Fixed') as GoalDeadlineType,
      updatedAt: goal.updatedAt ?? new Date().toISOString(),
    })) as FinancialGoal[];
  } catch {
    return [];
  }
}

export async function saveGoals(goals: FinancialGoal[]): Promise<void> {
  await AsyncStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
}

export async function loadProgressSnapshot(): Promise<ProgressSnapshot | null> {
  const raw = await AsyncStorage.getItem(REVIEW_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProgressSnapshot;
    return { ...parsed, id: parsed.id ?? 'current', updatedAt: parsed.updatedAt ?? parsed.reviewedAt };
  } catch {
    return null;
  }
}

export async function saveProgressSnapshot(
  snapshot: ProgressSnapshot
): Promise<void> {
  await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(snapshot));
}

export async function loadGoalScenarios(): Promise<GoalScenario[]> {
  const raw = await AsyncStorage.getItem(SCENARIOS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as GoalScenario[]).map((scenario) => ({
          ...scenario,
          updatedAt: scenario.updatedAt ?? scenario.createdAt,
        }))
      : [];
  } catch {
    return [];
  }
}

export async function saveGoalScenarios(scenarios: GoalScenario[]): Promise<void> {
  await AsyncStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(scenarios));
}
