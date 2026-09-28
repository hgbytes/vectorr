import { supabase } from './supabase';
import {
  Expense,
  FinancialGoal,
  FinancialProfile,
  GoalScenario,
  ProgressSnapshot,
} from './types';

export interface SyncState {
  expenses: Expense[];
  profile: FinancialProfile;
  goals: FinancialGoal[];
  scenarios: GoalScenario[];
  review: ProgressSnapshot | null;
}

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeRows<T extends { id: string; updatedAt?: string }>(
  local: T[],
  remote: T[]
): T[] {
  const byId = new Map(local.map((row) => [row.id, row]));
  for (const remoteRow of remote) {
    const localRow = byId.get(remoteRow.id);
    if (!localRow || timestamp(remoteRow.updatedAt) > timestamp(localRow.updatedAt)) {
      byId.set(remoteRow.id, remoteRow);
    }
  }
  return Array.from(byId.values());
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message ?? 'Supabase sync failed.');
}

export async function syncUserData(userId: string, local: SyncState): Promise<SyncState> {
  if (!supabase) return local;

  const [profileResult, expensesResult, goalsResult, scenariosResult, reviewResult] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('expenses').select('*').eq('user_id', userId),
      supabase.from('goals').select('*').eq('user_id', userId),
      supabase.from('goal_scenarios').select('*').eq('user_id', userId),
      supabase.from('progress_reviews').select('*').eq('user_id', userId).maybeSingle(),
    ]);
  throwIfError(profileResult.error);
  throwIfError(expensesResult.error);
  throwIfError(goalsResult.error);
  throwIfError(scenariosResult.error);
  throwIfError(reviewResult.error);

  const remoteProfile = profileResult.data
    ? {
        monthlyIncome: Number(profileResult.data.monthly_income),
        currentSavings: Number(profileResult.data.current_savings),
        monthlyDebtPayments: Number(profileResult.data.monthly_debt_payments),
        emergencyFundTarget: Number(profileResult.data.emergency_fund_target),
        goalContributionBudget: Number(profileResult.data.goal_contribution_budget),
        actualMonthlyGoalContributions: Number(profileResult.data.actual_monthly_goal_contributions),
        inflationRate: Number(profileResult.data.inflation_rate),
        expectedAnnualReturn: Number(profileResult.data.expected_annual_return),
        incomeGrowthRate: Number(profileResult.data.income_growth_rate),
        expenseGrowthRate: Number(profileResult.data.expense_growth_rate),
        updatedAt: profileResult.data.updated_at,
      }
    : null;
  const profile = remoteProfile && timestamp(remoteProfile.updatedAt) > timestamp(local.profile.updatedAt)
    ? remoteProfile
    : local.profile;

  const remoteExpenses: Expense[] = (expensesResult.data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    category: row.category,
    note: row.note ?? '',
    date: row.expense_date,
    updatedAt: row.updated_at,
  }));
  const remoteGoals: FinancialGoal[] = (goalsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    targetDate: row.target_date,
    priority: row.priority,
    category: row.category,
    minimumMonthlyContribution: Number(row.minimum_monthly_contribution),
    deadlineType: row.deadline_type,
    updatedAt: row.updated_at,
  }));
  const remoteScenarios: GoalScenario[] = (scenariosResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    priorityStrategy: row.priority_strategy,
    goalContributions: row.goal_contributions ?? {},
    projectedResults: row.projected_results ?? {},
    conflicts: row.conflicts ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const remoteReview: ProgressSnapshot | null = reviewResult.data
    ? {
        id: 'current',
        reviewedAt: reviewResult.data.reviewed_at,
        availableGoalBudget: Number(reviewResult.data.available_goal_budget),
        monthlyExpenses: Number(reviewResult.data.monthly_expenses),
        totalSaved: Number(reviewResult.data.total_saved),
        totalTarget: Number(reviewResult.data.total_target),
        updatedAt: reviewResult.data.updated_at,
      }
    : null;

  const merged = {
    expenses: mergeRows(local.expenses, remoteExpenses),
    goals: mergeRows(local.goals, remoteGoals),
    scenarios: mergeRows(local.scenarios, remoteScenarios),
    profile,
    review: remoteReview && (!local.review || timestamp(remoteReview.updatedAt) > timestamp(local.review.updatedAt))
      ? remoteReview
      : local.review,
  };

  throwIfError(
    (await supabase.from('profiles').upsert({
      user_id: userId,
      monthly_income: merged.profile.monthlyIncome,
      current_savings: merged.profile.currentSavings,
      monthly_debt_payments: merged.profile.monthlyDebtPayments,
      emergency_fund_target: merged.profile.emergencyFundTarget,
      goal_contribution_budget: merged.profile.goalContributionBudget,
      actual_monthly_goal_contributions: merged.profile.actualMonthlyGoalContributions,
      inflation_rate: merged.profile.inflationRate,
      expected_annual_return: merged.profile.expectedAnnualReturn,
      income_growth_rate: merged.profile.incomeGrowthRate,
      expense_growth_rate: merged.profile.expenseGrowthRate,
      updated_at: merged.profile.updatedAt ?? new Date().toISOString(),
    })).error
  );
  throwIfError(
    (await supabase.from('expenses').upsert(
      merged.expenses.map((expense) => ({
        id: expense.id,
        user_id: userId,
        amount: expense.amount,
        category: expense.category,
        note: expense.note,
        expense_date: expense.date,
        updated_at: expense.updatedAt ?? new Date().toISOString(),
      }))
    )).error
  );
  throwIfError(
    (await supabase.from('goals').upsert(
      merged.goals.map((goal) => ({
        id: goal.id,
        user_id: userId,
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount,
        target_date: goal.targetDate,
        priority: goal.priority,
        category: goal.category,
        minimum_monthly_contribution: goal.minimumMonthlyContribution,
        deadline_type: goal.deadlineType,
        updated_at: goal.updatedAt ?? new Date().toISOString(),
      }))
    )).error
  );
  throwIfError(
    (await supabase.from('goal_scenarios').upsert(
      merged.scenarios.map((scenario) => ({
        id: scenario.id,
        user_id: userId,
        name: scenario.name,
        priority_strategy: scenario.priorityStrategy,
        goal_contributions: scenario.goalContributions,
        projected_results: scenario.projectedResults,
        conflicts: scenario.conflicts,
        created_at: scenario.createdAt,
        updated_at: scenario.updatedAt ?? new Date().toISOString(),
      }))
    )).error
  );
  if (merged.review) {
    throwIfError(
      (await supabase.from('progress_reviews').upsert({
        user_id: userId,
        reviewed_at: merged.review.reviewedAt,
        available_goal_budget: merged.review.availableGoalBudget,
        monthly_expenses: merged.review.monthlyExpenses,
        total_saved: merged.review.totalSaved,
        total_target: merged.review.totalTarget,
        updated_at: merged.review.updatedAt ?? new Date().toISOString(),
      })).error
    );
  }

  return merged;
}
