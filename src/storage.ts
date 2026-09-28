import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from './types';

const STORAGE_KEY = 'expenses';

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
