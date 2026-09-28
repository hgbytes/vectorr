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
  updatedAt?: string;
}

export interface FinancialProfile {
  monthlyIncome: number;
  currentSavings: number;
  monthlyDebtPayments: number;
  emergencyFundTarget: number;
  goalContributionBudget: number;
  actualMonthlyGoalContributions: number;
  inflationRate: number;
  expectedAnnualReturn: number;
  incomeGrowthRate: number;
  expenseGrowthRate: number;
  updatedAt?: string;
}

export const DEFAULT_FINANCIAL_PROFILE: FinancialProfile = {
  monthlyIncome: 0,
  currentSavings: 0,
  monthlyDebtPayments: 0,
  emergencyFundTarget: 0,
  goalContributionBudget: 0,
  actualMonthlyGoalContributions: 0,
  inflationRate: 6,
  expectedAnnualReturn: 10,
  incomeGrowthRate: 5,
  expenseGrowthRate: 6,
};

export type GoalPriority = 'Essential' | 'Important' | 'Optional';
export type GoalCategory =
  | 'Emergency'
  | 'Retirement'
  | 'Education'
  | 'Home'
  | 'Debt'
  | 'Custom';
export type GoalDeadlineType = 'Fixed' | 'Flexible';

export const GOAL_CATEGORIES: GoalCategory[] = [
  'Emergency',
  'Retirement',
  'Education',
  'Home',
  'Debt',
  'Custom',
];

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: GoalPriority;
  category: GoalCategory;
  minimumMonthlyContribution: number;
  deadlineType: GoalDeadlineType;
  updatedAt?: string;
}

export interface GoalScenarioResult {
  contribution: number;
  completionDate: string | null;
  projectedValue: number;
  shortfall: number;
}

export interface GoalScenario {
  id: string;
  name: string;
  priorityStrategy: string;
  goalContributions: Record<string, number>;
  projectedResults: Record<string, GoalScenarioResult>;
  conflicts: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface ProgressSnapshot {
  id?: string;
  reviewedAt: string;
  availableGoalBudget: number;
  monthlyExpenses: number;
  totalSaved: number;
  totalTarget: number;
  updatedAt?: string;
}
