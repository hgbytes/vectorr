import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_FINANCIAL_PROFILE,
  Expense,
  FinancialGoal,
  FinancialProfile,
} from './types';

const STORAGE_KEY = 'expenses';
const PROFILE_STORAGE_KEY = 'financial-profile';
const GOALS_STORAGE_KEY = 'financial-goals';

export async function loadExpenses(): Promise<Expense[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Expense[];
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
    return Array.isArray(parsed) ? (parsed as FinancialGoal[]) : [];
  } catch {
    return [];
  }
}

export async function saveGoals(goals: FinancialGoal[]): Promise<void> {
  await AsyncStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
}
