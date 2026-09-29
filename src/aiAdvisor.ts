import { supabase } from './supabase';
import { AiInsight, CATEGORIES, Category, Expense, FinancialGoal, FinancialProfile } from './types';

export interface GoalSummary {
  name: string;
  category: string;
  priority: string;
  progressPct: number;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  deadlineType: string;
}

export interface ConflictSummary {
  title: string;
  detail: string;
}

export interface AdvisorSummary {
  monthlyIncome: number;
  monthlyExpenses: number;
  availableGoalBudget: number;
  savingsRate: number;
  debtRatio: number;
  emergencyCoverageMonths: number;
  categoryBreakdown: { category: Category; amount: number; pct: number }[];
  goals: GoalSummary[];
  conflicts: ConflictSummary[];
}

function currentMonthExpenses(expenses: Expense[]) {
  const now = new Date();
  return expenses.filter((expense) => {
    const date = new Date(expense.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
}

export function buildAdvisorSummary(
  goals: FinancialGoal[],
  profile: FinancialProfile,
  expenses: Expense[],
  availableGoalBudget: number,
  monthlyExpenses: number,
  conflicts: ConflictSummary[]
): AdvisorSummary {
  const monthExpenses = currentMonthExpenses(expenses);
  const categoryTotals: Record<Category, number> = {
    Food: 0,
    Transport: 0,
    Shopping: 0,
    Bills: 0,
    Entertainment: 0,
    Health: 0,
    Other: 0,
  };
  for (const expense of monthExpenses) categoryTotals[expense.category] += expense.amount;
  const categoryBreakdown = CATEGORIES.map((category) => ({
    category,
    amount: categoryTotals[category],
    pct: monthlyExpenses > 0 ? Math.round((categoryTotals[category] / monthlyExpenses) * 100) : 0,
  })).filter((item) => item.amount > 0);

  const monthlySurplus = profile.monthlyIncome - monthlyExpenses - profile.monthlyDebtPayments;
  const savingsRate = profile.monthlyIncome > 0 ? Math.max(monthlySurplus, 0) / profile.monthlyIncome * 100 : 0;
  const debtRatio = profile.monthlyIncome > 0 ? (profile.monthlyDebtPayments / profile.monthlyIncome) * 100 : 0;
  const emergencyCoverageMonths = monthlyExpenses > 0 ? profile.currentSavings / monthlyExpenses : 0;

  const goalSummaries: GoalSummary[] = goals.map((goal) => ({
    name: goal.name,
    category: goal.category,
    priority: goal.priority,
    progressPct: goal.targetAmount > 0
      ? Math.round(Math.min(goal.currentAmount / goal.targetAmount, 1) * 100)
      : 0,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate,
    deadlineType: goal.deadlineType,
  }));

  return {
    monthlyIncome: profile.monthlyIncome,
    monthlyExpenses,
    availableGoalBudget,
    savingsRate: Math.round(savingsRate),
    debtRatio: Math.round(debtRatio),
    emergencyCoverageMonths: Math.round(emergencyCoverageMonths * 10) / 10,
    categoryBreakdown,
    goals: goalSummaries,
    conflicts,
  };
}

export interface AiAdvisorResponse {
  insights: AiInsight[];
  generatedAt: string;
}

export async function fetchAiInsights(summary: AdvisorSummary): Promise<AiAdvisorResponse> {
  if (!supabase) throw new Error('Sign in to unlock AI insights.');
  const { data, error } = await supabase.functions.invoke('ai-advisor', {
    body: summary,
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    const body = await context?.json().catch(() => null);
    throw new Error(body?.error ?? error.message ?? 'AI advisor request failed.');
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.insights) throw new Error('AI advisor returned no insights.');
  return { insights: data.insights, generatedAt: data.generatedAt ?? new Date().toISOString() };
}
