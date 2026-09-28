export type Category =
  | 'Food'
  | 'Transport'
  | 'Shopping'
  | 'Bills'
  | 'Entertainment'
  | 'Health'
  | 'Other';

export const CATEGORIES: Category[] = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
];

export interface Expense {
  id: string;
  amount: number;
  category: Category;
  note: string;
  date: string; // ISO string
}
